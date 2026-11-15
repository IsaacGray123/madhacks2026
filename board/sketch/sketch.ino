// StudyLens — UNO Q MCU sketch (STM32 side)
// Draws the 3.5" ILI9486 TFT (480x320) and reads the XPT2046 touch panel.
// The Linux side (board/python/display.py) sends screens over the Arduino Router Bridge
// as pipe-delimited strings via the "ui" RPC; taps are sent back with Bridge.notify("touch", action).
//
// Libraries (Arduino Library Manager): "GFX Library for Arduino" (Arduino_GFX), "XPT2046_Touchscreen".
// Wiring: see board/WIRING.md.

#include <Arduino_RouterBridge.h>
#include <Arduino_GFX_Library.h>
#include <SPI.h>
#include <XPT2046_Touchscreen.h>

// ---------- pins (UNO headers, 3.3 V logic) ----------
#define TFT_CS 10
#define TFT_DC 9
#define TFT_RST 8
#define TOUCH_CS 7
#define TOUCH_IRQ 2

// ---------- touch calibration (raw XPT2046 -> screen). Tune with TOUCH_DEBUG. ----------
#define TOUCH_DEBUG 0
#define TS_MINX 300
#define TS_MAXX 3800
#define TS_MINY 300
#define TS_MAXY 3800
#define TS_SWAP_XY 0
#define TS_FLIP_X 1
#define TS_FLIP_Y 0

// ---------- palette (RGB565 mirror of app/src/shared/colors.ts) ----------
#define C_STUDY 0x250D
#define C_PHONE 0xE249
#define C_DISTRACT 0xF504
#define C_AWAY 0x9D36
#define C_EAT 0x3C1E
#define C_SLEEP 0x8B7B
#define C_ACCENT 0x0CF1
#define C_PAPER 0xF7BE
#define C_INK 0x1946
#define C_SOFT 0x530D
#define C_LINE 0xEF5C
#define C_WHITE 0xFFFF
#define C_AMBER_SOFT 0xFF9B
#define C_GREEN_SOFT 0xE7BD

Arduino_DataBus *bus = new Arduino_HWSPI(TFT_DC, TFT_CS);
// Most "3.5inch RPi LCD" boards (MPI3501 / Waveshare A) run the ILI9486 in 18-bit SPI mode.
Arduino_GFX *gfx = new Arduino_ILI9486_18bit(bus, TFT_RST, 1 /* landscape */, false);
XPT2046_Touchscreen ts(TOUCH_CS, TOUCH_IRQ);

const int W = 480, H = 320;
const char *ACT_KEYS[6] = {"studying", "phone", "distracted", "away", "eating", "sleeping"};
const char *ACT_LABELS[6] = {"Studying", "Phone", "Distracted", "Away", "Eat/Drink", "Sleeping"};
const uint16_t ACT_COLORS[6] = {C_STUDY, C_PHONE, C_DISTRACT, C_AWAY, C_EAT, C_SLEEP};
const char *TIMER_LABELS[4] = {"Water", "Food", "Break", "Eyes"};

enum Mode { BOOT, SETUP, SESSION, REMINDER };
Mode mode = BOOT;
Mode modeBeforeReminder = SETUP;

volatile bool hasPending = false;
String pending;
String lastStats;
String sessionStatus = "idle";
unsigned long lastTouch = 0;

// ---------- helpers ----------
int split(const String &s, char sep, String *out, int maxParts) {
  int n = 0, start = 0;
  for (int i = 0; i <= (int)s.length() && n < maxParts; i++) {
    if (i == (int)s.length() || s[i] == sep) {
      out[n++] = s.substring(start, i);
      start = i + 1;
    }
  }
  return n;
}

int actIndex(const String &k) {
  for (int i = 0; i < 6; i++)
    if (k == ACT_KEYS[i]) return i;
  return -1;
}

String clock(long s) {
  if (s < 0) s = 0;
  long h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
  char buf[16];
  if (h) snprintf(buf, sizeof buf, "%ld:%02ld:%02ld", h, m, sec);
  else snprintf(buf, sizeof buf, "%ld:%02ld", m, sec);
  return String(buf);
}

String shortDur(long s) {
  if (s < 0) return "off";
  if (s < 60) return String(s) + "s";
  long m = s / 60;
  if (m < 60) return String(m) + "m";
  return String(m / 60) + "h" + String(m % 60) + "m";
}

void text(int x, int y, const String &t, uint16_t color, uint8_t size, int16_t bg = -1) {
  gfx->setTextSize(size);
  if (bg >= 0) gfx->setTextColor(color, (uint16_t)bg);
  else gfx->setTextColor(color);
  gfx->setCursor(x, y);
  gfx->print(t);
}

