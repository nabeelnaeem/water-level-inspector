# Flashing the ESP32-S3 — Step by Step (for first-timers)

Everything is pre-prepared. You only need to type your **Wi-Fi name + password**
once, then click Upload. Follow these in order.

---

## ✅ What's already done for you
- `secrets.h` is created with the backend address pre-filled for this PC.
- `NODE_ID` in the sketch is already `tank-1` (matches the backend's default tank).
- No external libraries are needed.

## ✏️ Step 0 — Put in your Wi-Fi (the only thing you must edit)
1. Open `secrets.h` in this folder (Arduino IDE, or Notepad).
2. Change these two lines to your real Wi-Fi:
   ```cpp
   #define WIFI_SSID      "PUT_YOUR_WIFI_NAME_HERE"
   #define WIFI_PASSWORD  "PUT_YOUR_WIFI_PASSWORD_HERE"
   ```
   ⚠️ Keep the quotes. Use the **2.4 GHz** Wi-Fi (the ESP32 can't use 5 GHz).

---

## Step 1 — Install Arduino IDE
Download and install Arduino IDE 2.x: https://www.arduino.cc/en/software

## Step 2 — Add ESP32 support (one time)
1. `File → Preferences`.
2. In **"Additional boards manager URLs"**, paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
   Click OK.
3. Open `Tools → Board → Boards Manager…`, search **esp32**, install
   **"esp32 by Espressif Systems"** (wait for it to finish — it's a big download).

## Step 3 — Open the sketch
`File → Open…` → select `tank_node.ino` in this folder.

## Step 4 — Choose board settings
Under the **Tools** menu, set:

| Setting | Value |
|---|---|
| Board → esp32 → | **ESP32S3 Dev Module** |
| Flash Size | **16MB (128Mb)** |
| PSRAM | **OPI PSRAM** |
| USB CDC On Boot | **Enabled** |
| Upload Speed | **921600** (use 115200 if upload fails) |
| Port | _(set in the next step)_ |

## Step 5 — Plug in the board and pick the Port
1. Connect the board to the PC with a USB cable.
   - If your board has **two USB-C ports**, use the one labelled **UART** (or
     **COM**) for flashing. If there's only one port, use that.
   - Use a **data** USB cable, not a charge-only one.
2. `Tools → Port` → pick the COM port that just appeared (e.g. `COM5`).
   If none appears, see Troubleshooting below.

## Step 6 — Upload
1. Click the **→ (Upload)** arrow (top-left).
2. Wait. First compile takes a minute. It ends with `Hard resetting via RTS pin...`.
3. **If it gets stuck on "Connecting……":** hold the **BOOT** button on the board,
   briefly tap **RESET (RST)**, then release **BOOT**, and click Upload again.

## Step 7 — Watch it work
1. Open `Tools → Serial Monitor`. Set the baud (bottom-right) to **115200**.
2. You should see:
   ```
   --- ESP32-S3 Tank Node booting ---
   Connecting to Wi-Fi SSID: <your wifi>
   Wi-Fi connected. IP: 192.168.1.xx
   OTA ready.
   Distance: 42.30 cm
   POST http://192.168.1.23:4000/api/ingest -> 200 {...}
   ```
3. `-> 200` = success, the reading reached the backend. Open the web dashboard
   and you'll see the tank update.

> ⚠️ The backend must be running on this PC for the `-> 200` to work. In a
> terminal: `cd backend` then `npm run dev`.

---

## How to confirm the backend IP (if `-> 200` never appears)
The ESP must reach this PC's address. To check it:
1. Press `Win + R`, type `cmd`, Enter.
2. Type `ipconfig` and look for **"Wireless LAN adapter Wi-Fi" → IPv4 Address**.
3. If it's **192.168.1.18** (not .23), edit `secrets.h`:
   `#define BACKEND_INGEST_URL "http://192.168.1.18:4000/api/ingest"` and re-upload.

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| `secrets.h: No such file` | It's already here — make sure you opened `tank_node.ino` from this same folder. |
| No COM port shows up | Try the other USB port, another cable, or hold BOOT + tap RST. May need a CH340/CP210x USB driver. |
| Stuck "Connecting…" | Hold **BOOT**, tap **RST**, release **BOOT**, upload again. |
| Wi-Fi won't connect (dots forever) | Wrong SSID/password, or it's a 5 GHz network — use 2.4 GHz. |
| Readings always `-1.00` | Sensor wiring or AJ-SR04M mode — see `../WIRING.md`. |
| `POST ... -> -1` / refused | Backend not running, or wrong IP in `secrets.h`. |
