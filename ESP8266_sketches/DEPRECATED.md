# ⚠️ Deprecated — ESP8266 firmware

These sketches are the **original** 3-node ESP8266 design (2 Slaves + 1 LCD/LED
Master). They are kept for reference only and are **no longer the active
firmware**.

**Replaced by:** [`../ESP32S3_sketches/tank_node`](../ESP32S3_sketches) — a single
ESP32-S3 node that pushes JSON readings to the self-hosted
[backend](../backend), which now owns calibration, history, online/offline
state, and serves the web + mobile dashboards.

## Why the migration

- Hardware moved to **ESP32-S3-WROOM N16R8** (more GPIO, PSRAM, OTA, BLE).
- The LCD/LED **Master node is retired** — the dashboard replaces it.
- Fixes a safety bug: the old Slave returned `0` on sensor timeout, which the
  Master/app interpreted as a **full tank**. The new firmware returns `-1`,
  surfaced as a `fault`.
- Centralised history + multi-tank + future pump automation via the backend.

Do not flash these for new deployments. See
[`../ESP32S3_sketches/README.md`](../ESP32S3_sketches/README.md).