void centered(int cx, int y, const String &t, uint16_t color, uint8_t size) {
  int w = t.length() * 6 * size;
  text(cx - w / 2, y, t, color, size);
}

/** Word-wraps `t` into lines of at most `cols` characters, centered at cx. */
void wrapped(int cx, int y, const String &t, uint16_t color, uint8_t size, int cols) {
  String line, word;
  String rest = t + " ";
  for (int i = 0; i < (int)rest.length(); i++) {
    char c = rest[i];
    if (c == ' ') {
      if ((int)(line.length() + word.length() + 1) > cols && line.length()) {
        centered(cx, y, line, color, size);
        y += 10 * size;
        line = word;
      } else {
        line = line.length() ? line + " " + word : word;
      }
      word = "";
    } else {
      word += c;
    }
  }
  if (line.length()) centered(cx, y, line, color, size);
}

void button(int x, int y, int w, int h, const String &label, uint16_t bg, uint16_t fg, bool outline = false) {
  if (outline) {
    gfx->fillRoundRect(x, y, w, h, 10, C_WHITE);
    gfx->drawRoundRect(x, y, w, h, 10, C_LINE);
  } else {
    gfx->fillRoundRect(x, y, w, h, 10, bg);
  }
  centered(x + w / 2, y + h / 2 - 8, label, fg, 2);
}

bool hit(int px, int py, int x, int y, int w, int h) { return px >= x && px < x + w && py >= y && py < y + h; }

// ---------- screens ----------
// Setup: U|face|hint|ip
void drawSetup(String *p, int n) {
  bool face = n > 1 && p[1] == "1";
  String hint = n > 2 ? p[2] : "";
  String ip = n > 3 ? p[3] : "";
  if (mode != SETUP) {
    gfx->fillScreen(C_PAPER);
    text(20, 18, "StudyLens", C_ACCENT, 3);
    text(22, 50, "Camera setup", C_SOFT, 2);
    button(300, 258, 160, 46, "Start", C_ACCENT, C_WHITE);
    mode = SETUP;
  }
  // framing guide
  uint16_t c = face ? C_STUDY : C_DISTRACT;
  gfx->fillRoundRect(150, 80, 180, 150, 16, face ? C_GREEN_SOFT : C_AMBER_SOFT);
  for (int i = 0; i < 3; i++) gfx->drawRoundRect(150 + i, 80 + i, 180 - 2 * i, 150 - 2 * i, 16, c);
  gfx->fillCircle(240, 138, 26, c);           // head
  gfx->fillRoundRect(200, 172, 80, 46, 20, c); // shoulders
  gfx->fillRect(20, 236, 460, 16, C_PAPER);
  centered(240, 238, hint, face ? C_STUDY : C_INK, 2);
  gfx->fillRect(20, 268, 270, 40, C_PAPER);
  text(20, 270, "Laptop address:", C_SOFT, 1);
  text(20, 284, ip, C_INK, 2);
}

// Session: S|status|current|elapsed|focus|t0..t5|w,e,b,y
void drawSession(const String &payload) {
  String p[8];
  int n = split(payload, '|', p, 8);
  if (n < 7) return;
  String status = p[1];
  int cur = actIndex(p[2]);
  long elapsed = p[3].toInt();
  int focus = p[4].toInt();
  String t[6], tm[4];
  split(p[5], ',', t, 6);
  split(p[6], ',', tm, 4);

  bool statusChanged = status != sessionStatus;
  sessionStatus = status;
  if (mode != SESSION || statusChanged) {
    gfx->fillScreen(C_PAPER);
    for (int i = 0; i < 6; i++) text(16, 70 + i * 26, ACT_LABELS[i], C_INK, 2);
    bool paused = status == "paused";
    button(16, 270, 210, 42, paused ? "Resume" : "Pause", 0, C_INK, true);
    button(254, 270, 210, 42, "End session", C_ACCENT, C_WHITE);
    mode = SESSION;
  }

  // header: current activity chip, elapsed, focus
  gfx->fillRect(0, 0, W, 58, C_PAPER);
  bool paused = status == "paused";
  uint16_t chip = paused ? C_AWAY : (cur >= 0 ? ACT_COLORS[cur] : C_AWAY);
  String chipLabel = paused ? "Paused" : (cur >= 0 ? ACT_LABELS[cur] : "...");
  gfx->fillRoundRect(16, 12, 150, 34, 17, chip);
  centered(91, 21, chipLabel, C_WHITE, 2);
  text(190, 14, clock(elapsed), C_INK, 3);
  text(380, 12, String(focus) + "%", C_STUDY, 3);
  text(382, 40, "focus", C_SOFT, 1);

  // bars
  long secs[6], mx = 1;
  for (int i = 0; i < 6; i++) {
    secs[i] = t[i].toInt();
    if (secs[i] > mx) mx = secs[i];
  }
  for (int i = 0; i < 6; i++) {
    int y = 70 + i * 26;
    int bw = (int)(220L * secs[i] / mx);
    gfx->fillRoundRect(140, y, 220, 14, 7, C_LINE);
    if (bw > 0) gfx->fillRoundRect(140, y, max(bw, 14), 14, 7, ACT_COLORS[i]);
    gfx->fillRect(370, y, 110, 16, C_PAPER);
    text(372, y, clock(secs[i]), C_SOFT, 2);
  }

  // reminder timers
  gfx->fillRect(0, 228, W, 34, C_PAPER);
  for (int i = 0; i < 4; i++) {
    int x = 16 + i * 116;
    gfx->fillRoundRect(x, 230, 108, 30, 8, C_WHITE);
    text(x + 8, 234, TIMER_LABELS[i], C_SOFT, 1);
    text(x + 8, 244, shortDur(tm[i].toInt()), C_INK, 2);
  }
}

