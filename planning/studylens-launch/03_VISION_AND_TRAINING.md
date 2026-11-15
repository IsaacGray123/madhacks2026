# Faster camera feedback and better recognition

## Desired behavior

The proposed default is a gentle visual cue after about 2.5 seconds of sustained, supported look-away evidence during an active study session. A return to the calibrated study direction clears the cue after about 0.5 seconds. Repeated alerts for one continuous episode should be suppressed.

These are proposed timing targets. They need testing with the actual user, camera angle, glasses, lighting, and workload. The system estimates observable behavior. A head turn or downward glance can belong to legitimate studying. Offer Screen focus and Screen plus notes modes, with the latter allowing the calibrated note-taking area.

Maintain two temporal interpretations. Fast feedback supports the creature and a short nudge. Session history uses a more conservative state so a glance or stretch does not fragment the timeline. Both operate on the same fresh measurements.

## Current bottlenecks found in the code

| Layer | Current code | Effect |
|---|---|---|
| Capture | 640 by 480 requested, one latest-frame slot, no stored capture timestamp or sequence | Copies recent frames but cannot prove sample age or distinguish repeated reads of one frame |
| Main loop | `TARGET_FPS = 3.0` | Caps the loop at three updates/sec when inference is fast enough |
| Face | Runs on every loop using image mode | Repeats single-image inference rather than explicitly using video tracking |
| Other models | Four-slot hands/pose/hands/objects cycle when hand model exists | Nominally 1.5 hand updates/sec and 0.75 pose/object updates/sec at three loops/sec |
| Carry-over | Hands, pose, and objects retained between scheduled runs | Useful for continuity, but timestamps/expiry need explicit handling |
| Phone inference | Texting dwell four seconds, call dwell three seconds, then activity vote | Can react slowly even when hand evidence is available |
| Attention | Side-look dwell eight seconds | User's requested couple-second cue needs a faster path |
| Activity state | Six-second sample majority | Adds inertia and depends on sampling frequency |
| Publishing | One-second board loop | Adds up to roughly one second of transport scheduling delay |
| Laptop session | One-second tick | Adds another update interval on the display/history path |
| Preview | Default preview is enabled. New commit `b9ec5eb` encodes on a separate thread at a 12-FPS target | Video and inference now have independent cadences, but still share CPU, stdout locking, and network resources |

The configured three FPS is a target, not a measured hardware result. Camera capture FPS, face-analysis FPS, object-analysis FPS, preview FPS, and visible reaction latency are different measurements.

The hand features also require `models/hand_landmarker.task`. The older hardware test established initialization of the three core face/pose/object models. Verify the optional hand asset and its runtime separately. The current code falls back to alternating pose and object updates when that asset is absent.

## Measurement before changes

Add lightweight timing fields around existing stages. Report aggregated values every five seconds to stderr. Avoid printing per-frame debug text during the performance run.

- Store a monotonic capture timestamp and increasing frame sequence when `Camera._loop` receives a successful frame.
- Carry the sequence and capture age into inference. Skip a sequence already processed.
- Time RGB conversion, face, hand, pose, object, classifier, preview encoding, and JSON writing separately using a monotonic clock.
- Track each model's invocation count, latest measurement age, queue depth, and achieved update rate.
- On the laptop, record local receipt time and time to visible state/alert. Receipt-time freshness avoids requiring perfectly synchronized laptop and board clocks.
- A capture-to-laptop end-to-end estimate needs either a clock-offset method or a shared timing reference. Measure subpaths on their own clocks and film the physical action plus screen for the overall demo latency.
- Measure CPU and thermal behavior over at least five minutes. Capture and inference should keep bounded buffers if the consumer slows down.

Benchmark the current pipeline with preview closed and open, then repeat each candidate with the same recorded/live actions and lighting. Keep the working Python 3.12/MediaPipe 0.10.18 environment pinned during this process.

## Candidate performance preset

