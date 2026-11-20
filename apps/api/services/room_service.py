"""房间服务层。删除为软删除, 同时把该房间下的设备移出分组。"""

from __future__ import annotations

import uuid

from db import parse_uuid, row_to_dict
from errors import ApiError, not_found
from services.audit import write_audit


def serialize_room(row) -> dict:
    return row_to_dict(row)


async def list_rooms(pool, page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM rooms WHERE deleted_at IS NULL"
        )
        rows = await conn.fetch(
            "SELECT * FROM rooms WHERE deleted_at IS NULL"
            " ORDER BY sort_order ASC, created_at ASC LIMIT $1 OFFSET $2",
            page_size,
            offset,
        )
    return [serialize_room(r) for r in rows], int(total or 0)


async def get_room_or_404(pool, room_id_str: str) -> dict:
    room_id = parse_uuid(room_id_str)
    if room_id is None:
        raise not_found("房间")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM rooms WHERE id = $1 AND deleted_at IS NULL", room_id
        )
    if row is None:
        raise not_found("房间")
    return serialize_room(row)


async def create_room(pool, data: dict) -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise ApiError(422, "validation_error", "name 必填", None)
    sort_order = data.get("sort_order") or 0
    try:
        sort_order = int(sort_order)
    except (TypeError, ValueError):
        raise ApiError(422, "validation_error", "sort_order 须为整数", None)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO rooms (name, sort_order) VALUES ($1, $2) RETURNING *",
            name,
            sort_order,
        )
    room = serialize_room(row)
    await write_audit(pool, "room.create", "room", row["id"], {"name": name})
    return room


async def update_room(pool, room_id_str: str, data: dict) -> dict:
    room_id = parse_uuid(room_id_str)
    if room_id is None:
        raise not_found("房间")
    updates: dict = {}
    if "name" in data and data["name"] is not None:
        name = str(data["name"]).strip()
        if not name:
            raise ApiError(422, "validation_error", "name 不能为空", None)
        updates["name"] = name
    if "sort_order" in data and data["sort_order"] is not None:
        try:
            updates["sort_order"] = int(data["sort_order"])
        except (TypeError, ValueError):
            raise ApiError(422, "validation_error", "sort_order 须为整数", None)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM rooms WHERE id = $1 AND deleted_at IS NULL", room_id
        )
        if row is None:
            raise not_found("房间")
        if not updates:
            return serialize_room(row)
        set_clause = ", ".join(
            "{} = ${}".format(col, idx + 1) for idx, col in enumerate(updates)
        )
        updated = await conn.fetchrow(
            "UPDATE rooms SET {}, updated_at = now()"
            " WHERE id = ${} AND deleted_at IS NULL RETURNING *".format(
                set_clause, len(updates) + 1
            ),
            *list(updates.values()),
            room_id,
        )
    room = serialize_room(updated)
    await write_audit(
        pool, "room.update", "room", room_id, {"fields": sorted(updates)}
    )
    return room


async def delete_room(pool, room_id_str: str) -> dict:
    room_id = parse_uuid(room_id_str)
    if room_id is None:
        raise not_found("房间")
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "UPDATE rooms SET deleted_at = now(), updated_at = now()"
                " WHERE id = $1 AND deleted_at IS NULL RETURNING *",
                room_id,
            )
            if row is None:
                raise not_found("房间")
            # 房间删除后, 其下设备移出分组 (room_id 置空)。
            await conn.execute(
                "UPDATE devices SET room_id = NULL, updated_at = now()"
                " WHERE room_id = $1",
                room_id,
            )
    room = serialize_room(row)
    await write_audit(pool, "room.delete", "room", room_id, {})
    return room
