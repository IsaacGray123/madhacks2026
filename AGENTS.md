# AGENTS.md — StudyLens project handoff

Context for AI coding agents (Codex, etc.) picking up this repo. Read this first, then `README.md` and `board/WIRING.md`.

## What this is
**StudyLens**, a MadHacks 2026 hackathon project (team of 2, ~24–36 h). Students run it in the background while studying. A camera on an **Arduino UNO Q** classifies what the student is doing with on-device AI. A **Windows Electron app** fuses that with the active window, sends self-care reminders, and shows an honest breakdown of where the study time went.

- **Activities:** `studying`, `phone`, `distracted` (screen distraction, decided on the laptop), `away`, `eating`, `sleeping`.
- **Reminders:** water, eat, break/stretch, posture, 20-20-20 eye rest. There's a master on/off toggle. **Custom** intervals or a **Pomodoro** preset (25/5, with a 15-min long break every 4 cycles). Reminders fire once. Sleeping is only logged.
- **Demo priority:** the **Report** page, with a headline, donut chart, stat cards, an interactive timeline with post-session relabeling, insights and top distractions.
- **Live camera preview** on Home (pre-flight) and the live session page. Video streams from the board only while a preview is on screen and is never stored.
- **Appearance:** Settings → Appearance → Theme (System / Light / Dark).
- **Roles:** the repo owner builds the apps with AI agents. Their teammate handles the UNO Q, camera and TFT hardware.

## Architecture
```
USB webcam → UNO Q Linux side (Python, board/python/): MediaPipe face/pose/object → rule classifier
           → WebSocket server :8765  ⇄ (Wi-Fi)  ⇄  Laptop Electron app (app/) — SOURCE OF TRUTH
UNO Q Linux side ⇄ Arduino Router Bridge ⇄ UNO Q MCU sketch (board/sketch/) → 3.5" SPI TFT + touch
```
- **The laptop owns** session state, reminders and the database. The board only senses and displays.
- **WebSocket protocol:** `app/src/shared/protocol.ts`, mirrored in `board/python/protocol.py`. Keep the two in sync.
  - Board → laptop: `hello`, `vision {ts,state,conf,face,slouch,attention}` every 0.5 s (`PUBLISH_INTERVAL_S`), `event` (drank/ate), `touch` (start/pause/resume/stop/reminder_done/reminder_dismiss), and `frame {ts,jpeg}` (base64 JPEG, ~320 px wide, ~12 fps).
    - `attention` is `screen` | `down` | `away` | null (nobody in frame). `away` = head turned (`LOOK_AWAY_YAW_DEG`), eyes to the side (`GAZE_SIDE_THRESHOLD`), looking up past the screen (`LOOK_UP_DEG` / `GAZE_UP_THRESHOLD`), or body visible with the face lost. It starts after `LOOK_AWAY_S` (3 s) and ends only after `LOOK_BACK_S` (1 s) of looking back. `down` (notes/keyboard) is **not** distracted. It's optional on the TS side for older boards.
    - `frame` goes **only** to connections that sent `preview {on:true}`.
  - Laptop → board: `session`, `stats`, `reminder`, `reminder_clear`, `baseline`, `preview {on}`.
    - `server.py` handles `preview` itself: it tracks the set of subscribed clients and calls `on_preview(bool)` when the set goes empty or non-empty. `main.py`'s `on_laptop` never sees it.
- **Camera preview pipeline:**
  - Renderer `useCameraFrame` → IPC `camera:preview` → `DeviceLink.setPreview` (re-sent on reconnect) → board server.
  - Then `main.py` writes `preview 1|0` to the vision worker's **stdin**, and the worker's preview thread prints `{"preview": b64}` lines on stdout alongside the AI `Signals` lines.
  - `main.py` forwards those lines to subscribed clients as `frame` messages.
  - On the laptop, main sends `camera:frame` to the main window only while it's visible and not minimized.
  - The renderer also turns preview off when `document.hidden`.
- **Fusion:** `fuse(camera, window, keywords, attention)`. `present` + a distracting window → distracted (tagged with the keyword). Otherwise `present` + `attention === 'away'` → distracted, tagged `"Looking away"`.
- **Bridge strings, Linux → MCU** (the `ui` RPC):
  - `U|face|hint|ip`
  - `S|status|current|elapsed|focus|t0..t5|w,e,b,y`
  - `R|type|title|message`
  - `C`
