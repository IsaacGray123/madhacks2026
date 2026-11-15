// StudyLens — UNO Q MCU sketch (STM32 side)
// Draws the 3.5" RPi-style ILI9486 TFT (portrait, 320x480) and reads the XPT2046 touch panel.
// The Linux side (board/python/display.py) sends screens over the Arduino Router Bridge
// as pipe-delimited strings via the "ui" RPC; taps are sent back with Bridge.notify("touch", action).
//
// No extra libraries needed: the display driver is the same one board/tft_test proved works
// (RPi 16-bit shift-register mode), with a built-in 5x7 font and a raw XPT2046 reader.
// Wiring: see board/WIRING.md.

// ======================= SETTINGS =======================
#define USE_BRIDGE 1     // 0 = standalone demo (fake stats, no Python needed) to test screen + touch
#define TOUCH_ENABLED 1  // 0 = never touch the XPT2046 (use to rule touch wiring in/out)
#define HEARTBEAT 1      // 1 = tiny blinking square bottom-right: proves the sketch is still running
#define ROTATION 0       // 0 = portrait, connector at the top. 2 = portrait, upside down.

#define SPI_HZ 4000000   // TFT clock. Proven at 4 MHz; try 8000000 or 16000000 for faster redraws.
#define CS_PER_WORD 1    // 1 = toggle CS every 16-bit word (always works). 0 = hold CS low while
                         //     streaming pixels (much faster, works on most RPi boards — try it).
#define TOUCH_HZ 2000000 // XPT2046 max is ~2.5 MHz

// ---------- pins (UNO headers, 3.3 V logic) ----------
#define TFT_CS 10    // RPi pin 24
#define TFT_DC 9     // RPi pin 18
#define TFT_RST 8    // RPi pin 22
#define TOUCH_CS 7   // RPi pin 26
#define TOUCH_IRQ 2  // RPi pin 11 (not required; pressure is read over SPI)

// ---------- touch calibration (raw XPT2046 -> screen). Tune with TOUCH_DEBUG. ----------
#define TOUCH_DEBUG 0  // 1 = draw a dot + raw values on screen wherever you tap
#define TS_MINX 4454
#define TS_MAXX 7880
#define TS_MINY 4370
#define TS_MAXY 7894
#define TS_SWAP_XY 0   // measured raw X follows screen X, raw Y follows screen Y
#define TS_FLIP_X 1
#define TS_FLIP_Y 1
#define TS_PRESSURE 400  // higher = needs a firmer press
// ========================================================

#if USE_BRIDGE
#include <Arduino_RouterBridge.h>
#endif
#include <SPI.h>

// ---------- palette (RGB565 mirror of app/src/shared/colors.ts) ----------
#define C_STUDY 0x250D
#define C_PHONE 0xE249
#define C_DISTRACT 0xF504
#define C_AWAY 0x9D36
#define C_EAT 0x3C1E
#define C_SLEEP 0x8B7B
uint16_t companionAccent = 0x4386, companionDark = 0x32C4;
#define C_ACCENT companionAccent
#define C_ACCENT_DARK companionDark
#define C_PAPER 0xF7BE
#define C_INK 0x1946
#define C_SOFT 0x530D
#define C_LINE 0xEF5C
#define C_WHITE 0xFFFF
#define C_AMBER_SOFT 0xFF9B
#define C_GREEN_SOFT 0xE7BD

const int W = 320, H = 480;

// =====================================================================
//  Display driver (RPi 3.5" ILI9486 behind a 16-bit shift register)
// =====================================================================
SPISettings tftSpi(SPI_HZ, MSBFIRST, SPI_MODE0);
SPISettings touchSpi(TOUCH_HZ, MSBFIRST, SPI_MODE0);

static inline void word16(uint16_t w) {
  digitalWrite(TFT_CS, LOW);
  SPI.transfer16(w);
  digitalWrite(TFT_CS, HIGH);
}
static inline void cmd(uint8_t c) {
  digitalWrite(TFT_DC, LOW);
  word16(c);
  digitalWrite(TFT_DC, HIGH);
}
static inline void data(uint8_t d) { word16(d); }

void setWindow(int x0, int y0, int x1, int y1) {
  cmd(0x2A); data(x0 >> 8); data(x0 & 0xFF); data(x1 >> 8); data(x1 & 0xFF);
  cmd(0x2B); data(y0 >> 8); data(y0 & 0xFF); data(y1 >> 8); data(y1 & 0xFF);
  cmd(0x2C);
}

static inline void streamBegin() {
#if !CS_PER_WORD
  digitalWrite(TFT_CS, LOW);
#endif
}
static inline void push(uint16_t c) {
#if CS_PER_WORD
  word16(c);
#else
  SPI.transfer16(c);
#endif
}
static inline void streamEnd() {
#if !CS_PER_WORD
  digitalWrite(TFT_CS, HIGH);
#endif
}

void fillRect(int x, int y, int w, int h, uint16_t color) {
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;
  if (w <= 0 || h <= 0) return;
  SPI.beginTransaction(tftSpi);
  setWindow(x, y, x + w - 1, y + h - 1);
  streamBegin();
  for (uint32_t n = (uint32_t)w * h; n; n--) push(color);
  streamEnd();
  SPI.endTransaction();
}

void fillScreen(uint16_t color) { fillRect(0, 0, W, H, color); }

static int cornerInset(int r, int dy) {
  int dx = 0;
  while (dx * dx + dy * dy < r * r) dx++;
  return r - dx;
}

