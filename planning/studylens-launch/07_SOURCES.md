# Research and evidence

Research checked November 15, 2026. Source links below support capabilities and constraints. Proposed timings, engineering effort, craft budgets, character design, and implementation order are planning judgments.

## Repository baseline

The initial inspection used `e360e14` with attention/gesture work and `27c6b12` with camera preview/dark mode. Before this package was committed, the repository was fast-forwarded to `fb985f7`. Its preceding commit `b9ec5eb` moves preview into a separate thread with a 12-FPS target, opens the camera before model creation, and reduces the LCD session layout to four visible activity rows. The relevant plans were refreshed for those changes. This package does not modify the implementations.

| File | Evidence used in the plan |
|---|---|
| `board/python/config.py` | Capture size, three-FPS target, eight-second look-away dwell, six-second smoothing, hand timing, preview size/quality |
| `board/python/vision.py` | Face/image calls, optional hands, four-frame secondary schedule, carried model results, object-box simplification |
| `board/python/classifier.py` | Calibration, gaze estimates, phone/call/texting heuristics, vote-based confidence, posture |
| `board/python/camera.py` | Latest-frame capture thread, no per-frame sequence/timestamp, preview encoding |
| `board/python/vision_worker.py` | Python 3.12 worker, stdin preview control, separate preview thread, stdout locking |
| `board/python/main.py` | Python 3.13 app owner, worker subprocess, one-second publishing, preview scheduling |
| `board/python/server.py` | WebSocket listener, preview subscription and sending |
| `board/python/setup_vision.py` and `vision_requirements.txt` | Existing pinned inference setup |
| `app/src/main/deviceLink.ts` | Saved-address connection, retry, preview restoration, one-shot test |
| `app/src/main/session.ts` | Session ownership, one-second ticks, freshness handling, reminder/slouch use |
| `app/src/main/windows.ts` | Existing transparent reminder and edge-bar patterns |
| `app/src/main/index.ts` | Single-instance guard, tray, IPC, sample-history import, minimize-on-start behavior |
| `app/src/shared/fusion.ts` | Activity and attention fusion |
| `app/src/shared/types.ts` and `protocol.ts` | Existing activities, attention, reminders, settings, and messages |
| `app/src/shared/defaults.ts` | Default camera preview and window behavior |
| `app/src/shared/reminders.ts` | Reminder timing, posture cooldown and threshold |
| `app/src/renderer/src/pages/SessionLive.tsx` | Current session layout and preview |
| `app/src/renderer/src/pages/Settings.tsx` | Device address field, sample-history action, settings layout |
| `app/src/renderer/src/pages/Report.tsx` | Report display and relabeling |
| `app/package.json` | Pinned Electron/build dependencies and NSIS script/configuration |
| `board/sketch/sketch.ino` | Current dense session layout, shared touch constants, display driver, reminder screens |
| `board/WIRING.md` | Known wiring, camera positioning, hub power, portrait orientation |
| `tools/mock_board.py` | Scripted states and `p`, `s`, `a`, `l`, `auto`, and touch command fallback |

## External primary sources