- **Bridge, MCU → Linux:** `Bridge.notify("touch", action)`.

## Repo layout
| Path | What |
|---|---|
| `app/` | Electron 33.2 + electron-vite 2.3 + React 18.3 + TS 5.6 + Tailwind 3.4 + Recharts 2.13 + ws 8.18; Vitest; electron-builder (NSIS). Versions deliberately pinned. |
| `app/src/shared/` | Pure logic + types: `types.ts`, `protocol.ts`, `colors.ts`, `fusion.ts`, `reminders.ts` (ReminderEngine), `stats.ts`, `defaults.ts`, `demo.ts`, `format.ts`, plus `*.test.ts` |
| `app/src/main/` | `index.ts` (tray, hotkey, IPC, window behavior), `session.ts` (SessionManager), `deviceLink.ts` (WS client, auto-reconnect), `windowWatcher.ts` (PowerShell user32 on Windows, osascript on macOS for dev), `db.ts` (JSON file store, atomic writes; no SQLite, deliberately), `settings.ts`, `windows.ts` (main window, reminder popup, edge bar) |
| `app/src/preload/` | `window.api` contextBridge |
| `app/src/renderer/` | Pages: Home, SessionLive, Report, History, Settings, Popup, EdgeBar. Components: Timeline, Donut, Countdown, CameraPreview, ui. `lib/hooks.ts`: `useStatus`, `useSettings`, `useDarkMode`, `useChartColors`, `useCameraFrame` |
| `board/python/` | `main.py` (BoardApp; spawns the worker, forwards preview frames), `vision_worker.py` (separate Python 3.12 process: camera + models, JSON lines on stdout, `preview 1/0` on stdin), `camera.py` (latest-frame capture + `encode_preview`), `vision.py` (MediaPipe), `classifier.py` (pure rules; the reported state switches once a new raw state holds `SWITCH_AFTER_S` = 1.5 s), `server.py`, `display.py` (Bridge), `protocol.py`, `config.py` (all thresholds), `setup_vision.py` (builds the 3.12 env in App Lab), `tests/` |
| `board/python/main_full.py` | **Legacy** in-process version of `main.py`. Not maintained: no preview, attention or hand gestures. |
| `board/python/download_models.sh` | Fetches the 4 models into `models/` (git-ignored, so they must be downloaded or copied onto the board) |
| `board/sketch/sketch.ino` | MCU sketch: **no third-party libs**. Raw ILI9486 driver, built-in 5×7 font, raw XPT2046 touch. **Portrait 320×480**. The session screen shows **4 activity rows** (Studying, Phone, Distracted, Away; `SE_ROWS`). Eating and sleeping still arrive in `S|` totals and can appear in the status chip. |
| `board/tft_test/tft_test.ino` | Library-free screen bring-up test. `MODE_RPI16 1` is **confirmed working** on our panel. |
| `board/WIRING.md` | **Full hardware guide**: parts, wiring table, bring-up order, settings, troubleshooting |
| `tools/mock_board.py` | Fake board speaking the same WS protocol (`--fast`, `--webcam`; stdin commands) |

## Commands
```sh
# laptop app (use Node 20/22 LTS — newer Node can break Electron's binary install)
cd app && npm install && npm run dev
npm run typecheck && npm test          # Vitest: 17 tests
npm run dist:win                       # NSIS installer (build on Windows)

# fake board for dev without hardware; then app Settings → Device = 127.0.0.1:8765
pip install websockets && python tools/mock_board.py --fast
#   preview needs `pip install opencv-python` (scripted mode streams a test card; --webcam streams the real camera)
#   stdin commands: s p a e z = force state, l = looking away, auto, start/pause/resume/stop/done/dismiss

# board python tests (the local, git-ignored .venv has pytest + websockets: .venv/bin/python -m pytest ...)
python -m pytest board/python/tests    # 18 tests

# on the UNO Q (App Lab terminal or SSH), inside the app's python/ folder
./download_models.sh                   # face, pose, object, hand models → models/
python main.py --debug                 # prints raw/state/attention, hands, eyes vs threshold, pitch/yaw, gaze, objects
```
Gotchas:
- npm 11 blocks install scripts. `allowScripts` in `app/package.json` approves electron and esbuild.
- If `ELECTRON_RUN_AS_NODE=1` is inherited from a VS Code terminal, `electron.app` is undefined. Launch with `env -u ELECTRON_RUN_AS_NODE`.

