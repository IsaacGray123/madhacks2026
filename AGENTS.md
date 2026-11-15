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

## Current status / open issues
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
