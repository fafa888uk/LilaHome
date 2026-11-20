"""Lila Home 健康检查 (自 v0.1 main.py 原样移出, 行为与返回值不变)。

- 数据库: 真实连接 PostgreSQL 并执行 SELECT 1。
- MQTT: 真实做一次 MQTT CONNECT, 等 CONNACK。
- Home Assistant: v0.1 未接入, 固定返回 not_connected, 不连任何地址。
"""

import asyncio
import os
import threading

import asyncpg
import paho.mqtt.client as mqtt

CHECK_TIMEOUT = 3.0


def _sanitize_detail(message: str) -> str:
    """截断错误摘要, 并确保不把连接串/密码带进输出。"""
    text = str(message).strip() or "未知错误"
    # asyncpg/paho 的异常信息本身不含密码; 再做一道防线, 删掉可能出现的
    # 连接串片段 (形如 postgres://user:pass@host)。
    for marker in ("://",):
        if marker in text:
            text = text.split(marker, 1)[-1]
            text = "连接失败: " + text
            break
    return text[:200]


async def check_database() -> dict:
    """真实连接 PostgreSQL 并执行 SELECT 1。

    优先用 PGHOST/PGUSER/PGPASSWORD/PGDATABASE 四个独立变量连接
    （避免密码含 URL 特殊字符时 DSN 解析出错）；未设置时回退到 DATABASE_URL。
    """
    password = os.environ.get("PGPASSWORD")
    dsn = os.environ.get("DATABASE_URL")
    use_separate = password is not None
    if not use_separate and not dsn:
        return {"status": "error", "detail": "未配置数据库连接信息"}
    conn = None
    try:
        if use_separate:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=os.environ.get("PGHOST", "db"),
                    port=int(os.environ.get("PGPORT", "5432")),
                    user=os.environ.get("PGUSER", "lila_home"),
                    password=password,
                    database=os.environ.get("PGDATABASE", "lila_home"),
                ),
                timeout=CHECK_TIMEOUT,
            )
        else:
            conn = await asyncio.wait_for(
                asyncpg.connect(dsn), timeout=CHECK_TIMEOUT
            )
        await asyncio.wait_for(conn.fetchval("SELECT 1"), timeout=CHECK_TIMEOUT)
        return {"status": "ok", "detail": "连接成功, SELECT 1 通过"}
    except Exception as exc:  # noqa: BLE001 - 检查失败要如实上报, 不抛错
        return {"status": "error", "detail": _sanitize_detail(exc)}
    finally:
        if conn is not None:
            try:
                await conn.close()
            except Exception:  # noqa: BLE001 - 关闭失败不影响检查结果
                pass


def _mqtt_connect_once(host: str, port: int, timeout: float) -> dict:
    """同步做一次真实 MQTT CONNECT, 等 CONNACK。跑在线程里, 不阻塞事件循环。"""
    connected = threading.Event()
    result: dict = {}

    def on_connect(client, userdata, flags, rc, properties=None):
        result["connected"] = True
        result["rc"] = rc
        connected.set()

    def on_disconnect(client, userdata, rc, properties=None):
        # 服务端在 CONNACK 前就断开 (如对端不是 MQTT 服务): 只唤醒等待,
        # 不伪造 rc; 调用处据此区分"被拒"与"未收到 CONNACK 就断开"。
        connected.set()

    try:
        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
        except AttributeError:
            client = mqtt.Client()
        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.connect_async(host, port, keepalive=5)
        client.loop_start()
        try:
            if not connected.wait(timeout=timeout):
                return {"status": "error", "detail": "连接超时 (3 秒内未收到 CONNACK)"}
            if result.get("connected") and result.get("rc") == 0:
                return {"status": "ok", "detail": "MQTT CONNECT 成功, 收到 CONNACK"}
            if result.get("connected"):
                return {
                    "status": "error",
                    "detail": "MQTT 连接被拒绝, 返回码 rc={}".format(result.get("rc")),
                }
            return {"status": "error", "detail": "连接被断开, 未收到 CONNACK"}
        finally:
            try:
                client.disconnect()
            except Exception:  # noqa: BLE001 - 断开失败不影响检查结果
                pass
            client.loop_stop()
    except Exception as exc:  # noqa: BLE001 - 检查失败要如实上报, 不抛错
        return {"status": "error", "detail": _sanitize_detail(exc)}


async def check_mqtt() -> dict:
    """按环境变量做一次真实 MQTT CONNECT。"""
    host = os.environ.get("MQTT_HOST", "mosquitto")
    try:
        port = int(os.environ.get("MQTT_PORT", "1883"))
    except ValueError:
        return {"status": "error", "detail": "MQTT_PORT 不是有效端口号"}
    return await asyncio.to_thread(_mqtt_connect_once, host, port, CHECK_TIMEOUT)


def check_home_assistant() -> dict:
    """v0.1 未接入 Home Assistant, 固定返回 not_connected, 不连任何地址。"""
    return {"status": "not_connected", "detail": "未接入"}


async def run_checks() -> dict:
    """并行跑数据库与 MQTT 检查; Home Assistant 为固定值。"""
    db_result, mqtt_result = await asyncio.gather(
        check_database(), check_mqtt()
    )
    return {
        "database": db_result,
        "mqtt": mqtt_result,
        "home_assistant": check_home_assistant(),
    }
