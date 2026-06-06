// Tiny in-memory "refresh requested" registry. When a dashboard/app asks a
// node to take a fresh reading, we set a flag here; the node polls and
// consumes it on its next command check. Resets on restart (that's fine — a
// pending manual refresh is ephemeral).

const pending = new Set<string>();

/** Mark that node `id` should take an immediate reading. */
export function requestRefresh(id: string): void {
  pending.add(id);
}

/** Returns true once if a refresh was requested for `id`, then clears it. */
export function consumeRefresh(id: string): boolean {
  if (pending.has(id)) {
    pending.delete(id);
    return true;
  }
  return false;
}
