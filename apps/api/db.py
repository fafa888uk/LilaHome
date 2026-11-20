"""Lila Home 数据库层: asyncpg 连接池 + 启动时建表。

- 连接参数复用 v0.1 健康检查的同一套环境变量
  (PGHOST/PGUSER/PGPASSWORD/PGDATABASE 优先, 否则 DATABASE_URL)。
- 启动时执行 CREATE TABLE IF NOT EXISTS (字段取 DATABASE_DESIGN.md 草案的子集)。
- 种子数据只做两项: roles 4 行; integrations 7 行 (全部 is_enabled=false)。
  不种子任何设备、房间、场景、用户。
- 建表/种子失败不抛到启动流程外: 由 main.py 的 lifespan 捕获后以无库模式运行,
  业务接口此时返回 503 db_unavailable。
"""

from __future__ import annotations

import datetime
import json
import os
import uuid

import asyncpg

from errors import db_unavailable

DDL = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'member')),
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
-- 注意: username 唯一索引不在 DDL 里建: 已部署的库在 DDL 执行时
-- username 列尚未加上 (由 init_db 迁移段后加), 在此建索引会报
-- column "username" does not exist, 导致整个 init_db 失败、服务进无库模式。
-- 索引统一由 init_db 迁移段在 ADD COLUMN 之后建 (新库旧库都走同一段)。

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    kind VARCHAR(50) NOT NULL,
    protocol VARCHAR(50),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    config_ref VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id),
    integration_id UUID REFERENCES integrations(id),
    name VARCHAR(100) NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(100),
    device_type VARCHAR(50) NOT NULL
        CHECK (device_type IN ('router', 'speaker', 'light', 'climate', 'water_heater', 'other')),
    ha_entity_id VARCHAR(255) UNIQUE,
    compatibility_grade CHAR(1),
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_devices_room_id ON devices(room_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);

CREATE TABLE IF NOT EXISTS device_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id),
    state JSONB NOT NULL,
    source VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_states_device_recorded
    ON device_states(device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id),
    user_id UUID REFERENCES users(id),
    command JSONB NOT NULL,
    status VARCHAR(30) NOT NULL,
    ha_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_device_commands_device_created
    ON device_commands(device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rules JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS scene_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id),
    device_id UUID NOT NULL REFERENCES devices(id),
    action JSONB NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scene_actions_scene_sort
    ON scene_actions(scene_id, sort_order);

CREATE TABLE IF NOT EXISTS scene_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id),
    triggered_by UUID REFERENCES users(id),
    status VARCHAR(30) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    result JSONB
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    detail JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
    ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs(created_at DESC);
"""

# 种子: 角色 4 行 (只做这一项 + 集成种子, 不种子设备/房间/场景/用户)。
SEED_ROLES = [
    ("Owner", "全部权限: 用户管理、角色管理、安全设置、审计日志、设备与场景管理"),
    ("Admin", "设备、房间、场景、集成管理; 不可改用户角色、不可改安全设置"),
    ("Member", "控制已授权的设备、执行场景、查看状态"),
    ("Viewer", "只读: 查看状态与历史, 不可控制"),
]

# 种子: 集成 7 行, 全部 is_enabled=false (未接入, 只作登记)。
# kind/protocol 为登记用的分类信息, 不代表已验证可用。
SEED_INTEGRATIONS = [
    ("midea", "community", "LAN API"),
    ("xiaomi_miot", "community", "云 API"),
    ("matter", "official", "Matter"),
    ("homekit_controller", "official", "HomeKit"),
    ("xiaomi_miio", "community", "LAN API"),
    ("zigbee2mqtt", "community", "MQTT"),
    ("esphome", "official", "API"),
]


async def create_pool() -> asyncpg.Pool | None:
    """建 asyncpg 连接池; 未配置连接信息时返回 None (无库模式)。"""
    password = os.environ.get("PGPASSWORD")
    dsn = os.environ.get("DATABASE_URL")
    if password is not None:
        return await asyncpg.create_pool(
            host=os.environ.get("PGHOST", "db"),
            port=int(os.environ.get("PGPORT", "5432")),
            user=os.environ.get("PGUSER", "lila_home"),
            password=password,
            database=os.environ.get("PGDATABASE", "lila_home"),
            min_size=1,
            max_size=5,
            timeout=5,
        )
    if dsn:
        return await asyncpg.create_pool(
            dsn, min_size=1, max_size=5, timeout=5
        )
    return None


async def init_db(pool: asyncpg.Pool) -> None:
    """建表 (IF NOT EXISTS) + 种子数据。幂等, 可重复执行。"""
    async with pool.acquire() as conn:
        await conn.execute(DDL)
        # 状态列加宽: "completed_with_unknown" 为 21 字符, 旧的 VARCHAR(20) 装不下。
        # 对已建好的库做幂等拓宽 (只加宽, 不改已有数据)。
        await conn.execute(
            "ALTER TABLE scene_runs ALTER COLUMN status TYPE VARCHAR(30)"
        )
        await conn.execute(
            "ALTER TABLE device_commands ALTER COLUMN status TYPE VARCHAR(30)"
        )
        # 登录落地 (2026-11-20): users 表加 username/role; email 改为可空。
        # 已部署的库用以下 ALTER 幂等迁移; 新库直接由上面 DDL 建出新结构。
        await conn.execute(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100)"
        )
        await conn.execute(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS"
            " role VARCHAR(20) NOT NULL DEFAULT 'member'"
        )
        await conn.execute(
            "ALTER TABLE users ALTER COLUMN email DROP NOT NULL"
        )
        await conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active"
            " ON users (username) WHERE deleted_at IS NULL"
        )
        await conn.execute(
            "UPDATE users SET role = 'owner'"
            " WHERE is_owner IS TRUE AND role <> 'owner'"
        )
        await conn.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'users_role_check'
                ) THEN
                    ALTER TABLE users ADD CONSTRAINT users_role_check
                        CHECK (role IN ('owner', 'member'));
                END IF;
            END $$;
            """
        )
        for name, description in SEED_ROLES:
            await conn.execute(
                "INSERT INTO roles (name, description) VALUES ($1, $2)"
                " ON CONFLICT (name) DO NOTHING",
                name,
                description,
            )
        for name, kind, protocol in SEED_INTEGRATIONS:
            await conn.execute(
                "INSERT INTO integrations (name, kind, protocol, is_enabled)"
                " VALUES ($1, $2, $3, FALSE)"
                " ON CONFLICT (name) DO NOTHING",
                name,
                kind,
                protocol,
            )


def require_pool(request) -> asyncpg.Pool:
    """取请求上的连接池; 无库模式下抛 503 db_unavailable。"""
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise db_unavailable("未配置数据库连接信息或连接失败, 服务以无库模式运行")
    return pool


def row_to_dict(row) -> dict:
    """asyncpg Record -> 可 JSON 序列化的 dict (UUID/datetime 转字符串)。"""
    out: dict = {}
    for key, value in dict(row).items():
        if isinstance(value, uuid.UUID):
            out[key] = str(value)
        elif isinstance(value, datetime.datetime):
            out[key] = value.isoformat()
        elif isinstance(value, datetime.date):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


def parse_uuid(value: str | None):
    """解析 UUID 字符串; 解析失败返回 None (调用处按 404 处理)。"""
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def to_jsonb(value):
    """dict/list -> JSON 字符串 (asyncpg 的 jsonb 参数只接受 str, 不接受 dict)。
    None 与 str 原样返回。"""
    if value is None or isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def from_jsonb(value):
    """asyncpg 默认把 jsonb 读成 str, 这里还原成 dict/list。"""
    if value is None or isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value
