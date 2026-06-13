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
  fillEstimate,
  startFillSession,
  stopFillSession,
  rateOverWindow,
} from '../repository.js';
import { requestRefresh, consumeRefresh } from '../commands.js';

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

// GET /api/tanks/:id/history?minutes=60  (or ?hours=24) — time-series.
// Accepts a window in minutes (preferred) or hours (back-compat). Short
// windows return every reading; very long windows are downsampled.
tanksRouter.get('/:id/history', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const MAX_MINUTES = 60 * 24 * 90; // 90 days

  let minutes: number;
  if (req.query.minutes != null) minutes = Number(req.query.minutes);
  else if (req.query.hours != null) minutes = Number(req.query.hours) * 60;
  else minutes = 60;
  minutes = clamp(Number.isFinite(minutes) ? minutes : 60, 1, MAX_MINUTES);

  const maxPoints = clamp(Number(req.query.maxPoints) || 3000, 50, 5000);

  res.json({ tankId: tank.id, minutes, points: history(tank.id, minutes, maxPoints) });
});

// POST /api/tanks/:id/refresh — ask the node to take a fresh reading now.
// Called by the dashboard/app "Refresh now" button.
tanksRouter.post('/:id/refresh', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });
  requestRefresh(tank.id);
  res.json({ ok: true, requested: tank.id });
});

// GET /api/tanks/:id/command — polled by the node. Returns (and clears)
// whether a manual refresh was requested. Kept tiny on purpose.
tanksRouter.get('/:id/command', (req, res) => {
  res.json({ refresh: consumeRefresh(req.params.id) });
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// GET /api/tanks/:id/fill — current fill-to-100% estimate (active session only).
tanksRouter.get('/:id/fill', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });
  res.json(fillEstimate(tank.id));
});

// POST /api/tanks/:id/fill/start — begin tracking the current fill.
tanksRouter.post('/:id/fill/start', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });
  startFillSession(tank.id);
  res.json(fillEstimate(tank.id));
});

// POST /api/tanks/:id/fill/stop — stop tracking.
tanksRouter.post('/:id/fill/stop', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });
  stopFillSession(tank.id);
  res.json(fillEstimate(tank.id));
});

// GET /api/tanks/:id/rate?minutes=5 — net level change over a trailing window
// (1 minute to 3 hours). Powers the rise meter and the stall alarm.
tanksRouter.get('/:id/rate', (req, res) => {
  const tank = getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: 'tank_not_found' });
  const minutes = clamp(Number(req.query.minutes) || 5, 1, 180);
  res.json(rateOverWindow(tank.id, minutes));
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
