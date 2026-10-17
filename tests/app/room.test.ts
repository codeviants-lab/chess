import { describe, expect, it } from 'vitest';
import { clocks, newRoom, reduce, type Msg, type RoomState } from '../../app/game/room';

// A tiny in-memory "channel": every client applies every message (its own included) through reduce,
// exactly like the real controller does, and replies are delivered to the others.
class Net {
  states = new Map<string, RoomState | null>();
  join(pid: string, state: RoomState | null, name = pid) {
    this.states.set(pid, state);
    this.send(pid, { t: 'hello', name });
  }
  send(from: string, msg: Msg) {
    const pending: [string, Msg][] = [[from, msg]];
    while (pending.length) {
      const [sender, m] = pending.shift()!;
      for (const [pid, state] of this.states) {
        if (pid === sender && m.t === 'hello') continue;
        const out = reduce(state, sender, m, pid);
        this.states.set(pid, out.state);
        if (out.reply && pid !== sender) pending.push([pid, out.reply]);
      }
    }
  }
  s(pid: string) {
    return this.states.get(pid)!;
  }
}

const TC = { initialMs: 300_000, incrementMs: 0 };

function friendGame() {
  const net = new Net();
  net.join('ali', newRoom('r1', TC, { w: { pid: 'ali', name: 'Ali' } }));
  net.join('ayse', null, 'Ayşe');
  return net;
}

describe('oda protokolü', () => {
  it('the guest gets the free seat and both see the same room', () => {
    const net = friendGame();
    expect(net.s('ayse')?.seats.b).toEqual({ pid: 'ayse', name: 'Ayşe' });
    expect(net.s('ali')).toEqual(net.s('ayse'));
  });

  it("a full game: fool's mate ends with the same result on both sides", () => {
    const net = friendGame();
    const moves: [string, string][] = [['ali', 'f2f3'], ['ayse', 'e7e5'], ['ali', 'g2g4'], ['ayse', 'd8h4']];
    moves.forEach(([pid, uci], ply) => net.send(pid, { t: 'move', ply, uci, clockAfter: null }));
    expect(net.s('ali')!.result).toEqual({ winner: 'b', reason: 'mat' });
    expect(net.s('ayse')).toEqual(net.s('ali'));
    expect(net.s('ali')!.moves.map((m) => m.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
  });

  it('rejects moves out of turn, illegal moves, stale plies and moves by spectators', () => {
    const net = friendGame();
    net.join('can', null, 'Can'); // third person: spectator
    net.send('ayse', { t: 'move', ply: 0, uci: 'e7e5', clockAfter: null }); // not black's turn
    net.send('ali', { t: 'move', ply: 0, uci: 'e2e5', clockAfter: null }); // illegal
    net.send('can', { t: 'move', ply: 0, uci: 'e2e4', clockAfter: null }); // spectator
    expect(net.s('ali')!.moves).toEqual([]);
    net.send('ali', { t: 'move', ply: 0, uci: 'e2e4', clockAfter: null });
    net.send('ali', { t: 'move', ply: 0, uci: 'd2d4', clockAfter: null }); // stale ply
    expect(net.s('can')!.moves.map((m) => m.uci)).toEqual(['e2e4']);
    expect(net.s('can')!.seats.b?.pid).toBe('ayse');
  });

  it('a player who reloads gets the game back from the opponent', () => {
    const net = friendGame();
    net.send('ali', { t: 'move', ply: 0, uci: 'e2e4', clockAfter: null });
    net.send('ayse', { t: 'move', ply: 1, uci: 'c7c5', clockAfter: null });
    net.join('ayse', null, 'Ayşe'); // reload: state lost
    expect(net.s('ayse')!.moves.map((m) => m.uci)).toEqual(['e2e4', 'c7c5']);
    expect(net.s('ayse')!.seats.b?.pid).toBe('ayse');
  });

  it('draw offer: accepted by the other side only; a move cancels it', () => {
    const net = friendGame();
    net.send('ali', { t: 'draw', action: 'offer' });
    net.send('ali', { t: 'draw', action: 'accept' }); // own offer
    expect(net.s('ali')!.result).toBeNull();
    net.send('ali', { t: 'move', ply: 0, uci: 'e2e4', clockAfter: null });
    expect(net.s('ayse')!.drawOffer).toBeNull();
    net.send('ayse', { t: 'draw', action: 'offer' });
    net.send('ali', { t: 'draw', action: 'accept' });
    expect(net.s('ayse')!.result).toEqual({ winner: null, reason: 'anlaşma' });
  });

  it('resign and flag', () => {
    const a = friendGame();
    a.send('ayse', { t: 'resign' });
    expect(a.s('ali')!.result).toEqual({ winner: 'w', reason: 'teslim' });

    const b = friendGame();
    b.send('ali', { t: 'flag', color: 'w' }); // clocks have not started: ignored
    expect(b.s('ali')!.result).toBeNull();
    b.send('ali', { t: 'move', ply: 0, uci: 'e2e4', clockAfter: 300_000 });
    b.send('ayse', { t: 'move', ply: 1, uci: 'e7e5', clockAfter: 300_000 });
    b.send('ayse', { t: 'flag', color: 'w' });
    expect(b.s('ali')!.result).toEqual({ winner: 'b', reason: 'süre' });
  });

  it('rematch: offer + accept agree on the next room', () => {
    const net = friendGame();
    net.send('ali', { t: 'rematch', action: 'offer', room: 'r2' }); // game not over: ignored
    expect(net.s('ali')!.rematchOffer).toBeNull();
    net.send('ali', { t: 'resign' });
    net.send('ali', { t: 'rematch', action: 'offer', room: 'r2' });
    net.send('ayse', { t: 'rematch', action: 'accept', room: 'r2' });
    expect(net.s('ali')!.next).toBe('r2');
    expect(net.s('ayse')!.next).toBe('r2');
  });

  it('clocks run only for the side to move, from the second move on', () => {
    const net = friendGame();
    const s0 = net.s('ali')!;
    expect(clocks(s0, 0, 10_000)).toEqual({ w: 300_000, b: 300_000, running: null });
    net.send('ali', { t: 'move', ply: 0, uci: 'e2e4', clockAfter: 300_000 });
    net.send('ayse', { t: 'move', ply: 1, uci: 'e7e5', clockAfter: 295_000 });
    expect(clocks(net.s('ali')!, 1000, 4000)).toEqual({ w: 297_000, b: 295_000, running: 'w' });
  });
});
