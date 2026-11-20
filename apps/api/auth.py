"""RBAC 脚手架。

当前 v0.1 无登录, get_current_role 固定返回 "Owner"。
脚手架: 登录落地后改为从会话 (JWT/Session) 解析角色。
require_role(...) 只作结构占位: 当前恒过, 绝不声称已鉴权。
"""

from __future__ import annotations

from fastapi import Depends

from errors import ApiError

ROLE_ORDER = {"Viewer": 0, "Member": 1, "Admin": 2, "Owner": 3}


async def get_current_role() -> str:
    """当前无登录, 固定返回 Owner。

    脚手架: 登录落地后改为从会话解析角色。
    """
    return "Owner"


def require_role(minimum: str):
    """要求至少达到指定角色; 当前因 get_current_role 恒返 Owner 而恒过。

    仅作结构占位, 绝不声称已鉴权。登录落地后此处自动生效。
    """

    async def checker(role: str = Depends(get_current_role)) -> str:
        if ROLE_ORDER.get(role, -1) < ROLE_ORDER.get(minimum, 99):
            raise ApiError(403, "forbidden", "无该操作的权限", None)
        return role

    return checker
