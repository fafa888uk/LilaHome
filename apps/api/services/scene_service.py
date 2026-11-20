"""场景服务层。

规则引擎骨架:
- scenes 表的 rules JSONB 字段只存触发条件, 如
  {"type": "time", "at": "07:00"} 或
  {"type": "device_state", "device_id": "...", "equals": "on"}。
- 只存、只展示、不执行。
- 规则只存储不执行, 执行器后续阶段接入 HA 自动化。
  (本阶段 POST /scenes/{id}/run 只执行 scene_actions 里的设备动作,
  不解析、不触发 rules。)

场景执行:
- 建 scene_runs 记录, 逐个动作走 device_service.create_command 命令路径。
- HA 未接入时每个动作结果都是 UNKNOWN, run 的整体 status 写
  "completed_with_unknown", 绝不写 success。
"""

from __future__ import annotations

import uuid

from db import from_jsonb, parse_uuid, row_to_dict, to_jsonb
from errors import ApiError, not_found
from services import device_service
from services.audit import write_audit


def serialize_scene(row) -> dict:
    data = row_to_dict(row)
    data["rules"] = from_jsonb(data.get("rules"))
    return data


def serialize_action(row) -> dict:
    data = row_to_dict(row)
    action = from_jsonb(data.get("action")) or {}
    return {
        "id": data.get("id"),
        "scene_id": data.get("scene_id"),
        "device_id": data.get("device_id"),
        "action": action.get("action") if isinstance(action, dict) else None,
        "params": action.get("params") if isinstance(action, dict) else {},
        "sort_order": data.get("sort_order"),
        "created_at": data.get("created_at"),
    }


def serialize_run(row) -> dict:
    data = row_to_dict(row)
    result_payload = from_jsonb(data.get("result")) or {}
    data["result"] = result_payload
    # 执行结果数组同时放顶层 results, 供前端直接读取
    # (与 result.results 是同一份数据, 不产生第二份事实)。
    if isinstance(result_payload, dict):
        data["results"] = result_payload.get("results", [])
    else:
        data["results"] = []
    return data


async def _fetch_scene(pool, scene_id: uuid.UUID):
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT * FROM scenes WHERE id = $1 AND deleted_at IS NULL", scene_id
        )


async def get_scene_or_404(pool, scene_id_str: str) -> dict:
    scene_id = parse_uuid(scene_id_str)
    if scene_id is None:
        raise not_found("场景")
    row = await _fetch_scene(pool, scene_id)
    if row is None:
        raise not_found("场景")
    return serialize_scene(row)


async def list_scenes(pool, page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM scenes WHERE deleted_at IS NULL"
        )
        rows = await conn.fetch(
            "SELECT * FROM scenes WHERE deleted_at IS NULL"
            " ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            page_size,
            offset,
        )
    return [serialize_scene(r) for r in rows], int(total or 0)


async def create_scene(pool, data: dict) -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise ApiError(422, "validation_error", "name 必填", None)
    # rules 只存储不执行, 执行器后续阶段接入 HA 自动化。
    rules = data.get("rules")
    if rules is not None and not isinstance(rules, dict):
        raise ApiError(422, "validation_error", "rules 须为对象", None)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO scenes (name, description, is_enabled, rules)"
            " VALUES ($1, $2, $3, $4) RETURNING *",
            name,
            data.get("description"),
            bool(data.get("is_enabled", True)),
            to_jsonb(rules),
        )
    scene = serialize_scene(row)
    await write_audit(
        pool, "scene.create", "scene", row["id"], {"name": name}
    )
    return scene


async def update_scene(pool, scene_id_str: str, data: dict) -> dict:
    scene_id = parse_uuid(scene_id_str)
    if scene_id is None:
        raise not_found("场景")
    updates: dict = {}
    if "name" in data and data["name"] is not None:
        name = str(data["name"]).strip()
        if not name:
            raise ApiError(422, "validation_error", "name 不能为空", None)
        updates["name"] = name
    if "description" in data:
        updates["description"] = data["description"]
    if "is_enabled" in data and data["is_enabled"] is not None:
        updates["is_enabled"] = bool(data["is_enabled"])
    if "rules" in data:
        # rules 只存储不执行, 执行器后续阶段接入 HA 自动化。
        if data["rules"] is not None and not isinstance(data["rules"], dict):
            raise ApiError(422, "validation_error", "rules 须为对象", None)
        updates["rules"] = data["rules"]
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM scenes WHERE id = $1 AND deleted_at IS NULL", scene_id
        )
        if row is None:
            raise not_found("场景")
        if not updates:
            return serialize_scene(row)
        if "rules" in updates:
            updates["rules"] = to_jsonb(updates["rules"])
        set_clause = ", ".join(
            "{} = ${}".format(col, idx + 1) for idx, col in enumerate(updates)
        )
        updated = await conn.fetchrow(
            "UPDATE scenes SET {}, updated_at = now()"
            " WHERE id = ${} AND deleted_at IS NULL RETURNING *".format(
                set_clause, len(updates) + 1
            ),
            *list(updates.values()),
            scene_id,
        )
    scene = serialize_scene(updated)
    await write_audit(
        pool, "scene.update", "scene", scene_id, {"fields": sorted(updates)}
    )
    return scene


async def delete_scene(pool, scene_id_str: str) -> dict:
    scene_id = parse_uuid(scene_id_str)
    if scene_id is None:
        raise not_found("场景")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE scenes SET deleted_at = now(), updated_at = now()"
            " WHERE id = $1 AND deleted_at IS NULL RETURNING *",
            scene_id,
        )
    if row is None:
        raise not_found("场景")
    scene = serialize_scene(row)
    await write_audit(pool, "scene.delete", "scene", scene_id, {})
    return scene