// Reminder: R|type|title|message
void drawReminder(String *p, int n) {
  if (mode != REMINDER) modeBeforeReminder = mode;
  mode = REMINDER;
  gfx->fillScreen(C_ACCENT);
  centered(W / 2, 60, n > 2 ? p[2] : "Reminder", C_WHITE, 3);
  wrapped(W / 2, 120, n > 3 ? p[3] : "", C_WHITE, 2, 34);
  button(60, 240, 170, 52, "Done", C_WHITE, C_ACCENT);
  button(250, 240, 170, 52, "Dismiss", C_ACCENT, C_WHITE, true);
}

void restoreAfterReminder() {
  mode = BOOT;  // force full redraw
  if (lastStats.length() && sessionStatus != "idle") drawSession(lastStats);
  else {
    gfx->fillScreen(C_PAPER);
    centered(W / 2, 150, "StudyLens", C_ACCENT, 3);
  }
}

void handle(const String &payload) {
  String p[5];
  int n = split(payload, '|', p, 5);
  char kind = payload.length() ? payload[0] : '?';
  switch (kind) {
    case 'U':
      sessionStatus = "idle";
      if (mode != REMINDER) drawSetup(p, n);
      break;
    case 'S':
      lastStats = payload;
      if (mode != REMINDER) drawSession(payload);
      break;
    case 'R':
      drawReminder(p, n);
      break;
    case 'C':
      if (mode == REMINDER) restoreAfterReminder();
      break;
  }
}

// ---------- bridge ----------
void onUi(String payload) {
  // Runs in the bridge context: stash and draw from loop().
  pending = payload;
  hasPending = true;
}

void sendTouch(const char *action) { Bridge.notify("touch", String(action)); }

// ---------- touch ----------
void pollTouch() {
  if (!ts.touched() || millis() - lastTouch < 350) return;
  TS_Point r = ts.getPoint();
  lastTouch = millis();
  int rx = TS_SWAP_XY ? r.y : r.x, ry = TS_SWAP_XY ? r.x : r.y;
  int x = map(rx, TS_MINX, TS_MAXX, 0, W);
  int y = map(ry, TS_MINY, TS_MAXY, 0, H);
  if (TS_FLIP_X) x = W - x;
  if (TS_FLIP_Y) y = H - y;
#if TOUCH_DEBUG
  gfx->fillCircle(constrain(x, 0, W - 1), constrain(y, 0, H - 1), 4, C_PHONE);
  Serial.print("raw "); Serial.print(r.x); Serial.print(","); Serial.print(r.y);
  Serial.print(" -> "); Serial.print(x); Serial.print(","); Serial.println(y);
#endif
  switch (mode) {
    case SETUP:
      if (hit(x, y, 300, 258, 160, 46)) sendTouch("start");
      break;
    case SESSION:
      if (hit(x, y, 16, 270, 210, 42)) sendTouch(sessionStatus == "paused" ? "resume" : "pause");
      else if (hit(x, y, 254, 270, 210, 42)) sendTouch("stop");
      break;
    case REMINDER:
      if (hit(x, y, 60, 240, 170, 52)) {
        sendTouch("done");
        restoreAfterReminder();
      } else if (hit(x, y, 250, 240, 170, 52)) {
        sendTouch("dismiss");
        restoreAfterReminder();
      }
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  gfx->begin();
  gfx->fillScreen(C_PAPER);
  centered(W / 2, 140, "StudyLens", C_ACCENT, 3);
  centered(W / 2, 180, "Starting camera...", C_SOFT, 2);
  ts.begin();
  ts.setRotation(1);
  Bridge.begin();
  Bridge.provide("ui", onUi);
}

void loop() {
  if (hasPending) {
    noInterrupts();
    String p = pending;
    hasPending = false;
    interrupts();
    handle(p);
  }
  pollTouch();
  delay(10);
}
