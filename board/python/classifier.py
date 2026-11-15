"""Rule-based activity classifier. Pure Python (no MediaPipe import) so it can be unit tested.

Input: per-frame `Signals` extracted by vision.py. Output: smoothed camera state + attention + detected events.
"""
from __future__ import annotations

import math
import statistics
from collections import deque
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
    head_yaw: float = 0.0           # degrees, head turned left/right (sign doesn't matter; compared to baseline)
    gaze_down: float = 0.0          # 0..1, eyes looking down (eyeLookDown blendshapes)
    gaze_up: float = 0.0            # 0..1, eyes looking up (eyeLookUp blendshapes)
    gaze_side: float = 0.0          # 0..1, eyes turned to one side (eyeLookOut/In blendshapes)
    mouth: Point | None = None
    nose: Point | None = None
    ears: list[Point] = field(default_factory=list)      # left/right edge of the face, near the ears
    shoulders: tuple[Point, Point] | None = None
    wrists: list[Point] = field(default_factory=list)    # from pose
    hands: list[list[Point]] = field(default_factory=list)  # per hand: [wrist, thumb tip, index tip]
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
    attention: str | None = None    # "screen" | "down" | "away" | None (no face)


def _center(b: Box) -> Point:
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def _dist(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _inside(p: Point, b: Box, pad: float) -> bool:
    return b[0] - pad <= p[0] <= b[2] + pad and b[1] - pad <= p[1] <= b[3] + pad


def _mid(a: Point, b: Point) -> Point:
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def posture_ratio(nose: Point | None, shoulders: tuple[Point, Point] | None) -> float | None:
    """Nose height above the shoulder line, normalized by shoulder width. Drops when you slouch."""
    if not nose or not shoulders:
        return None
    (lx, ly), (rx, ry) = shoulders
    width = abs(lx - rx)
    if width < 0.05:
        return None
    return (((ly + ry) / 2) - nose[1]) / width


def raised_hands(s: Signals) -> list[list[Point]]:
    """Hands held up in front of the body (between mouth level and chest), i.e. not resting on the desk."""
    if not s.mouth:
        return []
    my = s.mouth[1]
    return [h for h in s.hands if my - C.HAND_ZONE_ABOVE <= h[0][1] <= my + C.HAND_ZONE_BELOW]


def hands_together(hands: list[list[Point]]) -> bool:
    return len(hands) >= 2 and _dist(hands[0][0], hands[1][0]) < C.HANDS_TOGETHER


def hand_at_ear(s: Signals) -> bool:
    return any(_dist(p, ear) < C.NEAR_EAR for h in s.hands for p in (h[0], h[2]) for ear in s.ears)


def bite_at_mouth(s: Signals) -> bool:
    """Thumb and index pinched together (holding food) right at the mouth. A chin rest is an open hand, not a pinch."""
    if not s.mouth:
        return False
    for _, thumb, index in s.hands:
        if _dist(thumb, index) < C.PINCH_DIST and _dist(_mid(thumb, index), s.mouth) < C.NEAR_MOUTH_FINGERS:
            return True
    return False


class ActivityClassifier:
    def __init__(self) -> None:
        self.absent_since: float | None = None
        self.eyes_closed_since: float | None = None
        self.face_hidden_since: float | None = None
        self.look_away_since: float | None = None
        self.look_back_since: float | None = None
        self.looking_away = False
        self.candidate: str | None = None
        self.candidate_since = 0.0
        self.phone_pose_since: float | None = None
        self.phone_call_since: float | None = None
        self.history: deque[tuple[float, str]] = deque()
        self.stable = "present"
        self.last_event_ts: dict[str, float] = {}
        # Per-person calibration, captured during the laptop's 3-2-1 countdown.
        self.baseline_ratio: float | None = None
        self.baseline_pitch = 0.0
        self.baseline_yaw = 0.0
        self.baseline_eyes: float | None = None
        self.last_ratio: float | None = None
        self.last_pitch = 0.0
        self.last_yaw = 0.0
        self.eyes_avg: float | None = None
        # Hand history for thumb motion and bite counting.
        self.thumb_hist: deque[tuple[float, Point]] = deque()
        self.last_hands: list[list[Point]] | None = None
        self.was_at_mouth = False
        self.bites: deque[float] = deque()

    # ---- calibration ----
    def capture_baseline(self) -> None:
        """Called at session start (the laptop's 3-2-1 countdown) while the user sits naturally."""
        self.baseline_ratio = self.last_ratio
        self.baseline_pitch = self.last_pitch
        self.baseline_yaw = self.last_yaw
        self.baseline_eyes = self.eyes_avg

    def eyes_closed_threshold(self) -> float:
        if self.baseline_eyes is None:
            return C.EYES_CLOSED_THRESHOLD
        return min(C.EYES_CLOSED_MAX, max(C.EYES_CLOSED_MIN, self.baseline_eyes + C.EYES_CLOSED_MARGIN))

    # ---- attention ----
    def attention(self, s: Signals) -> str | None:
        """Where the user is looking: at the screen, down (desk/lap/keyboard), or away.

        Away = head turned to the side, eyes turned to the side, or looking up/past the screen,
        held for LOOK_AWAY_S. It ends only after looking back for LOOK_BACK_S, so a quick glance
        at the screen doesn't split a distracted stretch. Turning far enough loses the face mesh,
        so a visible body/hands without a face also counts as turned away.
        """
        t = s.ts
        if not s.face and not (s.pose or s.hands):
            self.look_away_since = self.look_back_since = None
            self.looking_away = False
            return None
        if s.face:
            turned = abs(s.head_yaw - self.baseline_yaw) > C.LOOK_AWAY_YAW_DEG or s.gaze_side > C.GAZE_SIDE_THRESHOLD
            up = (self.baseline_pitch - s.head_pitch) > C.LOOK_UP_DEG or s.gaze_up > C.GAZE_UP_THRESHOLD
            away_now = turned or up
        else:
            away_now = True
        if away_now:
            self.look_back_since = None
            self.look_away_since = self.look_away_since if self.look_away_since is not None else t
            if t - self.look_away_since >= C.LOOK_AWAY_S:
                self.looking_away = True
        else:
            self.look_away_since = None
            if self.looking_away:
                self.look_back_since = self.look_back_since if self.look_back_since is not None else t
                if t - self.look_back_since >= C.LOOK_BACK_S:
                    self.looking_away = False
                    self.look_back_since = None
        if self.looking_away:
            return "away"
        if not s.face:
            return None
        down = (s.head_pitch - self.baseline_pitch) > C.LOOKING_DOWN_DEG or s.gaze_down > C.GAZE_DOWN_THRESHOLD
        return "down" if down else "screen"

    # ---- hands ----
    def thumbs_moving(self, s: Signals, raised: list[list[Point]]) -> bool:
        """Thumb tip moving relative to its wrist (texting/scrolling), measured over a short window."""
        t = s.ts
        # vision.py carries hand results over between hand-model runs; only record fresh samples.
        if raised and s.hands != self.last_hands:
            w, thumb, _ = raised[0]
            self.thumb_hist.append((t, (thumb[0] - w[0], thumb[1] - w[1])))
        self.last_hands = s.hands
        while self.thumb_hist and t - self.thumb_hist[0][0] > C.THUMB_WINDOW_S:
            self.thumb_hist.popleft()
        if not raised or len(self.thumb_hist) < 3:
            return False
        xs = [p[0] for _, p in self.thumb_hist]
        ys = [p[1] for _, p in self.thumb_hist]
        return math.hypot(statistics.pstdev(xs), statistics.pstdev(ys)) > C.THUMB_MOTION

    def count_bites(self, s: Signals) -> int:
        at_mouth = bite_at_mouth(s)
        if at_mouth and not self.was_at_mouth:
            self.bites.append(s.ts)
        self.was_at_mouth = at_mouth
        while self.bites and s.ts - self.bites[0] > C.BITE_WINDOW_S:
            self.bites.popleft()
        return len(self.bites)

    def _event(self, kind: str, t: float, events: list[str]) -> None:
        if t - self.last_event_ts.get(kind, -1e9) >= C.EAT_EVENT_COOLDOWN_S:
            self.last_event_ts[kind] = t
            events.append(kind)

    # ---- per-frame ----
    def raw_state(self, s: Signals, attention: str | None) -> tuple[str, list[str]]:
        events: list[str] = []
        t = s.ts
        raised = raised_hands(s)
        thumbs = self.thumbs_moving(s, raised)
        bites = self.count_bites(s)

        # Away: nobody in frame for a while.
        if not s.face and not s.pose and not s.hands:
            self.absent_since = self.absent_since if self.absent_since is not None else t
            self.eyes_closed_since = None
            self.face_hidden_since = None
            self.phone_pose_since = self.phone_call_since = None
            return ("away" if t - self.absent_since >= C.AWAY_AFTER_S else self.stable), events
        self.absent_since = None

        # Head on the desk: body visible, face not.
        if (s.pose or s.hands) and not s.face:
            self.face_hidden_since = self.face_hidden_since if self.face_hidden_since is not None else t
            if t - self.face_hidden_since >= C.SLEEP_FACE_DOWN_S:
                return "sleeping", events
        else:
            self.face_hidden_since = None

        # Phone (seen): a phone with a hand on it, or a phone up near the face.
        if s.phone:
            fingers = [p for h in s.hands for p in (h[0], h[2])]
            near_hand = any(_inside(w, s.phone, C.PHONE_NEAR_HAND) for w in s.wrists + fingers)
            near_face = s.mouth is not None and _dist(_center(s.phone), s.mouth) < C.NEAR_FACE * 1.6
            if near_hand or near_face:
                self.eyes_closed_since = None
                return "phone", events

        # Phone call (phone hidden by the hand): a hand held at the side of the face.
        if hand_at_ear(s):
            self.phone_call_since = self.phone_call_since if self.phone_call_since is not None else t
            if t - self.phone_call_since >= C.PHONE_CALL_S:
                return "phone", events
        else:
            self.phone_call_since = None

        # Texting (phone too small/hidden to detect): looking down with raised hands held together
        # or with thumbs moving. Typing hands rest lower, on the desk, so they don't count.
        if attention == "down" and raised and (hands_together(raised) or thumbs):
            self.phone_pose_since = self.phone_pose_since if self.phone_pose_since is not None else t
            if t - self.phone_pose_since >= C.PHONE_POSE_S:
                self.eyes_closed_since = None
                return "phone", events
        else:
            self.phone_pose_since = None

        # Eating / drinking: food or a drink at the mouth (or a hand at the mouth while one is visible).
        item = s.drink or s.food
        if item and s.mouth:
            fingers = [h[2] for h in s.hands]
            hand_at_mouth = any(_dist(w, s.mouth) < C.NEAR_FACE for w in s.wrists + fingers)
            if _dist(_center(item), s.mouth) < C.NEAR_FACE or hand_at_mouth:
                self._event("drank" if s.drink else "ate", t, events)
                return "eating", events

        # Eating (food not detected): repeated bites with pinched fingers.
        if bites >= C.BITES_FOR_EATING and t - self.bites[-1] <= C.EATING_HOLD_S:
            self._event("ate", t, events)
            return "eating", events

        # Sleeping: eyes closed for a long time while NOT looking down at notes
        # (looking down makes eyelids read as closed). Uses head pitch only: eyeLookDown
        # also rises when the eyes are shut, so it can't tell reading from sleeping.
        looking_down = (s.head_pitch - self.baseline_pitch) > C.LOOKING_DOWN_DEG
        if s.face and s.eyes_closed >= self.eyes_closed_threshold() and not looking_down:
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
            self.last_yaw = s.head_yaw
            # Running average of how "closed" this person's eyes read when open (glasses, eye shape).
            self.eyes_avg = s.eyes_closed if self.eyes_avg is None else 0.8 * self.eyes_avg + 0.2 * s.eyes_closed

        attention = self.attention(s)
        raw, events = self.raw_state(s, attention)

        # Switch once a new state has held for SWITCH_AFTER_S: fast, but one odd frame can't flip it.
        if raw == self.stable:
            self.candidate = None
        elif raw != self.candidate:
            self.candidate, self.candidate_since = raw, s.ts
        if self.candidate is not None and s.ts - self.candidate_since >= C.SWITCH_AFTER_S:
            self.stable, self.candidate = self.candidate, None

        # Confidence: share of the last few seconds that agrees with the reported state.
        self.history.append((s.ts, raw))
        while self.history and s.ts - self.history[0][0] > C.SMOOTHING_WINDOW_S:
            self.history.popleft()
        conf = sum(1 for _, st in self.history if st == self.stable) / len(self.history)

        return Result(
            state=self.stable,
            conf=conf,
            face=s.face,
            slouch=self.slouch() if s.pose else None,
            events=events,
            raw=raw,
            attention=attention,
        )