void fillRoundRect(int x, int y, int w, int h, int r, uint16_t color) {
  if (r > h / 2) r = h / 2;
  if (r > w / 2) r = w / 2;
  for (int i = 0; i < r; i++) {
    int in = cornerInset(r, r - i);
    fillRect(x + in, y + i, w - 2 * in, 1, color);
    fillRect(x + in, y + h - 1 - i, w - 2 * in, 1, color);
  }
  fillRect(x, y + r, w, h - 2 * r, color);
}

void outlineRoundRect(int x, int y, int w, int h, int r, int t, uint16_t line, uint16_t fill) {
  fillRoundRect(x, y, w, h, r, line);
  fillRoundRect(x + t, y + t, w - 2 * t, h - 2 * t, r > t ? r - t : 0, fill);
}

void fillCircle(int cx, int cy, int r, uint16_t color) {
  for (int dy = -r; dy <= r; dy++) {
    int dx = 0;
    while ((dx + 1) * (dx + 1) + dy * dy <= r * r) dx++;
    fillRect(cx - dx, cy + dy, 2 * dx + 1, 1, color);
  }
}

void initPanel() {
  digitalWrite(TFT_RST, HIGH); delay(20);
  digitalWrite(TFT_RST, LOW);  delay(50);
  digitalWrite(TFT_RST, HIGH); delay(150);
  SPI.beginTransaction(tftSpi);
  cmd(0x01); delay(150);  // software reset
  cmd(0x11); delay(150);  // sleep out
  cmd(0x3A); data(0x55);  // 16-bit pixels
  cmd(0xC2); data(0x44);
  cmd(0xC5); data(0x00); data(0x00); data(0x00); data(0x00);
  const uint8_t gp[] = {0x0F, 0x1F, 0x1C, 0x0C, 0x0F, 0x08, 0x48, 0x98, 0x37, 0x0A, 0x13, 0x04, 0x11, 0x0D, 0x00};
  const uint8_t gn[] = {0x0F, 0x32, 0x2E, 0x0B, 0x0D, 0x05, 0x47, 0x75, 0x37, 0x06, 0x10, 0x03, 0x24, 0x20, 0x00};
  cmd(0xE0); for (uint8_t b : gp) data(b);
  cmd(0xE1); for (uint8_t b : gn) data(b);
  cmd(0x20);  // inversion off
  // Memory access control: portrait 320x480, BGR. (0x28 was landscape.)
  cmd(0x36); data(ROTATION == 2 ? 0x88 : 0x48);
  cmd(0x29); delay(50);  // display on
  SPI.endTransaction();
}

// =====================================================================
//  Text (classic 5x7 font, ASCII 32..126, column-major, LSB = top row)
// =====================================================================
const uint8_t FONT[95][5] = {
  {0x00,0x00,0x00,0x00,0x00},{0x00,0x00,0x5F,0x00,0x00},{0x00,0x07,0x00,0x07,0x00},{0x14,0x7F,0x14,0x7F,0x14},
  {0x24,0x2A,0x7F,0x2A,0x12},{0x23,0x13,0x08,0x64,0x62},{0x36,0x49,0x56,0x20,0x50},{0x00,0x05,0x03,0x00,0x00},
  {0x00,0x1C,0x22,0x41,0x00},{0x00,0x41,0x22,0x1C,0x00},{0x2A,0x1C,0x7F,0x1C,0x2A},{0x08,0x08,0x3E,0x08,0x08},
  {0x00,0x50,0x30,0x00,0x00},{0x08,0x08,0x08,0x08,0x08},{0x00,0x60,0x60,0x00,0x00},{0x20,0x10,0x08,0x04,0x02},
  {0x3E,0x51,0x49,0x45,0x3E},{0x00,0x42,0x7F,0x40,0x00},{0x42,0x61,0x51,0x49,0x46},{0x21,0x41,0x45,0x4B,0x31},
  {0x18,0x14,0x12,0x7F,0x10},{0x27,0x45,0x45,0x45,0x39},{0x3C,0x4A,0x49,0x49,0x30},{0x01,0x71,0x09,0x05,0x03},
  {0x36,0x49,0x49,0x49,0x36},{0x06,0x49,0x49,0x29,0x1E},{0x00,0x36,0x36,0x00,0x00},{0x00,0x56,0x36,0x00,0x00},
  {0x08,0x14,0x22,0x41,0x00},{0x14,0x14,0x14,0x14,0x14},{0x00,0x41,0x22,0x14,0x08},{0x02,0x01,0x51,0x09,0x06},
  {0x32,0x49,0x79,0x41,0x3E},{0x7E,0x11,0x11,0x11,0x7E},{0x7F,0x49,0x49,0x49,0x36},{0x3E,0x41,0x41,0x41,0x22},
  {0x7F,0x41,0x41,0x22,0x1C},{0x7F,0x49,0x49,0x49,0x41},{0x7F,0x09,0x09,0x09,0x01},{0x3E,0x41,0x49,0x49,0x7A},
  {0x7F,0x08,0x08,0x08,0x7F},{0x00,0x41,0x7F,0x41,0x00},{0x20,0x40,0x41,0x3F,0x01},{0x7F,0x08,0x14,0x22,0x41},
  {0x7F,0x40,0x40,0x40,0x40},{0x7F,0x02,0x0C,0x02,0x7F},{0x7F,0x04,0x08,0x10,0x7F},{0x3E,0x41,0x41,0x41,0x3E},
  {0x7F,0x09,0x09,0x09,0x06},{0x3E,0x41,0x51,0x21,0x5E},{0x7F,0x09,0x19,0x29,0x46},{0x46,0x49,0x49,0x49,0x31},
  {0x01,0x01,0x7F,0x01,0x01},{0x3F,0x40,0x40,0x40,0x3F},{0x1F,0x20,0x40,0x20,0x1F},{0x3F,0x40,0x38,0x40,0x3F},
  {0x63,0x14,0x08,0x14,0x63},{0x07,0x08,0x70,0x08,0x07},{0x61,0x51,0x49,0x45,0x43},{0x00,0x7F,0x41,0x41,0x00},
  {0x02,0x04,0x08,0x10,0x20},{0x00,0x41,0x41,0x7F,0x00},{0x04,0x02,0x01,0x02,0x04},{0x40,0x40,0x40,0x40,0x40},
  {0x00,0x01,0x02,0x04,0x00},{0x20,0x54,0x54,0x54,0x78},{0x7F,0x48,0x44,0x44,0x38},{0x38,0x44,0x44,0x44,0x20},
  {0x38,0x44,0x44,0x48,0x7F},{0x38,0x54,0x54,0x54,0x18},{0x08,0x7E,0x09,0x01,0x02},{0x0C,0x52,0x52,0x52,0x3E},
  {0x7F,0x08,0x04,0x04,0x78},{0x00,0x44,0x7D,0x40,0x00},{0x20,0x40,0x44,0x3D,0x00},{0x7F,0x10,0x28,0x44,0x00},
  {0x00,0x41,0x7F,0x40,0x00},{0x7C,0x04,0x18,0x04,0x78},{0x7C,0x08,0x04,0x04,0x78},{0x38,0x44,0x44,0x44,0x38},
  {0x7C,0x14,0x14,0x14,0x08},{0x08,0x14,0x14,0x18,0x7C},{0x7C,0x08,0x04,0x04,0x08},{0x48,0x54,0x54,0x54,0x20},
  {0x04,0x3F,0x44,0x40,0x20},{0x3C,0x40,0x40,0x20,0x7C},{0x1C,0x20,0x40,0x20,0x1C},{0x3C,0x40,0x30,0x40,0x3C},
  {0x44,0x28,0x10,0x28,0x44},{0x0C,0x50,0x50,0x50,0x3C},{0x44,0x64,0x54,0x4C,0x44},{0x00,0x08,0x36,0x41,0x00},
  {0x00,0x00,0x7F,0x00,0x00},{0x00,0x41,0x36,0x08,0x00},{0x08,0x04,0x08,0x10,0x08},
};

