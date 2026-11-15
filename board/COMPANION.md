# The StudyLens companion

Moss is the default dinosaur. The Companion tab controls its name (18 characters), Grass/Pond/Peach/Lilac palette, and optional glasses. Preferences persist in the existing local settings file. The chosen palette sets the app accents; activity colors stay consistent for reports.

The home screen greets you with a calm pose, blink, and slight head tilt for four seconds, then paces across a responsive walking path. During a session the same character reacts to studying, phone, distracted, away, eating, sleeping, paused, and waiting for data. State changes trigger a small hop. Studying alternates a walk and a reading pose. Phone use gets a gentle head shake. Away curls up with its head on its paws and a small tear. Distracted looks around, follows a tiny butterfly, taps its foot, and then settles before the loop repeats. The Companion tab previews expressions without changing camera inference or session data. Reduced-motion preferences disable desktop animations.

The desktop habitat uses layered hills, a soft path, flowers, cloud drift, and a palette-tinted paper background. The MCU mirrors the revised reactions in a tiny meadow, with no floating waving block. The MCU uses a small pixel sprite, about 8 frames/s at most, streamed in a small tile to keep touch handling and the existing proven display driver intact. The four activity rows are compacted. Elapsed time replaces focus percentage in the LCD header. Focus remains available in the desktop app and reports. Reminder buttons and session buttons retain their existing positions. Actual smoothness depends on the panel's SPI speed and must be checked on the board.

## Install once

1. Quit StudyLens from its tray menu and run `app/dist/StudyLens Setup 0.1.0.exe`. A Git pull alone does not update an installed desktop executable.
2. From PowerShell in the repository root, send the board package and installer:

```powershell
scp board/install_companion.py "app/dist/StudyLens Companion Board.zip" arduino@172.20.10.4:~/
ssh arduino@172.20.10.4 "python3 ~/install_companion.py --app hackathon"
```

Replace the address or app folder if yours differs. This is a one-time deployment over SSH. Daily connections continue through the app's saved Background SSH login. No IDE is required. The installer backs up replaced files, preserves `python/config.py` and existing sketch touch calibration, and starts the app through App CLI so the updated sketch can compile/upload. If the CLI command fails, it restores the previous files and attempts to start the old app.

3. Reopen the Windows app. In Companion, choose a name/color. Reconnecting also resends companion settings. Python carries those fields in every LCD setup/stats message, which avoids losing settings in the MCU's single-message mailbox. Older screens ignore the appended fields. A Python-only update cannot draw the new creature on an old sketch.

## Validation

- TypeScript typecheck, shared logic tests, Python transport/recovery checks.
- Hidden, isolated Electron rendering checks for the home greeting, Companion tab, expression previews, palette/name persistence, and light/dark layouts. This does not capture the user's desktop.
- Native C++ compilation with Arduino/Bridge stubs and simulated screen/state messages. This is not an UNO Q toolchain build or a physical-panel test.

Confirm on the board after installation: readable timer/name, activity changes and hops, pause/resume, all touch buttons, reminder clear/restore, color sync after reconnect, and acceptable animation speed. Camera models and classifier thresholds are unchanged by this feature.
