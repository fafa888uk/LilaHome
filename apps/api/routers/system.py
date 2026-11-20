"""聚合视图与系统接口。

- GET /lights、/climate、/water-heaters、/speakers: 按 device_type 过滤
  devices 表; 每个设备带 status "not_connected"; 空表返回 []。
- GET /network/devices: 路由器集成未接入, 只读监控待接入后可用。
- GET /system/health: 与 /health 同样内容 (同一套 run_checks)。
- GET /audit-logs: 分页, 默认 20。
- GET /integrations: 种子列表, 带 is_enabled 与 status "not_connected"。
- GET /users: users 表, 当前为空返回 [] (绝不返回 password_hash)。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from db import from_jsonb, require_pool, row_to_dict
from routers.common import page_params, paginated
from services import device_service
from services.health_checks import run_checks

router = APIRouter(tags=["views", "system"])


async def _view(request: Request, device_type: str, pagination: tuple):
    pool = require_pool(request)
    page, page_size = pagination
    items, _total = await device_service.list_by_type(
        pool, device_type, page, page_size
    )
    return items


@router.get("/lights")
async def list_lights(request: Request, pagination: tuple = Depends(page_params)):
    return await _view(request, "light", pagination)


@router.get("/climate")
async def list_climate(request: Request, pagination: tuple = Depends(page_params)):
    return await _view(request, "climate", pagination)


@router.get("/water-heaters")
async def list_water_heaters(request: Request, pagination: tuple = Depends(page_params)):
    return await _view(request, "water_heater", pagination)


@router.get("/speakers")
async def list_speakers(request: Request, pagination: tuple = Depends(page_params)):
    return await _view(request, "speaker", pagination)


@router.get("/network/devices")
async def list_network_devices():
    return {
        "status": "not_connected",
        "devices": [],
        "detail": "路由器集成未接入，只读监控待接入后可用",
    }


@router.get("/system/health")
async def system_health(request: Request) -> dict:
    # 与 /health 同样内容: 同一套 run_checks, 同样的 overall 判定。
    checks = await run_checks()
    overall = (
        "ok"
        if checks["database"]["status"] == "ok"
        and checks["mqtt"]["status"] == "ok"
        else "degraded"
    )
    return {"status": overall, "version": request.app.version, "checks": checks}


@router.get("/audit-logs")
async def list_audit_logs(request: Request, pagination: tuple = Depends(page_params)):
    pool = require_pool(request)
    page, page_size = pagination
    offset = (page - 1) * page_size
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM audit_logs")
        rows = await conn.fetch(
            "SELECT * FROM audit_logs ORDER BY created_at DESC"
            " LIMIT $1 OFFSET $2",
            page_size,
            offset,
        )
    rows = [row_to_dict(r) for r in rows]
    for item in rows:
        item["detail"] = from_jsonb(item.get("detail"))
    return paginated(rows, int(total or 0), page, page_size)


@router.get("/integrations")
async def list_integrations(request: Request):
    pool = require_pool(request)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM integrations ORDER BY name ASC"
        )
    items = []
    for row in rows:
        item = row_to_dict(row)
        item["status"] = "not_connected"
        # 前端读取的别名字段, 值与规范字段一致。
        item["type"] = row["kind"]
        item["enabled"] = row["is_enabled"]
        items.append(item)
    return items


@router.get("/users")
async def list_users(request: Request):
    pool = require_pool(request)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, email, display_name, is_owner, is_active,"
            " created_at, updated_at, deleted_at FROM users"
            " WHERE deleted_at IS NULL ORDER BY created_at ASC"
        )
    return [row_to_dict(r) for r in rows]
