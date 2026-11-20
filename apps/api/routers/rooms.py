"""房间接口: GET/POST/PATCH/DELETE /rooms。删除为软删除。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from auth import require_role
from db import require_pool
from routers.common import page_params, paginated
from services import room_service

router = APIRouter(prefix="/rooms", tags=["rooms"])


class RoomCreate(BaseModel):
    name: str
    sort_order: int = 0


class RoomUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None


@router.get("")
async def list_rooms(request: Request, pagination: tuple = Depends(page_params)):
    pool = require_pool(request)
    page, page_size = pagination
    items, total = await room_service.list_rooms(pool, page, page_size)
    return paginated(items, total, page, page_size)


@router.post("", dependencies=[Depends(require_role("Admin"))])
async def create_room(request: Request, body: RoomCreate):
    pool = require_pool(request)
    return await room_service.create_room(pool, body.model_dump())


@router.patch("/{room_id}", dependencies=[Depends(require_role("Admin"))])
async def update_room(request: Request, room_id: str, body: RoomUpdate):
    pool = require_pool(request)
    return await room_service.update_room(
        pool, room_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{room_id}", dependencies=[Depends(require_role("Admin"))])
async def delete_room(request: Request, room_id: str):
    pool = require_pool(request)
    return await room_service.delete_room(pool, room_id)
