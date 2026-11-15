# AGENTS.md — StudyLens project handoff

Context for AI coding agents (Codex, etc.) picking up this repo. Read this first, then `README.md` and `board/WIRING.md`.

## What this is
**StudyLens**, a MadHacks 2026 hackathon project (team of 2, ~24–36 h). Students run it in the background while studying. A camera on an **Arduino UNO Q** classifies what the student is doing with on-device AI. A **Windows Electron app** fuses that with the active window, sends self-care reminders, and shows an honest breakdown of where the study time went.

- **Activities:** `studying`, `phone`, `distracted` (screen distraction, decided on the laptop), `away`, `eating`, `sleeping`.
- **Reminders:** water, eat, break/stretch, posture, 20-20-20 eye rest. There's a master on/off toggle. **Custom** intervals or a **Pomodoro** preset (25/5, with a 15-min long break every 4 cycles). Reminders fire once. Sleeping is only logged.
- **Demo priority:** the **Report** page, with a headline, donut chart, stat cards, an interactive timeline with post-session relabeling, insights and top distractions.
- **Roles:** the repo owner builds the apps with AI agents. Their teammate handles the UNO Q, camera and TFT hardware.

## Architecture
```
USB webcam → UNO Q Linux side (Python, board/python/): MediaPipe face/pose/object → rule classifier
           → WebSocket server :8765  ⇄ (Wi-Fi)  ⇄  Laptop Electron app (app/) — SOURCE OF TRUTH
UNO Q Linux side ⇄ Arduino Router Bridge ⇄ UNO Q MCU sketch (board/sketch/) → 3.5" SPI TFT + touch
```
- **The laptop owns** session state, reminders and the database. The board only senses and displays.
- **WebSocket protocol:** `app/src/shared/protocol.ts`, mirrored in `board/python/protocol.py`. Keep the two in sync.
  - Board → laptop: `hello`, `vision {ts,state,conf,face,slouch}` at 1 Hz, `event` (drank/ate), and `touch` (start/pause/resume/stop/reminder_done/reminder_dismiss).
  - Laptop → board: `session`, `stats`, `reminder`, `reminder_clear`, `baseline`.
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
| `app/src/renderer/` | Pages: Home, SessionLive, Report, History, Settings, Popup, EdgeBar. Components: Timeline, Donut, Countdown, ui |
| `board/python/` | `main.py` (BoardApp), `camera.py`, `vision.py` (MediaPipe), `classifier.py` (pure rules + 6 s majority vote), `server.py`, `display.py` (Bridge), `protocol.py`, `config.py` (all thresholds), `tests/` |
| `board/sketch/sketch.ino` | MCU sketch: **no third-party libs**. Raw ILI9486 driver, built-in 5×7 font, raw XPT2046 touch. **Portrait 320×480**. |
| `board/tft_test/tft_test.ino` | Library-free screen bring-up test. `MODE_RPI16 1` is **confirmed working** on our panel. |
| `board/WIRING.md` | **Full hardware guide**: parts, wiring table, bring-up order, settings, troubleshooting |
| `tools/mock_board.py` | Fake board speaking the same WS protocol (`--fast`, `--webcam`; stdin commands) |

## Commands
```sh
# laptop app (use Node 20/22 LTS — newer Node can break Electron's binary install)
cd app && npm install && npm run dev
npm run typecheck && npm test          # Vitest: 16 tests
npm run dist:win                       # NSIS installer (build on Windows)

# fake board for dev without hardware; then app Settings → Device = 127.0.0.1:8765
pip install websockets && python tools/mock_board.py --fast

# board python tests
python -m pytest board/python/tests    # 6 tests
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
5. **The sketch is host-compiled only:** checked with stub headers plus a framebuffer emulator that renders screens to PNG. It has not been compiled with the UNO Q (Zephyr) core yet.

## Conventions
- Activity colors are fixed: studying green, phone red, distracted amber, away gray, eating blue, sleeping purple. They're defined in `app/src/shared/colors.ts`, with RGB565 mirrors in `sketch.ino`.
- UI style is calm and minimal, with an accent teal `#0f9d8a`, top tabs (Home / History / Settings) and a device status dot. Every setting has a one-line description.
- **Window behavior during a session** is user-selectable, default **minimize to taskbar**. The other options are hide to tray and close completely.
- **Session flow:** Start runs a 3-2-1 countdown that captures the posture baseline. Stop goes straight to the Report.
- Keep shared logic pure and unit-tested (`app/src/shared`, `board/python/classifier.py`). Run typecheck and tests before committing.
- Git: work on `main`, remote `origin` = GitHub. Commit only when asked.
