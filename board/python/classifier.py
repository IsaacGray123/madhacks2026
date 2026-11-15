"""Rule-based activity classifier. Pure Python (no MediaPipe import) so it can be unit tested.

Input: per-frame `Signals` extracted by vision.py. Output: smoothed camera state + detected events.
"""
from __future__ import annotations

import math
from collections import Counter, deque
from dataclasses import dataclass, field

import config as C

Point = tuple[float, float]
Box = tuple[float, float, float, float]  # x0, y0, x1, y1 normalized to [0, 1]


@dataclass
class Signals:
    ts: float                       # seconds
    face: bool = False
    pose: bool = False
    eyes_closed: float = 0.0        # 0..1
    head_pitch: float = 0.0         # degrees, positive = looking down (after PITCH_SIGN)
    mouth: Point | None = None
    nose: Point | None = None
    shoulders: tuple[Point, Point] | None = None
    wrists: list[Point] = field(default_factory=list)
    phone: Box | None = None
    drink: Box | None = None
    food: Box | None = None


@dataclass
class Result:
    state: str
    conf: float
    face: bool
    slouch: float | None
    events: list[str]
    raw: str


def _center(b: Box) -> Point:
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def _dist(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _inside(p: Point, b: Box, pad: float) -> bool:
    return b[0] - pad <= p[0] <= b[2] + pad and b[1] - pad <= p[1] <= b[3] + pad


def posture_ratio(nose: Point | None, shoulders: tuple[Point, Point] | None) -> float | None:
    """Nose height above the shoulder line, normalized by shoulder width. Drops when you slouch."""
    if not nose or not shoulders:
        return None
    (lx, ly), (rx, ry) = shoulders
    width = abs(lx - rx)
    if width < 0.05:
        return None
    return (((ly + ry) / 2) - nose[1]) / width


class ActivityClassifier:
    def __init__(self) -> None:
        self.absent_since: float | None = None
        self.eyes_closed_since: float | None = None
        self.face_hidden_since: float | None = None
        self.history: deque[tuple[float, str]] = deque()
        self.stable = "present"
        self.last_event_ts: dict[str, float] = {}
        self.baseline_ratio: float | None = None
        self.baseline_pitch = 0.0
        self.last_ratio: float | None = None
        self.last_pitch = 0.0

    # ---- calibration ----
    def capture_baseline(self) -> None:
        """Called at session start (the laptop's 3-2-1 countdown) while the user sits naturally."""
        self.baseline_ratio = self.last_ratio
        self.baseline_pitch = self.last_pitch

    # ---- per-frame ----
    def raw_state(self, s: Signals) -> tuple[str, list[str]]:
        events: list[str] = []
        t = s.ts

        # Away: nobody in frame for a while.
        if not s.face and not s.pose:
            self.absent_since = self.absent_since if self.absent_since is not None else t
            self.eyes_closed_since = None
            self.face_hidden_since = None
            return ("away" if t - self.absent_since >= C.AWAY_AFTER_S else self.stable), events
        self.absent_since = None

        # Head on the desk: body visible, face not.
        if s.pose and not s.face:
            self.face_hidden_since = self.face_hidden_since if self.face_hidden_since is not None else t
            if t - self.face_hidden_since >= C.SLEEP_FACE_DOWN_S:
                return "sleeping", events
        else:
            self.face_hidden_since = None

        # Phone: a phone with a wrist on it, or a phone up near the face.
        if s.phone:
            near_hand = any(_inside(w, s.phone, C.PHONE_NEAR_HAND) for w in s.wrists)
            near_face = s.mouth is not None and _dist(_center(s.phone), s.mouth) < C.NEAR_FACE * 1.6
            if near_hand or near_face:
                self.eyes_closed_since = None
                return "phone", events

        # Eating / drinking: food or a drink at the mouth (or a wrist at the mouth while one is visible).
        item = s.drink or s.food
        if item and s.mouth:
            wrist_at_mouth = any(_dist(w, s.mouth) < C.NEAR_FACE for w in s.wrists)
            if _dist(_center(item), s.mouth) < C.NEAR_FACE or wrist_at_mouth:
                kind = "drank" if s.drink else "ate"
                last = self.last_event_ts.get(kind, -1e9)
                if t - last >= C.EAT_EVENT_COOLDOWN_S:
                    self.last_event_ts[kind] = t
                    events.append(kind)
                return "eating", events

        # Sleeping: eyes closed for a long time while NOT looking down at notes
        # (looking down makes eyelids read as closed).
        looking_down = (s.head_pitch - self.baseline_pitch) > C.LOOKING_DOWN_DEG
        if s.face and s.eyes_closed >= C.EYES_CLOSED_THRESHOLD and not looking_down:
            self.eyes_closed_since = self.eyes_closed_since if self.eyes_closed_since is not None else t
            if t - self.eyes_closed_since >= C.SLEEP_EYES_CLOSED_S:
                return "sleeping", events
        else:
            self.eyes_closed_since = None

        return "present", events

    def slouch(self) -> float | None:
        if self.last_ratio is None or not self.baseline_ratio or self.baseline_ratio <= 0:
            return None
        drop = (self.baseline_ratio - self.last_ratio) / self.baseline_ratio
        return max(0.0, min(1.0, drop / C.SLOUCH_FULL_DROP))

    def update(self, s: Signals) -> Result:
        ratio = posture_ratio(s.nose, s.shoulders)
        if ratio is not None:
            self.last_ratio = ratio
        if s.face:
            self.last_pitch = s.head_pitch

        raw, events = self.raw_state(s)

        # Majority vote over the last few seconds to stop flicker.
        self.history.append((s.ts, raw))
        while self.history and s.ts - self.history[0][0] > C.SMOOTHING_WINDOW_S:
            self.history.popleft()
        counts = Counter(st for _, st in self.history)
        top, n = counts.most_common(1)[0]
        # Ties keep the previous state.
        if n > len(self.history) / 2 or top == self.stable:
            self.stable = top
        conf = counts[self.stable] / len(self.history)

        return Result(
            state=self.stable,
            conf=conf,
            face=s.face,
            slouch=self.slouch() if s.pose else None,
            events=events,
            raw=raw,
        )
