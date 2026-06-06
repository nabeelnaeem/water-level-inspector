# ESP32-S3 Tank Node — Wiring Guide

Hardware on hand:
- **ESP32-S3-WROOM-1 N16R8** dev board
- **AJ-SR04M V3.0** waterproof ultrasonic sensor
- **XL7015** DC-DC buck converter (adjustable)
- **12V 2A** power adapter
- 2× resistors **2.2 kΩ** + **3.3 kΩ** (echo voltage divider)
- Optional: 1× LED + **220–330 Ω** resistor (status), waterproof enclosure

Firmware pin map (from `tank_node.ino`):
| Signal | ESP32-S3 GPIO |
|---|---|
| Sensor **Trig** | GPIO **5** |
| Sensor **Echo** | GPIO **4** (via divider) |
| Status LED | GPIO **2** (optional) |

---

## ⚠️ Do this FIRST: set the buck to 5.0 V

The XL7015 is **adjustable**. Before connecting anything else:
1. Connect the 12V adapter to the XL7015 **IN+ / IN−**.
2. Put a multimeter on the **OUT+ / OUT−**.
3. Turn the trimpot until the output reads **5.0 V** (4.9–5.1 V is fine).
4. Power off. Now wire the rest.

Feeding more than 5 V into the sensor/board 5V rail can damage them.

---

## Power wiring

```
12V 2A adapter (+) ─────▶ XL7015  IN+
12V 2A adapter (−) ─────▶ XL7015  IN−  (GND)

XL7015 OUT+ (set to 5.0V) ──┬──▶ ESP32-S3  "5V" pin (a.k.a. VBUS/VIN)
                            └──▶ AJ-SR04M  VCC

XL7015 OUT− (GND) ──────────┬──▶ ESP32-S3  GND
                            └──▶ AJ-SR04M  GND
```

- Feed the regulated 5 V into the board's **5V / VIN** pin — **NOT** the `3V3`
  pin (that pin is a 3.3 V *output*).
- **All grounds must be common** (buck, board, sensor share one GND). This is
  the #1 cause of flaky ultrasonic readings.

---

## Sensor signal wiring

The AJ-SR04M runs on **5 V**, so its **Echo** output is a **5 V pulse**. The
ESP32-S3 GPIOs are **3.3 V only** — a 5 V signal can damage them. Use the
voltage divider on **Echo** (Trig is an output from the board at 3.3 V, which
the sensor accepts, so it needs no divider).

```
ESP32-S3 GPIO5 ───────────────────────────▶ AJ-SR04M  Trig    (3.3V out is OK)

AJ-SR04M Echo (5V) ──[ 2.2kΩ ]──┬──────────▶ ESP32-S3 GPIO4   (~3.0V — safe)
                                │
                            [ 3.3kΩ ]
                                │
                               GND
```

Divider math: `5V × 3.3k / (2.2k + 3.3k) = 3.0 V` — a safe logic-high for the S3.

### Only have 1 kΩ resistors? Use 3× 1 kΩ (gives 3.33 V)

You don't need the 2.2k/3.3k pair — combine 1 kΩ units. Put **one** on the Echo
side and **two in series** (= 2 kΩ) to GND:

```
Echo (5V) ─[1kΩ]─┬──────────▶ GPIO4
                 │
               [1kΩ]
                 │   (two 1kΩ in series = 2kΩ)
               [1kΩ]
                 │
                GND
```

`5V × 2k / (1k + 2k) = 3.33 V` — equal to the 3.3 V rail, safe for the GPIO.

⚠️ Do **not** use just two equal 1 kΩ (`5 × 1k/2k = 2.5 V`) — that sits on the
ESP32's logic-high threshold and reads unreliably. For an exact 3.0 V you'd need
4× 1 kΩ (top = 1k; bottom = 1.5k = `1k + two 1k in parallel`), but the 3× 1 kΩ
/ 3.33 V option above is simpler and works well.

---

## Optional status LED (GPIO2)

```
ESP32-S3 GPIO2 ──[ 220–330Ω ]──▶ LED (+ anode)
LED (− cathode) ───────────────▶ GND
```

The firmware drives this HIGH on a successful POST, LOW on failure.

---

## Full ASCII overview

```
                 ┌───────────────┐
 12V 2A ───────▶ │   XL7015 buck │  set OUT = 5.0V
                 │  IN+  IN−     │
                 │  OUT+ OUT−    │
                 └───┬──────┬────┘
              5V ────┘      └──── GND
               │                    │
        ┌──────┴───────┐     ┌──────┴───────────────┐
        ▼              ▼     ▼                       ▼
   AJ-SR04M VCC   ESP32 5V   ESP32 GND          AJ-SR04M GND
   AJ-SR04M Trig ◀────────── GPIO5
   AJ-SR04M Echo ──[2.2k]──┬─────────▶ GPIO4
                           [3.3k]
                            │
                           GND
```

---

## Bring-up / flashing order

1. **Flash over USB first.** Connect the board to your PC by USB and upload
   `tank_node.ino` (board: *ESP32S3 Dev Module*, PSRAM **enabled**, Flash
   **16MB**). You can leave the buck disconnected during the first flash.
2. After it's flashed, you can run the node off the buck. Powering from USB
   **and** the 5V buck at the same time is usually tolerated on these boards
   (they have input protection), but if unsure, use one source at a time.
3. Open the Serial Monitor at **115200** baud to watch Wi-Fi connect and the
   `POST … -> 200` lines. After the first OTA-capable boot, future updates can
   go wirelessly.

---

## AJ-SR04M V3.0 mode — verify this

The firmware assumes **Mode 0 (HC-SR04-style Trig/Echo)**: send a 10 µs Trig
pulse, measure the Echo high time.

⚠️ On many AJ-SR04M / JSN-SR04T **V3.0** boards the operating mode is selected
by a resistor footprint on the back (often labelled **R19** or **R27**):
- **Open / no resistor** → Trig/Echo mode (what this firmware expects).
- A populated resistor (e.g. 47 kΩ / 120 kΩ) selects serial/UART or
  auto-distance modes that **won't** work with this firmware.

If you flash the firmware and the Serial Monitor shows distances of `-1.00`
(no echo) even with the sensor pointed at a wall ~50 cm away, your board is
likely **not** in Trig/Echo mode — check that the mode resistor pad is empty.
Confirm against the markings on *your* specific board before assuming.

Sensor specs to keep in mind:
- **Blind zone ≈ 25 cm** — readings closer than that are unreliable. Mount the
  sensor so the *full* water level is **≥ ~25 cm** below it, and set the tank's
  `maxLevelDistance` in the dashboard to that full-level reading.
- Range ≈ 25–450 cm. Point it straight down at a calm water surface; avoid
  mounting over inflow turbulence.
