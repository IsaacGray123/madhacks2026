"""WebSocket contract between the UNO Q (server) and the laptop app (client).

Mirror of app/src/shared/protocol.ts — keep the two in sync.

board -> laptop:
  {"type":"hello","device":"unoq","version":1}
  {"type":"vision","ts":<ms>,"state":"present|phone|away|eating|sleeping|distracted","conf":0..1,"face":bool,"slouch":0..1|null,"attention":"screen|down|away"|null}
  {"type":"event","ts":<ms>,"event":"drank|ate"}
  {"type":"touch","action":"start|pause|resume|stop|reminder_done|reminder_dismiss","reminder"?:str}
  {"type":"frame","ts":<ms>,"jpeg":<base64 JPEG>}   (only to clients that sent preview on)

laptop -> board:
  {"type":"session","status":"idle|running|paused"}
  {"type":"stats","status":..,"elapsedMs":..,"current":activity|null,"focusPct":..,"totals":{activity:ms},"timers":{"water","eat","break","eye": ms|null}}
  {"type":"reminder","reminder":str,"title":str,"message":str}
  {"type":"reminder_clear"}
  {"type":"baseline"}
  {"type":"companion","companion":{"name":str,"color":"green|blue|peach|lavender","glasses":bool}}
  {"type":"preview","on":bool}   (ask for / stop the live camera preview)
"""
import json
import time

PROTOCOL_VERSION = 1
DEFAULT_PORT = 8765
CAMERA_STATES = ("present", "phone", "away", "eating", "sleeping", "distracted")
ACTIVITIES = ("studying", "phone", "distracted", "away", "eating", "sleeping")
TIMER_KEYS = ("water", "eat", "break", "eye")


def now_ms() -> int:
    return int(time.time() * 1000)


def hello() -> str:
    return json.dumps({"type": "hello", "device": "unoq", "version": PROTOCOL_VERSION})


ATTENTION = ("screen", "down", "away")


def vision(state: str, conf: float, face: bool, slouch, attention: str | None = None) -> str:
    return json.dumps({
        "type": "vision", "ts": now_ms(), "state": state, "conf": round(conf, 2),
        "face": bool(face), "slouch": None if slouch is None else round(float(slouch), 3),
        "attention": attention,
    })


def event(kind: str) -> str:
    return json.dumps({"type": "event", "ts": now_ms(), "event": kind})


def touch(action: str, reminder: str | None = None) -> str:
    msg = {"type": "touch", "action": action}
    if reminder:
        msg["reminder"] = reminder
    return json.dumps(msg)


def frame(jpeg_b64: str) -> str:
    return json.dumps({"type": "frame", "ts": now_ms(), "jpeg": jpeg_b64})
