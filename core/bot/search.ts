import { Board, KING, moveFrom, movePromotion, moveToUci, PAWN } from './board';
import { evaluate } from './evaluate';

export type BotLevel = 'kolay' | 'orta' | 'zor';

interface LevelSettings {
  maxDepth: number;
  quiescence: boolean;
  /** Random centipawns added to each root move's score: makes weaker levels vary and err. */
  noiseCp: number;
  timeMs: number;
}

export const LEVELS: Record<BotLevel, LevelSettings> = {
  kolay: { maxDepth: 2, quiescence: false, noiseCp: 150, timeMs: 300 },
  orta: { maxDepth: 3, quiescence: true, noiseCp: 30, timeMs: 800 },
  zor: { maxDepth: 6, quiescence: true, noiseCp: 0, timeMs: 1500 },
};

/** Injected so that the search stays pure and testable (core/ rule: no Date.now or Math.random). */
export interface SearchDeps {
  random: () => number;
  now: () => number;
}

export interface BotMove {
  /** Long algebraic, e.g. "e2e4" or "e7e8q". */
  uci: string;
  /** Score of the chosen move in centipawns for the side to move (before noise). */
  score: number;
  depth: number;
  nodes: number;
}

const MATE = 100_000;
const INF = 1_000_000;
const VALUE = [0, 100, 320, 330, 500, 900, 0]; // by Board piece type

class Timeout extends Error {}

// Captures first (most valuable victim, least valuable attacker), then promotions, then the rest.
function orderMoves(board: Board, moves: number[], first = -1): number[] {
  const scored = moves.map((m) => {
    if (m === first) return { m, s: 1e9 };
    let s = 0;
    const victim = board.capturedType(m);
    if (victim) s += 10 * VALUE[victim]! - VALUE[board.pieceType(moveFrom(m))]! + 10_000;
    const promo = movePromotion(m);
    if (promo) s += VALUE[promo]! + 5_000;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.m);
}

function insufficientMaterial(board: Board): boolean {
  let minors = 0;
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) {
      i += 7;
      continue;
    }
    const t = Math.abs(board.sq[i]!);
    if (t === 0 || t === KING) continue;
    if (t === PAWN || t >= 4) return false; // pawn, rook, queen
    if (++minors > 1) return false;
  }
  return true;
}

/** Picks a move for the side to move in `fen`. Returns null if there is no legal move. */
export function chooseMove(fen: string, level: BotLevel, deps: SearchDeps): BotMove | null {
  const settings = LEVELS[level];
  const board = new Board(fen);
  const rootMoves = board.legalMoves();
  if (rootMoves.length === 0) return null;

  const deadline = deps.now() + settings.timeMs;
  let nodes = 0;
  let checkClock = false; // the first depth always completes

  function quiesce(alpha: number, beta: number): number {
    nodes++;
    const standPat = evaluate(board);
    if (!settings.quiescence) return standPat;
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    for (const m of orderMoves(board, board.pseudoMoves(true))) {
      if (!board.make(m)) continue;
      const score = -quiesce(-beta, -alpha);
      board.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(depth: number, alpha: number, beta: number, ply: number): number {
    if (checkClock && (nodes & 1023) === 0 && deps.now() > deadline) throw new Timeout();
    nodes++;
    if (board.halfmove >= 100 || insufficientMaterial(board)) return 0;
    if (depth === 0) return quiesce(alpha, beta);
    let best = -INF;
    let legal = 0;
    for (const m of orderMoves(board, board.pseudoMoves())) {
      if (!board.make(m)) continue;
      legal++;
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      board.unmake();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    if (legal === 0) return board.inCheck() ? -MATE + ply : 0;
    return best;
  }

  // Iterative deepening. Each completed depth scores every root move; the deepest completed depth wins.
  // With noise every root move needs an exact score (full window); without noise the root can prune.
  let scores: { m: number; score: number }[] = [];
  let completedDepth = 0;
  let previousBest = -1;
  for (let depth = 1; depth <= settings.maxDepth; depth++) {
    const current: { m: number; score: number }[] = [];
    let alpha = -INF;
    try {
      for (const m of orderMoves(board, rootMoves, previousBest)) {
        board.make(m);
        try {
          const a = settings.noiseCp === 0 ? alpha : -INF;
          const score = -negamax(depth - 1, -INF, -a, 1);
          if (score > alpha) alpha = score;
          current.push({ m, score });
        } finally {
          board.unmake();
        }
      }
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
    scores = current;
    completedDepth = depth;
    checkClock = true;
    previousBest = current.reduce((a, b) => (b.score > a.score ? b : a)).m;
    if (Math.abs(alpha) > MATE / 2 || deps.now() > deadline) break;
  }

  let pick = scores[0]!;
  let pickNoisy = -INF;
  for (const s of scores) {
    // A forced mate is never hidden by noise.
    const noise = Math.abs(s.score) > MATE / 2 ? 0 : (deps.random() * 2 - 1) * settings.noiseCp;
    const noisy = s.score + noise;
    if (noisy > pickNoisy) {
      pickNoisy = noisy;
      pick = s;
    }
  }
  return { uci: moveToUci(pick.m), score: pick.score, depth: completedDepth, nodes };
}