## Hardware facts (confirmed)
- **TFT:** 3.5" RPi-style ILI9486 + XPT2046. It works only in **RPi 16-bit shift-register mode**: every command, data byte and pixel is sent as a 16-bit word, with CS toggled per word. Pixel format is 0x55 (RGB565). `Arduino_GFX`'s `ILI9486_18bit` did **not** work, so don't reintroduce GFX libraries.
- **MADCTL:** 0x48 = portrait (`ROTATION 0`), 0x88 = upside-down portrait, 0x28 = landscape.
- **Wiring (RPi header pin → UNO Q):**

  | Header pin | Signal | UNO Q |
  |---|---|---|
  | 1 | 3.3 V | 3V3 |
  | 2 | 5 V | 5V |
  | 6 | GND | GND |
  | 19 | MOSI | D11 |
  | 21 | MISO | D12 |
  | 23 | SCLK | D13 |
  | 24 | LCD_CS | D10 |
  | 18 | DC | D9 |
  | 22 | RST | D8 |
  | 26 | TP_CS | D7 |
  | 11 | TP_IRQ | D2 |

- **Sketch debug switches** (top of `sketch.ino`):
  - `USE_BRIDGE 0`: standalone demo with fake data.
  - `TOUCH_ENABLED 0`: disables touch.
  - `HEARTBEAT`: a blinking square shows the sketch is still running.
  - `TOUCH_DEBUG 1`: shows tap dots and raw values.
  - `SPI_HZ` and `CS_PER_WORD 0`: speed-ups.
  - `TS_*`: touch calibration.

## Current handoff, 2026-11-15

This section supersedes the older status notes below.

- The UNO Q runs the sketch and Python app through App Lab. The screen has reached `Waiting for laptop`. The earlier suspected wiring cause for a blank screen was never confirmed.
- Touch calibration uses `TS_MINX=4454`, `TS_MAXX=7880`, `TS_MINY=4370`, `TS_MAXY=7894`, `TS_SWAP_XY=0`, and both flips set to 1. The user supplied raw corner measurements. Debug output was disabled in a later commit. Confirm final finger/dot alignment and button actions on hardware.
- App Lab's `python-apps-base:0.13.2` image uses Python 3.13. MediaPipe 1.2.3 installed but crashed when creating models with unsupported CPU instructions and exit code 132. Import-only checks passed before the crash.
- Python 3.12 with MediaPipe 0.10.18 initialized all three models on the actual UNO Q and printed `AI models ready`. The tested dependencies include headless OpenCV contrib 4.11.0.86, JAX/JAXLIB 0.4.35, and NumPy 1.26.4.
- `main.py` now keeps the Bridge, WebSocket server, classifier, and posture baseline in App Lab's Python 3.13 process. It launches `vision_worker.py` with `/app/.cache/vision312/bin/python` for camera inference. Signals cross stdout as JSON. `STUDYLENS_VISION_PYTHON` can override the interpreter. Local desktop use defaults to the current interpreter.
- `setup_vision.py` installs the separate environment and its interpreter under the mounted app `.cache` directory, then checks model initialization. It uses `vision_requirements.txt` and installs MediaPipe with `--no-deps` to retain headless OpenCV. `requirements.txt` supplies the main app's dependencies. Copy both requirements files along with the Python files.
- Desktop OpenCV failed with `libGL.so.1` missing. Installing `libgl1` failed because the base container had broken Debian dependencies. Replacing desktop OpenCV with headless OpenCV allowed imports to pass.
- `main_full.py` preserves the original app implementation from before the subprocess integration. It is a backup. The full current startup file is `main.py` and contains `class BoardApp`. If startup still prints `Importing vision`, the board still has the temporary diagnostic copy.
- The board app folder is `/home/arduino/ArduinoApps/hackathon-1`, mounted at `/app`, and its container is `hackathon-1-main-1`. Names vary with the app. Use `docker inspect` and `docker ps -a` to verify them. Updating GitHub alone did not update the App Lab copy in this session.

After copying the current files into App Lab, press Run. Run this in the board terminal, wait for `Camera environment ready`, then Stop and Run again.

```sh
docker exec hackathon-1-main-1 python3 /app/python/setup_vision.py
```

### Laptop connection

