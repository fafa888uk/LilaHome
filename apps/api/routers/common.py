"""路由层共用: 分页参数与分页信封。"""

from __future__ import annotations

from fastapi import Query


def page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> tuple[int, int]:
    return page, page_size


def paginated(items: list, total: int, page: int, page_size: int) -> dict:
    return {"items": items, "page": page, "page_size": page_size, "total": total}
