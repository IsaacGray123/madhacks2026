# StudyLens

**Where did your study time actually go?**

StudyLens is a study companion for your desk. A small camera on an **Arduino UNO Q** watches your study session and uses on-device AI to notice what you're doing: studying, on your phone, looking away, away from your desk, eating or drinking, or dozing off. A desktop app on your laptop adds which app or website is in front of you, sends gentle self-care reminders while you work, and shows you an honest breakdown when you're done.

- **See the truth about a session.** A timeline, a focus percentage and your top distractions, with any moment you can relabel if the camera got it wrong.
- **Gentle reminders.** Water, food, stretch breaks, posture and 20-20-20 eye rest, or a Pomodoro timer.
- **A companion.** Moss, a small dinosaur on the app and the desk touchscreen, reacts to what you're doing.
- **Private by design.** The AI runs on the board. Your history stays on your computer.

```
USB webcam ─► Arduino UNO Q ─► on-board AI decides what you're doing ─► Wi-Fi ─► StudyLens app on your laptop
                   │                                                              (session, reminders, reports)
                   └─► 3.5" touchscreen: live status, timers, Start / Pause / End, companion
```

---

## What you need

| Item | Notes |
|---|---|
| **Arduino UNO Q** | Runs the camera AI. The higher-RAM version is better if you have the choice. |
| **USB webcam** | Any plug-and-play (UVC) webcam. 720p is plenty. |
| **USB-C hub with power passthrough** | The UNO Q has one USB-C port, so the hub gives the webcam a port and passes power through. |
| **USB-C power supply, 5 V / 3 A or more** | A laptop USB port usually can't power the board, camera and screen together. |
| **3.5" "RPi LCD" touchscreen** (ILI9486 + XPT2046, 480×320) | Optional but recommended. It shows status and has its own buttons. |
| **11 short jumper wires** (female-to-male, 20 cm or less) | To connect the touchscreen. |
| **A Windows laptop** | Runs the StudyLens app. Both devices need to be on the same Wi-Fi network. |

The full parts list, wiring table and placement advice are in **[board/WIRING.md](board/WIRING.md)**.

---

## Setup

### 1. Build the hardware

Follow [board/WIRING.md](board/WIRING.md) sections 1–6: plug the webcam into the hub, connect the touchscreen with the 11 wires, and power everything from the USB-C supply.

**Camera placement matters.** Mount it centered on your laptop screen, at about eye level, facing you. Keep it in the same spot once you've started using StudyLens.

### 2. Put the StudyLens software on the board

The board runs StudyLens as an **Arduino App Lab** app. The `board/` folder in this repo is already laid out as one.

