import { load, save } from '../lib/store';

// Short synthesized move sounds (no audio files to license or download).

let ctx: AudioContext | null = null;
let enabled = load('sound', true);

export function soundEnabled(): boolean {
  return enabled;
}

export function toggleSound(): boolean {
  enabled = !enabled;
  save('sound', enabled);
  return enabled;
}

export function playMove(capture: boolean): void {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(capture ? 220 : 330, t);
    osc.frequency.exponentialRampToValueAtTime(capture ? 110 : 180, t + 0.08);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  } catch {
    // Audio is optional.
  }
}
