"""MQTT 服务封装 (paho-mqtt)。

- check_connection(): 真实做一次 MQTT CONNECT 等 CONNACK, 复用健康检查的
  同一套逻辑 (见 services/health_checks.py); 供 /health 与后续接入检查共用。
- publish(): 命令下发占位。MQTT_HOST 未设置时直接返回 not_connected,
  不连任何地址; 设置后才真实连接-发布-断开一次。
- 本阶段设备命令不走 MQTT (HA 未接入, 命令直接记 UNKNOWN); publish 只留
  给后续阶段的命令下发路径调用。
"""

from __future__ import annotations

import json
import os
import threading

import paho.mqtt.client as mqtt

from services.health_checks import _mqtt_connect_once


class MqttService:
    def __init__(self, host: str | None = None, port: int | None = None) -> None:
        self.host = host if host is not None else os.environ.get("MQTT_HOST")
        try:
            self.port = int(
                port if port is not None else os.environ.get("MQTT_PORT", "1883")
            )
        except ValueError:
            self.port = 1883

    @property
    def is_configured(self) -> bool:
        """是否配置了 MQTT 地址。未配置 = 未接入, 不连任何地址。"""
        return bool(self.host)

    def check_connection(self, timeout: float = 3.0) -> dict:
        """真实 CONNECT 一次。未配置时返回 not_connected, 不连任何地址。"""
        if not self.is_configured:
            return {"status": "not_connected", "detail": "未接入"}
        return _mqtt_connect_once(self.host, self.port, timeout)

    def publish_sync(self, topic: str, payload: dict | str, qos: int = 0) -> dict:
        """同步发布一条消息。未配置时返回 not_connected 占位, 不连任何地址。"""
        if not self.is_configured:
            return {"status": "not_connected", "detail": "MQTT 未接入, 消息未发布"}
        body = payload if isinstance(payload, str) else json.dumps(payload)
        published = threading.Event()
        result: dict = {}

        def on_connect(client, userdata, flags, rc, properties=None):
            if rc == 0:
                info = client.publish(topic, body, qos=qos)
                result["mid"] = info.mid
            else:
                result["error"] = "连接被拒绝, rc={}".format(rc)
                published.set()

        def on_publish(client, userdata, mid, properties=None):
            if result.get("mid") == mid:
                result["published"] = True
                published.set()

        try:
            try:
                client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
            except AttributeError:
                client = mqtt.Client()
            client.on_connect = on_connect
            client.on_publish = on_publish
            client.connect_async(self.host, self.port, keepalive=5)
            client.loop_start()
            try:
                if not published.wait(timeout=5.0):
                    return {"status": "error", "detail": "MQTT 发布超时 (5 秒内未收到确认)"}
                if result.get("published"):
                    return {"status": "ok", "detail": "MQTT 发布成功"}
                return {
                    "status": "error",
                    "detail": result.get("error", "MQTT 发布失败"),
                }
            finally:
                try:
                    client.disconnect()
                except Exception:  # noqa: BLE001
                    pass
                client.loop_stop()
        except Exception as exc:  # noqa: BLE001 - 发布失败如实上报
            return {"status": "error", "detail": "MQTT 发布失败: {}".format(exc)[:200]}
