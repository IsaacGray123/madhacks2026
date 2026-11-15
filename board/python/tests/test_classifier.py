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
