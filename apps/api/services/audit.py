"""审计日志写入。

- 每次写操作 (POST/PATCH/DELETE/命令/场景执行) 都调 write_audit 记一行。
- actor 固定为 "system:tailscale" (v0.1 无登录, 无真实用户)。
- detail 脱敏: 递归删掉键名含 password/token/secret/key/passwd/credential
  的条目, 绝不把密码/Token 写进审计日志。
- audit_logs 只追加、不修改、不删除。
- 写入失败不抛错 (不让审计失败反过来弄丢业务操作), 只打印一行警告。
"""

from __future__ import annotations

import uuid

from db import to_jsonb

ACTOR = "system:tailscale"

_SENSITIVE_SUBSTRINGS = (
    "password",
    "passwd",
    "token",
    "secret",
    "apikey",
    "api_key",
    "credential",
    "private_key",
)


def sanitize_detail(detail) -> dict:
    """递归脱敏: 删敏感键, 其余原样保留; 非 dict 输入包一层返回。"""
    if not isinstance(detail, dict):
        return {"value": detail}

    def _clean(value):
        if isinstance(value, dict):
            out = {}
            for key, item in value.items():
                lowered = str(key).lower().replace("-", "_")
                if any(s in lowered for s in _SENSITIVE_SUBSTRINGS):
                    continue
                out[key] = _clean(item)
            return out
        if isinstance(value, list):
            return [_clean(item) for item in value]
        return value

    cleaned = _clean(detail)
    return cleaned if isinstance(cleaned, dict) else {"value": cleaned}


async def write_audit(
    pool,
    action: str,
    target_type: str | None = None,
    target_id: uuid.UUID | str | None = None,
    detail: dict | None = None,
) -> None:
    """写一行审计日志。失败时只告警, 不抛错。"""
    if pool is None:
        return
    payload = {"actor": ACTOR}
    payload.update(sanitize_detail(detail or {}))
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO audit_logs (action, target_type, target_id, detail)"
                " VALUES ($1, $2, $3, $4)",
                action,
                target_type,
                target_id if isinstance(target_id, uuid.UUID) else None,
                to_jsonb(payload),
            )
    except Exception as exc:  # noqa: BLE001 - 审计失败不阻塞业务操作
        print("[lila-home] 审计写入失败 ({}): {}".format(action, exc), flush=True)
