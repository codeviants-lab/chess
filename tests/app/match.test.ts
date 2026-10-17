import { describe, expect, it } from 'vitest';
import { myPairing, pairUp } from '../../app/game/match';

const m = (pid: string, since: number) => ({ pid, name: pid, since });

describe('rastgele eşleşme', () => {
  it('pairs the oldest waiting players first, the same way on every client', () => {
    const list = [m('c', 3), m('a', 1), m('d', 4), m('b', 2), m('e', 5)];
    const pairs = pairUp(list);
    expect(pairs.map((p) => [p.seats.w.pid, p.seats.b.pid].sort())).toEqual([['a', 'b'], ['c', 'd']]);
    expect(pairUp([...list].reverse())).toEqual(pairs);
    expect(myPairing(list, 'e')).toBeNull();
  });

  it('a newcomer does not change an existing pair', () => {
    const before = pairUp([m('a', 1), m('b', 2)]);
    const after = pairUp([m('a', 1), m('b', 2), m('z', 9)]);
    expect(after[0]).toEqual(before[0]);
  });

  it('both players of a pair compute the same room and colours', () => {
    const list = [m('a', 1), m('b', 2)];
    expect(myPairing(list, 'a')).toEqual(myPairing(list, 'b'));
  });
});
