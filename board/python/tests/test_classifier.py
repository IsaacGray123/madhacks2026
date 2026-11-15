import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from classifier import ActivityClassifier, Signals  # noqa: E402

FACE = dict(face=True, pose=True, mouth=(0.5, 0.55), nose=(0.5, 0.45), shoulders=((0.3, 0.8), (0.7, 0.8)))


def feed(c, seconds, fps=3, start=0.0, **kw):
    r = None
    for i in range(int(seconds * fps)):
        r = c.update(Signals(ts=start + i / fps, **kw))
    return r, start + seconds


def test_present_by_default():
    c = ActivityClassifier()
    r, _ = feed(c, 5, **FACE)
    assert r.state == "present" and r.face


def test_away_after_threshold_not_before():
    c = ActivityClassifier()
    _, t = feed(c, 5, **FACE)
    r, t = feed(c, 6, start=t)          # 6s absent: still present
    assert r.state == "present"
    r, t = feed(c, 12, start=t)         # long absence -> away (after smoothing)
    assert r.state == "away"


def test_phone_in_hand():
    c = ActivityClassifier()
    _, t = feed(c, 3, **FACE)
    r, _ = feed(c, 8, start=t, phone=(0.4, 0.6, 0.55, 0.85), wrists=[(0.47, 0.8)], **FACE)
    assert r.state == "phone"


def test_drinking_emits_single_event():
    c = ActivityClassifier()
    _, t = feed(c, 3, **FACE)
    events = []
    for i in range(30):
        r = c.update(Signals(ts=t + i / 3, drink=(0.45, 0.5, 0.55, 0.62), wrists=[(0.5, 0.6)], **FACE))
        events += r.events
    assert r.state == "eating"
    assert events == ["drank"]


def test_sleeping_eyes_closed_but_not_when_reading():
    c = ActivityClassifier()
    r, _ = feed(c, 25, eyes_closed=0.9, **FACE)
    assert r.state == "sleeping"

    c = ActivityClassifier()
    r, _ = feed(c, 25, eyes_closed=0.9, head_pitch=30, **FACE)   # looking down at notes
    assert r.state == "present"


def test_slouch_vs_baseline():
    c = ActivityClassifier()
    feed(c, 2, **FACE)
    c.capture_baseline()
    slumped = dict(FACE, nose=(0.5, 0.62))
    r, _ = feed(c, 2, start=10, **slumped)
    assert r.slouch is not None and r.slouch > 0.5
    r, _ = feed(c, 2, start=20, **FACE)
    assert r.slouch == 0


# ---- attention, calibration, hands ----
# Hands are [wrist, thumb tip, index tip]. FACE has the mouth at y=0.55.
EARS = [(0.36, 0.45), (0.64, 0.45)]
TEXTING = [[(0.45, 0.75), (0.47, 0.70), (0.46, 0.68)], [(0.55, 0.75), (0.53, 0.70), (0.54, 0.68)]]
TYPING = [[(0.35, 1.0), (0.37, 0.97), (0.36, 0.95)], [(0.65, 1.0), (0.63, 0.97), (0.64, 0.95)]]


def test_looking_away_is_sustained_attention():
    c = ActivityClassifier()
    r, t = feed(c, 3, **FACE)
    assert r.attention == "screen"
    r, t = feed(c, 5, start=t, head_yaw=40, **FACE)     # a quick glance doesn't count
    assert r.attention == "screen"
    r, t = feed(c, 6, start=t, head_yaw=40, **FACE)     # 11 s turned away
    assert r.attention == "away" and r.state == "present"
    r, _ = feed(c, 1, start=t, **FACE)
    assert r.attention == "screen"


def test_yaw_is_relative_to_baseline():
    c = ActivityClassifier()
    _, t = feed(c, 2, head_yaw=35, **FACE)               # camera off to the side
    c.capture_baseline()
    r, _ = feed(c, 12, start=t, head_yaw=35, **FACE)
    assert r.attention == "screen"


def test_eye_threshold_calibrates_to_the_person():
    # Glasses / narrow eyes read as half closed. Uncalibrated, that looks like sleep.
    r, _ = feed(ActivityClassifier(), 25, eyes_closed=0.65, **FACE)
    assert r.state == "sleeping"
    c = ActivityClassifier()
    _, t = feed(c, 3, eyes_closed=0.45, **FACE)
    c.capture_baseline()
    r, t = feed(c, 25, start=t, eyes_closed=0.65, **FACE)
    assert r.state == "present"
    r, _ = feed(c, 25, start=t, eyes_closed=0.95, **FACE)
    assert r.state == "sleeping"


def test_texting_pose_without_a_detected_phone():
    c = ActivityClassifier()
    _, t = feed(c, 3, **FACE)
    r, _ = feed(c, 10, start=t, gaze_down=0.8, hands=TEXTING, **FACE)
    assert r.state == "phone"


def test_typing_or_clasped_hands_are_not_phone():
    c = ActivityClassifier()
    r, _ = feed(c, 12, gaze_down=0.8, hands=TYPING, **FACE)       # looking at the keyboard
    assert r.state == "present"
    c = ActivityClassifier()
    r, _ = feed(c, 12, hands=TEXTING, **FACE)                     # hands up but eyes on the screen
    assert r.state == "present"


def test_one_hand_with_moving_thumb_is_phone():
    c = ActivityClassifier()
    t = 0.0
    for i in range(36):
        dx = 0.03 if i % 2 else -0.03
        hand = [[(0.5, 0.75), (0.5 + dx, 0.70), (0.5, 0.68)]]
        r = c.update(Signals(ts=t + i / 3, gaze_down=0.8, hands=hand, **FACE))
    assert r.state == "phone"


def test_hand_at_ear_is_phone_call():
    c = ActivityClassifier()
    _, t = feed(c, 3, ears=EARS, **FACE)
    r, _ = feed(c, 8, start=t, ears=EARS, hands=[[(0.33, 0.55), (0.34, 0.5), (0.35, 0.46)]], **FACE)
    assert r.state == "phone"


def test_repeated_bites_are_eating_but_chin_rest_is_not():
    bite = [[(0.5, 0.7), (0.49, 0.56), (0.51, 0.56)]]       # pinched fingertips at the mouth
    chin = [[(0.5, 0.7), (0.42, 0.6), (0.56, 0.56)]]        # open hand under the chin
    c = ActivityClassifier()
    events, t = [], 0.0
    for _ in range(3):                                       # three bites, ~6 s apart
        for hands, secs in ((bite, 1.5), ([], 4.5)):
            for i in range(int(secs * 3)):
                r = c.update(Signals(ts=t, hands=hands, **FACE))
                events += r.events
                t += 1 / 3
    assert r.state == "eating" and events == ["ate"]

    c = ActivityClassifier()
    r, _ = feed(c, 20, hands=chin, **FACE)
    assert r.state == "present" and not r.events