- `board/app.yaml` publishes port 8765 using a `ports` list. The board's App Lab copy also needs this entry. Docker mappings to `0.0.0.0:8765` and `[::]:8765` were verified.
- The last board Wi-Fi address was `172.20.10.4`, and the laptop's was `172.20.10.3`. Check the current board address with `ip -4 addr show wlan0`. Addresses can change. `172.20.0.2` in the Python log is the Docker container address.
- The laptop reached the board using ping and TCP 22. TCP 8765 timed out from the laptop, although the server was reachable inside the container and through the board's localhost published port. The cause of the incoming connection block is still undetermined.
- An SSH tunnel was provided as the workaround. Run this on the Windows laptop, enter the Arduino Linux account password locally, and leave the terminal open.

```powershell
ssh -N -L 127.0.0.1:8766:127.0.0.1:8765 arduino@172.20.10.4
```

In the StudyLens laptop app, open Settings, scroll to Device, set UNO Q address to `127.0.0.1:8766`, and click Test. A direct connection uses the board's current Wi-Fi IP with port 8765. The user acknowledged the tunnel instructions. An explicit successful Test result has not been recorded.

### Windows app startup and network setup

- Use Node 20 or 22 LTS. PowerShell blocked `npm.ps1`, and `npm.cmd` worked. Node 26.13.1 was installed initially. Electron's executable was missing and startup failed with `Error: Electron uninstall`. Running `node node_modules/electron/install.js` using a temporary official Node 22.23.5 executable repaired the installation.
- Clear `ELECTRON_RUN_AS_NODE` for launch. The StudyLens window opened successfully on Windows after the repair. Run the commands below from the repository's `app` folder.

```powershell
npm.cmd install
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm.cmd run dev
```

- UWNet intercepted model downloads with a certificate for `securelogin.local.uwnet.wisc.edu`. Network access was subsequently resolved and all three models downloaded. The observed board Wi-Fi MAC is `14:b5:cd:e4:1c:69`. UWNet device registration is at https://access.services.wisc.edu/Device. The later connection tests used the hotspot addresses above.
- If `download_models.sh` fails with `set: Illegal option`, fix Windows line endings using `sed -i 's/\r$//' download_models.sh` and rerun it on the board.

### Remaining verification

- After the subprocess integration, the user reported `Waiting for laptop`, which the code displays after receiving a face detection. Sustained frame rate and classification accuracy still need measurement.
- Verify the laptop connection Test result and a full session with start, pause/resume, stop, reminder completion/dismissal, and posture baseline capture. Bridge initialization and Python-to-sketch screen updates have worked.
- Confirm Windows window watcher accuracy, tray behavior, and the global hotkey. The Windows app window has launched successfully.
- Local Python syntax, six classifier checks, simulated JSON transfer and worker exit handling, and mocked setup commands passed. Actual camera/Bridge/session integration still needs the checks above.
- The laptop app's typecheck and all 16 Vitest tests passed using Node 22 during this handoff update.

## Earlier status notes
1. **Screen went blank ~0.5 s after the boot text** with the previous sketch.
   - Leading hypothesis: header pins **22 (RST) and 26 (TP_CS) are swapped**, so touch polling pulls D7 low and resets the panel.
   - The user was asked to check this and to test with `TOUCH_ENABLED 0` / `USE_BRIDGE 0`.
   - **Waiting on the result.**
2. **Touch calibration** for portrait is unverified. The `TS_*` defaults are guesses (`TS_SWAP_XY 1`).
3. **Not yet verified on real hardware:**
   - Arduino Router Bridge API names: C++ `Bridge.begin/provide/notify`, Python `from arduino.app_utils import Bridge, App`.
   - Running `board/` as an Arduino App Lab app.
   - MediaPipe installing and running fast enough on the UNO Q (aarch64). Fallback: `tflite-runtime`.
4. **Windows-only behavior not yet tested on Windows:** the PowerShell window watcher, tray, taskbar minimize, and the global hotkey `Ctrl+Shift+S`. Development so far has been on macOS with the mock board, and everything works end to end there.
5. **The sketch is host-compiled only:** checked with stub headers plus a framebuffer emulator that renders screens to PNG. It has not been compiled with the UNO Q (Zephyr) core yet. The 4-row session layout hasn't been checked on the panel either.
6. **Camera preview is not verified on hardware.**
   - Unknowns: the CPU cost of 12 fps JPEG encoding next to inference on the A53 cores (lower `PREVIEW_FPS` if the AI rate drops), and frame delivery through App Lab's exposed port 8765.
   - It was tested with the mock board and with a stub-model run of `vision_worker.py` (~12 fps, starts before the models finish loading).
   - If the preview stays on "Starting the camera feed…", the usual cause is that the board is still running old Python files (the console never logs `camera preview on`), or the laptop app wasn't fully restarted after preload/main changes.
