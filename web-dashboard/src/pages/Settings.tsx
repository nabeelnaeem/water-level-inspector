// Tank configuration: add / edit / delete tanks (calibration lives here).
import { useState } from 'react';
import { useTanks, useSaveTank, useDeleteTank } from '../api/hooks';
import type { TankState } from '../api/types';
import { apiBase } from '../api/client';

interface Draft {
  id: string;
  label: string;
  heightCm: string;
  maxLevelDistanceCm: string;
  capacityLiters: string;
  sortOrder: string;
}

const empty: Draft = {
  id: '',
  label: '',
  heightCm: '',
  maxLevelDistanceCm: '0',
  capacityLiters: '',
  sortOrder: '0',
};

function toDraft(t: TankState): Draft {
  return {
    id: t.config.id,
    label: t.config.label,
    heightCm: String(t.config.heightCm),
    maxLevelDistanceCm: String(t.config.maxLevelDistanceCm),
    capacityLiters: t.config.capacityLiters != null ? String(t.config.capacityLiters) : '',
    sortOrder: String(t.config.sortOrder),
  };
}

export function Settings() {
  const { data: tanks } = useTanks();
  const save = useSaveTank();
  const del = useDeleteTank();
  const [draft, setDraft] = useState<Draft>(empty);
  const [editingExisting, setEditingExisting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const loadForEdit = (t: TankState) => {
    setDraft(toDraft(t));
    setEditingExisting(true);
    setMsg(null);
  };

  const reset = () => {
    setDraft(empty);
    setEditingExisting(false);
    setMsg(null);
  };

  const submit = async () => {
    const heightCm = parseFloat(draft.heightCm);
    const maxLevelDistanceCm = parseFloat(draft.maxLevelDistanceCm);
    const capacityLiters = draft.capacityLiters.trim() ? parseFloat(draft.capacityLiters) : null;
    const sortOrder = parseInt(draft.sortOrder || '0', 10);

    if (!draft.id.trim() || !draft.label.trim()) return setMsg('ID and label are required.');
    if (!(heightCm > 0)) return setMsg('Tank height must be a positive number.');
    if (!(maxLevelDistanceCm >= 0)) return setMsg('Max-level offset must be ≥ 0.');

    try {
      await save.mutateAsync({
        id: draft.id.trim(),
        label: draft.label.trim(),
        heightCm,
        maxLevelDistanceCm,
        capacityLiters,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      });
      setMsg('Saved ✓');
      if (!editingExisting) reset();
    } catch (e) {
      setMsg(`Save failed: ${(e as Error).message}`);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete tank "${id}" and all its history?`)) return;
    await del.mutateAsync(id);
    if (draft.id === id) reset();
  };

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, letterSpacing: -0.5 }}>Settings</h1>
      <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>
        Backend: <code>{apiBase()}</code>
      </p>

      {/* Existing tanks */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <strong style={{ fontSize: 14 }}>Configured tanks</strong>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(tanks ?? []).map((t) => (
            <div
              key={t.config.id}
              className="row"
              style={{
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'var(--bg-elev-2)',
                borderRadius: 10,
              }}
            >
              <span>
                <strong>{t.config.label}</strong>{' '}
                <span className="muted">· {t.config.id} · {t.config.heightCm}cm</span>
              </span>
              <span className="row" style={{ gap: 8 }}>
                <button className="pill" style={{ border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-dim)' }}
                        onClick={() => loadForEdit(t)}>Edit</button>
                <button className="pill" style={{ border: '1px solid #ff4d4f40', cursor: 'pointer', color: '#ff4d4f' }}
                        onClick={() => remove(t.config.id)}>Delete</button>
              </span>
            </div>
          ))}
          {tanks && tanks.length === 0 && <span className="muted">None yet.</span>}
        </div>
      </div>

      {/* Add / edit form */}
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <strong style={{ fontSize: 14 }}>{editingExisting ? 'Edit tank' : 'Add a tank'}</strong>
          {editingExisting && (
            <button className="pill" style={{ border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-dim)' }}
                    onClick={reset}>+ New instead</button>
          )}
        </div>

        <div className="field">
          <label>Node ID</label>
          <input
            value={draft.id}
            onChange={(e) => set('id', e.target.value)}
            placeholder="tank-1"
            disabled={editingExisting}
          />
          <span className="hint">Must match the firmware's <code>NODE_ID</code>. Cannot change after creation.</span>
        </div>
        <div className="field">
          <label>Label</label>
          <input value={draft.label} onChange={(e) => set('label', e.target.value)} placeholder="Underground Tank" />
        </div>
        <div className="field">
          <label>Tank height (cm)</label>
          <input value={draft.heightCm} onChange={(e) => set('heightCm', e.target.value)} placeholder="142" inputMode="decimal" />
          <span className="hint">Absolute internal height of the tank.</span>
        </div>
        <div className="field">
          <label>Max-level offset (cm)</label>
          <input value={draft.maxLevelDistanceCm} onChange={(e) => set('maxLevelDistanceCm', e.target.value)} placeholder="29.56" inputMode="decimal" />
          <span className="hint">Sensor reading when the tank is completely full. Mind the ~25 cm sensor blind zone.</span>
        </div>
        <div className="field">
          <label>Capacity (litres, optional)</label>
          <input value={draft.capacityLiters} onChange={(e) => set('capacityLiters', e.target.value)} placeholder="1000" inputMode="decimal" />
          <span className="hint">Enables volume readouts on the dashboard.</span>
        </div>
        <div className="field">
          <label>Sort order</label>
          <input value={draft.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} placeholder="0" inputMode="numeric" />
        </div>

        <div className="row" style={{ gap: 12, marginTop: 6 }}>
          <button className="btn primary" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editingExisting ? 'Save changes' : 'Add tank'}
          </button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
