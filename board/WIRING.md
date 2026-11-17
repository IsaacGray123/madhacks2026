# StudyLens hardware guide

Everything you need to build, wire, place and run the hardware side of StudyLens: the camera, display, touch, board, power and network.

**Contents**
1. [Parts list](#1-parts-list)
2. [How the hardware fits together](#2-how-the-hardware-fits-together)
3. [Physical placement](#3-physical-placement)
4. [Power](#4-power)
5. [Display + touch wiring](#5-display--touch-wiring)
6. [Bring-up order (do these in sequence)](#6-bring-up-order-do-these-in-sequence)
7. [Sketch settings reference](#7-sketch-settings-reference)
8. [What the screen shows and what each button does](#8-what-the-screen-shows-and-what-each-button-does)
9. [Camera](#9-camera)
10. [Running the full app on the UNO Q](#10-running-the-full-app-on-the-uno-q)
11. [Network](#11-network)
12. [Linux ↔ MCU message format](#12-linux--mcu-message-format)
13. [Troubleshooting](#13-troubleshooting)
14. [Tuning the classifier](#14-tuning-the-classifier)
15. [Demo-day checklist](#15-demo-day-checklist)

---

## 1. Parts list

| Part | Notes |
|---|---|
| **Arduino UNO Q** | Runs everything on the board. If you have a choice, use the version with more RAM, because MediaPipe needs a lot of memory. |
| **USB webcam (UVC)** | Any plug-and-play webcam (720p is plenty). It needs no drivers on Linux. |
| **USB-C hub with power passthrough (PD)** | The UNO Q has one USB-C port. The hub gives you a USB-A port for the webcam and passes power through to the board. |
| **USB-C power supply, 5 V / 3 A or more** | Plugs into the hub's PD input. A laptop USB port often can't power the board, the webcam and the screen backlight together. |
| **3.5" "RPi LCD" touchscreen**: ILI9486 display + XPT2046 touch, 480×320 | Ours is confirmed working in *RPi 16-bit shift-register mode* (`tft_test` mode 1). |
| **Female-to-male jumper wires × 11**, plus spares | The female end goes on the screen's pins and the male end into the UNO Q headers. Keep them **short (≤ 20 cm)**, because long wires corrupt fast SPI signals. |
| Tape, Velcro or a small stand | To mount the camera and keep the jumpers from being pulled out. |
| Phone hotspot (backup) | In case the venue Wi-Fi blocks device-to-device traffic. |

---

## 2. How the hardware fits together

```
                ┌──────────────────────────── Arduino UNO Q ────────────────────────────┐
 USB webcam ──► │ Linux side (Python: board/python/)          MCU side (board/sketch/)    │
  (via hub)     │  vision_worker.py (Python 3.12):            sketch.ino                  │
                │    camera.py → vision.py (MediaPipe)                                    │
                │  main.py: classifier.py → server.py ◄─Bridge─► draws screens, touch     │──SPI──► 3.5" TFT + touch
                │        │ WebSocket :8765                                                │
                └────────┼───────────────────────────────────────────────────────────────┘
                         │ Wi-Fi (same network, or an SSH tunnel)
                         ▼
                 Laptop app (Windows, app/) — owns the session, reminders, history
```

- **Linux side** (Debian, Python): reads the webcam, runs the AI models, works out what you're doing, and talks to the laptop over Wi-Fi. The camera and models run in a separate Python 3.12 process (`vision_worker.py`), because MediaPipe doesn't work on App Lab's Python 3.13.
- **MCU side** (Arduino sketch): drives the screen and reads touches. It doesn't think; it draws whatever the Linux side sends.
- **Bridge**: the UNO Q's built-in link between the two sides. Screens go Linux → MCU through the `ui` call, and taps go MCU → Linux through the `touch` call.
- **The laptop is the boss**: session state, timers and reminders all live in the laptop app, and the board just senses and displays.

---

## 3. Physical placement

**Camera:** this matters most for accuracy.
- Mount it on **top of the laptop screen, centered**, facing you, like a built-in webcam.
- Sit **50–80 cm** away. The frame should show your **head, shoulders, hands and the front edge of the desk**. The phone, cup and food detectors and the hand gestures (texting, phone calls, bites) need to see your hands.
- Put light **in front of you**, not behind you. A bright window behind you makes your face a silhouette and face detection fails.
- Don't move the camera during a session. When a session starts, StudyLens runs a **5-second countdown** and asks you to look at the screen you'll study from. At the end of it, it captures where your screen is (your head and eye direction), how open your eyes normally look, and your posture. Moving the camera afterwards throws those off.

**Board and screen:**
- Put the screen **beside the laptop, within arm's reach**, so you can tap Pause, End and Done.
- Put the UNO Q next to the screen, so the jumper wires stay short.
- Tape the jumper bundle down. A wire that pops loose is the #1 cause of a blank or garbled screen.
- In portrait mode the screen's pin header is at the top (`ROTATION 0`). If your mount has it at the bottom, set `ROTATION 2`.

---

## 4. Power

- Use **power supply → hub (PD-in) → UNO Q**, with the **webcam in the hub**.
- The screen takes power from the UNO Q's **5V** pin (backlight) and **3V3** pin (logic).
- Signs that power is too weak:
  - The board reboots when the camera starts.
  - The screen flickers or goes white partway through.
  - The webcam disconnects (`/dev/video0` disappears).
- **Never** connect 5 V to any of the signal pins (D2, D7–D13). The UNO Q headers are **3.3 V logic**, which matches the screen.

---

## 5. Display + touch wiring

### Finding pins on the screen's 40-pin header
The screen was made to plug onto a Raspberry Pi. Its black connector has **2 rows × 20 holes**.
- **Pin 1** is marked with a "1", a triangle, or a **square solder pad** on the back of the board.
- **Odd numbers (1, 3, 5 … 39) are in one row** and **even numbers (2, 4, 6 … 40) in the other**. Pin 2 is directly beside pin 1.
- When you flip the board over, left and right swap. **Always count from the pin-1 mark**, never by eye.

```
 pin-1 end
     ▼
 odd:   1   3   5   7   9  [11] 13  15  17 [19] [21] [23] 25 ...
 even: [2]  4  [6]  8  10  12  14  16 [18] 20  [22] [24] [26] ...
        [ ] = pins we use (plus pin 1)
```

### The 11 wires

| Screen pin | Row | Signal | UNO Q pin | Used by |
|---|---|---|---|---|
| **1** | odd | 3.3 V | **3V3** | display + touch logic |
| **2** | even | 5 V | **5V** | backlight |
| **6** | even | GND | **GND** | everything |
| **19** | odd | MOSI (data → screen) | **D11** | display + touch (shared) |
| **21** | odd | MISO (data ← touch) | **D12** | **touch only** |
| **23** | odd | SCLK (clock) | **D13** | display + touch (shared) |
| **24** | even | LCD CS | **D10** | display |
| **18** | even | DC / RS | **D9** | display |
| **22** | even | RESET | **D8** | display |
| **26** | even | TOUCH CS | **D7** | touch |
| **11** | odd | TOUCH IRQ | **D2** | touch (optional) |

**Common mistakes:**
- **Pins 22 and 26 swapped.** The screen draws for a moment, then goes blank as soon as the sketch reads touch. The `tft_test` sketch can't catch this swap.
- **The MISO wire (21 → D12) is loose.** The display works perfectly but touch never responds, because only touch uses that wire.
- **Every wire is one row off.** You counted from the wrong end of the header. You get no picture at all, just a white backlight.

To change pin numbers, edit the `#define`s at the top of `sketch/sketch.ino`. They must match in `tft_test/tft_test.ino` too.

---

## 6. Bring-up order (do these in sequence)

Each step proves one thing before you move on. Upload sketches with **Arduino App Lab** or the **Arduino IDE 2** with the *Arduino UNO Q* board package installed. **No extra libraries are needed.**

| # | Do this | You should see | If not |
|---|---|---|---|
| 1 | Power on with no sketch | White or grey backlight glow | Dark: check pin 2 → 5V and pin 6 → GND |
| 2 | Upload `board/tft_test/tft_test.ino` (`MODE_RPI16 1`) | Red, then green, then blue, then stripes, repeating | White: re-check pins 18, 19, 23, 24 and lower `SPI_HZ` |
| 3 | Upload `board/sketch/sketch.ino` with `USE_BRIDGE 0` | Boot screen, then a demo setup screen, a session with moving bars, and a water reminder about every 40 s. A blinking square in the bottom-right corner. | Goes blank: check pins 22/26, or try `TOUCH_ENABLED 0` |
| 4 | Same, with `TOUCH_DEBUG 1` | A red dot plus raw numbers where you tap | See [touch calibration](#touch-calibration) |
| 5 | Set `TOUCH_DEBUG 0` and `USE_BRIDGE 1`, then run it as an App Lab app ([§10](#10-running-the-full-app-on-the-uno-q)) | `3/3 bridge ok`, then the Camera setup screen with an IP address. The first run shows `Preparing camera...` for several minutes while it installs the AI. | Stuck at `2/3`: the Bridge isn't connecting |
| 6 | Connect the laptop app ([§11](#11-network)) and press Start | The 5-second countdown runs on the laptop, then the screen switches to session stats | See [§13](#13-troubleshooting) |

### Touch calibration
Our panel is already calibrated in `sketch.ino`: `TS_MINX 4454`, `TS_MAXX 7880`, `TS_MINY 4370`, `TS_MAXY 7894`, `TS_SWAP_XY 0`, `TS_FLIP_X 1`, `TS_FLIP_Y 1`. Another panel of the same model may need its own values:

1. Set `TOUCH_DEBUG 1` and upload. Tap all four corners and the center.
2. Fix the direction first:

   | What the dot does | Change |
   |---|---|
   | Moves vertically when your finger moves horizontally | Toggle `TS_SWAP_XY` |
   | Mirrored left ↔ right | Toggle `TS_FLIP_X` |
   | Mirrored top ↔ bottom | Toggle `TS_FLIP_Y` |

3. Then fix the scale. Write down the smallest and largest raw numbers you see at the edges and put them in `TS_MINX` / `TS_MAXX` / `TS_MINY` / `TS_MAXY`.
4. If taps aren't detected at all, lower `TS_PRESSURE` from 400 to about 200. If it registers phantom taps, raise it.
5. Set `TOUCH_DEBUG 0` when you're done.

---

## 7. Sketch settings reference
All of these are at the top of `board/sketch/sketch.ino`.

| Setting | Default | What it does |
|---|---|---|
| `USE_BRIDGE` | 1 | 0 = standalone demo with fake data, no Python needed. Use it to test the screen and touch. |
| `TOUCH_ENABLED` | 1 | 0 = never talk to the touch chip. Use it to rule touch in or out when debugging. |
| `HEARTBEAT` | 1 | Blinks a tiny square in the bottom-right corner while the sketch is running. |
| `ROTATION` | 0 | 0 = portrait with the header at the top. 2 = upside-down portrait. |
| `SPI_HZ` | 4000000 | Display clock. Try 8 MHz, then 16 MHz, for faster redraws. Go back down if the image garbles. |
| `CS_PER_WORD` | 1 | 0 = stream pixels without toggling chip-select (several times faster). Try it once everything works. |
| `TOUCH_HZ` | 2000000 | Touch chip clock. Leave it alone. |
| `TOUCH_DEBUG` | 0 | 1 = show tap dots and raw values on screen. |
| `TS_MINX` … `TS_FLIP_Y` | measured for our panel | Touch calibration (see above). |
| `TS_PRESSURE` | 400 | How firm a press counts as a tap. |

---

## 8. What the screen shows and what each button does

| Screen | When | Shows | Buttons → action sent to the laptop |
|---|---|---|---|
| **Boot** | Power-on | "StudyLens / Starting camera..." plus start-up steps `1/3`–`3/3` | — |
| **Camera setup** | No session running | The companion's name, a framing guide ("I can see you!" or "Find your frame"), hint text such as `Preparing camera...` or `Waiting for laptop...`, and the board's address | **Start** → opens StudyLens on the laptop and runs the 5-second "look at your study screen" countdown, then starts the session |
| **Session** | During a session | Current activity chip, session time, time bars for Studying / Phone / Distracted / Away, the companion walking on a slope, and countdowns for Water / Food / Break / Eyes | **Pause** / **Resume**, **End** → stops the session (the laptop opens the Report) |
| **Reminder** | When a reminder fires | Title + message | **Done** → resets that reminder's timer. **Dismiss** → just closes it. Both also close the popup on the laptop. |

Eating and sleeping time aren't shown as bars on the touchscreen, but they're still tracked and can appear in the activity chip. The laptop's Report shows everything. The companion's name, color and glasses come from the laptop's **Companion** tab.

---

## 9. Camera

### Check that Linux sees it
On the UNO Q, through SSH or the App Lab terminal:
```sh
ls /dev/video*            # expect /dev/video0 (sometimes also video1, video2)
```
- **No `/dev/video*` at all:** the camera isn't detected. Try another hub port, check the power supply, and re-plug the camera.
- **Several entries:** that's normal. Many webcams create several `/dev/video` devices and only one gives frames. `CAMERA_INDEX = "auto"` in `config.py` finds the one that works. Set a number (for example `1`) only if auto-detection picks the wrong camera.

### The AI and its models install themselves
When the App Lab app starts, `main.py` prepares everything the camera needs, then keeps retrying if something fails:

1. **The AI environment.** MediaPipe needs Python 3.12, but App Lab runs Python 3.13. On the first run, `setup_vision.py` builds a separate Python 3.12 environment in the app's `.cache/vision312` folder with MediaPipe 0.10.18 and headless OpenCV. This takes several minutes. Later runs reuse it.
2. **The models.** `model_assets.py` downloads and checksums the four models into `python/models/`: face, pose, objects and hands. Files that are already there and correct are kept.
3. **The camera worker.** `vision_worker.py` runs the camera and models in that Python 3.12 environment and streams results back to `main.py`.

The touchscreen shows `Preparing camera...` during this, and `Camera recovering - retrying...` if something failed. **The board needs internet the first time.** Read the App Lab console for the exact error.

**Running the steps by hand (optional).** Useful for watching the install or forcing it again:
```sh
# on the board; replace hackathon-1-main-1 with your app's container (docker ps shows it)
docker exec hackathon-1-main-1 python3 /app/python/setup_vision.py   # prints "AI models ready", then "Camera environment ready"

# or download only the models, from the app's python/ folder
./download_models.sh
```
If `download_models.sh` fails with `set: Illegal option`, the file has Windows line endings. Fix it with `sed -i 's/\r$//' download_models.sh` and run it again.

### Camera settings (`board/python/config.py`)
| Setting | Default | Notes |
|---|---|---|
| `CAMERA_INDEX` | `"auto"` | Finds a camera that delivers frames. A number or path overrides it. |
| `FRAME_WIDTH` × `FRAME_HEIGHT` | 640 × 480 | Lower to 320×240 if the AI frame rate is too slow |
| `TARGET_FPS` | 3 | AI frames per second. A new activity takes over after it holds for 1.5 s (`SWITCH_AFTER_S`). |
| `PREVIEW_FPS` | 12 | Live camera preview frame rate, sent only while the laptop's preview is open. Lower it if the AI slows down. |

---

## 10. Running the full app on the UNO Q

The sketch and the Python code must run **together as one Arduino App Lab app**, since that's what connects the Bridge. The `board/` folder is already laid out like an App Lab app:

```
board/
  app.yaml          ← app name/description
  python/           ← Linux side (main.py is the entry point)
  sketch/           ← MCU side (sketch.ino)
```

1. In the sketch, make sure `USE_BRIDGE 1` and `TOUCH_DEBUG 0` are set.
2. In App Lab, create a new app (or import this folder) and copy in `app.yaml`, the whole `python/` folder (including `requirements.txt`, `vision_requirements.txt` and `model_assets.py`) and `sketch/sketch.ino`. `app.yaml` publishes port 8765 so the laptop can connect.
3. Press **Run**. App Lab flashes the sketch and starts `main.py`, which installs the AI environment and models the first time ([§9](#9-camera)).
4. **You should see:**
   - The screen boot steps reach `3/3 bridge ok - waiting for main.py`, then the **Camera setup** screen appears.
   - On the first run, `Preparing camera...` for several minutes, then `Waiting for laptop...` once it sees your face.
   - The App Lab console shows `WebSocket server on ws://<ip>:8765`.
   - When you tap a button, the console shows a `touch` line.

**Updating the board.** Pushing to GitHub does **not** update the board. Copy the changed files into the App Lab app again, then **Stop** and **Run**. The models and the Python 3.12 environment are kept. For the companion update there's a one-time installer that backs up files and keeps your `config.py` and touch calibration: see [COMPANION.md](COMPANION.md).

On our board, the app folder is `/home/arduino/ArduinoApps/hackathon-1` (mounted at `/app` inside the container `hackathon-1-main-1`). Names change with the app name, so check with `docker ps -a`.

**Debugging without App Lab:** `python main.py --debug` runs the Python side alone. The screen won't update because there's no Bridge, but it prints the camera classification about 3 times a second, which is useful for tuning ([§14](#14-tuning-the-classifier)).

---

## 11. Network

- The board and the laptop must be on the **same Wi-Fi network**.
- **Board address:** shown on the Camera setup screen. On the board, `ip -4 addr show wlan0` shows it too. Ignore a `172.20.0.x` address in the Python log: that's the App Lab container's internal address.
- **Port:** 8765. The board is the server and the laptop connects to it.

In the laptop app, go to **Settings → Device** and pick a connection:

| Connection | When to use it | How |
|---|---|---|
| **Direct** | The laptop can reach the board's port 8765 | Enter `<board-ip>:8765` and press **Test** |
| **Background SSH** | Direct times out, which is common on campus and venue Wi-Fi even when the board answers `ping` | Enter the board's address and its Linux account password once. The password is encrypted on the laptop, and StudyLens opens the SSH tunnel by itself every time it starts. |

The dot in the top bar turns green when connected.

**Manual SSH tunnel (fallback).** If Background SSH isn't available, open a tunnel yourself and leave the terminal open:
```powershell
ssh -N -L 127.0.0.1:8766:127.0.0.1:8765 arduino@<board-ip>
```
Then set the address in **Settings → Device → Direct** to `127.0.0.1:8766`.

**If nothing connects:**
- Check that both devices are on the same network.
- Put **both on a phone hotspot**. Many school and venue networks block device-to-device traffic.
- `unoq.local` only works if mDNS works on that network, so use the raw IP if in doubt.
- University networks may need the board registered first. UW–Madison's UWNet intercepts downloads with a `securelogin` certificate until the board's MAC address is registered at https://access.services.wisc.edu/Device.

---

## 12. Linux ↔ MCU message format
`board/python/display.py` sends these strings over the Bridge `ui` call. The sketch draws them.

| Message | Meaning |
|---|---|
| `U\|face\|hint\|ip\|name\|color\|glasses` | Setup screen. `face` = 0/1. The last three are the companion's name, color and glasses (0/1). |
| `S\|status\|current\|elapsed\|focus\|t0,t1,t2,t3,t4,t5\|w,e,b,y\|name\|color\|glasses` | Session screen. `status` = running/paused. `current` = activity key. Times are in seconds. `t0`–`t5` are, in order: studying, phone, distracted, away, eating, sleeping (the screen draws bars for the first four). `w,e,b,y` are the water, eat, break and eyes countdowns in seconds (−1 = off). The companion fields come last. |
| `R\|type\|title\|message` | Reminder screen |
| `C` | Clear the reminder and go back to the previous screen |

Taps go back as `Bridge.notify("touch", action)`, where action is `start`, `pause`, `resume`, `stop`, `done` or `dismiss`.

The companion fields are sent in **every** `U` and `S` message because the sketch's Bridge mailbox holds only one message. Older sketches ignore the extra fields.

---

## 13. Troubleshooting

| Symptom | Most likely cause | Fix |
|---|---|---|
| Screen completely dark | No 5 V to the backlight | Pin 2 → 5V, pin 6 → GND |
| Screen white, nothing drawn | Display wires wrong or a loose jumper | Run `tft_test`. Check pins 18/19/23/24. Count from pin 1. |
| Text appears for ~0.5 s, then blank | Pins 22 ↔ 26 swapped | Swap them back, or test with `TOUCH_ENABLED 0` |
| Garbled or striped image | SPI too fast for the jumpers | Lower `SPI_HZ`, shorten the wires |
| Heartbeat square stops blinking | The sketch froze | Note the last boot step shown and report it |
| Stuck at `2/3 starting bridge...` | Not running as an App Lab app | Run it through App Lab, not a plain IDE upload |
| "No screen from main.py yet" | The Python side crashed or isn't running | Read the error in the App Lab console |
| No tap dot in `TOUCH_DEBUG` | Touch wiring (21, 26, 19, 23) or pressure | Check the MISO wire. Lower `TS_PRESSURE`. |
| Taps land in the wrong place | Calibration | [Touch calibration](#touch-calibration) |
| Tap works, but the laptop doesn't react | Laptop not connected | Check that the device dot in the laptop app is green |
| `Preparing camera...` for a long time | First run is installing the AI, or the board has no internet | Wait several minutes on the first run. Check the App Lab console. Make sure the board is online (see the UWNet note in [§11](#11-network)). |
| `Camera recovering - retrying...` | The camera or the AI worker failed | Read the App Lab console. Check the webcam and hub power. It retries automatically. |
| `No camera delivered frames` in the console | Camera unplugged, underpowered, or the wrong device | Re-plug it into the powered hub, or set `CAMERA_INDEX` to a number |
| Laptop pings the board but Test times out | The network blocks port 8765 | Use **Background SSH** or the manual tunnel ([§11](#11-network)), or a phone hotspot |
| Camera preview stuck on "Starting the camera feed…" | The board is running old Python files | Copy the current `python/` files into App Lab, then Stop and Run |
| Classification is very slow (< 1 line/s in `--debug`) | The CPU is overloaded | Lower `PREVIEW_FPS` or close the laptop's preview, then lower `FRAME_WIDTH`/`FRAME_HEIGHT` or `TARGET_FPS` |
| Board reboots randomly | Not enough power | Use a 5 V / 3 A+ supply on the hub |

---

## 14. Tuning the classifier
Every threshold is in `board/python/config.py`. Run `python main.py --debug` and act out each state while watching the output. It prints the raw and reported state, attention, hands, eye openness against its threshold, head pitch and yaw, gaze, and detected objects.

Start each test session normally, looking at your screen during the 5-second countdown, because most rules are measured against that starting position.

| Problem | Fix |
|---|---|
| Glancing at notes or a second monitor counts as **Looking away** | Raise `LOOK_AWAY_YAW_DEG` (head turn, default 20°) or `GAZE_SIDE_THRESHOLD` (eyes to the side, default 0.45). Raise `LOOK_AWAY_S` (default 3 s) to wait longer. |
| Looking at the top of the screen counts as looking away | Raise `GAZE_UP_THRESHOLD` (default 0.4) or `LOOK_UP_DEG` (default 12°). This is likelier when the camera sits below the screen. |
| Reading notes reads as **Phone** or **Sleeping** | Looking down for `LONG_LOOK_DOWN_S` (default 10 s) is decided by your eyes: open → phone, closed → sleeping, unclear → distracted. Tune `DOWN_EYES_OPEN_MAX` (0.45) and `DOWN_EYES_CLOSED_MIN` (0.75) from the `eyes=` values, or set `LONG_LOOK_DOWN_S = 0` to turn the rule off. |
| Short glances down count as looking down | Raise `LOOKING_DOWN_DEG` or `GAZE_DOWN_THRESHOLD`. Flip `PITCH_SIGN` if `pitch` goes negative when you look down. |
| Texting under the desk isn't caught | Lower `HAND_ZONE_BELOW` or `PHONE_POSE_S`, or raise `HANDS_TOGETHER`. `HAND_ZONE_BELOW` depends on camera height. |
| Typing reads as phone | Lower `HAND_ZONE_BELOW` so hands on the keyboard count as "resting" |
| Phone not detected | EfficientDet sees phones best from the side. Lower `OBJECT_SCORE` to about 0.3, or raise `PHONE_NEAR_HAND`. |
| Drinking missed | Raise `NEAR_FACE` |
| "Away" triggers too fast or too slow | `AWAY_AFTER_S` (default 5 s) |
| Labels flicker | Raise `SWITCH_AFTER_S` (default 1.5 s) |
| Changes are recognized too slowly | Lower `SWITCH_AFTER_S`, `LOOK_AWAY_S` or `PHONE_POSE_S`. Expect more false readings. |
| Posture reminders too sensitive | Raise `SLOUCH_FULL_DROP` |

Unit tests: `python -m pytest board/python/tests`.

---

## 15. Demo-day checklist
- [ ] Power supply, hub, webcam, screen and spare jumpers are packed.
- [ ] All jumpers are re-seated and taped down. The pin 22/26 wires are checked.
- [ ] Phone hotspot is ready, in case the venue Wi-Fi blocks devices.
- [ ] The camera is mounted on the laptop and the lighting is in front of you.
- [ ] App Lab app runs and the screen shows Camera setup with an IP.
- [ ] Laptop **Settings → Device** is set up (Direct with the IP, or Background SSH), and the dot is green.
- [ ] The first-run AI install has finished: the screen reaches `Waiting for laptop...`.
- [ ] Remember the app minimizes itself when a session starts (**Settings → During a session**). Click it in the taskbar to show the judges.
- [ ] Touch is calibrated: Start, Pause, End, Done and Dismiss all hit.
- [ ] For a short demo, set the water reminder to 1 minute so a reminder fires on stage.
- [ ] Rehearse the 5-second countdown: sit normally and look at the laptop screen until it ends.
- [ ] Backup plan: `python tools/mock_board.py --fast` on the laptop, with Settings → Device set to `127.0.0.1:8765`, plus **Load demo data** for History.