| Setting | Initial candidate | Reason and tradeoff |
|---|---|---|
| Camera request | 480 by 360, or a supported 320 by 240 fallback | Lower copy/conversion cost, with potentially smaller phone detail |
| Camera capture rate | Request 15 FPS and measure actual delivered rate | A fresh frame is available when an inference slot is ready |
| Main face-analysis target | Start at 6 Hz, then test 8 Hz if measured budget allows | Faster attention evidence |
| Face inference | VIDEO mode with tracking | Can reuse tracked regions instead of repeating full detection work |
| Pose | Around 1–2 updates/sec, with source-age checks | Posture changes generally permit a slower cadence |
| Hands | Around 2 updates/sec while relevant; lower rate otherwise | Retain gesture cues without running constantly |
| Object detector | Around 1–2 updates/sec, with occasional extra checks during phone candidates | Keep direct object evidence while budgeting CPU |
| Preview | Test the existing 12-FPS target with 240-pixel width and JPEG quality about 45–55, then compare 6 FPS | Preserve smoother video while measuring inference contention. Use a 2–3-FPS fallback if CPU or network load requires it |
| Fast evidence publish | On evidence transitions plus bounded periodic updates around 4 Hz | Reduces one-second publishing delay |
| Statistics/MCU updates | Keep roughly 1 Hz for reports/timers | Avoid unnecessary desktop/Bridge redraw load |

All rates above are proposed targets, and they are not promised UNO Q performance. They are not a requirement to run every scheduled model simultaneously.

For one sequential worker, a useful first budget is

```text
6 * face_ms + 2 * hands_ms + 1.5 * pose_ms + 1 * object_ms
  + capture_conversion_preview_and_serialization_ms_per_second
  < 1000 ms of worker time per second
```

The measured model costs determine the feasible schedule. If face processing alone consumes most of the budget, reduce its target, reduce secondary work, or benchmark an alternative model path. Extra Python threads can create CPU contention when native libraries already use several threads.