1. In App Lab, create a new app (or import the folder) and copy in `board/app.yaml`, the whole `board/python/` folder and `board/sketch/sketch.ino`.
2. Press **Run** once so App Lab creates the app's container.
3. Open a terminal on the board (App Lab's terminal, or `ssh arduino@<board-ip>` from your laptop) and install the camera AI:

   ```sh
   # replace hackathon-1-main-1 with your app's container name (docker ps shows it)
   docker exec hackathon-1-main-1 python3 /app/python/setup_vision.py
   ```

   Wait for `Camera environment ready`.
4. Download the AI models. From the app's `python/` folder on the board:

   ```sh
   ./download_models.sh
   ```

   This needs internet. Without the hand model, everything still works except hand gestures (texting, phone calls, bites).
5. In App Lab, press **Stop**, then **Run**. The touchscreen shows the **Camera setup** screen with the board's IP address.

Updating the code on GitHub does **not** update the board. Copy the files into App Lab again whenever they change. Updating the companion has its own one-time installer, described in [board/COMPANION.md](board/COMPANION.md).

### 3. Install the StudyLens app on your laptop

Install **Node.js 20 or 22 LTS** first. Newer versions can break Electron's install.

```powershell
cd app
npm.cmd install
npm.cmd run dist:win
```

Then run the installer it creates in `app/dist/` (`StudyLens Setup x.y.z.exe`).

To run it without installing, use `npm.cmd run dev` instead of `dist:win`.

### 4. Connect the app to the board

Open StudyLens, go to **Settings → Device**, and choose a connection:

- **Direct:** enter the board's IP address shown on the touchscreen, with port 8765 (for example `192.168.1.42:8765`), and press **Test**.
- **Background SSH:** use this if Direct can't connect, which is common on campus Wi-Fi. Enter the board's address and its Linux account password once. The password is encrypted on your computer, and StudyLens reconnects by itself every time it opens.

The dot in the top bar turns green when the board is connected. If neither works, put both the laptop and the board on a **phone hotspot**. Many school and venue networks block devices from talking to each other.

---

## Using StudyLens

### Starting a session

1. On **Home**, check the pre-flight list. **UNO Q connected** and **Camera sees you** should both be green. The live camera preview shows what the camera sees.
2. Click **Start study session** (or tap **Start** on the touchscreen).
3. **During the 5-second countdown, sit the way you normally study and look at the screen you'll be studying from.** StudyLens uses this starting position to learn where your screen is, how open your eyes normally look, and your posture. This is the most important step for accurate tracking.
4. Study. By default the app minimizes itself so it stays out of your way. You can change that in **Settings → During a session**.

You can pause or end a session from the app, the touchscreen, or the tray icon (when the app hides itself to the tray). The global hotkey **Ctrl+Shift+S** ends a session from any app.

### What StudyLens tracks

| Activity | How it's recognized |
|---|---|
| 🟢 **Studying** | You're facing your screen and nothing else applies. Looking down briefly at notes or the keyboard still counts. |
| 🔴 **Phone** | A phone in your hand, a texting or phone-call pose, or looking down for a long time with your eyes open. |
| 🟠 **Distracted** | Looking away from your screen for a few seconds, or a distracting app or site (YouTube, Reddit, Discord…) in the active window. |
| ⚪ **Away** | Nobody in front of the camera. |
| 🔵 **Eating / drinking** | Food or a cup at your mouth, or repeated bites. |
| 🟣 **Sleeping** | Eyes closed for a while. It's only logged, with no alarm. |

The list of distracting apps and sites is yours to edit in **Settings → Distraction list**.

### Reminders

Reminders pop up once in the corner of your screen. Mark them **Done** or dismiss them.

- **Custom** (default): water, food, stretch breaks, posture and 20-20-20 eye rest, each with its own interval.
- **Pomodoro:** 25-minute focus blocks with 5-minute breaks, a 15-minute break every 4 blocks, plus water and food.

Turn reminders off entirely in **Settings → Notifications**. Your session is still tracked.

### After a session

Ending a session takes you straight to the **Report**: your focus percentage, a donut chart of where the time went, a timeline, insights and your top distractions. **Click any block on the timeline to relabel it** if the camera got it wrong, for example if you were using your phone as a calculator.

**History** shows your week at a glance, with trends and streaks.

### Other things you can set

- **Companion:** name your dinosaur, pick its colors (these also set the app's accent color), and give it glasses.
- **Theme:** System, Light or Dark, in **Settings → Appearance**.
- **Edge bar:** a thin colored strip along the edge of your screen that shows your current activity.
- **Demo data:** **Settings → Data → Load demo data** fills in two weeks of sample sessions so you can explore the Report and History.

---

## Privacy

- **The AI runs on the UNO Q.** The camera's video is analyzed on the board.
- **Video only reaches your laptop while the camera preview is on screen**, and it is never saved. You can turn the preview off in **Settings → Device**.
- **Your study history is stored only on your computer.** Nothing is uploaded. **Settings → Data → Delete all data** erases it.

---

## Tips for accurate tracking

- **Look at your study screen during the 5-second countdown**, every session.
- **Keep the camera fixed**, centered on your screen, with your face and shoulders in view.
- **Good, even lighting** on your face helps. Avoid a bright window behind you.
- **Relabel mistakes** in the Report. StudyLens estimates what it can see; it can't know whether a glance away was you thinking.

---

## Troubleshooting

| Problem | What to try |
|---|---|
| The top bar says **UNO Q offline** | Check the address in **Settings → Device**, make sure both devices are on the same network, try **Background SSH**, or use a phone hotspot. |
| **Camera sees you** never turns green | On the board, check that the webcam shows up (`ls /dev/video*`) and that `setup_vision.py` printed `Camera environment ready`. Read the App Lab console for errors. The models take 10–30 seconds to load after **Run**. |
| The camera preview stays on "Starting the camera feed…" | The board is probably running old code. Copy the latest `board/python/` files into App Lab, then **Stop** and **Run**. |
| The touchscreen is blank or doesn't respond to taps | See [board/WIRING.md](board/WIRING.md), section 13, and the touch calibration steps in section 6. |
| Tracking feels wrong for you | Start a new session and look at your screen during the countdown. Thresholds can be tuned in `board/python/config.py` (see [WIRING.md](board/WIRING.md), section 14). |

---

## Try it without the hardware

A fake board lets you explore the app on any computer:

```sh
pip install websockets
python tools/mock_board.py --fast       # in one terminal

cd app && npm install && npm run dev    # in another
```

In the app, set **Settings → Device → UNO Q address** to `127.0.0.1:8765`. In the mock board's terminal, type `p` (phone), `l` (looking away), `a` (away), `e` (eating), `z` (sleeping), `d` (long look down) or `s` (studying), then Enter, to act things out.

---

## For developers

StudyLens is written in **TypeScript** (Electron + React desktop app), **Python** (camera AI on the UNO Q, using MediaPipe and OpenCV) and **C++** (the touchscreen sketch on the UNO Q's microcontroller).

| Path | What |
|---|---|
| `app/` | The desktop app |
| `board/python/` | The board's camera, AI pipeline, activity rules and WebSocket server |
| `board/sketch/` | The touchscreen sketch |
| `board/WIRING.md` | Hardware, board setup and tuning |
| `tools/mock_board.py` | The fake board |

```sh
cd app && npm run typecheck && npm test   # desktop app tests
python -m pytest board/python/tests       # board tests
```

The architecture, message protocol, conventions and current status are documented in **[AGENTS.md](AGENTS.md)**.

---

Built at **MadHacks 2026**.
