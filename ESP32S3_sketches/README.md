# ESP32-S3 Firmware — Tank Node

New firmware for the Smart Water Level Inspector, migrated from the original
3× ESP8266 (2 Slaves + 1 LCD Master) design to a single **ESP32-S3** node that
pushes readings to the [backend](../backend).

> Replaces `ESP8266_sketches/` (now deprecated — see that folder's
> `DEPRECATED.md`). The LCD/LED Master node is retired; the dashboard + backend
> own display, alarms, history, and online/offline state.

## Hardware

| Part | Detail |
|---|---|
| MCU | ESP32-S3-WROOM-1 **N16R8** (16MB flash, 8MB PSRAM, Wi-Fi + BLE) |
| Sensor | AJ-SR04M V3.0 waterproof ultrasonic (Mode 0 = Trig/Echo) |
| Power | 12V 2A adapter → XL7015 buck → 5V for sensor & board VIN |
| Enclosure | Waterproof |

### Wiring (⚠ keep the 5V→3.3V echo divider)

```
Sensor VCC  -> 5V (VIN)
Sensor GND  -> GND
Sensor Trig -> GPIO 5
Sensor Echo -> GPIO 4   via 2.2kΩ / 3.3kΩ divider (5V -> ~3.0V)  ** required **
Status LED  -> GPIO 2   (optional)
```

Avoid strapping/reserved S3 pins: **GPIO 0, 3, 45, 46** (boot), **19/20** (USB),
**26–37** (flash/PSRAM on N16R8).

## Setup

1. Install the **ESP32 boards** package in Arduino IDE / arduino-cli
   (Espressif "esp32" core ≥ 3.0). Select board **ESP32S3 Dev Module**, enable
   **PSRAM**, set Flash Size **16MB**.
2. `cp secrets.h.example secrets.h` and fill in Wi-Fi + `BACKEND_INGEST_URL`.
3. In `tank_node.ino`, set `NODE_ID` to match the tank `id` in the backend
   (the seeded default is `tank-1`).
4. Flash over USB the first time; subsequent updates can go over **OTA**
   (the node advertises as `NODE_ID` on the network).

## How it works

```
loop(): every REPORT_INTERVAL_MS
  read AJ-SR04M  (median of 5 pings, -1 on timeout/out-of-range)
  POST /api/ingest  {nodeId, rawDistanceCm, rssi, fw, uptimeS}
  backend computes %, stores history, broadcasts to dashboards
```

### Migration notes (ESP8266 → ESP32-S3)

| Concern | Change |
|---|---|
| Wi-Fi / HTTP libs | `ESP8266WiFi`/`ESP8266HTTPClient` → `WiFi.h`/`HTTPClient.h` |
| Static IP | `WiFi.config()` now requires the **DNS** arg (handled) |
| Pins | NodeMCU `D1/D2` aliases → raw GPIO numbers |
| Button on GPIO0 | removed (GPIO0 is a strapping pin); Master node retired |
| Sensor timeout | returns **-1** (fault) instead of 0 → no false "full tank" |
| Reliability | median-of-5 sampling, Wi-Fi self-heal/restart, OTA |
| Output | **pushes JSON** to backend instead of serving raw float |

## Scaling to more tanks

Flash another ESP32-S3 with a different `NODE_ID` (e.g. `tank-2`) and add a
matching tank in the dashboard **Settings**. No backend code changes needed.