int textWidth(const String &t, uint8_t size) { return t.length() * 6 * size; }

/**
 * Draws `t` with its top-left at (x, y) on solid background `bg` (one SPI window per string).
 * If `fieldW` > text width, the rest of the field is cleared with `bg`.
 */
void text(int x, int y, const String &t, uint16_t fg, uint8_t size, uint16_t bg, int fieldW = 0) {
  int n = t.length();
  int tw = n * 6 * size, th = 8 * size;
  if (fieldW > tw) fillRect(x + tw, y, fieldW - tw, th, bg);
  if (n == 0 || x >= W || y >= H) return;
  if (x < 0) x = 0;
  if (x + tw > W) { n = (W - x) / (6 * size); tw = n * 6 * size; }
  if (n <= 0) return;
  SPI.beginTransaction(tftSpi);
  setWindow(x, y, x + tw - 1, y + th - 1);
  streamBegin();
  for (int py = 0; py < th; py++) {
    uint8_t row = py / size;
    for (int i = 0; i < n; i++) {
      char c = t[i];
      const uint8_t *g = FONT[(c < 32 || c > 126) ? ('?' - 32) : (c - 32)];
      for (int col = 0; col < 6; col++) {
        bool on = col < 5 && row < 7 && ((g[col] >> row) & 1);
        uint16_t px = on ? fg : bg;
        for (uint8_t s = 0; s < size; s++) push(px);
      }
    }
  }
  streamEnd();
  SPI.endTransaction();
}

void centered(int cx, int y, const String &t, uint16_t fg, uint8_t size, uint16_t bg) {
  text(cx - textWidth(t, size) / 2, y, t, fg, size, bg);
}

/** Right-aligned in the field [x, x+fieldW). Clears the field first. */
void rightText(int x, int y, int fieldW, const String &t, uint16_t fg, uint8_t size, uint16_t bg) {
  fillRect(x, y, fieldW, 8 * size, bg);
  text(x + fieldW - textWidth(t, size), y, t, fg, size, bg);
}

/** Word-wraps `t` into lines of at most `cols` characters, centered at cx. Returns lines drawn. */
int wrapped(int cx, int y, const String &t, uint16_t fg, uint8_t size, int cols, uint16_t bg) {
  String line, word, rest = t + " ";
  int lines = 0;
  for (int i = 0; i < (int)rest.length(); i++) {
    char c = rest[i];
    if (c == ' ') {
      if ((int)(line.length() + word.length() + 1) > cols && line.length()) {
        centered(cx, y, line, fg, size, bg);
        y += 10 * size;
        lines++;
        line = word;
      } else {
        line = line.length() ? line + " " + word : word;
      }
      word = "";
    } else {
      word += c;
    }
  }
  if (line.length()) { centered(cx, y, line, fg, size, bg); lines++; }
  return lines;
}