7. **Recognition v2 (gaze/attention, per-person calibration, hand gestures) is unit-tested only.**
   - Thresholds in `config.py` need tuning on the real camera with `--debug`. Start with `GAZE_DOWN_THRESHOLD`, `HAND_ZONE_BELOW` (depends on camera height), `HANDS_TOGETHER`, `LOOK_AWAY_YAW_DEG`, `GAZE_SIDE_THRESHOLD`, `GAZE_UP_THRESHOLD` and `LOOK_UP_DEG`. The faster timings (`SWITCH_AFTER_S`, `LOOK_AWAY_S`) trade some false "distracted" for speed; loosen them if glances at notes or a second monitor get flagged.
   - Check that inference still reaches ~3 fps with the hand model.
8. **Dark mode** has been typechecked but not reviewed visually, especially Popup, EdgeBar and Report.

## Conventions
- Activity colors are fixed: studying green, phone red, distracted amber, away gray, eating blue, sleeping purple. They're defined in `app/src/shared/colors.ts`, with RGB565 mirrors in `sketch.ino`.
- UI style is calm and minimal, with an accent teal `#0f9d8a`, top tabs (Home / History / Settings) and a device status dot. Every setting has a one-line description.
- **Theme tokens:**
  - The palette lives as RGB-triplet CSS variables in `src/renderer/src/index.css`: light values on `:root`, and a dark override under `@media (prefers-color-scheme: dark)`. `tailwind.config.js` maps `ink`, `paper` and `accent` to them.
  - Use `bg-paper` / `bg-paper-card` / `text-ink*` / `border-paper-line`. **Never** use `bg-white` or raw hex for surfaces or text.
  - One-off status colors (emerald/amber/red) need a `dark:` variant.
  - Recharts colors must come from `useChartColors()`, because SVG attributes can't read CSS variables.
  - The dark accent is slightly brighter (`rgb(20 176 155)`). `#0f9d8a` remains the brand/light color.
- **Theme switching:**
  - `settings.theme` → `nativeTheme.themeSource` in main (`applyTheme`). That drives `prefers-color-scheme` in every window, plus the native title bar. Tailwind uses `darkMode: 'media'`.
  - Window background colors follow `nativeTheme.shouldUseDarkColors`.
