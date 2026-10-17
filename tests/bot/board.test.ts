import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { Board, moveToUci, perft } from '../../core/bot/board';

// Reference counts from https://www.chessprogramming.org/Perft_Results
const POSITIONS: [string, string, number[]][] = [
  ['başlangıç', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['pozisyon 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['pozisyon 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['pozisyon 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];

describe('bot tahtası (perft)', () => {
  it.each(POSITIONS)('%s', (_name, fen, counts) => {
    counts.forEach((expected, i) => expect(perft(new Board(fen), i + 1)).toBe(expected));
  });

  it('legal moves match chess.js in every position of the perft set', () => {
    for (const [, fen] of POSITIONS) {
      const ours = new Board(fen).legalMoves().map(moveToUci).sort();
      const theirs = new Chess(fen)
        .moves({ verbose: true })
        .map((m) => m.from + m.to + (m.promotion ?? ''))
        .sort();
      expect(ours).toEqual(theirs);
    }
  });

  it('make/unmake restores the position exactly', () => {
    const fen = POSITIONS[1]![1];
    const board = new Board(fen);
    const before = [...board.sq, board.side, board.castling, board.ep, board.halfmove];
    perft(board, 3);
    expect([...board.sq, board.side, board.castling, board.ep, board.halfmove]).toEqual(before);
  });
});
