"""统一设备服务层。

所有设备读写都走这里; 路由层只做 HTTP 适配, 不直连数据库/HA/MQTT。
内部调:
- integrations/home_assistant.py: HA REST 客户端。HA_BASE_URL 未设置时
  一律返回 not_connected, 不连任何地址; 设置后才真实发请求。
- services/mqtt_service.py: MQTT 发布/订阅封装。本阶段命令不走 MQTT
  (HA 未接入), publish 只留给后续阶段的命令下发路径。

控制状态机 (见 API_DESIGN.md 2):
- HA 未接入时, 命令直接记 UNKNOWN, detail 写明未下发、无法确认执行结果,
  绝不写 CONFIRMED, 绝不谎报执行结果。
- HA 已配置时才真实调 HA 服务; 调通只记 EXECUTING (等待回执确认),
  回执确认逻辑后续阶段接入; 调用失败记 FAILED。
"""

from __future__ import annotations

import uuid

from db import from_jsonb, parse_uuid, row_to_dict, to_jsonb
from errors import ApiError, not_found
from integrations.home_assistant import HomeAssistantClient
from services.audit import write_audit
from services.mqtt_service import MqttService  # noqa: F401  (后续命令下发路径用)

DEVICE_TYPES = ("router", "speaker", "light", "climate", "water_heater", "other")

# 禁止行为 (API_DESIGN.md 3.5 / SECURITY_DESIGN.md 3.3):
# 控制接口不得接受"绕过安全保护"的参数, 须在 API 层拒绝并记审计。
FORBIDDEN_PARAM_KEYS = {
    "over_temperature",
    "bypass_safety",
    "disable_interlock",
    "gas_override",
}

HA_NOT_CONNECTED_DETAIL = "Home Assistant 未接入，指令未下发，无法确认执行结果"

# 设备类型 -> HA 服务域。router/other 无 HA 服务映射, 不下发。
HA_DOMAIN_BY_TYPE = {
    "light": "light",
    "climate": "climate",
    "water_heater": "water_heater",
    "speaker": "media_player",
}


class DeviceNotFoundError(ApiError):
    def __init__(self) -> None:
        super().__init__(404, "not_found", "设备不存在", None)


class DangerousParamsError(ApiError):
    def __init__(self, keys: list[str]) -> None:
        super().__init__(
            422,
            "validation_error",
            "危险参数被拒绝: {}".format(", ".join(sorted(keys))),
            {"forbidden_keys": sorted(keys)},
        )
        self.keys = keys


def find_forbidden_keys(params) -> list[str]:
    """递归扫描 params 里的键 (大小写不敏感), 找出禁用的危险参数。"""
    found: set[str] = set()

    def _scan(value) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                if str(key).lower() in FORBIDDEN_PARAM_KEYS:
                    found.add(str(key).lower())
                _scan(item)
        elif isinstance(value, list):
            for item in value:
                _scan(item)

    _scan(params or {})
    return sorted(found)


def serialize_device(row) -> dict:
    data = row_to_dict(row)
    # 未接入时 ha_entity_id 与 compatibility_grade 保持为空, 不编造。
    # 另附前端读取的别名字段 (type/compatibility_level/integration),
    # 值与规范字段完全一致, 只是换个名字, 不产生第二份事实。
    return {
        "id": data.get("id"),
        "room_id": data.get("room_id"),
        "integration_id": data.get("integration_id"),
        "integration": data.get("integration_name"),
        "name": data.get("name"),
        "brand": data.get("brand"),
        "model": data.get("model"),
        "device_type": data.get("device_type"),
        "type": data.get("device_type"),
        "ha_entity_id": data.get("ha_entity_id"),
        "compatibility_grade": data.get("compatibility_grade"),
        "compatibility_level": data.get("compatibility_grade"),
        "is_online": data.get("is_online"),
        "status": "not_connected",
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "deleted_at": data.get("deleted_at"),
    }


