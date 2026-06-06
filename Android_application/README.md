# Water Level Inspector — Mobile App (Expo / React Native)

Mobile dashboard for the Smart Water Level Inspector. **Refactored** to consume
the shared [backend](../backend) JSON API (REST + WebSocket) — the same contract
the [web dashboard](../web-dashboard) uses — instead of polling sensors directly.

## What changed (v1 → v2)

| Before | After |
|---|---|
| Polled each ESP8266 sensor's raw-float endpoint directly | Talks to the backend over REST + live **WebSocket** |
| Re-implemented tank math on-device | Backend is the single source of truth |
| Per-sensor IP config | Single **backend URL** in Settings |
| Two hard-coded tanks | **Multi-tank**, auto-discovered from the backend |
| No history | Per-tank 24h **history sparkline** |
| Dead sensor → showed "100% full" | Surfaces a **fault** state |

## Architecture

```
api/        types.ts  client.ts            # data contract + REST/WS client
hooks/      useTanks.ts  useHistory.ts      # live data (WS + polling fallback)
context/    ConfigContext.tsx               # backend URL + refresh (AsyncStorage)
constants/  appConfig.ts                    # defaults
components/  TankGauge.tsx  HistorySparkline.tsx
app/(tabs)/  index.tsx (Dashboard)  explore.tsx (Settings)
```

- **Live updates:** `useTanks` opens one WebSocket (`/ws`) with auto-reconnect
  and patches state as readings arrive; REST polling is a fallback.
- **Reused** from v1: `TankGauge` (animated gauge), `ConfigContext`, the dark UI.
- **Removed:** the unused Expo starter template (themed-text/view, parallax,
  collapsible, etc.), `useStoredConfig`, and the old direct-polling `useTankData`.

## Run

```bash
cd Android_application
npm install
npx expo start          # scan the QR with Expo Go
```

Open **Settings**, set the **Backend URL** to your LAN host (e.g.
`http://192.168.1.50:4000`), tap **Test connection**, then **Save**.

> Per `AGENTS.md`, this project pins to **Expo SDK 54** — check the versioned
> docs at https://docs.expo.dev/versions/v54.0.0/ before adding native modules.
> The refactor intentionally uses only built-ins already present in SDK 54
> (`fetch`, `WebSocket`, `AsyncStorage`, `expo-router`) — no new native deps.
