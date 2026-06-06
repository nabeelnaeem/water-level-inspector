/*
 * Smart Water Level Inspector — ESP32-S3 Tank Node
 * -------------------------------------------------
 * Replaces the ESP8266 Slave + Master architecture. A single ESP32-S3
 * reads one AJ-SR04M waterproof ultrasonic sensor and PUSHES raw distance
 * readings to the self-hosted backend, which owns calibration, history,
 * online/offline state, and serves the web + mobile dashboards.
 *
 * Board:  ESP32-S3-WROOM-1 (N16R8 — 16MB flash / 8MB PSRAM)
 * Sensor: AJ-SR04M V3.0 in Mode 0 (HC-SR04-style Trig/Echo)
 *
 * Key differences vs. the old ESP8266 firmware:
 *   - Pushes JSON to the backend instead of serving a raw-float endpoint
 *     (no CORS issues, central history, fail-safe offline detection).
 *   - Returns -1 on sensor timeout INSTEAD of 0  → backend marks the tank
 *     "fault" rather than silently reporting a full tank (the original bug).
 *   - Median-of-N sampling to reject transient ultrasonic spikes.
 *   - ArduinoOTA for wireless firmware updates (16MB flash has room).
 *
 * Wiring (3.3V logic — keep the 5V echo voltage divider!):
 *   Sensor VCC  -> 5V (VIN from the XL7015 buck / 12V->5V)
 *   Sensor GND  -> GND
 *   Sensor Trig -> GPIO 5
 *   Sensor Echo -> GPIO 4  VIA 2.2k/3.3k divider (5V -> 3.0V)  ** required **
 *
 * Avoid strapping/reserved pins on the S3: GPIO0, 3, 45, 46 (boot),
 * 19/20 (USB), and 26–32 / 33–37 (SPI flash & PSRAM on N16R8).
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoOTA.h>
#include "secrets.h"   // copy secrets.h.example -> secrets.h and fill in

// ----------------------------------------------------------------------------
// Node configuration
// ----------------------------------------------------------------------------

// MUST match the tank `id` configured in the backend (e.g. "tank-1").
static const char* NODE_ID = "tank-1";
static const char* FW_VERSION = "1.0.0";

// How often to sample + report on the regular schedule (ms).
// NOTE: if you raise this above ~60s, also raise the backend's
// OFFLINE_TIMEOUT_SECONDS so the tank isn't shown offline between posts.
static const unsigned long REPORT_INTERVAL_MS = 120000;  // 2 minutes

// How often to ask the backend whether a manual refresh was requested (ms).
// This is a tiny GET, so it can be frequent without much cost. A dashboard
// "Refresh now" press will be served within this interval.
static const unsigned long COMMAND_POLL_INTERVAL_MS = 3000;

// ----------------------------------------------------------------------------
// Pins
// ----------------------------------------------------------------------------
static const int TRIG_PIN = 5;
static const int ECHO_PIN = 4;
static const int STATUS_LED = 2;   // simple status LED (optional)

// ----------------------------------------------------------------------------
// Sensor parameters (AJ-SR04M V3.0, Mode 0)
// ----------------------------------------------------------------------------
static const float SOUND_CM_PER_US = 0.0343f;   // ~343 m/s
static const unsigned long ECHO_TIMEOUT_US = 30000UL; // ~5 m round trip
static const float MIN_VALID_CM = 20.0f;   // below the ~25cm blind zone -> suspect
static const float MAX_VALID_CM = 450.0f;  // sensor max range
static const int   SAMPLE_COUNT = 5;       // median-of-N

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------
unsigned long lastReport = 0;
unsigned long lastCommandPoll = 0;
// Command endpoint, derived from BACKEND_INGEST_URL at startup
// (e.g. http://host:4000/api/ingest  ->  http://host:4000/api/tanks/<id>/command).
String commandUrl;

// ----------------------------------------------------------------------------
// Wi-Fi
// ----------------------------------------------------------------------------
void connectWiFi() {
  Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

#ifdef USE_STATIC_IP
  IPAddress ip, gw, mask, dns;
  ip.fromString(STATIC_IP);
  gw.fromString(STATIC_GATEWAY);
  mask.fromString(STATIC_SUBNET);
  dns.fromString(STATIC_DNS);
  if (!WiFi.config(ip, gw, mask, dns)) {  // note: ESP32 needs the DNS arg
    Serial.println("Static IP config failed; falling back to DHCP.");
  }
#endif

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
    // Reboot if Wi-Fi never comes up within 40s (self-healing node).
    if (millis() - start > 40000) {
      Serial.println("\nWi-Fi timeout — restarting.");
      ESP.restart();
    }
  }
  Serial.printf("\nWi-Fi connected. IP: %s  RSSI: %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

// ----------------------------------------------------------------------------
// OTA
// ----------------------------------------------------------------------------
void setupOTA() {
  ArduinoOTA.setHostname(NODE_ID);
#ifdef OTA_PASSWORD
  ArduinoOTA.setPassword(OTA_PASSWORD);
#endif
  ArduinoOTA.onStart([]() { Serial.println("OTA update starting..."); });
  ArduinoOTA.onEnd([]()   { Serial.println("\nOTA complete."); });
  ArduinoOTA.onError([](ota_error_t e) { Serial.printf("OTA error %u\n", e); });
  ArduinoOTA.begin();
  Serial.println("OTA ready.");
}

// ----------------------------------------------------------------------------
// Sensor
// ----------------------------------------------------------------------------

// Single trig/echo cycle. Returns distance in cm, or -1 on timeout/out-of-range.
float readOnce() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
  if (duration == 0) return -1.0f;  // no echo -> sensor fault / out of range

  float cm = (duration * SOUND_CM_PER_US) / 2.0f;
  if (cm < MIN_VALID_CM || cm > MAX_VALID_CM) return -1.0f;
  return cm;
}

// Median-of-N filtered reading. Returns -1 if too few samples were valid.
float readDistanceCm() {
  float samples[SAMPLE_COUNT];
  int n = 0;
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    float v = readOnce();
    if (v >= 0) samples[n++] = v;
    delay(60);  // let echoes settle between pings
  }
  if (n < (SAMPLE_COUNT / 2 + 1)) return -1.0f;  // mostly invalid -> fault

  // insertion sort the valid samples
  for (int i = 1; i < n; i++) {
    float key = samples[i];
    int j = i - 1;
    while (j >= 0 && samples[j] > key) { samples[j + 1] = samples[j]; j--; }
    samples[j + 1] = key;
  }
  return samples[n / 2];
}

// ----------------------------------------------------------------------------
// Reporting
// ----------------------------------------------------------------------------
void reportReading(float distanceCm) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi down; skipping report.");
    return;
  }

  char body[192];
  // distanceCm is sent as-is; -1 is the backend's documented fault sentinel.
  snprintf(body, sizeof(body),
           "{\"nodeId\":\"%s\",\"rawDistanceCm\":%.2f,\"rssi\":%d,"
           "\"fw\":\"%s\",\"uptimeS\":%lu}",
           NODE_ID, distanceCm, WiFi.RSSI(), FW_VERSION, millis() / 1000UL);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, BACKEND_INGEST_URL);
  http.addHeader("Content-Type", "application/json");
#ifdef INGEST_KEY
  http.addHeader("x-ingest-key", INGEST_KEY);
#endif

  int code = http.POST((uint8_t*)body, strlen(body));
  Serial.printf("POST %s -> %d  %s\n", BACKEND_INGEST_URL, code, body);

  // Quick LED feedback: solid on success, off on failure.
  digitalWrite(STATUS_LED, (code >= 200 && code < 300) ? HIGH : LOW);
  http.end();
}

// Ask the backend whether a manual refresh was requested. Returns true if so.
// Tiny GET; the backend clears the flag when we read it.
bool manualRefreshRequested() {
  if (WiFi.status() != WL_CONNECTED || commandUrl.length() == 0) return false;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, commandUrl);
#ifdef INGEST_KEY
  http.addHeader("x-ingest-key", INGEST_KEY);
#endif

  bool refresh = false;
  int code = http.GET();
  if (code == 200) {
    // Response is small: {"refresh":true} or {"refresh":false}.
    refresh = http.getString().indexOf("true") >= 0;
  }
  http.end();
  return refresh;
}

// ----------------------------------------------------------------------------
// Arduino lifecycle
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n--- ESP32-S3 Tank Node booting ---");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  digitalWrite(STATUS_LED, LOW);

  // Derive the command URL from the ingest URL: replace the trailing
  // "/api/ingest" with "/api/tanks/<NODE_ID>/command".
  commandUrl = String(BACKEND_INGEST_URL);
  int apiIdx = commandUrl.indexOf("/api/ingest");
  if (apiIdx >= 0) commandUrl = commandUrl.substring(0, apiIdx);
  commandUrl += "/api/tanks/" + String(NODE_ID) + "/command";

  connectWiFi();
  setupOTA();

  // Immediate first reading so the dashboard populates on boot.
  reportReading(readDistanceCm());
  lastReport = millis();
}

void loop() {
  ArduinoOTA.handle();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Manual-refresh check: poll the backend's command flag frequently.
  if (millis() - lastCommandPoll >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPoll = millis();
    if (manualRefreshRequested()) {
      Serial.println("[Manual refresh requested]");
      float d = readDistanceCm();
      Serial.printf("Distance: %.2f cm\n", d);
      reportReading(d);
      lastReport = millis();  // reset the regular timer
    }
  }

  // Regular scheduled report.
  if (millis() - lastReport >= REPORT_INTERVAL_MS) {
    float d = readDistanceCm();
    Serial.printf("Distance: %.2f cm\n", d);
    reportReading(d);
    lastReport = millis();
  }
}
