# Water Level Inspector — Web Dashboard

Modern, responsive React + Vite dashboard for the Smart Water Level Inspector.
Talks to the [backend](../backend) over REST + WebSocket. Light/dark mode,
multi-tank cards, live updates, and historical charts.

## Features

- 📊 Live tank cards — circular gauge, water height, sensor distance, volume
- 🟢 Per-tank status (online / sensor-fault / offline) + last-updated ticker
- 🔌 Live WebSocket stream with auto-reconnect (falls back to polling)
- 📈 Historical area charts with 6h / 24h / 7d / 30d ranges
- 🌗 Light & dark themes (persisted)
- ⚙️ Settings page to add/edit/calibrate/delete tanks
- 🚧 Pump-automation page (preview, wired for future relay control)
- 📱 Fully responsive (phone → desktop)

## Stack

React 19 · Vite 6 · TypeScript · TanStack Query · Zustand (theme) · Recharts ·
React Router.

## Run

```bash
cd web-dashboard
npm install
npm run dev        # http://localhost:5173 (also served on your LAN IP)
```

Make sure the [backend](../backend) is running. By default the dashboard talks
to `http://<same-hostname>:4000`. To point elsewhere, set `VITE_API_BASE`:

```bash
echo 'VITE_API_BASE=http://192.168.1.50:4000' > .env
```

## Build & self-host

```bash
npm run build      # outputs static files to dist/
npm run preview    # serve the production build on the LAN
```

`dist/` is plain static files — serve it from the same device as the backend
(nginx, `npm run preview`, or any static host).

## Architecture

```
src/
  api/        types.ts  client.ts  hooks.ts   # data contract + REST + WS/Query
  store/      theme.ts                        # Zustand light/dark
  lib/        format.ts                       # display helpers
  components/ GaugeRing StatusBadge HistoryChart TankCard
              LastUpdated ConnectionDot ThemeToggle
  pages/      Dashboard  Settings  PumpControl
  App.tsx  main.tsx  index.css
```

- **Server state** (tanks, history) → TanStack Query, patched in place by the
  WebSocket hook (`useLiveUpdates`).
- **UI state** (theme) → Zustand, persisted to `localStorage`.
- **Data contract** (`api/types.ts`) mirrors `backend/src/types.ts` and is the
  same shape the mobile app consumes.
