// StudyLens — TFT bring-up test for the UNO Q (no extra libraries needed).
//
// Purpose: find out whether the 3.5" RPi-style ILI9486 screen is wired correctly and which
// interface it uses, BEFORE flashing the full sketch.
//
// What you should see if it works: the screen fills RED, then GREEN, then BLUE, then shows
// three vertical stripes (red | green | blue) with a white border, and repeats.
// The board's built-in LED blinks every loop so you know the sketch is running even if the screen stays blank.
//
// Try MODE_RPI16 = 1 first (most "3.5inch RPi LCD" boards: Waveshare A, MPI3501, Kuman, etc.).
// If the screen stays plain white with mode 1, change it to 0, upload again, and compare.

#include <SPI.h>

// ======================= SETTINGS =======================
#define MODE_RPI16 1          // 1 = Raspberry-Pi-style board (16-bit shift register).  0 = plain ILI9486 SPI.
#define SPI_HZ 4000000        // 4 MHz is safe for jumper wires. Raise to 16000000 once it works.

#define TFT_CS 10             // RPi header pin 24
#define TFT_DC 9              // RPi header pin 18
#define TFT_RST 8             // RPi header pin 22
#define TOUCH_CS 7            // RPi header pin 26 — held HIGH so the touch chip stays off the bus
// SCK = D13 (pin 23), MOSI = D11 (pin 19), MISO = D12 (pin 21) — the board's hardware SPI pins
// ========================================================

const uint16_t W = 480, H = 320;
const uint16_t RED = 0xF800, GREEN = 0x07E0, BLUE = 0x001F, WHITE = 0xFFFF, BLACK = 0x0000;

// ---------- low-level bus ----------
static inline void word16(uint16_t w) {
  // RPi boards latch each 16-bit word when CS goes high, so toggle CS per word (slow but always correct).
  digitalWrite(TFT_CS, LOW);
  SPI.transfer16(w);
  digitalWrite(TFT_CS, HIGH);
}

void cmd(uint8_t c) {
  digitalWrite(TFT_DC, LOW);
#if MODE_RPI16
  word16(c);
#else
  digitalWrite(TFT_CS, LOW);
  SPI.transfer(c);
  digitalWrite(TFT_CS, HIGH);
#endif
  digitalWrite(TFT_DC, HIGH);
}

void data(uint8_t d) {
  digitalWrite(TFT_DC, HIGH);
#if MODE_RPI16
  word16(d);
#else
  digitalWrite(TFT_CS, LOW);
  SPI.transfer(d);
  digitalWrite(TFT_CS, HIGH);
#endif
}

void window(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1) {
  cmd(0x2A); data(x0 >> 8); data(x0 & 0xFF); data(x1 >> 8); data(x1 & 0xFF);  // column range
  cmd(0x2B); data(y0 >> 8); data(y0 & 0xFF); data(y1 >> 8); data(y1 & 0xFF);  // row range
  cmd(0x2C);                                                                   // start writing pixels
}

void rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color) {
  window(x, y, x + w - 1, y + h - 1);
  digitalWrite(TFT_DC, HIGH);
  uint32_t n = (uint32_t)w * h;
#if MODE_RPI16
  while (n--) word16(color);
#else
  // 18-bit colour: 3 bytes per pixel
  uint8_t r = (color >> 8) & 0xF8, g = (color >> 3) & 0xFC, b = (color << 3) & 0xF8;
  digitalWrite(TFT_CS, LOW);
  while (n--) {
    SPI.transfer(r);
    SPI.transfer(g);
    SPI.transfer(b);
  }
  digitalWrite(TFT_CS, HIGH);
#endif
}

// ---------- ILI9486 init (same sequence the Raspberry Pi drivers use) ----------
void initPanel() {
  digitalWrite(TFT_RST, HIGH); delay(20);
  digitalWrite(TFT_RST, LOW);  delay(50);
  digitalWrite(TFT_RST, HIGH); delay(150);

  cmd(0x01); delay(150);                       // software reset
  cmd(0x11); delay(150);                       // sleep out
  cmd(0x3A); data(MODE_RPI16 ? 0x55 : 0x66);   // pixel format: 16-bit (RPi) or 18-bit (plain SPI)
  cmd(0xC2); data(0x44);                       // power control 3
  cmd(0xC5); data(0x00); data(0x00); data(0x00); data(0x00);  // VCOM
  const uint8_t gp[] = {0x0F, 0x1F, 0x1C, 0x0C, 0x0F, 0x08, 0x48, 0x98, 0x37, 0x0A, 0x13, 0x04, 0x11, 0x0D, 0x00};
  const uint8_t gn[] = {0x0F, 0x32, 0x2E, 0x0B, 0x0D, 0x05, 0x47, 0x75, 0x37, 0x06, 0x10, 0x03, 0x24, 0x20, 0x00};
  cmd(0xE0); for (uint8_t b : gp) data(b);     // positive gamma
  cmd(0xE1); for (uint8_t b : gn) data(b);     // negative gamma
  cmd(0x20);                                   // inversion off
  cmd(0x36); data(0x28);                       // landscape 480x320, BGR order
  cmd(0x29); delay(50);                        // display on
}

void blink() {
#ifdef LED_BUILTIN
  digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
#endif
}

void setup() {
  Serial.begin(115200);
#ifdef LED_BUILTIN
  pinMode(LED_BUILTIN, OUTPUT);
#endif
  pinMode(TFT_CS, OUTPUT);   digitalWrite(TFT_CS, HIGH);
  pinMode(TOUCH_CS, OUTPUT); digitalWrite(TOUCH_CS, HIGH);
  pinMode(TFT_DC, OUTPUT);   digitalWrite(TFT_DC, HIGH);
  pinMode(TFT_RST, OUTPUT);

  SPI.begin();
  SPI.beginTransaction(SPISettings(SPI_HZ, MSBFIRST, SPI_MODE0));

  Serial.println(MODE_RPI16 ? "TFT test: MODE_RPI16 (Raspberry Pi style)" : "TFT test: plain ILI9486 SPI");
  initPanel();
  Serial.println("init sent");
}

void loop() {
  blink(); Serial.println("RED");   rect(0, 0, W, H, RED);   delay(800);
  blink(); Serial.println("GREEN"); rect(0, 0, W, H, GREEN); delay(800);
  blink(); Serial.println("BLUE");  rect(0, 0, W, H, BLUE);  delay(800);
  blink(); Serial.println("STRIPES");
  rect(0, 0, W, H, WHITE);
  rect(10, 10, 153, H - 20, RED);
  rect(163, 10, 154, H - 20, GREEN);
  rect(317, 10, 153, H - 20, BLUE);
  delay(2500);
}
