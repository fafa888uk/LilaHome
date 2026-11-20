"""场景接口: CRUD、动作、执行。

规则引擎骨架: scenes.rules 只存触发条件、只展示、不执行。
规则只存储不执行, 执行器后续阶段接入 HA 自动化。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from auth import require_role
from db import require_pool
from routers.common import page_params, paginated
from services import scene_service

router = APIRouter(prefix="/scenes", tags=["scenes"])


class SceneCreate(BaseModel):
    name: str
    description: str | None = None
    is_enabled: bool = True
    # 触发条件, 如 {"type": "time", "at": "07:00"}。
    # 只存、只展示、不执行; 执行器后续阶段接入 HA 自动化。
    rules: dict | None = None


class SceneUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_enabled: bool | None = None
    rules: dict | None = None


class SceneActionCreate(BaseModel):
    device_id: str
    action: str
    params: dict = {}
    sort_order: int = 0


@router.get("")
async def list_scenes(request: Request, pagination: tuple = Depends(page_params)):
    pool = require_pool(request)
    page, page_size = pagination
    items, total = await scene_service.list_scenes(pool, page, page_size)
    return paginated(items, total, page, page_size)


@router.post("", dependencies=[Depends(require_role("Admin"))])
async def create_scene(request: Request, body: SceneCreate):
    pool = require_pool(request)
    return await scene_service.create_scene(pool, body.model_dump())


@router.patch("/{scene_id}", dependencies=[Depends(require_role("Admin"))])
async def update_scene(request: Request, scene_id: str, body: SceneUpdate):
    pool = require_pool(request)
    return await scene_service.update_scene(
        pool, scene_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{scene_id}", dependencies=[Depends(require_role("Admin"))])
async def delete_scene(request: Request, scene_id: str):
    pool = require_pool(request)
    return await scene_service.delete_scene(pool, scene_id)


@router.post(
    "/{scene_id}/actions", dependencies=[Depends(require_role("Admin"))]
)
async def add_action(request: Request, scene_id: str, body: SceneActionCreate):
    pool = require_pool(request)
    return await scene_service.add_action(pool, scene_id, body.model_dump())


@router.get("/{scene_id}/actions")
async def list_actions(request: Request, scene_id: str):
    pool = require_pool(request)
    return await scene_service.list_actions(pool, scene_id)


@router.post("/{scene_id}/run", dependencies=[Depends(require_role("Member"))])
async def run_scene(request: Request, scene_id: str):
    pool = require_pool(request)
    return await scene_service.run_scene(pool, scene_id)


@router.get("/{scene_id}/runs/{run_id}")
async def get_run(request: Request, scene_id: str, run_id: str):
    pool = require_pool(request)
    return await scene_service.get_run(pool, scene_id, run_id)
