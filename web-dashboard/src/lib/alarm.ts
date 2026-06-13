// Web Audio alarm — generates a short beep pattern without any asset files.
// The AudioContext must be created/resumed from a user gesture (the bell
// toggle click), which is why `unlockAudio` is called from the toggle handler.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Resume the audio context from a user gesture so later beeps are allowed. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

/** Play one beep at `startTime` for `dur` seconds. */
function tone(c: AudioContext, startTime: number, dur: number, freq: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Quick attack/decay envelope to avoid clicks.
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(startTime);
  osc.stop(startTime + dur + 0.02);
}

/** Ring an attention-grabbing triple beep. Safe to call repeatedly. */
export function ringAlarm(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime;
  tone(c, t, 0.18, 880);
  tone(c, t + 0.25, 0.18, 880);
  tone(c, t + 0.5, 0.3, 988);
}
