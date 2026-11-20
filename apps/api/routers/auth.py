"""登录鉴权接口。

- GET  /auth/status         -> {"setup_required": bool} (公开)
- POST /auth/setup          -> 仅用户表为空时建第一个 owner, 否则 403 (公开)
- POST /auth/login          -> 用户名+密码, 返回 JWT (公开, 限流)
- GET  /auth/me             -> 当前登录用户 (需登录)
- POST /auth/change-password -> 改自己的密码 (需登录)

密码最短 8 位; 用户名 1-64 字符。登录失败统一报"用户名或密码错误",
不区分账号不存在还是密码错误。审计日志只记动作与用户名, 绝不记密码。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator

from auth import (
    check_login_rate_limit,
    client_ip,
    create_token,
    get_current_user,
    hash_password,
    record_login_failure,
    record_login_success,
    verify_password,
)
from db import require_pool
from errors import ApiError
from services.audit import write_audit

router = APIRouter(tags=["auth"])

_TOKEN_TTL_SECONDS = 7 * 24 * 3600


class SetupBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def _strip_username(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class LoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def _strip_username(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class ChangePasswordBody(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


def _public_user(row) -> dict:
    """对外返回的用户字段 (绝不含 password_hash)。"""
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "role": row["role"],
    }


def _token_response(row) -> dict:
    user = _public_user(row)
    return {
        "token": create_token(user["id"], user["username"], user["role"]),
        "token_type": "bearer",
        "expires_in": _TOKEN_TTL_SECONDS,
        "user": user,
    }


@router.get("/auth/status")
async def auth_status(request: Request) -> dict:
    """是否需要首次设置 (用户表无有效用户时为 true)。"""
    pool = require_pool(request)
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL"
        )
    return {"setup_required": int(count or 0) == 0}


@router.post("/auth/setup")
async def auth_setup(request: Request, body: SetupBody) -> dict:
    """建第一个 owner 账号; 用户表非空时 403。

    事务内对 users 表加排他锁后再计数, 防止两个并发 setup 同时建出账号。
    密码先在事务外哈希, 锁只持有极短时间。成功后直接返回 JWT (即登即用)。
    """
    password_hash = hash_password(body.password)
    pool = require_pool(request)
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("LOCK TABLE users IN EXCLUSIVE MODE")
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL"
            )
            if int(count or 0) > 0:
                raise ApiError(403, "forbidden", "已存在管理员账号，无法重复设置", None)
            row = await conn.fetchrow(
                "INSERT INTO users (username, password_hash, role, is_owner, is_active)"
                " VALUES ($1, $2, 'owner', TRUE, TRUE)"
                " RETURNING id, username, role",
                body.username,
                password_hash,
            )
    await write_audit(
        pool,
        "auth.setup",
        "user",
        row["id"],
        {"actor": "user:{}".format(body.username), "username": body.username},
    )
    return _token_response(row)


@router.post("/auth/login")
async def auth_login(request: Request, body: LoginBody) -> dict:
    """用户名+密码登录, 返回 JWT。失败统一 401, 不区分原因。"""
    ip = client_ip(request)
    check_login_rate_limit(ip)
    pool = require_pool(request)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, username, password_hash, role, is_active FROM users"
            " WHERE username = $1 AND deleted_at IS NULL",
            body.username,
        )
    if (
        row is None
        or not row["is_active"]
        or not verify_password(row["password_hash"], body.password)
    ):
        record_login_failure(ip)
        await write_audit(
            pool,
            "auth.login_failed",
            "user",
            row["id"] if row is not None else None,
            {"actor": "user:{}".format(body.username), "username": body.username},
        )
        raise ApiError(401, "unauthorized", "用户名或密码错误", None)
    record_login_success(ip)
    await write_audit(
        pool,
        "auth.login",
        "user",
        row["id"],
        {"actor": "user:{}".format(body.username), "username": body.username},
    )
    return _token_response(row)


@router.get("/auth/me")
async def auth_me(request: Request, user: dict = Depends(get_current_user)) -> dict:
    """当前登录用户 (id/username/role)。"""
    return {"id": user["id"], "username": user["username"], "role": user["role"]}


@router.post("/auth/change-password")
async def auth_change_password(
    request: Request,
    body: ChangePasswordBody,
    user: dict = Depends(get_current_user),
) -> dict:
    """改自己的密码: 先验旧密码, 再写新哈希。"""
    pool = require_pool(request)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, password_hash FROM users"
            " WHERE id = $1 AND deleted_at IS NULL",
            user["id"],
        )
    if row is None or not verify_password(
        row["password_hash"], body.current_password
    ):
        raise ApiError(401, "unauthorized", "当前密码不正确", None)
    new_hash = hash_password(body.new_password)
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2",
            new_hash,
            row["id"],
        )
    await write_audit(
        pool,
        "auth.change_password",
        "user",
        row["id"],
        {"actor": "user:{}".format(user["username"])},
    )
    return {"ok": True}
