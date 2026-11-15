# StudyLens

**Where did your study time actually go?** StudyLens watches a study session through a camera on an Arduino UNO Q. On-device AI classifies what you're doing: studying, on your phone, distracted on screen, away, eating or drinking, or asleep. A Windows desktop app sends gentle self-care reminders during the session and gives you an honest breakdown afterwards.

```
USB webcam ─► UNO Q (Linux): MediaPipe face/pose/object models ─► rule classifier ─► WebSocket :8765
                 │                                                                      │ Wi-Fi
                 └─ Bridge ─► STM32 ─► 3.5" TFT (setup guide · live stats · reminders)   ▼
                                                     Windows laptop: StudyLens (Electron)
                                                     active-window tracking · reminders · reports
```
Video never leaves the UNO Q. Only activity labels are sent to the laptop, and all history is stored locally.

## Repo layout
| Path | What |
|---|---|
| `app/` | Electron + React + TypeScript desktop app (Windows) |
| `app/src/shared/` | Protocol, types, fusion, reminder engine, stats. Pure TS and unit-tested. |
| `board/python/` | UNO Q Linux side: camera, MediaPipe pipeline, classifier, WebSocket server, TFT bridge |
| `board/sketch/` | UNO Q MCU sketch: TFT drawing and touch |
| `board/WIRING.md` | Wiring, board setup, tuning checklist |
| `tools/mock_board.py` | Fake UNO Q, so you can develop and demo the app without hardware |

## Run the app (no hardware needed)
Use **Node 20 or 22 LTS**. On very new Node versions, Electron's binary extraction can fail silently during `npm install`.

```sh
# terminal 1: fake board (needs: pip install websockets)
python tools/mock_board.py            # add --fast for quicker state changes; type p/a/e/z/s to force states

# terminal 2: the app
cd app
npm install
npm run dev
```
In the app, go to **Settings → Device** and set the address to `127.0.0.1:8765`. You can also use **Settings → Data → Load demo data** to fill in two weeks of history.

## Build the Windows installer
```sh
cd app
npm run dist:win     # → app/dist/StudyLens Setup x.y.z.exe
```
Build on Windows for best results. electron-builder can cross-build from macOS, but code signing and NSIS work best on Windows.

## Tests
```sh
cd app && npm test                       # fusion, reminders (incl. Pomodoro), stats/insights
python -m pytest board/python/tests      # classifier rules
```

## How the activity is decided
1. **On the UNO Q:** MediaPipe Face (eyes and head pitch), Pose (presence, shoulders and wrists) and EfficientDet (phone, cup, bottle, food) produce signals every frame. Rules in `board/python/classifier.py` turn those signals into `present / phone / away / eating / sleeping`, with a 6-second majority vote to stop flicker.
2. **On the laptop:** `present` is refined using the foreground window. If the app or title matches a distraction keyword (YouTube, Reddit…), it counts as **Screen distraction**. Otherwise it counts as **Studying**.
3. **After the session:** any wrong label can be fixed by clicking that block on the Report timeline.

## A little study companion

Moss is a small dinosaur who waves hello, paces, reads, and reacts to the session state. Open **Companion** to name them, choose Grass/Pond/Peach/Lilac colors (also used for the app accents), toggle glasses, and preview their expressions. The updated MCU sketch draws a matching pixel companion below the compact session stats.

Desktop installers and board code must each be updated once. See [companion installation and behavior](board/COMPANION.md) for the packaged update, SSH commands, preserved calibration, and hardware checks.