| Source | What it supports | Use and boundary |
|---|---|---|
| [Arduino Run and Monitor Apps](https://docs.arduino.cc/software/app-lab/apps/run) | Run at startup and default application behavior | Verify the app ID on the actual board |
| [Arduino App CLI](https://docs.arduino.cc/software/app-lab/cli/cli) | Listing apps, default app command, status and ports | Current documentation can differ from the installed host CLI |
| [UNO Q manual](https://docs.arduino.cc/tutorials/uno-q/user-manual/) | Board runtime, remote access, network setup | Network reachability still needs a local test |
| [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) | Transparent, focus, and window behavior | Project uses Electron 33.2.0, so verify methods against that release |
| [Electron custom interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions) | Click-through behavior and pointer forwarding | Test Windows scaling and actual interaction regions |
| [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) | OS-backed local secret encryption | Newest asynchronous APIs may exceed the project's pinned release |
| [Electron app API](https://www.electronjs.org/docs/latest/api/app) | Optional login startup and app lifecycle | Login startup is an optional later setting |
| [ssh2 repository](https://github.com/mscdex/ssh2) | Forwarded channels, authentication, host verification, keepalive configuration | Controller, pairing, and recovery behavior are our proposed integration |
| [electron-builder NSIS](https://www.electron.build/docs/nsis/) | Windows installer target | Existing project pins electron-builder 25.1.8 |
| [Microsoft Mobile hotspot](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/use-your-windows-device-as-a-mobile-hotspot) | Laptop-hosted Wi-Fi connection sharing | Adapter/upstream requirements and offline behavior need testing on this laptop |
| [MediaPipe 0.10.18 Face Landmarker source](https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.18/mediapipe/tasks/python/vision/face_landmarker.py) | VIDEO configuration, timestamped inference interface | Hardware performance remains unmeasured |
| [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) | Face landmarks, blendshapes, transformation matrices | Face-expression coefficients require validation for attention use |
| [Blendshape model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf) | Intended expression use and sensitivity to input conditions | Provides no StudyLens attention-accuracy guarantee |
| [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) | Landmarks, handedness, and tracking options | Gesture-to-phone decisions remain project-specific |
| [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) | Body/world landmarks and visibility | Pose confidence and camera framing constrain posture interpretation |
| [OpenCV VideoCapture](https://docs.opencv.org/4.x/d8/dfe/classcv_1_1VideoCapture.html) | Capture behavior and property-setting caveats | Actual camera mode and frame delivery need measurement |
| [Grouped dataset splitting](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupShuffleSplit.html) | Whole-group train/test separation | Grouping by session alone does not prove generalization to new people |
| [LogisticRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html) | Multiclass scores, prediction, and regularized training | The proposed JSON evaluator needs numerical parity tests |
| [Model Maker object-detector example](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/model_maker/python/vision/object_detector/object_detector_demo.py) | Dataset-based detector customization and export workflow | Training dependencies and exported model metadata need a pinned validation path |
| [MadHacks official site](https://www.madhacks.io/) | Dates, venue, and published judging schedule | No per-team pitch limit or complete rubric was verified |
| [Adafruit cardboard enclosure](https://learn.adafruit.com/cardboard-box-for-circuit-playground-express) | Cardboard as an electronics-enclosure prototyping method | Template dimensions do not fit this LCD automatically |
| [Adafruit camera project case](https://learn.adafruit.com/lobe-trash-classifier-machine-learning/optional-build-it-case) | Quick custom cardboard construction around camera electronics | Our stand dimensions are to be measured |
| [IKEA BERGENES](https://www.ikea.com/us/en/p/bergenes-holder-for-mobile-phone-tablet-bamboo-10457999/) | Example of a simple off-the-shelf stand | Fit, stock, price, and pickup were not confirmed |
| [UW nodeLab laser cutting](https://nodelab.art.wisc.edu/laser-cutting-engraving) | Local fabrication reference | Access, training, Sunday hours, and queue were not confirmed |

Older Model Maker guide URLs redirected during research. The plan therefore points to the repository's actual object-detector example for training implementation. Published benchmarks for other phones or computers are excluded from proposed UNO Q performance claims.

## Hardware/session observations supplied by the user

- Python 3.13 with MediaPipe 1.2.3 failed when creating models due to unsupported LSE instructions. Further runs also reported other unsupported CPU feature names.
- The Python 3.12 / MediaPipe 0.10.18 isolated test printed `AI models ready`.
- The headless OpenCV replacement resolved the tested import path after the desktop build required a missing graphics library.
- The integrated app later reached `Waiting for laptop`.
- The board Wi-Fi IP was `172.20.10.4`, the laptop Wi-Fi IP was `172.20.10.3`, and the board MAC observed in ARP matched `14:b5:cd:e4:1c:69`.
- Both server-inside-container and board-local published-port tests passed. A laptop WebSocket/TCP test to 8765 timed out, while SSH port 22 was reachable.
- The user accepted the SSH-tunnel instructions, but the conversation did not include a successful app-level test transcript afterward.
- A StudyLens window was observed running on Windows after the Electron installation repair.

## Assumptions and limits

- The creature name, appearance, mood timing, frame-rate targets, alert timings, craft costs, and implementation durations are proposals.
- The companion plan covers both laptop and LCD surfaces because the requested screen was ambiguous.
- No model was trained and no new accuracy, reaction time, or throughput was measured for this planning task.
- The reference snippets are integration guidance. Syntax checks do not establish hardware or packaged-app behavior.
- The pitch deliverable is a storyboard and script. Final slides still require actual screenshots/photos, measured claims, and the organizer's confirmed time limit.
- Direct-wireless hotspot behavior and automatic pairing have not been tested on this laptop/board combination.
- Enclosure fit requires physical measurements. Product examples have unverified local availability.
- The production app, board installation, installed desktop app, and GitHub were left unmodified by this planning task.

## Planning-artifact checks performed

- All eight documents' local Markdown links and fenced-code boundaries were checked.
- Four Python reference blocks were syntax-parsed. The attention gate was exercised with entry thresholds, return/rearm, cooldown, invalid evidence, and paused eligibility. The lightweight evaluator was exercised with a deterministic test vector and a nonfinite input.
- Five TypeScript reference blocks were transpiled for syntax. The companion selector was exercised across all six existing activities, idle, pause, and unavailable-camera conditions.
- The forwarding helper was exercised against a local echo socket using a fake established SSH client. The check covered bidirectional data, listener shutdown, repeated close, and invalid-port rejection. Actual SSH authentication, pairing, network reconnect, and packaged Electron behavior remain implementation tests.
- The eight-slide storyboard count and the three-minute timing total were checked. Final rendered slides have not been authored in this planning task.
- Repository status was checked so the planning folder is the only intended addition.
