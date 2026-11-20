"""Lila Home 统一错误体与业务异常。

所有新接口的错误响应统一为 {"code", "message", "detail"}。
"""

from __future__ import annotations


class ApiError(Exception):
    """业务异常, 由 main.py 的异常处理器转成统一错误体。"""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        detail=None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.detail = detail


def error_body(code: str, message: str, detail=None) -> dict:
    body: dict = {"code": code, "message": message}
    body["detail"] = detail
    return body


def db_unavailable(detail: str = "数据库未连接") -> ApiError:
    """数据库不可用 (未配置连接信息, 或连接池建立失败)。

    注意: 这是 503, 不是 500 —— 服务本身正常, 是依赖未就绪。
    """
    return ApiError(503, "db_unavailable", "数据库未连接", detail)


def not_found(what: str = "对象") -> ApiError:
    return ApiError(404, "not_found", f"{what}不存在", None)


def validation_error(message: str, detail=None) -> ApiError:
    return ApiError(422, "validation_error", message, detail)
