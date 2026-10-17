import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { chooseMove, type BotLevel } from '../../core/bot/search';

// Deterministic deps: a fixed random sequence and a clock that never runs out unless asked to.
function deps(seed = 1, clock = () => 0) {
  let x = seed;
  return {
    random: () => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x / 2147483648;
    },
    now: clock,
  };
}

const LEVELS: BotLevel[] = ['kolay', 'orta', 'zor'];

describe('bot', () => {
  it.each(LEVELS)('%s: plays a legal move from the start position', (level) => {
    const move = chooseMove(new Chess().fen(), level, deps());
    expect(move).not.toBeNull();
    expect(() => new Chess().move(move!.uci)).not.toThrow();
  });

  it.each(LEVELS)('%s: finds mate in one', (level) => {
    // Scholar's mate pattern: Qxf7#.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    for (let seed = 1; seed <= 5; seed++) expect(chooseMove(fen, level, deps(seed))!.uci).toBe('f3f7');
  });

  it.each(LEVELS)('%s: takes a free queen', (level) => {
    const fen = '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1';
    for (let seed = 1; seed <= 5; seed++) expect(chooseMove(fen, level, deps(seed))!.uci).toBe('d2d5');
  });

  it.each(['orta', 'zor'] as const)('%s: does not leave its queen hanging', (level) => {
    // The knight on c6 attacks the white queen on d4: the queen must move away.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/8/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 1 4';
    const chess = new Chess(fen);
    chess.move(chooseMove(fen, level, deps())!.uci);
    const queenStillAttacked = chess.moves({ verbose: true }).some((m) => m.captured === 'q');
    expect(queenStillAttacked).toBe(false);
  });

  it('returns null when the game is over', () => {
    const mated = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(chooseMove(mated, 'zor', deps())).toBeNull();
  });

  it('stops at the time limit but still answers with a completed depth', () => {
    let t = 0;
    const move = chooseMove(new Chess().fen(), 'zor', deps(1, () => (t += 50)));
    expect(move).not.toBeNull();
    expect(move!.depth).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic for the same seed', () => {
    const fen = new Chess().fen();
    expect(chooseMove(fen, 'kolay', deps(7))!.uci).toBe(chooseMove(fen, 'kolay', deps(7))!.uci);
  });
});