def serialize_command(row) -> dict:
    data = row_to_dict(row)
    command = from_jsonb(data.get("command")) or {}
    ha_result = from_jsonb(data.get("ha_result")) or {}
    detail = ha_result.get("detail") if isinstance(ha_result, dict) else None
    return {
        "id": data.get("id"),
        "command_id": data.get("id"),
        "device_id": data.get("device_id"),
        "action": command.get("action") if isinstance(command, dict) else None,
        "params": command.get("params") if isinstance(command, dict) else None,
        "status": data.get("status"),
        "detail": detail,
        "ha_result": ha_result,
        "created_at": data.get("created_at"),
        "completed_at": data.get("completed_at"),
    }


async def _fetch_device(pool, device_id: uuid.UUID):
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT d.*, i.name AS integration_name FROM devices d"
            " LEFT JOIN integrations i ON i.id = d.integration_id"
            " WHERE d.id = $1 AND d.deleted_at IS NULL",
            device_id,
        )


async def get_device_or_404(pool, device_id_str: str) -> dict:
    device_id = parse_uuid(device_id_str)
    if device_id is None:
        raise DeviceNotFoundError()
    row = await _fetch_device(pool, device_id)
    if row is None:
        raise DeviceNotFoundError()
    return serialize_device(row)


async def list_devices(
    pool,
    room_id: str | None = None,
    device_type: str | None = None,
    brand: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    conditions = ["deleted_at IS NULL"]
    args: list = []
    if room_id:
        room_uuid = parse_uuid(room_id)
        if room_uuid is None:
            return [], 0
        args.append(room_uuid)
        conditions.append("room_id = ${}".format(len(args)))
    if device_type:
        args.append(device_type)
        conditions.append("device_type = ${}".format(len(args)))
    if brand:
        args.append(brand)
        conditions.append("brand = ${}".format(len(args)))
    where = "WHERE " + " AND ".join(conditions)
    offset = (page - 1) * page_size
    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM devices {}".format(where), *args
        )
        rows = await conn.fetch(
            "SELECT d.*, i.name AS integration_name FROM devices d"
            " LEFT JOIN integrations i ON i.id = d.integration_id"
            " {} ORDER BY d.created_at DESC"
            " LIMIT ${} OFFSET ${}".format(where, len(args) + 1, len(args) + 2),
            *args,
            page_size,
            offset,
        )
    return [serialize_device(r) for r in rows], int(total or 0)


async def create_device(pool, data: dict) -> dict:
    name = (data.get("name") or "").strip()
    device_type = data.get("device_type")
    if not name:
        raise ApiError(422, "validation_error", "name 必填", None)
    if device_type not in DEVICE_TYPES:
        raise ApiError(
            422,
            "validation_error",
            "device_type 只能是 {}".format(", ".join(DEVICE_TYPES)),
            None,
        )
    room_id = parse_uuid(data.get("room_id")) if data.get("room_id") else None
    integration_id = (
        parse_uuid(data.get("integration_id")) if data.get("integration_id") else None
    )
    async with pool.acquire() as conn:
        if room_id is not None:
            exists = await conn.fetchval(
                "SELECT 1 FROM rooms WHERE id = $1 AND deleted_at IS NULL", room_id
            )
            if not exists:
                raise not_found("房间")
        if integration_id is not None:
            exists = await conn.fetchval(
                "SELECT 1 FROM integrations WHERE id = $1", integration_id
            )
            if not exists:
                raise not_found("集成")
        # model 未知写 UNKNOWN, 不编造; ha_entity_id 与 compatibility_grade 初始为空。
        model = (data.get("model") or "").strip() or "UNKNOWN"
        row = await conn.fetchrow(
            "INSERT INTO devices (room_id, integration_id, name, brand, model,"
            " device_type, ha_entity_id, compatibility_grade)"
            " VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL)"
            " RETURNING *",
            room_id,
            integration_id,
            name,
            (data.get("brand") or "").strip() or None,
            model,
            device_type,
        )
    device = serialize_device(row)
    await write_audit(
        pool,
        "device.create",
        "device",
        row["id"],
        {"name": name, "device_type": device_type, "model": model},
    )
    return device


