# StudyLens launch plan

Prepared November 15, 2026. This package contains proposals, implementation references, and presentation preparation. Application source, board configuration, dependencies, and installed software were left as found for this planning task. Nothing in these documents has been deployed or pushed.

## Read in this order

| Document | What you can decide or execute from it |
|---|---|
| [Companion](01_COMPANION.md) | Character direction, all four moods, laptop and LCD placement, animation rules, code outline, and validation |
| [Connection](02_CONNECTION.md) | Automatic SSH, one-time pairing, boot startup, reconnect behavior, and the installer workflow |
| [Vision and training](03_VISION_AND_TRAINING.md) | Faster feedback, a measured inference schedule, look-away alerts, phone/posture improvements, and training instructions |
| [Pitch and demo](04_PITCH_AND_DEMO.md) | An eight-slide storyboard, exact slide copy, a three-minute script, judge interaction, and fallback paths |
| [Physical enclosure](05_ENCLOSURE.md) | Three build options, a supply list, measured cutting steps, cable routing, and presentation setup |
| [Implementation runbook](06_IMPLEMENTATION_RUNBOOK.md) | Work order, estimated effort, acceptance checks, release commands, and stretch features |
| [Sources](07_SOURCES.md) | Primary documentation, repository evidence, known limitations, and research boundaries |

## Recommended decisions

1. Use one small mint-colored study creature across the laptop and physical screen. Start with the laptop session view and a simplified LCD face. Add a floating desktop window after the state mapping and artwork are stable.
2. Put SSH forwarding inside the desktop app. Use the existing reachable SSH path, save pairing once, and reconnect automatically. Keep the existing Python 3.13 Bridge plus Python 3.12 inference arrangement.
3. Introduce a fast attention-alert path with a proposed 2.5-second sustained look-away threshold. Keep a separate, slower interpretation for session history and normal breaks. Benchmark the full path before promising any frame rate.
4. Start with a proposed 6-Hz face-analysis target and reduce unnecessary hand/object inference. Validate tracking mode on the installed MediaPipe 0.10.18 build. Lower preview overhead and measure the camera's actual mode.
5. Present a short live loop in which a judge chooses an interruption, sees a reaction, and then sees it represented in the report. Use a named recorded fallback if the hardware fails.
6. Build a foam-board or cardboard desktop stand with an open rear and a paper character bezel. Preserve the touch area and give every cable strain relief.

## What the current project already provides

The initial review used `e360e14`, following `27c6b12`. Before pushing this package, the repository was updated to `fb985f7`, including `b9ec5eb`. Those newer changes already move preview into its own thread with a 12-FPS target and simplify the LCD to four activity rows. The plans below incorporate those updates. Re-read the files before implementation if another teammate changes them.

| Item | Evidence and current limits |
|---|---|
| Windows app | Electron app, installer configuration, Settings, session controls, reports, timeline corrections, and tray behavior exist |
| Board inference | The earlier board test initialized all three core models using Python 3.12 and MediaPipe 0.10.18 |
| Board display | The user reported `Waiting for laptop` after integration |
| Camera preview | Current code sends optional JPEG preview frames from a separate thread with a 12-FPS target while preview is requested. Actual hardware throughput remains unmeasured |
| Attention | Current code estimates head yaw, gaze side/down, and an attention state with an eight-second side-look threshold |
| Hand gestures | Optional Hand Landmarker supports texting/call/bite heuristics in the current code |
| Phone recognition | Current rules combine detected phone boxes with hands/face and inferred hand poses |
| Posture | Current score compares nose-to-shoulder geometry with a captured baseline |
| Connection | Local board and container port 8765 worked, while the laptop's direct connection timed out. SSH port 22 was reachable |
| Automatic forwarding | Proposed in this plan. A successful app-managed tunnel has not been implemented or tested |
| Creature | Proposed in this plan. No application companion exists in the reviewed source |
| Hardware accuracy | No event-level accuracy study or sustained FPS benchmark was available |

