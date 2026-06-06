// Seeds a default tank so a fresh install has something to show. Idempotent.
import { listTanks, upsertTank } from './repository.js';

export function ensureSeedData(): void {
  if (listTanks().length > 0) return;

  // Mirrors the original Underground Tank calibration. The firmware's
  // `nodeId` must equal this `id` for readings to bind to the tank.
  upsertTank({
    id: 'tank-1',
    label: 'Underground Tank',
    heightCm: 142,
    maxLevelDistanceCm: 29.56,
    capacityLiters: null,
    sortOrder: 0,
  });

  console.log('[water-backend] seeded default tank "tank-1" (Underground Tank)');
}

// Allow `npm run seed` to run this standalone.
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  ensureSeedData();
  console.log('Seed complete.');
}