async def update_device(pool, device_id_str: str, data: dict) -> dict:
    device_id = parse_uuid(device_id_str)
    if device_id is None:
        raise DeviceNotFoundError()
    row = await _fetch_device(pool, device_id)
    if row is None:
        raise DeviceNotFoundError()
    updates: dict = {}
    if "name" in data and data["name"] is not None:
        name = str(data["name"]).strip()
        if not name:
            raise ApiError(422, "validation_error", "name 不能为空", None)
        updates["name"] = name
    if "room_id" in data:
        updates["room_id"] = (
            parse_uuid(data["room_id"]) if data["room_id"] else None
        )
    if "integration_id" in data:
        updates["integration_id"] = (
            parse_uuid(data["integration_id"]) if data["integration_id"] else None
        )
    if "brand" in data and data["brand"] is not None:
        updates["brand"] = str(data["brand"]).strip() or None
    if "model" in data and data["model"] is not None:
        updates["model"] = str(data["model"]).strip() or "UNKNOWN"
    if "device_type" in data and data["device_type"] is not None:
        if data["device_type"] not in DEVICE_TYPES:
            raise ApiError(
                422,
                "validation_error",
                "device_type 只能是 {}".format(", ".join(DEVICE_TYPES)),
                None,
            )
        updates["device_type"] = data["device_type"]
    if "compatibility_grade" in data:
        updates["compatibility_grade"] = data["compatibility_grade"]
    if "is_online" in data and data["is_online"] is not None:
        updates["is_online"] = bool(data["is_online"])
    if not updates:
        return serialize_device(row)
    async with pool.acquire() as conn:
        if updates.get("room_id") is not None:
            exists = await conn.fetchval(
                "SELECT 1 FROM rooms WHERE id = $1 AND deleted_at IS NULL",
                updates["room_id"],
            )
            if not exists:
                raise not_found("房间")
        set_clause = ", ".join(
            "{} = ${}".format(col, idx + 1) for idx, col in enumerate(updates)
        )
        updated = await conn.fetchrow(
            "UPDATE devices SET {}, updated_at = now()"
            " WHERE id = ${} AND deleted_at IS NULL RETURNING *".format(
                set_clause, len(updates) + 1
            ),
            *list(updates.values()),
            device_id,
        )
    device = serialize_device(updated)
    await write_audit(
        pool, "device.update", "device", device_id, {"fields": sorted(updates)}
    )
    return device


async def delete_device(pool, device_id_str: str) -> dict:
    device_id = parse_uuid(device_id_str)
    if device_id is None:
        raise DeviceNotFoundError()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE devices SET deleted_at = now(), updated_at = now()"
            " WHERE id = $1 AND deleted_at IS NULL RETURNING *",
            device_id,
        )
    if row is None:
        raise DeviceNotFoundError()
    device = serialize_device(row)
    await write_audit(pool, "device.delete", "device", device_id, {})
    return device


async def get_latest_state(pool, device_id: uuid.UUID) -> dict | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM device_states WHERE device_id = $1"
            " ORDER BY recorded_at DESC LIMIT 1",
            device_id,
        )
    return row_to_dict(row) if row else None


async def get_device_state(pool, device_id_str: str) -> dict:
    """最后已知状态。无快照时返回 not_connected, 不编造状态。

    有快照返回快照; 无快照但 HA 已配置且设备有 ha_entity_id 时, 尝试读一次
    HA 实时状态 (读到即存快照); 其余情况一律返回 not_connected。
    """
    device_id = parse_uuid(device_id_str)
    if device_id is None:
        raise DeviceNotFoundError()
    row = await _fetch_device(pool, device_id)
    if row is None:
        raise DeviceNotFoundError()
    snapshot = await get_latest_state(pool, device_id)
    if snapshot is not None:
        return {
            "device_id": str(device_id),
            "state": from_jsonb(snapshot.get("state")),
            "status": "ok",
            "source": snapshot.get("source"),
            "recorded_at": snapshot.get("recorded_at"),
        }
    ha_entity_id = row["ha_entity_id"]
    ha = HomeAssistantClient()
    if ha_entity_id and ha.is_configured:
        result = await ha.get_state(ha_entity_id)
        if result.get("status") == "ok":
            state = result.get("data") or {}
            async with pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO device_states (device_id, state, source)"
                    " VALUES ($1, $2, 'ha_poll')",
                    device_id,
                    to_jsonb(state),
                )
            return {
                "device_id": str(device_id),
                "state": state,
                "status": "ok",
                "source": "ha_poll",
                "recorded_at": None,
            }
    return {
        "device_id": str(device_id),
        "state": None,
        "status": "not_connected",
        "detail": "未接入",
    }


