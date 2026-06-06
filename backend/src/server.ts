// HTTP + WebSocket server entrypoint.
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { config } from './config.js';
import { pruneOldReadings } from './db.js';
import { ensureSeedData } from './seed.js';
import { tanksRouter } from './routes/tanks.js';
import { ingestRouter } from './routes/ingest.js';
import { initWebSocket } from './ws.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '16kb' }));

// Health check (used by Docker + the dashboard's connection indicator).
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api/tanks', tanksRouter);
app.use('/api/ingest', ingestRouter);

// Fallback 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Seed a default tank on first run so the dashboard isn't empty.
ensureSeedData();

// Prune history on boot, then daily.
pruneOldReadings();
setInterval(pruneOldReadings, 24 * 60 * 60 * 1000).unref();

const server = createServer(app);
initWebSocket(server);

server.listen(config.port, config.host, () => {
  console.log(
    `[water-backend] listening on http://${config.host}:${config.port}  ` +
      `(REST /api, WebSocket /ws)`,
  );
});