The latest attention and hand-gesture additions were inspected in code. Their presence in GitHub establishes implementation, while board performance and behavior remain things to measure.

## Important findings

- With the optional hand model present, the current four-frame schedule runs face every loop, hands twice per cycle, and pose/objects once per cycle. At the configured three loops per second, pose and object updates are each nominally 0.75 per second. Actual rates can be lower.
- A six-second activity vote, an eight-second look-away timer, one-second publishing, and one-second session ticks can all contribute to slow feedback. Different paths use different subsets of these delays. Increasing a single FPS setting cannot remove all of them.
- The current look-away state changes the fused activity to distracted. A dedicated quick look-away notification still needs to be implemented.
- The README's statement that video never leaves the board needs updating before a presentation. The implemented preview sends JPEG frames to the laptop while requested. Accurate pitch wording is that inference runs on the board and optional preview travels locally to the paired laptop.
- Reducing camera resolution saves some capture, preprocessing, copying, and JPEG work. Many model stages internally use fixed input tensors, so their neural-network cost may change much less.
- The newer 12-FPS preview makes video feel smoother independently of the three-FPS inference target. Measure their shared CPU and output-channel contention before choosing a preview/inference balance.
- A person's glance toward notes, keyboard, another monitor, or an accessibility aid can be legitimate study behavior. Calibration and a screen-plus-notes mode should inform the alert rule.

## Time-boxed choices

All durations are engineering estimates for the existing project. They include implementation and some verification, and they can expand with hardware failures. The time you are away is the planning window. The work below is the proposed execution budget after you return.

| Available implementation time | Suggested scope |
|---|---|
| About 60–90 minutes | Confirm boot startup, prepare the demo and fallback, tune look-away timing with a simple gentle cue, build the enclosure, and retain the known connection method |
| About 2–3 hours | Add an app-managed OpenSSH connection using an already provisioned key, a laptop companion in the session view, and a measured faster pipeline preset |
| About 4–6 hours | Add first-time pairing, embedded SSH, floating companion, calibrated attention, refined LCD artwork, and complete power-cycle testing |
| After the event | Train and validate a personalized behavior classifier, expand the dataset, and harden discovery and updates |

For a short remaining build window, first-time key provisioning and new model training are the highest uncertainty. A rehearsed manual connection remains the fallback until the automatic path passes its checks.

## Definition of ready for the demonstration

- Powering the board starts the app and initializes the existing tested inference environment.
- The installed Windows build opens and reconnects after a board restart.
- The presenter has verified each action they will perform at the actual camera angle and lighting.
- The companion changes mood without rapid flickering or blocking controls.
- A supported look-away cue produces one gentle notification after the configured dwell and returns quietly when attention returns.
- The report reflects the demonstrated behaviors, and sample data is identified when used.
- A short recording and a sample report are available locally.
- The screen stands securely, wires are retained, touch works, and power can be disconnected without pulling signal wires.

## Optional additions worth considering

| Addition | Why it helps | When to consider it |
|---|---|---|
| Camera health indicator | Distinguishes a missing face from a stalled worker or stale camera sample | During the latency work |
| Screen-plus-notes study mode | Gives deliberate reading a supported interpretation | Before enabling aggressive look-away alerts |
| One-click recalibration | Helps when the camera, chair, or user changes | With the attention improvements |
| Quiet recovery reaction | Makes returning to study feel welcome | With the companion |
| Explicit demo mode | Makes a recorded or simulated fallback clear to the judge | During rehearsal preparation |
| Simple snooze | Prevents a legitimate sustained task from causing repeated nudges | After basic alerts work |

The plan assumes a single user, a single paired UNO Q, local operation, the existing USB camera, and a Windows laptop. It covers both laptop and LCD creature placement because “on the screen” could refer to either surface. Event timing and artwork direction can be adjusted without changing the architecture.
