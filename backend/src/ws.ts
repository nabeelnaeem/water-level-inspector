// WebSocket hub: pushes live tank updates to connected dashboards/apps.
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { TankReading, TankState } from './types.js';
import { allTankStates } from './repository.js';

type OutboundMessage =
  | { type: 'snapshot'; tanks: TankState[] }
  | { type: 'reading'; reading: TankReading; state: TankState };

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    // Send the current snapshot immediately on connect.
    send(socket, { type: 'snapshot', tanks: allTankStates() });

    socket.on('message', (raw) => {
      // Only command supported: a client-requested refresh snapshot.
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'refresh') {
          send(socket, { type: 'snapshot', tanks: allTankStates() });
        }
      } catch {
        /* ignore malformed frames */
      }
    });
  });
}

function send(socket: WebSocket, msg: OutboundMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

/** Broadcast a new reading + derived state to every connected client. */
export function broadcastReading(reading: TankReading, state: TankState): void {
  if (!wss) return;
  const payload = JSON.stringify({ type: 'reading', reading, state });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}