async def add_action(pool, scene_id_str: str, data: dict) -> dict:
    scene_id = parse_uuid(scene_id_str)
    if scene_id is None:
        raise not_found("场景")
    scene = await _fetch_scene(pool, scene_id)
    if scene is None:
        raise not_found("场景")
    device_id = parse_uuid(data.get("device_id"))
    if device_id is None:
        raise ApiError(422, "validation_error", "device_id 必填且须为 UUID", None)
    action_name = (data.get("action") or "").strip()
    if not action_name:
        raise ApiError(422, "validation_error", "action 必填", None)
    params = data.get("params") or {}
    if not isinstance(params, dict):
        raise ApiError(422, "validation_error", "params 须为对象", None)
    # 场景动作里的危险参数同样拒绝 (与单设备命令同一条规则)。
    forbidden = device_service.find_forbidden_keys(params)
    if forbidden:
        raise device_service.DangerousParamsError(forbidden)
    device = await device_service._fetch_device(pool, device_id)
    if device is None:
        raise not_found("设备")
    sort_order = data.get("sort_order")
    try:
        sort_order = int(sort_order) if sort_order is not None else 0
    except (TypeError, ValueError):
        raise ApiError(422, "validation_error", "sort_order 须为整数", None)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO scene_actions (scene_id, device_id, action, sort_order)"
            " VALUES ($1, $2, $3, $4) RETURNING *",
            scene_id,
            device_id,
            to_jsonb({"action": action_name, "params": params}),
            sort_order,
        )
    action_row = serialize_action(row)
    await write_audit(
        pool,
        "scene.action.add",
        "scene",
        scene_id,
        {"device_id": str(device_id), "action": action_name},
    )
    return action_row


async def list_actions(pool, scene_id_str: str):
    scene_id = parse_uuid(scene_id_str)
    if scene_id is None:
        raise not_found("场景")
    scene = await _fetch_scene(pool, scene_id)
    if scene is None:
        raise not_found("场景")
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM scene_actions WHERE scene_id = $1"
            " ORDER BY sort_order ASC, created_at ASC",
            scene_id,
        )
    return [serialize_action(r) for r in rows]


async def run_scene(pool, scene_id_str: str) -> dict:
    """执行场景: 逐个动作走命令路径, 每个动作结果记入 scene_runs.result。

    HA 未接入时每个动作结果都是 UNKNOWN, run 整体 status 为
    "completed_with_unknown", 绝不写 success。
    rules 只存储不执行, 本次执行不解析 rules。
    """
    scene_id = parse_uuid(scene_id_str)
    if scene_id is None:
        raise not_found("场景")
    scene = await _fetch_scene(pool, scene_id)
    if scene is None:
        raise not_found("场景")
    async with pool.acquire() as conn:
        run_row = await conn.fetchrow(
            "INSERT INTO scene_runs (scene_id, status) VALUES ($1, 'running')"
            " RETURNING *",
            scene_id,
        )
        action_rows = await conn.fetch(
            "SELECT * FROM scene_actions WHERE scene_id = $1"
            " ORDER BY sort_order ASC, created_at ASC",
            scene_id,
        )
    results: list[dict] = []
    for action_row in action_rows:
        action = from_jsonb(action_row["action"]) or {}
        action_name = action.get("action")
        params = action.get("params") or {}
        device_id = action_row["device_id"]
        try:
            command = await device_service.create_command(
                pool, str(device_id), action_name, params
            )
            results.append(
                {
                    "device_id": str(device_id),
                    "action": action_name,
                    "command_id": command.get("command_id"),
                    "status": command.get("status"),
                    "detail": command.get("detail"),
                }
            )
        except device_service.DeviceNotFoundError:
            results.append(
                {
                    "device_id": str(device_id),
                    "action": action_name,
                    "command_id": None,
                    "status": "UNKNOWN",
                    "detail": "设备不存在，指令未下发，无法确认执行结果",
                }
            )
        except device_service.DangerousParamsError as exc:
            results.append(
                {
                    "device_id": str(device_id),
                    "action": action_name,
                    "command_id": None,
                    "status": "UNKNOWN",
                    "detail": exc.message,
                }
            )
    # 整体状态: 只要有一个动作不是 CONFIRMED, 就不是 success。
    # 本阶段 HA 未接入, 全部动作均为 UNKNOWN, 故整体恒为 completed_with_unknown。
    overall = (
        "completed_with_unknown"
        if any(r["status"] != "CONFIRMED" for r in results)
        else "completed"
    )
    result_payload = {"results": results, "status": overall}
    async with pool.acquire() as conn:
        updated = await conn.fetchrow(
            "UPDATE scene_runs SET status = $1, completed_at = now(), result = $2"
            " WHERE id = $3 RETURNING *",
            overall,
            to_jsonb(result_payload),
            run_row["id"],
        )
    run = serialize_run(updated)
    await write_audit(
        pool,
        "scene.run",
        "scene",
        scene_id,
        {"run_id": str(run_row["id"]), "status": overall},
    )
    return run


async def get_run(pool, scene_id_str: str, run_id_str: str) -> dict:
    scene_id = parse_uuid(scene_id_str)
    run_id = parse_uuid(run_id_str)
    if scene_id is None or run_id is None:
        raise not_found("场景执行记录")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM scene_runs WHERE id = $1 AND scene_id = $2",
            run_id,
            scene_id,
        )
    if row is None:
        raise not_found("场景执行记录")
    return serialize_run(row)
