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

from db import create_pool, init_db
from errors import ApiError, error_body
from routers import devices as devices_router
from routers import rooms as rooms_router
from routers import scenes as scenes_router
from routers import system as system_router
from services.health_checks import run_checks

VERSION = "0.1.0"


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


app.include_router(rooms_router.router, prefix="/api/v1")
app.include_router(devices_router.router, prefix="/api/v1")
app.include_router(scenes_router.router, prefix="/api/v1")
app.include_router(system_router.router, prefix="/api/v1")