async def create_command(
    pool, device_id_str: str, action: str, params: dict
) -> dict:
    """发控制指令。

    顺序: 危险参数校验 (422, 先于设备存在性校验, 见 API_DESIGN.md 3.5:
    须在 Pydantic/接口层拒绝) -> 设备存在性 (404) -> HA 下发或记 UNKNOWN。
    """
    forbidden = find_forbidden_keys(params or {})
    if forbidden:
        # 拒绝也要记审计 (无库时 write_audit 静默跳过)。
        await write_audit(
            pool,
            "device.control.rejected",
            "device",
            parse_uuid(device_id_str),
            {"action": action, "forbidden_keys": forbidden},
        )
        raise DangerousParamsError(forbidden)
    device_id = parse_uuid(device_id_str)
    if device_id is None:
        raise DeviceNotFoundError()
    row = await _fetch_device(pool, device_id)
    if row is None:
        raise DeviceNotFoundError()

    ha = HomeAssistantClient()
    status = "UNKNOWN"
    ha_result: dict = {"status": "not_connected", "detail": HA_NOT_CONNECTED_DETAIL}
    completed_at_sql = "NULL"
    if ha.is_configured:
        domain = HA_DOMAIN_BY_TYPE.get(row["device_type"])
        if domain is None:
            ha_result = {
                "status": "not_connected",
                "detail": "该设备类型无 Home Assistant 服务映射，指令未下发",
            }
        else:
            result = await ha.call_service(
                domain, action, {"entity_id": row["ha_entity_id"], **(params or {})}
            )
            ha_result = result
            if result.get("status") == "ok":
                # 已发往 HA, 但未收到回执确认, 只能记 EXECUTING, 不能记 CONFIRMED。
                status = "EXECUTING"
            elif result.get("status") == "error":
                status = "FAILED"
                completed_at_sql = "now()"
    async with pool.acquire() as conn:
        record = await conn.fetchrow(
            "INSERT INTO device_commands (device_id, command, status, ha_result,"
            " completed_at) VALUES ($1, $2, $3, $4, {}) RETURNING *".format(
                completed_at_sql
            ),
            device_id,
            to_jsonb({"action": action, "params": params or {}}),
            status,
            to_jsonb(ha_result),
        )
    command = serialize_command(record)
    await write_audit(
        pool,
        "device.control",
        "device",
        device_id,
        {"action": action, "status": status},
    )
    return command


async def list_commands(
    pool, device_id_str: str, page: int = 1, page_size: int = 20
) -> tuple[list[dict], int]:
    device_id = parse_uuid(device_id_str)
    if device_id is None:
        raise DeviceNotFoundError()
    row = await _fetch_device(pool, device_id)
    if row is None:
        raise DeviceNotFoundError()
    offset = (page - 1) * page_size
    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM device_commands WHERE device_id = $1", device_id
        )
        rows = await conn.fetch(
            "SELECT * FROM device_commands WHERE device_id = $1"
            " ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            device_id,
            page_size,
            offset,
        )
    return [serialize_command(r) for r in rows], int(total or 0)


async def get_command(pool, device_id_str: str, command_id_str: str) -> dict:
    device_id = parse_uuid(device_id_str)
    command_id = parse_uuid(command_id_str)
    if device_id is None or command_id is None:
        raise ApiError(404, "not_found", "指令不存在", None)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM device_commands WHERE id = $1 AND device_id = $2",
            command_id,
            device_id,
        )
    if row is None:
        raise ApiError(404, "not_found", "指令不存在", None)
    return serialize_command(row)


async def list_by_type(
    pool, device_type: str, page: int = 1, page_size: int = 20
) -> tuple[list[dict], int]:
    """聚合视图底层: 按 device_type 过滤 devices 表。"""
    return await list_devices(pool, device_type=device_type, page=page, page_size=page_size)
