"""设备接口: CRUD、状态、控制指令。

- POST /devices 校验 name 与 device_type 必填; device_type 只允许
  router/speaker/light/climate/water_heater/other; model 未知写 UNKNOWN;
  ha_entity_id 与 compatibility_grade 初始为空。
- POST /devices/{id}/commands: 危险参数先于设备存在性校验拒绝 (422),
  并记审计; HA 未接入时记录状态直接为 UNKNOWN, HTTP 202 返回该记录。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from auth import require_role
from db import parse_uuid, require_pool
from errors import ApiError
from routers.common import page_params, paginated
from services import device_service
from services.audit import write_audit

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceCreate(BaseModel):
    name: str
    device_type: str
    room_id: str | None = None
    integration_id: str | None = None
    brand: str | None = None
    model: str | None = None


class DeviceUpdate(BaseModel):
    name: str | None = None
    room_id: str | None = None
    integration_id: str | None = None
    brand: str | None = None
    model: str | None = None
    device_type: str | None = None
    compatibility_grade: str | None = None
    is_online: bool | None = None


class CommandCreate(BaseModel):
    action: str
    params: dict = {}


@router.get("")
async def list_devices(
    request: Request,
    pagination: tuple = Depends(page_params),
    room_id: str | None = Query(None),
    device_type: str | None = Query(None),
    brand: str | None = Query(None),
):
    pool = require_pool(request)
    page, page_size = pagination
    items, total = await device_service.list_devices(
        pool, room_id, device_type, brand, page, page_size
    )
    return paginated(items, total, page, page_size)


@router.post("", dependencies=[Depends(require_role("Admin"))])
async def create_device(request: Request, body: DeviceCreate):
    pool = require_pool(request)
    return await device_service.create_device(pool, body.model_dump())


@router.get("/{device_id}")
async def get_device(request: Request, device_id: str):
    pool = require_pool(request)
    return await device_service.get_device_or_404(pool, device_id)


@router.patch("/{device_id}", dependencies=[Depends(require_role("Admin"))])
async def update_device(request: Request, device_id: str, body: DeviceUpdate):
    pool = require_pool(request)
    return await device_service.update_device(
        pool, device_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{device_id}", dependencies=[Depends(require_role("Admin"))])
async def delete_device(request: Request, device_id: str):
    pool = require_pool(request)
    return await device_service.delete_device(pool, device_id)


@router.get("/{device_id}/state")
async def get_device_state(request: Request, device_id: str):
    pool = require_pool(request)
    return await device_service.get_device_state(pool, device_id)


@router.post(
    "/{device_id}/commands",
    status_code=202,
    dependencies=[Depends(require_role("Member"))],
)
async def create_command(request: Request, device_id: str, body: CommandCreate):
    if not body.action or not body.action.strip():
        raise ApiError(422, "validation_error", "action 必填", None)
    # 危险参数校验在接口层先行, 优先于数据库可用性 (503) 与设备存在性 (404):
    # 假 device_id + 危险参数 -> 422; 假 device_id + 安全参数 -> 404 (有库时)。
    forbidden = device_service.find_forbidden_keys(body.params or {})
    if forbidden:
        await write_audit(
            getattr(request.app.state, "pool", None),
            "device.control.rejected",
            "device",
            parse_uuid(device_id),
            {"action": body.action.strip(), "forbidden_keys": forbidden},
        )
        raise device_service.DangerousParamsError(forbidden)
    pool = require_pool(request)
    return await device_service.create_command(
        pool, device_id, body.action.strip(), body.params or {}
    )


@router.get("/{device_id}/commands")
async def list_commands(request: Request, device_id: str, pagination: tuple = Depends(page_params)):
    pool = require_pool(request)
    page, page_size = pagination
    items, total = await device_service.list_commands(pool, device_id, page, page_size)
    return paginated(items, total, page, page_size)


@router.get("/{device_id}/commands/{command_id}")
async def get_command(request: Request, device_id: str, command_id: str):
    pool = require_pool(request)
    return await device_service.get_command(pool, device_id, command_id)