OpenCV capture property requests depend on the backend and device. Check the returned mode and measured delivery rate. A successful `.set()` does not establish that the camera accepted the requested mode. Lower external resolution also leaves many internal model tensor sizes unchanged. [OpenCV VideoCapture](https://docs.opencv.org/4.x/d8/dfe/classcv_1_1VideoCapture.html)

## MediaPipe tracking changes

The installed MediaPipe 0.10.18 source exposes video-mode face inference. Configure a task for VIDEO and call `detect_for_video` with strictly increasing millisecond timestamps. Pose and hand tasks need the corresponding mode/method change as well. Keep a separately monotonic timestamp stream for each model when schedules differ. [Pinned face-task source](https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.18/mediapipe/tasks/python/vision/face_landmarker.py)

Reference face setup follows. It belongs inside the existing Python 3.12 worker when implemented.

```python
import time
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision as mp_vision

options = mp_vision.FaceLandmarkerOptions(
    base_options=mp_tasks.BaseOptions(model_asset_path="models/face_landmarker.task"),
    running_mode=mp_vision.RunningMode.VIDEO,
    num_faces=1,
    output_face_blendshapes=True,
    output_facial_transformation_matrixes=True,
)
face = mp_vision.FaceLandmarker.create_from_options(options)
last_face_timestamp_ms = -1

# When a new camera sample is available, use its monotonic capture time.
capture_timestamp_ms = time.monotonic_ns() // 1_000_000
timestamp_ms = max(capture_timestamp_ms, last_face_timestamp_ms + 1)
# `image` is the existing mediapipe.Image for this fresh camera sample.
# result = face.detect_for_video(image, timestamp_ms)
last_face_timestamp_ms = timestamp_ms
```

The commented inference call is an integration point. Use the capture timestamp already attached to the frame, rather than creating a new timestamp each time an old image is reread. Close every task on worker exit.

## Schedule by time and relevance

Replace the rigid four-frame slot with per-model next-due times. Run face analysis on each selected fresh frame. Run at most one expensive secondary task on that frame at first. Select an overdue task based on measurement age and current evidence.

1. Pose gets priority if posture evidence is stale.
2. Hands get extra checks when gaze is down, a hand enters a likely phone region, or a phone/call candidate exists.
3. Objects get periodic checks even without a candidate so new phones can be discovered.
4. Drop overdue work if a queue would accumulate. Process the newest captured sample.
5. Record each source timestamp and clear expired results. A pose/hands/object update from an old frame must never be presented as a new observation.

Proposed expiry starts around two expected update periods, with an upper bound chosen from measurements. Compare expiration against each source's own timestamp. Track hand sample sequence explicitly. The current code uses inequality of carried hand coordinates to detect fresh samples, which can confuse unchanged measurements with unsampled data.

For preview, keep only the latest encoded frame and one in-flight network send per client. Cancel or skip an older preview when the next one arrives. The current `run_coroutine_threadsafe` path can schedule sends repeatedly while a slow client is still waiting. State/control messages should retain priority over video.

Hardware acceleration is a later investigation. It needs a verified delegate, supported models, and a comparison on this board. Preserve the CPU path that already initializes models while testing the changes above.

## Fast look-away feedback

Add fresh evidence alongside the existing attention result. Proposed optional protocol fields are an evidence candidate, validity, a per-sample sequence, and source age. Existing readers can continue using the established fields.

```ts
interface AttentionEvidence {
  candidate: 'screen' | 'down' | 'side' | 'unknown'
  valid: boolean
  sampleSequence: number
  ageMs: number
}
```

A fast gate evaluates the candidate during active study. The existing attention field can remain a more conservative history interpretation. A temporary feedback field or explicit attention-cue event lets the companion react before the timeline changes. Avoid overwriting recorded session totals just to animate quickly.

Proposed initial values are a 2.5-second entry dwell, 0.5-second return dwell, and a 60-second global cooldown. One continuous episode produces one cue. These are adjustable product defaults. A visual-only nudge is the first version.

Eligibility requires an active, unpaused session, fresh camera evidence, enabled notifications, and a study task that expects screen attention. Planned breaks, eye rests, a screen-plus-notes region, and an explicit snooze suppress the cue. A hidden or missing face is represented as unknown until presence logic establishes away.

The gate below is a reference for timing semantics. It accepts already-calibrated, valid look-away evidence. It does not implement gaze estimation.

```python
from dataclasses import dataclass

@dataclass
class AttentionGate:
    dwell_s: float = 2.5
    return_s: float = 0.5
    cooldown_s: float = 60.0
    started: float | None = None
    recovery: float | None = None
    fired: bool = False
    last_alert: float = float("-inf")

    def update(self, now: float, looking_away: bool,
               eligible: bool, valid: bool) -> bool:
        if not eligible or not valid:
            self.started = None
            self.recovery = None
            return False
        if not looking_away:
            self.started = None
            self.recovery = now if self.recovery is None else self.recovery
            if now - self.recovery >= self.return_s:
                self.fired = False
            return False
        self.recovery = None
        self.started = now if self.started is None else self.started
        if self.fired or now - self.started < self.dwell_s:
            return False
        if now - self.last_alert < self.cooldown_s:
            return False
        self.fired = True
        self.last_alert = now
        return True
```

Call with a monotonic clock. Test session restart, settings updates, and large sample gaps explicitly. Before invoking the gate, reject duplicate sequences and evidence older than the configured freshness limit. The gate's low-confidence reset prevents a missing-data interval from completing a dwell by itself.

For the laptop, create a separate attention prompt/event using the existing popup infrastructure where practical. Keep its copy and dismissal semantics distinct from the water/eat timer engine. The main process owns throttling so a minimized window and the LCD cannot each fire an independent prompt. Use copy such as “Ready to return to your screen?” and let the creature give one wave.

## Calibration and recognition improvements

### Screen attention

- Capture several seconds of normal screen viewing and use robust medians for head pose and open-eye signals.
- Ask the user to look toward the screen edges, the keyboard, and their note area. Store the ranges as this camera setup's allowed study zones.
- Head pose and face blendshapes provide approximate orientation evidence. Face blendshapes represent facial expression coefficients and require validation before being treated as gaze direction. Exact screen fixation is a stronger claim than this setup currently supports. [Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker), [blendshape model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf)
- Reset the calibration when the camera moves or a different user starts. An initial manual Recalibrate button is sufficient.

### Phone use

- Prefer a detected phone box plus a nearby hand as the strongest initial signal.
- Keep hidden-phone gestures as a separately identified candidate. Hand-at-ear, clasped hands, or moving thumbs alone can be ambiguous.
- Retain object confidence, handedness/sample age, and hand visibility in diagnostics. The current simplified signals discard object confidence after thresholding.
- Reduce dwell only after testing typing, chin resting, note taking, drinking, and holding a calculator as negative examples.
- Use a longer, conservative dwell for gesture-only phone inference than for a clear detected phone-in-hand event.
- Consider a smaller search crop around fresh hands for object detection, while periodically checking the full image. Map crop coordinates back to the common normalized image frame before using the existing geometry rules.

### Posture

- Capture a neutral seated baseline using several reliable pose samples and stable shoulder visibility.
- Combine nose/shoulder geometry, head pitch, shoulder tilt, and torso orientation when enough landmarks are visible. Missing hips in a desk camera should lower confidence for torso estimates.
- Keep posture separate from distraction. Slouching and phone use can occur at the same time.
- Report a continuous deviation and use a sustained dwell for reminders. The existing posture reminder default is 60 seconds. A proposed demo preset can shorten it, with a visible Demo label and a return to the user's real defaults afterward.
- Avoid carrying a stale posture value into new reminders. In the current session code, the slouch passed to the reminder engine deserves the same freshness check used by camera-state selection.

## Training path in steps

Training becomes useful once the measurement and labeling path is reliable. Start by training the behavior layer from the existing landmarks and object detections. It is small enough to evaluate with ordinary arithmetic on the board or laptop.

1. Define the behaviors. Initial attention labels are `screen`, `reading_notes`, `look_away`, and `phone`. Posture gets an independent label because it can co-occur with any attention behavior.
2. Add opt-in local sample capture with timestamps and the current feature values. A saved video clip is useful for verification, and collection should be explicit. The existing app preview is transient and should not become a recorder silently.
3. Record normal work first, then repeat each target behavior. Include different phone colors/angles, glasses, bright/dim conditions, notes, typing, chin resting, and short glances.
4. For an initial pilot, aim for roughly 10 events per behavior under several conditions and enough continuous normal study to count false alerts. This is a collection starting point, not evidence that a trained model will generalize. For a broader model, collect multiple users and days.
5. Annotate event start/end times and uncertain intervals. Review the video with the signals. Exclude ambiguous labels from supervised training until reviewed.
6. Create sliding 1.5-second feature windows every 250 ms. Include the session/person/clip identifiers. If windows overlap, keep the entire session within a single dataset split.
7. Hold out complete sessions for testing. For claims about new users, hold out people as well. Fit scaling using only the training data. [scikit-learn grouped splitting](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupShuffleSplit.html)
8. Train a regularized multiclass logistic classifier as an interpretable baseline. Compare it against the existing rules on the same held-out data.
9. Inspect the confusion matrix, event recall, false alerts per hour of normal work, and detection-delay distribution. Window-level accuracy alone can hide poor event timing.
10. Export feature names, scaling, class order, weights, intercepts, training metadata, and version as JSON. Evaluate those coefficients with plain arithmetic in the existing environment.
11. Run the trained layer in shadow mode for a session. Log what it would have said before letting it trigger notifications.
12. If phone boxes are missing even in clear recorded examples, train/fine-tune the object detector separately using bounding-box labels. MediaPipe's repository contains Model Maker object-detector examples and export code. Pin a working training environment, export a compatible TFLite model with the expected metadata, then verify it in the board's existing runtime. [Model Maker example](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/model_maker/python/vision/object_detector/object_detector_demo.py)

## Dataset contract

Proposed `windows.csv` has one row per labeled feature window. Every feature below must be calculated identically during collection, training, and inference. Clip annotations and raw data are separate files.

```csv
session_id,clip_id,label,mean_abs_yaw,mean_pitch_delta,mean_gaze_side,mean_gaze_down,phone_fraction,hand_phone_overlap,thumb_motion,face_fraction
```

Use degrees for head angles, normalized blendshape/box-derived values for fractions, and a scale normalized to hand or face size for movement. Compute phone fraction as the fraction of fresh eligible object observations containing a detected phone. Keep missing indicators in a later schema revision if many windows lack a model source. The initial training script below rejects missing/nonfinite values, so collection must produce a consistent complete feature set.

## Laptop training commands

This is a proposed separate training environment. Install Python 3.12 on the training computer or use a Python environment manager to obtain it. The Windows `py -0p` command lists installed interpreters when the launcher is available. The training environment is separate from the UNO Q runtime.

```powershell
py -3.12 -m venv .venv-train
.\.venv-train\Scripts\python.exe -m pip install numpy scikit-learn
.\.venv-train\Scripts\python.exe train_attention.py windows.csv attention_model.json
```

Save the reference script below as `train_attention.py` when implementation begins. Package versions should be recorded with the trained model. This script requires the dataset collector and feature-window builder described above. It does not create labels or manufacture training examples.

```python
import csv
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "mean_abs_yaw", "mean_pitch_delta", "mean_gaze_side", "mean_gaze_down",
    "phone_fraction", "hand_phone_overlap", "thumb_motion", "face_fraction",
]

def main():
    dataset, destination = sys.argv[1:]
    with open(dataset, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("The dataset is empty")
    x = np.asarray([[float(row[key]) for key in FEATURES] for row in rows])
    y = np.asarray([row["label"] for row in rows])
    groups = np.asarray([row["session_id"] for row in rows])
    expected = {"screen", "reading_notes", "look_away", "phone"}
    if set(y) != expected or not np.isfinite(x).all():
        raise ValueError("Collect all four classes with finite feature values")
    if len(set(groups)) < 5:
        raise ValueError("Collect at least five independent sessions for this pilot split")
    train, test = next(GroupShuffleSplit(
        n_splits=1, test_size=0.2, random_state=42,
    ).split(x, y, groups))
    if set(y[train]) != expected or set(y[test]) != expected:
        raise ValueError("This split lacks a class. Collect broader sessions before training")
    model = make_pipeline(
        StandardScaler(),
        LogisticRegression(class_weight="balanced", max_iter=1000),
    )
    model.fit(x[train], y[train])
    predicted = model.predict(x[test])
    print(classification_report(y[test], predicted, zero_division=0))
    print(confusion_matrix(y[test], predicted, labels=sorted(expected)))
    scaler = model.named_steps["standardscaler"]
    classifier = model.named_steps["logisticregression"]
    exported = {
        "schema_version": 1,
        "feature_names": FEATURES,
        "classes": classifier.classes_.tolist(),
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "weights": classifier.coef_.tolist(),
        "bias": classifier.intercept_.tolist(),
        "train_sessions": sorted(set(groups[train])),
        "test_sessions": sorted(set(groups[test])),
    }
    Path(destination).write_text(json.dumps(exported, indent=2), encoding="utf-8")
    print("Exported a candidate model. Review held-out event performance before deployment.")

if __name__ == "__main__":
    main()
```

Five sessions is a proposed minimum for exercising this pilot split. It is not a scientific claim of sufficient sample size. Sessions can contain repeated short examples, but evaluation should also include long ordinary study periods.

## Lightweight deployment reference

Multiclass logistic regression uses a softmax interpretation of class scores. The coefficient format above supports a small pure-Python evaluator. Its scores need validation before being presented as confidence in actual attention. [LogisticRegression documentation](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)

```python
import math

def predict_attention(model, features):
    names = model["feature_names"]
    values = [float(features[name]) for name in names]
    if not all(math.isfinite(value) for value in values):
        return None
    scaled = [
        (value - mean) / scale
        for value, mean, scale in zip(values, model["mean"], model["scale"])
    ]
    logits = [
        sum(weight * value for weight, value in zip(weights, scaled)) + bias
        for weights, bias in zip(model["weights"], model["bias"])
    ]
    peak = max(logits)
    exponentials = [math.exp(score - peak) for score in logits]
    total = sum(exponentials)
    probabilities = [value / total for value in exponentials]
    index = max(range(len(probabilities)), key=probabilities.__getitem__)
    return model["classes"][index], probabilities[index]
```

The model loader must validate schema version, feature order, dimensions, finite coefficients, positive scales, and expected classes before accepting a file. Compare this evaluator against `predict_proba` for saved test vectors. Return an unknown/low-quality condition when input sources are stale. Wrap the result in the same dwell/cooldown behavior rather than firing a notification from every prediction.

## Evaluation sheet

| Measure | How to calculate it | Proposed initial goal |
|---|---|---|
| Face-analysis rate | Fresh analyzed frame count divided by elapsed wall time | Test feasibility around 6/sec |
| Look-away alert delay | Physical supported look-away onset to visible cue | Around 2.5–3.5 sec under the tested conditions |
| Phone event recall | Correctly recognized phone events divided by labeled phone events | Record measured value before choosing a goal |
| False alerts | Incorrect prompts divided by hours of normal study | Collect enough normal work to estimate meaningfully |
| Model source age | Receipt age of the most recent measurement from each task | Within the selected model-specific TTL |
| Recovery delay | Return to the allowed study zone to cleared cue | Around 0.5–1 sec |
| Preview rate | Delivered preview frames/sec with preview enabled | Compare the current 12-FPS target with a 6-FPS preset while preserving inference rate |

The candidate goals are acceptance proposals, not measured results. The current six-second vote's `conf` field measures vote agreement and should not be described as calibrated model accuracy.

## Tests before release

- Use fake clocks for 2.4-second and 2.6-second looks, return dwell, cooldown, duplicate samples, invalid samples, and pause/resume.
- Test short side glances, keyboard viewing, paper notes, a second monitor, glasses, and partial face visibility.
- Verify that face loss, camera unplug, a hung worker, and network loss each become sensing conditions without a phone accusation.
- Test phone held visibly, a partly hidden phone, typing, hand-at-ear without a phone, chin rest, and a calculator.
- Verify current eat/drink/sleep rules after changing model cadence.
- Test posture with missing shoulders/hips and with a camera moved after calibration.
- Benchmark preview closed/open and compare latency and CPU over the same five-minute sequence.
- Preserve old board messages that lack new optional evidence fields. Keep Python and TypeScript protocol changes synchronized.

## File map

| File | Proposed responsibility |
|---|---|
| `board/python/camera.py` | Sequence, capture time, supported mode reporting |
| `board/python/vision.py` | Video tasks, due times, source freshness, object confidence |
| `board/python/vision_worker.py` | Pipeline timing, bounded preview rate, fresh-sample output |
| `board/python/classifier.py` | Time-based state evidence and reliable feature-window inputs |
| `board/python/config.py` | Measured presets and configurable cue timings |
| `board/python/main.py` and `server.py` | Transition publishing and bounded outgoing preview |
| `board/python/protocol.py` and `app/src/shared/protocol.ts` | Optional evidence and health metadata |
| `app/src/main/session.ts` | Receive-time freshness, cue eligibility, event accounting |
| `app/src/main/attentionAlerts.ts` | Proposed single owner for alert dwell and cooldown |
| `app/src/shared/types.ts`, preload, renderer | Optional transient feedback and prompt controls |

The initial implementation should focus on measurement, tracking, source freshness, and a well-tested rule-based cue. Training then has a stable data contract and a meaningful baseline to beat.
