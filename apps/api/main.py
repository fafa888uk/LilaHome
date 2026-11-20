"""Lila Home API 入口。

v0.1 两个接口的响应形状一个字不动:
- GET /health        健康检查 (依赖真实连通性检查, 始终返回 HTTP 200)
- GET /api/v1/status 状态摘要

完整版新增 (全部挂在 /api/v1 下, 见 routers/):
- 房间 /rooms、设备 /devices (含状态与控制指令)、聚合视图
  /lights、/climate、/water-heaters、/speakers
- 场景 /scenes (含动作与执行; rules 只存不执行, 执行器后续阶段接入 HA 自动化)
- 网络只读 /network/devices、系统 /system/health、审计 /audit-logs、
  集成 /integrations、用户 /users
- 登录鉴权 /auth (首次设置、登录、改密码、当前用户); 除 /health 与
  /auth/status、/auth/setup、/auth/login 外, 全部 /api/v1/* 要求 Bearer JWT
  (中间件验签, 失败 401; 未配置 LILA_JWT_SECRET 时 fail-closed)。

启动时建表 (db.init_db, CREATE TABLE IF NOT EXISTS + 种子)。
数据库未配置/连不上时以无库模式启动: /health 仍返回 degraded,
业务接口返回 503 {"code": "db_unavailable", ...}。
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from auth import decode_token
from db import create_pool, init_db
from errors import ApiError, error_body
from routers import auth as auth_router
from routers import devices as devices_router
from routers import rooms as rooms_router
from routers import scenes as scenes_router
from routers import system as system_router
from services.health_checks import run_checks

VERSION = "0.1.0"

# 无需登录即可访问的路径: 健康检查 + 首次设置/登录三口。
# 其余 /api/v1/* (含 /auth/me、/auth/change-password) 一律要求 Bearer JWT。
_PUBLIC_PATHS = frozenset(
    {
        "/health",
        "/api/v1/auth/status",
        "/api/v1/auth/setup",
        "/api/v1/auth/login",
    }
)


class AuthMiddleware(BaseHTTPMiddleware):
    """验签中间件: /api/v1/* 要求 Authorization: Bearer <JWT>。

    验签通过后把 {"id","username","role"} 写进 request.state.user,
    供 auth.get_current_user / require_role 使用。
    公开路径直接放行; 非 /api/v1/ 路径 (如 /docs) 不拦截。
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in _PUBLIC_PATHS or not path.startswith("/api/v1/"):
            return await call_next(request)
        authorization = request.headers.get("authorization", "")
        if not authorization.lower().startswith("bearer "):
            return JSONResponse(
                status_code=401,
                content=error_body("unauthorized", "未登录或登录已过期", None),
            )
        token = authorization[7:].strip()
        if not token:
            return JSONResponse(
                status_code=401,
                content=error_body("unauthorized", "未登录或登录已过期", None),
            )
        try:
            payload = decode_token(token)
        except ApiError as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content=error_body(exc.code, exc.message, exc.detail),
            )
        request.state.user = {
            "id": str(payload.get("sub", "")),
            "username": str(payload.get("username", "")),
            "role": str(payload.get("role", "")),
        }
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时建连接池并建表; 失败则以无库模式运行, 不阻止服务启动。"""
    pool = None
    try:
        pool = await create_pool()
        if pool is not None:
            await init_db(pool)
    except Exception as exc:  # noqa: BLE001 - 无库模式仍要能起服务
        print(
            "[lila-home] 数据库初始化失败, 以无库模式启动: {}".format(exc),
            flush=True,
        )
        if pool is not None:
            try:
                await pool.close()
            except Exception:  # noqa: BLE001
                pass
        pool = None
    app.state.pool = pool
    yield
    if pool is not None:
        await pool.close()


app = FastAPI(title="Lila Home API", version=VERSION, lifespan=lifespan)
app.add_middleware(AuthMiddleware)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.detail),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Pydantic 校验失败也统一成 {"code","message","detail"}。
    details = []
    for err in exc.errors():
        loc = ".".join(str(part) for part in err.get("loc", ()))
        details.append(
            {"loc": loc, "msg": err.get("msg", ""), "type": err.get("type", "")}
        )
    return JSONResponse(
        status_code=422,
        content=error_body("validation_error", "参数校验失败", details),
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    code = {
        400: "validation_error",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        422: "validation_error",
    }.get(exc.status_code, "internal_error")
    message = exc.detail if isinstance(exc.detail, str) else "请求失败"
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, message, None),
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    # 未预料的异常也统一错误体, 不泄露堆栈。
    print("[lila-home] 未处理异常: {!r}".format(exc), flush=True)
    return JSONResponse(
        status_code=500,
        content=error_body("internal_error", "服务端异常", None),
    )


@app.get("/health")
async def health() -> dict:
    checks = await run_checks()
    overall = (
        "ok"
        if checks["database"]["status"] == "ok"
        and checks["mqtt"]["status"] == "ok"
        else "degraded"
    )
    return {"status": overall, "version": VERSION, "checks": checks}


@app.get("/api/v1/status")
async def status() -> dict:
    checks = await run_checks()
    return {
        "version": VERSION,
        "database": checks["database"]["status"],
        "mqtt": checks["mqtt"]["status"],
        "home_assistant": checks["home_assistant"]["status"],
        "detail": {
            "database": checks["database"]["detail"],
            "mqtt": checks["mqtt"]["detail"],
            "home_assistant": checks["home_assistant"]["detail"],
        },
        # 与 /health 同形的 checks 对象 (新增键, 原有字段不动),
        # 供首页按检查项名解析; v0.1 字段一个字没改。
        "checks": checks,
    }


app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(rooms_router.router, prefix="/api/v1")
app.include_router(devices_router.router, prefix="/api/v1")
app.include_router(scenes_router.router, prefix="/api/v1")
app.include_router(system_router.router, prefix="/api/v1")
