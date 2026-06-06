# Water Level Inspector — Backend

Self-hosted LAN backend for the Smart Water Level Inspector. It receives raw
sensor readings from ESP32-S3 tank nodes, computes calibrated levels (the
**single source of truth** for tank math), stores a time-series history in
SQLite, and serves both the web dashboard and the mobile app over a JSON REST
API + WebSocket.

```
ESP32-S3 node  ──POST /api/ingest──▶  Backend (Express + SQLite + ws)
                                          │  REST /api/*  +  WS /ws
                                          ▼
                              Web dashboard  &  React Native app
```

## Requirements

- Node.js 20+ (22 recommended), or Docker.
- A build toolchain for `better-sqlite3`'s native addon (Python 3 + a C++
  compiler). On a Raspberry Pi / Debian: `sudo apt install build-essential python3`.
  The Docker image installs these for you.

## Run with Node

```bash
cd backend
cp .env.example .env        # adjust PORT / OFFLINE_TIMEOUT etc.
npm install
npm run dev                 # hot-reload dev server
# or for production:
npm run build && npm start
```

## Run with Docker (recommended for an always-on LAN host)

```bash
cd backend
docker compose up -d --build
```

Data persists in the `water-data` volume. The API listens on `:4000`.

## Configuration (`.env`)

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | HTTP + WS port |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` = reachable on the LAN) |
| `DB_PATH` | `./data/water.db` | SQLite file |
| `INGEST_KEY` | _(empty)_ | If set, nodes must send header `x-ingest-key` |
| `OFFLINE_TIMEOUT_SECONDS` | `90` | No reading within this window ⇒ tank shown offline |
| `HISTORY_RETENTION_DAYS` | `90` | Older readings pruned daily (0 = keep forever) |

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/tanks` | Snapshot of all tanks (config + latest + status) |
| `GET` | `/api/tanks/:id` | Single tank snapshot |
| `GET` | `/api/tanks/:id/history?hours=24` | Downsampled time-series |
| `PUT` | `/api/tanks/:id` | Create/update tank config |
| `DELETE` | `/api/tanks/:id` | Remove a tank |
| `POST` | `/api/ingest` | **Node → backend** raw reading |
| `WS` | `/ws` | Live `snapshot` + `reading` messages |

### Ingest payload (from the ESP32-S3)

```http
POST /api/ingest
Content-Type: application/json
x-ingest-key: <only if INGEST_KEY is set>

{ "nodeId": "tank-1", "rawDistanceCm": 42.3, "rssi": -55, "fw": "1.0.0", "uptimeS": 3600 }
```

`nodeId` **must** equal a tank `id`. A fresh DB is seeded with `tank-1`
(Underground Tank). `rawDistanceCm: -1` is the firmware's sensor-fault
sentinel and is surfaced as a `fault` status (it is **not** treated as a
full tank — fixing the original "dead sensor reads 100%" bug).

### WebSocket messages (backend → client)

```jsonc
{ "type": "snapshot", "tanks": [ /* TankState[] */ ] }   // on connect / on request
{ "type": "reading", "reading": { /* TankReading */ }, "state": { /* TankState */ } }
```

Send `{ "type": "refresh" }` to request a fresh snapshot.

## Quick smoke test

```bash
# Pretend to be a node and push a reading:
curl -X POST http://localhost:4000/api/ingest \
  -H 'content-type: application/json' \
  -d '{"nodeId":"tank-1","rawDistanceCm":42.3,"rssi":-55,"fw":"1.0.0","uptimeS":120}'

curl http://localhost:4000/api/tanks
```
