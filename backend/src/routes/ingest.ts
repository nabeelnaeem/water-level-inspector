// Ingestion endpoint: the ESP32-S3 node POSTs raw sensor readings here.
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { ingest, getTank, tankState } from '../repository.js';
import { broadcastReading } from '../ws.js';

export const ingestRouter = Router();

const ingestSchema = z.object({
  nodeId: z.string().min(1).max(64),
  // -1 is the firmware's "sensor faulted" sentinel; allow it through.
  rawDistanceCm: z.number().finite(),
  rssi: z.number().int().optional(),
  fw: z.string().max(32).optional(),
  uptimeS: z.number().int().nonnegative().optional(),
});

// POST /api/ingest
ingestRouter.post('/', (req, res) => {
  // Optional shared-secret auth for the node.
  if (config.ingestKey && req.header('x-ingest-key') !== config.ingestKey) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  }

  const reading = ingest(parsed.data);
  if (!reading) {
    // Node reported, but no tank with this id exists yet.
    return res.status(404).json({ error: 'unknown_node', nodeId: parsed.data.nodeId });
  }

  const tank = getTank(reading.tankId)!;
  const state = tankState(tank);
  broadcastReading(reading, state);

  res.json({ ok: true, status: state.status, percentage: reading.percentage });
});