// =====================================================================
//  Touch (XPT2046, raw SPI)
// =====================================================================
#if TOUCH_ENABLED
static uint16_t tsRead(uint8_t command) {
  SPI.transfer(command);
  return SPI.transfer16(0) >> 3;  // 12-bit result
}

bool readTouchRaw(int &rx, int &ry) {
  SPI.beginTransaction(touchSpi);
  digitalWrite(TOUCH_CS, LOW);
  int z1 = tsRead(0xB1), z2 = tsRead(0xC1);
  int z = z1 + 4095 - z2;
  long sx = 0, sy = 0;
  const int N = 4;
  if (z >= TS_PRESSURE) {
    tsRead(0xD1);  // first sample is noisy, discard
    for (int i = 0; i < N; i++) {
      sx += tsRead(0xD1);
      sy += tsRead(0x91);
    }
  }
  tsRead(0x90);  // power down, keep IRQ enabled
  digitalWrite(TOUCH_CS, HIGH);
  SPI.endTransaction();
  if (z < TS_PRESSURE) return false;
  rx = sx / N;
  ry = sy / N;
  return true;
}
#endif

// =====================================================================
//  Layout (portrait 320 x 480) — drawing and hit-testing share these
// =====================================================================
// Setup
const int SU_START_X = 20, SU_START_Y = 404, SU_START_W = 280, SU_START_H = 56;
// Session
const int SE_ROW_Y = 66, SE_ROW_H = 37;  // activity rows (SE_ROWS of them)
// Only the first 4 activities get a row: Studying, Phone, Distracted, Away. Eating and sleeping
// still arrive in the S| totals (and show in the status chip) but have no row on this screen.
const int SE_ROWS = 4;
const int SE_TIMER_Y = 352, SE_TIMER_W = 66, SE_TIMER_H = 44, SE_TIMER_GAP = 8;
const int SE_BTN_Y = 410, SE_BTN_H = 56, SE_PAUSE_X = 16, SE_STOP_X = 164, SE_BTN_W = 140;
// Reminder
const int RE_BTN_X = 20, RE_BTN_W = 280, RE_BTN_H = 56, RE_DONE_Y = 330, RE_DISMISS_Y = 400;

// =====================================================================
//  App
// =====================================================================
const char *ACT_KEYS[6] = {"studying", "phone", "distracted", "away", "eating", "sleeping"};
const char *ACT_LABELS[6] = {"Studying", "Phone", "Distracted", "Away", "Eat/Drink", "Sleeping"};
const uint16_t ACT_COLORS[6] = {C_STUDY, C_PHONE, C_DISTRACT, C_AWAY, C_EAT, C_SLEEP};
const char *TIMER_LABELS[4] = {"Water", "Food", "Break", "Eyes"};

enum Mode { BOOT, SETUP, SESSION, REMINDER };
Mode mode = BOOT;

volatile bool hasPending = false;
String pending;
String lastStats;
String sessionStatus = "idle";
unsigned long lastTouch = 0, bootAt = 0, lastBeat = 0;
bool gotUi = false, waitingShown = false, beat = false;

struct {
  int cur = -2, focus = -1;
  String elapsed, chip;
  int barW[6];
  String barT[6], timer[4];
  int face = -1;
  String hint, ip;
} shown;

// Companion settings ride along with U/S messages; old messages keep the defaults.
String companionName = "Moss";
int companionPalette = 0, companionMood = -1;
bool companionGlasses = true;
unsigned long companionChanged = 0, companionFrameAt = 0;
int companionDrawMode = -1, companionCaptionMood = -999;
int companionSpriteX = -1, companionSpriteY = -1;
const uint16_t DINO_BODY[4] = {0x85AB, 0x7D78, 0xE550, 0xB4D9};
const uint16_t DINO_SPINE[4] = {0x53C7, 0x4372, 0xAB6A, 0x7B13};
const uint16_t DINO_BELLY[4] = {0xE776, 0xDF7E, 0xF717, 0xEF1E};

void readCompanion(String *p, int n, int start) {
  if (n <= start + 2) return;
  String name = p[start].substring(0, 18);
  if (!name.length()) name = "Moss";
  int palette = p[start + 1] == "blue" ? 1 : p[start + 1] == "peach" ? 2 : p[start + 1] == "lavender" ? 3 : 0;
  bool glasses = p[start + 2] != "0";
  if (name != companionName || palette != companionPalette || glasses != companionGlasses) {
    companionName = name; companionPalette = palette; companionGlasses = glasses;
    companionAccent = DINO_SPINE[palette]; companionDark = DINO_SPINE[palette];
    // Force a full redraw once so buttons and the name pick up their new palette.
    if (mode != REMINDER) mode = BOOT;
    companionDrawMode = -1;
  }
}

void resetShown() {
  shown.cur = -2; shown.focus = -1; shown.elapsed = ""; shown.chip = "";
  for (int i = 0; i < 6; i++) { shown.barW[i] = -1; shown.barT[i] = ""; }
  for (int i = 0; i < 4; i++) shown.timer[i] = "";
  shown.face = -1; shown.hint = "\x01"; shown.ip = "\x01";
}

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