- **Privacy:** camera video goes to the laptop only while a preview is visible (`settings.cameraPreview` on, the main window shown). It is never written to disk or the DB. Keep the Home privacy note accurate if this changes.
- **Recognition rules:**
  - Anything per-person (posture ratio, head pitch/yaw, eyes-open level) is calibrated in `ActivityClassifier.capture_baseline()` during the 5-second countdown.
  - The hand model is optional: `vision.py` logs a warning and skips hands if `models/hand_landmarker.task` is missing.
  - Face runs every frame. Hands / pose / hands / objects share a 4-frame rotation, and results carry over between runs.
  - **Long look down** (`LONG_LOOK_DOWN_S` = 10 s of attention `down`, with brief glances up under `LOOK_DOWN_GRACE_S` ignored) is decided by eye openness:
    - eyeBlink ≤ `DOWN_EYES_OPEN_MAX` → `phone`, unless the hands are visible and resting low (typing or writing), which stays studying
    - ≥ `DOWN_EYES_CLOSED_MIN` → `sleeping`
    - in between → camera state `distracted`, which fuses to activity distracted with the tag `"Looking down"`
    - `LONG_LOOK_DOWN_S = 0` turns the rule off.
  - `distracted` is a camera state (`CameraState` in `types.ts`, `CAMERA_STATES` in `protocol.py`) in addition to the laptop's window-based distraction.
  - **Latency budget:** ~1.5 s switch delay on the board (plus any rule's own hold time, e.g. `PHONE_POSE_S`, `AWAY_AFTER_S`), then ≤0.5 s board publish and ≤0.5 s laptop `TICK_MS` in `session.ts`. Sleep timers stay long on purpose.
- **Window behavior during a session** is user-selectable, default **minimize to taskbar**. The other options are hide to tray and close completely.
- **Session flow:** Start runs a 5-second countdown that tells the user to look at the screen they'll study from. The baseline (eye/head direction = "where the screen is", eyes-open level, posture) is captured when the countdown **ends**, not on click. Stop goes straight to the Report.
  - Start tapped on the UNO Q touchscreen runs the same countdown on the laptop: main sends `navigate {page:'home', countdown:true}`, and Home runs the countdown and starts the session. If the window doesn't start it within 10 s, main captures the baseline and starts the session itself. Cancel sends `session:countdownCanceled`, which clears that fallback.
- Keep shared logic pure and unit-tested (`app/src/shared`, `board/python/classifier.py`). Run typecheck and tests before committing.
- Git: work on `main`, remote `origin` = GitHub. Commit only when asked.


## Companion update (November 15)

- `app/src/shared/companion.ts` defines validated name/color/glasses preferences, mood mapping, and kind status copy. New settings default to Moss / grass green / glasses, including upgrades from older settings files.
- `Companion.tsx` renders an SVG dinosaur with CSS animations, a still unboxed welcome (blink/head tilt; no floating wave or landscape), state-change hop, responsive full-width pacing, reading, gentle phone head shake, distracted look-around/butterfly/fidget, curled-up away pose with a tear, and eating/rest poses. The scene is a full-width two-shade curved slope; the live companion sits outside the narrow timer/camera card, and the Companion preview sits above customization. Reduced-motion is supported. A new Companion navigation tab previews moods and persists preferences. App accents follow the companion palette; activity colors retain their meaning.
- `useSettings` publishes a local custom event so mounted settings consumers and theme accents stay synchronized. Preferences send through `SessionManager` on reconnect and settings changes as `companion` messages.
- Python `Display` appends name/color/glasses to **every** U/S payload, because the sketch bridge has a one-message mailbox. Old sketches ignore these extra fields. The updated sketch keeps Pause/End/reminder hit boxes intact, compacts activity rows, moves elapsed time to the header, and streams a procedural pixel sprite at a maximum of about 8fps. Its 216px walking range spans most of the display; each frame restores the union of old/new sprite positions over a static full-width curved slope. Setup is plain. Real panel speed is unverified.
- `board/install_companion.py` plus `app/dist/StudyLens Companion Board.zip` provide a one-time host-side deployment without the IDE. Preserve `config.py` and existing pin/touch/SPI tuning, back up replaced files, start through App CLI, and restore previous files if CLI fails. See `board/COMPANION.md`.
- Verification: 31 Vitest tests and typecheck, Python transport/recovery tests, installer rollback/calibration tests, hidden Electron rendering/interactions in light/dark (no desktop capture), native stub C++ compilation and screen/state transitions. The updated sketch has **not** been compiled with the actual UNO Q toolchain or tested on the physical panel.

- Slope refinement checks: isolated Electron validation of unboxed intro/full-width live scene, light/dark, reduced motion, and walking bounds at narrow/wide sizes; native framebuffer comparison of incremental drawing vs a clean render across 250 walking frames passed (no trails), and the LCD horizontal range exceeded 210px. Physical SPI speed and UNO Q compilation remain unverified.

### Rebuilding and deploying after pulling

- Windows installers, board ZIP bundles, and preview PNGs under `app/dist/` are local, ignored build artifacts. They are not distributed by a source-code push. Run `npm.cmd run dist:win` from `app/` with Node 20/22 to rebuild the desktop installer.
- Recreate the current board bundle from the repository root using the allowlist in the installer:

```powershell
python -c "from pathlib import Path; from runpy import run_path; import zipfile; files=run_path('board/install_companion.py')['FILES']; z=zipfile.ZipFile('app/dist/StudyLens Companion Board.zip','w',zipfile.ZIP_DEFLATED); [z.write(Path('board')/name,name) for name in files]; z.close()"
```

- Update the existing board app using `board/install_companion.py` and that bundle, as described in `board/COMPANION.md`. Do not recreate the App Lab app or delete its models/cache. Both the desktop installer and board update are required to see the complete change. A Git push does not deploy either one.
- User preference: keep intros plain and still, with no landscape box. Keep the full-width curved two-shade slope and wide roaming in session/companion views. Preserve the encouraging text and existing mood reactions. Do not restore the floating wave or small illustrated tile.
