# UNO Q wiring and setup

## Hardware
- Arduino UNO Q
- USB webcam (UVC) → **USB-C hub** → UNO Q USB-C port (the hub also powers the board)
- 3.5" "RPi LCD" SPI touchscreen: **ILI9486 display + XPT2046 touch**, 480×320 (MPI3501 / Waveshare 3.5" A style)

## TFT → UNO Q jumper wires
The screen was built to plug onto a Raspberry Pi 40-pin header. Run jumper wires from its header pins to the UNO Q's Arduino headers instead.

| TFT pin (RPi header #) | Signal | UNO Q pin |
|---|---|---|
| 1 or 17 | 3.3 V | 3V3 |
| 2 or 4 | 5 V (backlight / regulator) | 5V |
| 6 | GND | GND |
| 19 | MOSI (LCD_SI + TP_SI) | D11 |
| 21 | MISO (TP_SO) | D12 |
| 23 | SCLK (shared) | D13 |
| 24 | LCD_CS | D10 |
| 18 | LCD_RS / DC | D9 |
| 22 | RST | D8 |
| 26 | TP_CS | D7 |
| 11 | TP_IRQ (PENIRQ) | D2 |

The UNO Q headers use **3.3 V logic**, which matches the panel. The pin numbers live at the top of `sketch/sketch.ino` if you need to change them.

## Software on the board
1. **MCU sketch.** Open `board/sketch/sketch.ino` in Arduino App Lab (or the IDE) and flash it. It needs no extra libraries: the display driver (RPi 16-bit shift-register mode), font and touch reader are built in. If the screen ever stays blank, flash `board/tft_test/tft_test.ino` first to check the wiring.
2. **Linux side** (SSH or the App Lab terminal):
   ```sh
   cd board/python
   pip install -r requirements.txt
   ./download_models.sh
   python main.py --debug
   ```
   On startup it prints `WebSocket server on ws://<ip>:8765`. The TFT setup screen shows the same address.
3. **Laptop.** In StudyLens, enter that `ip:8765` under **Settings → Device**, then press **Test**.

## Things to verify early (first 2 hours)
- [ ] `pip install mediapipe` works on the board's Debian aarch64 image. If it doesn't, try `pip install mediapipe --no-deps` plus `numpy`, or switch the three detectors to `tflite-runtime` with the same `.tflite` models.
- [ ] Frame rate: `--debug` prints about 3 lines per second. If it's slower, lower `TARGET_FPS` or `FRAME_WIDTH`/`FRAME_HEIGHT` in `config.py`.
- [ ] The display shows "StudyLens / Starting camera...". If it stays white, run `board/tft_test` (mode 1 is confirmed on our panel). Once it works, try `CS_PER_WORD 0` and a higher `SPI_HZ` at the top of the sketch for faster redraws.
- [ ] Touch: set `TOUCH_DEBUG 1`, tap the corners, read the raw values printed at the bottom of the screen, and adjust `TS_MINX…TS_FLIP_Y`.
- [ ] Bridge: confirm `Bridge.provide("ui", onUi)` with a `String` argument and `Bridge.notify("touch", …)` match your RouterBridge library version, and that `from arduino.app_utils import Bridge, App` works in Python. `display.py` falls back to logging if the import fails.
- [ ] The venue Wi-Fi allows device-to-device traffic. If it doesn't, put the laptop and the board on a phone hotspot.

## Tuning the classifier
Every threshold is in `board/python/config.py`. Run `python main.py --debug` and act out each state while watching the `raw=` / `state=` output:
- **Looking down at notes reads as sleeping?** Raise `LOOKING_DOWN_DEG`, or flip `PITCH_SIGN` if `pitch` goes negative when you look down.
- **Phone not detected?** EfficientDet sees phones best from the side. Lower `OBJECT_SCORE` to around 0.3, or raise `PHONE_NEAR_HAND`.
- **Drinking missed?** Raise `NEAR_FACE`.

Unit tests: `python -m pytest board/python/tests`.
