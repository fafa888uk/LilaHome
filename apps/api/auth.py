"""Lila Home 登录鉴权 (JWT)。

- 密码: Argon2id 哈希 (argon2-cffi 默认即 Argon2id), 绝不存明文。
- Token: JWT HS256, 密钥来自环境变量 LILA_JWT_SECRET (只存在服务器 .env,
  绝不进仓库、绝不打印); 有效期 7 天。
- 角色: token 里 role 为 owner/member; require_role 接到该角色上
  (owner 映射为 Owner, member 映射为 Member; 旧脚手架的 Viewer/Admin
  档位保留在 ROLE_ORDER 里, 目前无对应账号)。
- 中间件 (main.py) 在 /api/v1/* 上验签并把用户信息写进 request.state;
  本模块的 get_current_user/get_current_role 从 state 取。
- 登录限流: 内存计数, 同一 IP 连续失败 10 次后 429 锁 5 分钟。
"""

from __future__ import annotations

import datetime
import os
import time

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Request

from errors import ApiError

ROLE_ORDER = {"Viewer": 0, "Member": 1, "Admin": 2, "Owner": 3}

# token role (小写) -> require_role 用的档位名。
_ROLE_MAP = {"owner": "Owner", "member": "Member"}

_TOKEN_TTL_SECONDS = 7 * 24 * 3600
_MAX_LOGIN_FAILURES = 10
_LOGIN_LOCK_SECONDS = 300

_ph = PasswordHasher()

# {ip: {"count": int, "locked_until": float(monotonic)}}
_LOGIN_ATTEMPTS: dict[str, dict] = {}


def hash_password(password: str) -> str:
    """Argon2id 哈希 (argon2-cffi 默认参数即 Argon2id)。"""
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """校验密码; 哈希格式非法或不匹配都返回 False, 不抛错、不区分原因。"""
    try:
        return bool(_ph.verify(password_hash, password))
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def get_jwt_secret() -> str:
    """取 JWT 密钥; 未配置时 503 (fail-closed, 绝不用默认密钥)。"""
    secret = os.environ.get("LILA_JWT_SECRET")
    if not secret:
        raise ApiError(503, "auth_not_configured", "未配置登录密钥", None)
    return secret


def create_token(user_id: str, username: str, role: str) -> str:
    """签发 JWT (HS256, 7 天有效)。"""
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + datetime.timedelta(seconds=_TOKEN_TTL_SECONDS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def decode_token(token: str) -> dict:
    """验签并解码 JWT; 过期/篡改/密钥未配置时抛 ApiError (401/503)。"""
    try:
        return jwt.decode(
            token, get_jwt_secret(), algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "unauthorized", "登录已过期，请重新登录", None)
    except jwt.InvalidTokenError:
        raise ApiError(401, "unauthorized", "未登录或登录已过期", None)


def client_ip(request: Request) -> str:
    """取客户端 IP: 优先 X-Forwarded-For 首项 (经两层 nginx 转发),
    否则取直连地址; 取不到返回 unknown (限流仍按该键计数)。"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


def check_login_rate_limit(ip: str) -> None:
    """登录前检查: 锁定期内直接 429, 不再查库、不再验密码。"""
    entry = _LOGIN_ATTEMPTS.get(ip)
    if entry is not None and entry["locked_until"] > time.monotonic():
        raise ApiError(
            429, "too_many_requests", "登录失败次数过多，请 5 分钟后再试", None
        )


def record_login_failure(ip: str) -> None:
    """记一次登录失败; 连续 10 次后锁 5 分钟。"""
    entry = _LOGIN_ATTEMPTS.get(ip)
    if entry is None:
        entry = {"count": 0, "locked_until": 0.0}
        _LOGIN_ATTEMPTS[ip] = entry
    entry["count"] = int(entry["count"]) + 1
    if int(entry["count"]) >= _MAX_LOGIN_FAILURES:
        entry["locked_until"] = time.monotonic() + _LOGIN_LOCK_SECONDS
        entry["count"] = 0


def record_login_success(ip: str) -> None:
    """登录成功清零该 IP 的失败计数。"""
    _LOGIN_ATTEMPTS.pop(ip, None)


def get_current_user(request: Request) -> dict:
    """取中间件写入 request.state 的当前用户; 无则 401。

    返回 {"id", "username", "role"} (role 为 owner/member 小写)。
    """
    user = getattr(request.state, "user", None)
    if not isinstance(user, dict) or not user.get("id"):
        raise ApiError(401, "unauthorized", "未登录或登录已过期", None)
    return user


async def get_current_role(request: Request) -> str:
    """当前用户档位 (Owner/Member), 供 require_role 使用; 未登录抛 401。"""
    user = get_current_user(request)
    return _ROLE_MAP.get(str(user.get("role", "")).lower(), "Viewer")


def require_role(minimum: str):
    """要求至少达到指定档位; 角色取自 JWT (经中间件验签)。

    只有 owner (Owner 档) 能过 Admin 级写操作; member (Member 档)
    能过 Member 级操作 (设备控制、执行场景)。
    """

    async def checker(request: Request) -> str:
        role = await get_current_role(request)
        if ROLE_ORDER.get(role, -1) < ROLE_ORDER.get(minimum, 99):
            raise ApiError(403, "forbidden", "无该操作的权限", None)
        return role

    return checker
