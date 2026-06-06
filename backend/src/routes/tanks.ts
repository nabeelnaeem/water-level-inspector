// REST routes for reading/configuring tanks.
import { Router } from 'express';
import { z } from 'zod';
import {
  allTankStates,
  getTank,
  tankState,
  upsertTank,
  deleteTank,
  history,
} from '../repository.js';

export const tanksRouter = Router();

// GET /api/tanks — current snapshot of every tank.
tanksRouter.get('/', (_req, res) => {
  res.json({ tanks: allTankStates() });
});

// GET /api/tanks/:id — single tank snapshot.
tanksRouter.get('/:id', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });
  res.json(tankState(tank));
});

// GET /api/tanks/:id/history?hours=24 — downsampled time-series.
tanksRouter.get('/:id/history', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });

  const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24 * 30);
  res.json({ tankId: tank.id, hours, points: history(tank.id, hours) });
});

const tankSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  heightCm: z.number().positive(),
  maxLevelDistanceCm: z.number().min(0),
  capacityLiters: z.number().positive().nullable().default(null),
  sortOrder: z.number().int().default(0),
});

// PUT /api/tanks/:id — create or update a tank's configuration.
tanksRouter.put('/:id', (req, res) => {
  const parsed = tankSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_tank', details: parsed.error.flatten() });
  }
  const saved = upsertTank(parsed.data);
  res.json(tankState(saved));
});

// DELETE /api/tanks/:id
tanksRouter.delete('/:id', (req, res) => {
  const ok = deleteTank(req.params.id);
  if (!ok) return res.status(404).json({ error: 'tank_not_found' });
  res.status(204).end();
});
