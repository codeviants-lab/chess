import type { Member } from '../net/transport';
import type { Color } from './room';

// Random matchmaking without a server: everyone waiting in the same lobby sees the same member list and
// pairs it the same way — oldest with second oldest, third with fourth, … — so both sides of a pair reach the
// same room id and colours without exchanging a message. A newcomer never breaks an earlier pair.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface Pairing {
  room: string;
  seats: Record<Color, Member>;
}

export function pairUp(members: readonly Member[]): Pairing[] {
  const queue = [...members].sort((a, b) => a.since - b.since || (a.pid < b.pid ? -1 : 1));
  const pairs: Pairing[] = [];
  for (let i = 0; i + 1 < queue.length; i += 2) {
    const [a, b] = [queue[i]!, queue[i + 1]!];
    const key = [a.pid, b.pid].sort().join(':') + ':' + Math.min(a.since, b.since);
    const room = 'm' + hash(key).toString(36) + hash(key + '#').toString(36);
    const aWhite = hash(room + a.pid) < hash(room + b.pid);
    pairs.push({ room, seats: aWhite ? { w: a, b } : { w: b, b: a } });
  }
  return pairs;
}

export function myPairing(members: readonly Member[], pid: string): Pairing | null {
  return pairUp(members).find((p) => p.seats.w.pid === pid || p.seats.b.pid === pid) ?? null;
}