String clockStr(long s) {
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

void button(int x, int y, int w, int h, const String &label, uint16_t bg, uint16_t fg, bool outline = false) {
  if (outline) outlineRoundRect(x, y, w, h, 12, 2, C_LINE, C_WHITE);
  else fillRoundRect(x, y, w, h, 12, bg);
  centered(x + w / 2, y + h / 2 - 8, label, fg, 2, outline ? C_WHITE : bg);
}

bool hit(int px, int py, int x, int y, int w, int h) { return px >= x && px < x + w && py >= y && py < y + h; }

// Tiny procedural sprite. Stream a complete small tile to avoid erase/draw flicker.
// All animation runs here, never on the bridge thread. No third-party graphics library.
bool dinoOval(int x, int y, int cx, int cy, int rx, int ry) {
  return (x-cx)*(x-cx)*ry*ry + (y-cy)*(y-cy)*rx*rx <= rx*rx*ry*ry;
}
uint16_t dinoPixel(int x, int y, int mood, int phase, bool blink) {
  uint16_t body = DINO_BODY[companionPalette], spine = DINO_SPINE[companionPalette], belly = DINO_BELLY[companionPalette];
  if (x < 0 || x >= 28 || y < 0 || y >= 30) return C_PAPER;
  if (mood == 3) { // Curled up, head on paws, with a slow little tear.
    if (y >= 17 && y <= 20 && ((x >= 17 && x <= 19) || (x >= 22 && x <= 24))) return spine;
    if (dinoOval(x,y,9,23,8,5)) {
      if (companionGlasses && y >= 20 && y <= 24 && x >= 3 && x <= 14 &&
          (y == 20 || y == 24 || x == 3 || x == 8 || x == 10 || x == 14)) return C_INK;
      if ((x == 6 || x == 12) && y == 22) return C_INK;
      if (x == 13 && y >= 24 && y <= 24 + phase % 4) return 0x8E5B;
      if (y == 26 && x >= 7 && x <= 10) return spine;
      return body;
    }
    if (dinoOval(x,y,17,24,8,4) || (x >= 21 && x <= 26 && y >= 25 && y <= 27)) {
      if (dinoOval(x,y,16,25,5,2)) return belly;
      return body;
    }
    if (y == 28 && x >= 4 && x <= 15) return body;
    return C_PAPER;
  }
  // The face moves independently: no floating hand or covering the face.
  int headX = x;
  int sequence = phase % 44;
  if (y < 15 && mood == 1 && sequence >= 8 && sequence <= 23)
    headX += (sequence / 3) % 2 ? 1 : -1;
  if (y < 15 && mood == 2 && sequence >= 8 && sequence <= 30)
    headX += sequence < 19 ? 1 : -1;
  if ((headX >= 17 && headX <= 20 && y >= 4 && y <= 8) ||
      (x >= 19 && x <= 22 && y >= 10 && y <= 13) ||
      (x >= 20 && x <= 23 && y >= 16 && y <= 19)) return spine;
  bool shape = dinoOval(headX,y,11,8,9,6) || dinoOval(x,y,15,18,7,9) ||
               (x >= 15 && x <= 25 && y >= 24 && y <= 26) || (x == 26 && y == 24);
  int step = mood == 0 || mood == -1 ? (phase % 4 < 2 ? 1 : -1) : 0;
  if ((x >= 8 && x <= 13 && y >= 25 && y <= 28 + step) ||
      (x >= 17 && x <= 22 && y >= 25 && y <= 28 - step)) shape = true;
  if (mood == 2 && x >= 8 && x <= 13 && y == 28 && phase % 6 < 3) shape = false;
  if (mood == 2 && sequence >= 8 && sequence <= 28 && y >= 0 && y <= 3 && headX >= 20 && headX <= 26)
    return (headX % 3 == 2 && y == 1) ? spine : belly; // small wandering-thought bubble
  if (shape) {
    uint16_t c = body;
    if (dinoOval(x,y,12,20,3,6)) c = belly;
    if (companionGlasses && y >= 5 && y <= 10 && headX >= 4 && headX <= 16) {
      if (y == 5 || y == 10 || headX == 4 || headX == 9 || headX == 11 || headX == 16 || (headX == 10 && y == 7)) c = C_INK;
    }
    if ((headX == 7 || headX == 13) && (y == 7 || (y == 8 && !blink && mood != 5 && mood != -2))) c = C_INK;
    if (y == 12 && headX >= 8 && headX <= 11) c = spine;
    if ((headX == 5 || headX == 15) && y == 11) c = 0xECAF;
    if (mood == 0 && phase % 48 >= 18 && phase % 48 < 34 && y >= 18 && y <= 24 && x >= 5 && x <= 14) c = x == 10 ? belly : spine;
    if (mood == 4 && y >= 16 && y <= 20 && x >= 5 && x <= 9) c = 0xEDCD;
    return c;
  }
  return C_PAPER;
}
uint16_t dinoTint(uint16_t color, int amount) {
  int red = (((C_PAPER >> 11) * (16 - amount)) + ((color >> 11) * amount)) / 16;
  int green = ((((C_PAPER >> 5) & 63) * (16 - amount)) + (((color >> 5) & 63) * amount)) / 16;
  int blue = (((C_PAPER & 31) * (16 - amount)) + ((color & 31) * amount)) / 16;
  return (red << 11) | (green << 5) | blue;
}
int companionGroundY(int x) { return 306 + (x - 160) * (x - 160) / 2400; }
uint16_t companionBackdrop(int x, int y, bool session) {
  return session && y >= companionGroundY(x) && y < 400 ? dinoTint(DINO_BODY[companionPalette], 3) : C_PAPER;
}
void drawCompanionTerrain() {
  SPI.beginTransaction(tftSpi);
  setWindow(0, 244, W - 1, 399);
  streamBegin();
  for (int y = 244; y < 400; y++) for (int x = 0; x < W; x++) push(companionBackdrop(x, y, true));
  streamEnd(); SPI.endTransaction();
}
void animateCompanion() {
  if (mode != SESSION && mode != SETUP) return;
  unsigned long now = millis();
  if (now - companionFrameAt < 120 && companionDrawMode == (int)mode) return;
  companionFrameAt = now;
  bool session = mode == SESSION;
  if (companionDrawMode != (int)mode) {
    if (session) { fillRect(0, 222, W, 22, C_PAPER); centered(160, 225, companionName, C_ACCENT, 2, C_PAPER); }
    companionDrawMode = (int)mode;
    companionCaptionMood = -999;
    companionSpriteX = -1;
  }
  int phase = now / 120;
  int mood = session ? (sessionStatus == "paused" ? -2 : companionMood) : -3;
  int progress = (phase * 2) % 432;
  int tileX = mood == 0 ? 16 + (progress <= 216 ? progress : 432 - progress) : 124;
  int tileY = session ? companionGroundY(tileX + 36) - 66 : 158;
  bool flip = mood == 0 && progress <= 216;
  int jump = now - companionChanged < 600 ? (int)(600 - (now - companionChanged)) / 75 : 0;
  bool blink = phase % 43 == 0;
  // Redraw only the union of the old/new sprite tiles. Wide roaming does not require
  // repainting the entire screen every frame; terrain under the old sprite is restored.
  int left = tileX, top = tileY, right = tileX + 71, bottom = tileY + 71;
  if (companionSpriteX >= 0) {
    if (companionSpriteX < left) left = companionSpriteX;
    if (companionSpriteY < top) top = companionSpriteY;
    if (companionSpriteX + 71 > right) right = companionSpriteX + 71;
    if (companionSpriteY + 71 > bottom) bottom = companionSpriteY + 71;
  }
  SPI.beginTransaction(tftSpi);
  setWindow(left, top, right, bottom);
  streamBegin();
  for (int y = top; y <= bottom; y++) for (int x = left; x <= right; x++) {
    int px = x - tileX - 8, py = y - tileY - 8 + jump;
    uint16_t pixel = C_PAPER;
    if (px >= 0 && py >= 0) {
      int sx = px / 2;
      if (flip) sx = 27 - sx;
      pixel = dinoPixel(sx, py / 2, mood, phase, blink);
    }
    push(pixel == C_PAPER ? companionBackdrop(x, y, session) : pixel);
  }
  streamEnd(); SPI.endTransaction();
  companionSpriteX = tileX; companionSpriteY = tileY;
  if (session && mood != companionCaptionMood) {
    companionCaptionMood = mood;
    uint16_t ground = dinoTint(DINO_BODY[companionPalette], 3);
    fillRect(0, 322, W, 12, ground);
    const char *hint = mood == 1 ? "One more page?" : mood == 2 ? "A tiny reset." : mood == 3 ? "Saving your spot." : mood == 5 || mood == -2 ? "Rest a little." : "Growing together.";
    centered(160, 324, hint, C_SOFT, 1, ground);
  }
}

void drawBoot(const String &line) {
  fillScreen(C_PAPER);
  centered(W / 2, 190, "StudyLens", C_ACCENT, 3, C_PAPER);
  centered(W / 2, 235, line, C_SOFT, 2, C_PAPER);
}

/** Small status line under the boot screen, so we can see how far start-up got. */
void bootStep(const String &s) {
  fillRect(0, 290, W, 10, C_PAPER);
  centered(W / 2, 290, s, C_SOFT, 1, C_PAPER);
  Serial.println(s);
}

// ---------- Setup: U|face|hint|ip ----------
void drawSetup(String *p, int n) {
  int face = (n > 1 && p[1] == "1") ? 1 : 0;
  String hint = n > 2 ? p[2] : "";
  String ip = n > 3 ? p[3] : "";
  if (mode != SETUP) {
    fillScreen(C_PAPER);
    text(20, 24, "StudyLens", C_ACCENT, 3, C_PAPER);
    text(22, 58, "Camera setup", C_SOFT, 2, C_PAPER);
    text(20, 352, "Laptop address:", C_SOFT, 1, C_PAPER);
    button(SU_START_X, SU_START_Y, SU_START_W, SU_START_H, "Start", C_ACCENT, C_WHITE);
    resetShown();
    mode = SETUP;
  }
  if (face != shown.face) {  // framing guide
    uint16_t c = face ? C_STUDY : C_DISTRACT;
    fillRect(60, 96, 200, 180, C_PAPER);
    centered(160, 111, companionName, C_ACCENT, 2, C_PAPER);
    centered(160, 137, face ? "I can see you!" : "Find your frame", c, 1, C_PAPER);
    companionDrawMode = -1;
    shown.face = face;
    shown.hint = "\x01";
  }
  if (hint != shown.hint) {
    fillRect(0, 290, W, 44, C_PAPER);
    wrapped(W / 2, 292, hint, face ? C_STUDY : C_INK, 2, 24, C_PAPER);
    shown.hint = hint;
  }
  if (ip != shown.ip) {
    text(20, 366, ip, C_INK, 2, C_PAPER, 280);
    shown.ip = ip;
  }
}

// ---------- Session: S|status|current|elapsed|focus|t0..t5|w,e,b,y (rows drawn for t0..t3) ----------
void drawSession(const String &payload) {
  String p[10];
  int n = split(payload, '|', p, 10);
  readCompanion(p, n, 7);
  if (n < 7) return;
  String status = p[1];
  int cur = actIndex(p[2]);
  long elapsed = p[3].toInt();
  // p[4] retains focus % for compatibility; elapsed time now occupies the header.
  String t[6], tm[4];
  split(p[5], ',', t, 6);
  split(p[6], ',', tm, 4);
  bool paused = status == "paused";

  if (mode != SESSION || status != sessionStatus) {
    fillScreen(C_PAPER);
    drawCompanionTerrain();
    text(190, 44, "session time", C_SOFT, 1, C_PAPER);
    companionDrawMode = -1;
    for (int i = 0; i < SE_ROWS; i++) text(16, SE_ROW_Y + i * SE_ROW_H, ACT_LABELS[i], C_INK, 2, C_PAPER);
    for (int i = 0; i < 4; i++) {
      int x = 16 + i * (SE_TIMER_W + SE_TIMER_GAP);
      fillRoundRect(x, SE_TIMER_Y, SE_TIMER_W, SE_TIMER_H, 8, C_WHITE);
      text(x + 5, SE_TIMER_Y + 6, TIMER_LABELS[i], C_SOFT, 1, C_WHITE);
    }
    button(SE_PAUSE_X, SE_BTN_Y, SE_BTN_W, SE_BTN_H, paused ? "Resume" : "Pause", 0, C_INK, true);
    button(SE_STOP_X, SE_BTN_Y, SE_BTN_W, SE_BTN_H, "End", C_ACCENT, C_WHITE);
    resetShown();
    mode = SESSION;
  }
  sessionStatus = status;

  // Compact header: activity chip and elapsed time leave room for the companion.
  uint16_t chip = paused ? C_AWAY : (cur >= 0 ? ACT_COLORS[cur] : C_AWAY);
  String chipLabel = paused ? "Paused" : (cur >= 0 ? ACT_LABELS[cur] : "...");
  if (chipLabel != shown.chip) {
    fillRoundRect(16, 14, 150, 34, 17, chip);
    centered(91, 23, chipLabel, C_WHITE, 2, chip);
    shown.chip = chipLabel;
  }
  if (cur != companionMood) { companionMood = cur; companionChanged = millis(); }
  String el = clockStr(elapsed);
  if (el != shown.elapsed) {
    rightText(174, 18, 130, el, C_INK, 2, C_PAPER);
    shown.elapsed = el;
  }

  // activity rows: label + time on one line, full-width bar below
  long secs[SE_ROWS], mx = 1;
  for (int i = 0; i < SE_ROWS; i++) {
    secs[i] = t[i].toInt();
    if (secs[i] > mx) mx = secs[i];
  }
  for (int i = 0; i < SE_ROWS; i++) {
    int y = SE_ROW_Y + i * SE_ROW_H;
    String ts = clockStr(secs[i]);
    if (ts != shown.barT[i]) {
      rightText(200, y, 104, ts, C_SOFT, 2, C_PAPER);
      shown.barT[i] = ts;
    }
    int bw = (int)(288L * secs[i] / mx);
    if (bw > 0 && bw < 10) bw = 10;
    if (bw != shown.barW[i]) {
      fillRoundRect(16, y + 20, 288, 10, 5, C_LINE);
      if (bw > 0) fillRoundRect(16, y + 20, bw, 10, 5, ACT_COLORS[i]);
      shown.barW[i] = bw;
    }
  }

  // reminder timers (4 small tiles)
  for (int i = 0; i < 4; i++) {
    String v = shortDur(tm[i].toInt());
    if (v != shown.timer[i]) {
      int x = 16 + i * (SE_TIMER_W + SE_TIMER_GAP);
      text(x + 3, SE_TIMER_Y + 20, v, C_INK, 2, C_WHITE, SE_TIMER_W - 6);
      shown.timer[i] = v;
    }
  }
}

// ---------- Reminder: R|type|title|message ----------
void drawReminder(String *p, int n) {
  mode = REMINDER;
  fillScreen(C_ACCENT);
  String title = n > 2 ? p[2] : "Reminder";
  uint8_t ts = textWidth(title, 3) <= W - 24 ? 3 : 2;
  centered(W / 2, 90, title, C_WHITE, ts, C_ACCENT);
  wrapped(W / 2, 160, n > 3 ? p[3] : "", C_WHITE, 2, 24, C_ACCENT);
  button(RE_BTN_X, RE_DONE_Y, RE_BTN_W, RE_BTN_H, "Done", C_WHITE, C_ACCENT);
  button(RE_BTN_X, RE_DISMISS_Y, RE_BTN_W, RE_BTN_H, "Dismiss", C_ACCENT_DARK, C_WHITE);
}

void restoreAfterReminder() {
  mode = BOOT;  // force full redraw
  if (lastStats.length() && sessionStatus != "idle") drawSession(lastStats);
  else drawBoot("Ready");
}

void handle(const String &payload) {
  String p[10];
  int n = split(payload, '|', p, 10);
  char kind = payload.length() ? payload[0] : '?';
  switch (kind) {
    case 'U':
      readCompanion(p, n, 4);
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
#if USE_BRIDGE
void onUi(String payload) {
  // Runs in the bridge context: stash and draw from loop().
  noInterrupts();
  pending = payload;
  hasPending = true;
  interrupts();
}
#endif

void sendTouch(const char *action) {
  Serial.print("touch: "); Serial.println(action);
#if USE_BRIDGE
  Bridge.notify("touch", String(action));
#endif
}

// ---------- touch ----------
void pollTouch() {
#if TOUCH_ENABLED
  if (millis() - lastTouch < 350) return;
  int rx, ry;
  if (!readTouchRaw(rx, ry)) return;
  lastTouch = millis();
  int ax = TS_SWAP_XY ? ry : rx, ay = TS_SWAP_XY ? rx : ry;
  int x = map(ax, TS_SWAP_XY ? TS_MINY : TS_MINX, TS_SWAP_XY ? TS_MAXY : TS_MAXX, 0, W);
  int y = map(ay, TS_SWAP_XY ? TS_MINX : TS_MINY, TS_SWAP_XY ? TS_MAXX : TS_MAXY, 0, H);
  if (TS_FLIP_X) x = W - x;
  if (TS_FLIP_Y) y = H - y;
  x = constrain(x, 0, W - 1);
  y = constrain(y, 0, H - 1);
#if TOUCH_DEBUG
  fillCircle(x, y, 4, C_PHONE);
  text(4, H - 12, "raw " + String(rx) + "," + String(ry) + " -> " + String(x) + "," + String(y), C_INK, 1, C_WHITE, 220);
  Serial.print("raw "); Serial.print(rx); Serial.print(","); Serial.print(ry);
  Serial.print(" -> "); Serial.print(x); Serial.print(","); Serial.println(y);
#endif
  switch (mode) {
    case SETUP:
      if (hit(x, y, SU_START_X, SU_START_Y, SU_START_W, SU_START_H)) sendTouch("start");
      break;
    case SESSION:
      if (hit(x, y, SE_PAUSE_X, SE_BTN_Y, SE_BTN_W, SE_BTN_H)) sendTouch(sessionStatus == "paused" ? "resume" : "pause");
      else if (hit(x, y, SE_STOP_X, SE_BTN_Y, SE_BTN_W, SE_BTN_H)) sendTouch("stop");
      break;
    case REMINDER:
      if (hit(x, y, RE_BTN_X, RE_DONE_Y, RE_BTN_W, RE_BTN_H)) {
        sendTouch("done");
        restoreAfterReminder();
      } else if (hit(x, y, RE_BTN_X, RE_DISMISS_Y, RE_BTN_W, RE_BTN_H)) {
        sendTouch("dismiss");
        restoreAfterReminder();
      }
      break;
    default:
      break;
  }
#endif
}

// ---------- standalone demo (USE_BRIDGE 0) ----------
#if !USE_BRIDGE
void demoTick() {
  static unsigned long last = 0;
  static long s = 0, act[6] = {0};
  if (millis() - last < 1000) return;
  last = millis();
  s++;
  if (s < 6) {
    handle(String("U|") + (s > 2 ? "1" : "0") + "|" + (s > 2 ? "Face detected - you're in frame" : "Move into view of the camera") + "|demo mode");
    return;
  }
  int cur = (s / 8) % 6;
  act[cur]++;
  long focus = act[0] * 100 / (s - 5);
  String t;
  for (int i = 0; i < 6; i++) t += String(act[i]) + (i < 5 ? "," : "");
  handle(String("S|running|") + ACT_KEYS[cur] + "|" + String(s - 5) + "|" + String(focus) + "|" + t + "|" +
         String(2400 - s) + "," + String(9000 - s) + "," + String(3600 - s) + "," + String(1200 - s));
  if ((s - 5) % 40 == 0) handle("R|water|Drink some water|You haven't had a sip in a while. Grab your bottle.");
}
#endif

void setup() {
  Serial.begin(115200);
  pinMode(TFT_CS, OUTPUT);   digitalWrite(TFT_CS, HIGH);
  pinMode(TOUCH_CS, OUTPUT); digitalWrite(TOUCH_CS, HIGH);
  pinMode(TFT_DC, OUTPUT);   digitalWrite(TFT_DC, HIGH);
  pinMode(TFT_RST, OUTPUT);  digitalWrite(TFT_RST, HIGH);
  pinMode(TOUCH_IRQ, INPUT_PULLUP);
  SPI.begin();

  initPanel();
  resetShown();
  drawBoot("Starting camera...");
  bootStep("1/3 screen ok");

#if USE_BRIDGE
  bootStep("2/3 starting bridge...");
  Bridge.begin();
  Bridge.provide("ui", onUi);
  bootStep("3/3 bridge ok - waiting for main.py");
#else
  bootStep("demo mode (USE_BRIDGE 0)");
#endif
  bootAt = millis();
}

void loop() {
  if (hasPending) {
    noInterrupts();
    String p = pending;
    hasPending = false;
    interrupts();
    gotUi = true;
    handle(p);
  }
#if !USE_BRIDGE
  demoTick();
#endif
  if (!gotUi && !waitingShown && USE_BRIDGE && millis() - bootAt > 20000) {
    centered(W / 2, 310, "No screen from main.py yet", C_DISTRACT, 1, C_PAPER);
    waitingShown = true;
  }
#if HEARTBEAT
  if (millis() - lastBeat > 500) {
    lastBeat = millis();
    beat = !beat;
    fillRect(W - 6, H - 6, 4, 4, beat ? C_STUDY : C_INK);
  }
#endif
  animateCompanion();
  pollTouch();
  delay(10);
}
