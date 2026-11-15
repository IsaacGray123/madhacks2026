"""Drives the 3.5" TFT on the UNO Q's STM32 via the Arduino Router Bridge.

The MCU sketch (board/sketch/sketch.ino) exposes one RPC, "ui", that takes a pipe-delimited string,
and calls "touch" back on the Linux side when a button is tapped. Formats:

  U|<face 0/1>|<hint>|<ip>                                    setup screen (framing guide)
  S|<status>|<current>|<elapsed_s>|<focus%>|t0,t1,t2,t3,t4,t5|water,eat,break,eye   session stats
     totals order = studying,phone,distracted,away,eating,sleeping (seconds); timers in seconds, -1 = off
  R|<reminder type>|<title>|<message>                           reminder prompt
  C                                                             clear reminder

Without the Arduino runtime (e.g. on a laptop) it falls back to printing, so the same code runs everywhere.
"""
from __future__ import annotations

import logging
from typing import Callable

import protocol

log = logging.getLogger("display")

try:  # Arduino App Lab runtime on the UNO Q
    from arduino.app_utils import Bridge  # type: ignore

    HAVE_BRIDGE = True
except Exception:  # pragma: no cover - laptop / CI
    Bridge = None
    HAVE_BRIDGE = False


def _clean(s: str, n: int = 60) -> str:
    # The TFT font is ASCII only; keep the delimiter out of text fields.
    return s.replace("|", "/").encode("ascii", "ignore").decode()[:n]


class Display:
    def __init__(self, on_touch: Callable[[str], None]):
        self.on_touch = on_touch
        self.last = ""
        if HAVE_BRIDGE:
            # Touch actions arrive as: start | pause | resume | stop | done | dismiss
            Bridge.provide("touch", self._touch)
            log.info("TFT bridge ready")
        else:
            log.warning("Arduino Bridge not available: TFT output goes to the log")

    def _touch(self, action: str) -> None:
        self.on_touch(str(action))

    def _send(self, payload: str, force: bool = False) -> None:
        if payload == self.last and not force:
            return
        self.last = payload
        if HAVE_BRIDGE:
            try:
                Bridge.call("ui", payload)
            except Exception as e:  # noqa: BLE001
                log.error("bridge call failed: %s", e)
        else:
            log.debug("TFT <- %s", payload)

    def setup(self, face: bool, hint: str, ip: str) -> None:
        self._send(f"U|{int(face)}|{_clean(hint)}|{ip}")

    def stats(self, msg: dict) -> None:
        totals = msg.get("totals", {})
        timers = msg.get("timers", {})
        t = ",".join(str(int(totals.get(a, 0) // 1000)) for a in protocol.ACTIVITIES)
        tm = ",".join(str(-1 if timers.get(k) is None else int(timers[k] // 1000)) for k in protocol.TIMER_KEYS)
        self._send(
            f"S|{msg.get('status', 'running')}|{msg.get('current') or 'none'}|{int(msg.get('elapsedMs', 0) // 1000)}"
            f"|{int(msg.get('focusPct', 0))}|{t}|{tm}"
        )

    def reminder(self, kind: str, title: str, message: str) -> None:
        self._send(f"R|{kind}|{_clean(title, 40)}|{_clean(message, 90)}", force=True)

    def clear_reminder(self) -> None:
        self._send("C", force=True)
