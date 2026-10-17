// A small, fast 0x88 board for the bot's search. chess.js stays the source of truth for the rules of the game;
// this board exists only because chess.js builds SAN for every generated move, which makes search ~1000x slower.
// Correctness is checked against known perft counts and against chess.js (tests/bot/board.test.ts).

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;

// Move encoding: from (7 bits) | to (7 bits) << 7 | promotion piece (3 bits) << 14 | flag (3 bits) << 17.
const F_NONE = 0;
const F_DOUBLE = 1;
const F_EP = 2;
const F_CASTLE = 3;

export const moveFrom = (m: number): number => m & 127;
export const moveTo = (m: number): number => (m >> 7) & 127;
export const movePromotion = (m: number): number => (m >> 14) & 7;
const moveFlag = (m: number): number => (m >> 17) & 7;
const encode = (from: number, to: number, promo = 0, flag = F_NONE): number =>
  from | (to << 7) | (promo << 14) | (flag << 17);

const KNIGHT_STEPS = [33, 31, 18, 14, -14, -18, -31, -33];
const BISHOP_STEPS = [17, 15, -15, -17];
const ROOK_STEPS = [16, 1, -1, -16];
const KING_STEPS = [17, 16, 15, 1, -1, -15, -16, -17];

const FILES = 'abcdefgh';
const PROMO_CHARS = ' pnbrqk';

export function squareName(sq: number): string {
  return FILES[sq & 7]! + String((sq >> 4) + 1);
}

function parseSquare(name: string): number {
  return (Number(name[1]) - 1) * 16 + FILES.indexOf(name[0]!);
}

export function moveToUci(m: number): string {
  const p = movePromotion(m);
  return squareName(moveFrom(m)) + squareName(moveTo(m)) + (p ? PROMO_CHARS[p] : '');
}

// Castling rights lost when a piece moves from or to these squares.
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0x04] = 15 & ~(WK | WQ);
CASTLE_MASK[0x00] = 15 & ~WQ;
CASTLE_MASK[0x07] = 15 & ~WK;
CASTLE_MASK[0x74] = 15 & ~(BK | BQ);
CASTLE_MASK[0x70] = 15 & ~BQ;
CASTLE_MASK[0x77] = 15 & ~BK;

interface Undo {
  move: number;
  captured: number;
  castling: number;
  ep: number;
  halfmove: number;
}

export class Board {
  /** 0x88 squares; white pieces positive, black negative. */
  readonly sq = new Int8Array(128);
  /** 1 = white to move, -1 = black. */
  side = 1;
  castling = 0;
  ep = -1;
  halfmove = 0;
  private readonly kings = [0, 0]; // [white, black]
  private readonly history: Undo[] = [];

  constructor(fen: string) {
    const [placement = '', turn = 'w', castle = '-', ep = '-', half = '0'] = fen.split(' ');
    let rank = 7;
    let file = 0;
    for (const ch of placement) {
      if (ch === '/') {
        rank--;
        file = 0;
      } else if (ch >= '1' && ch <= '8') {
        file += Number(ch);
      } else {
        const type = ' pnbrqk'.indexOf(ch.toLowerCase());
        const sq = rank * 16 + file;
        this.sq[sq] = ch === ch.toUpperCase() ? type : -type;
        if (type === KING) this.kings[ch === 'K' ? 0 : 1] = sq;
        file++;
      }
    }
    this.side = turn === 'w' ? 1 : -1;
    if (castle.includes('K')) this.castling |= WK;
    if (castle.includes('Q')) this.castling |= WQ;
    if (castle.includes('k')) this.castling |= BK;
    if (castle.includes('q')) this.castling |= BQ;
    this.ep = ep === '-' ? -1 : parseSquare(ep);
    this.halfmove = Number(half);
  }

  kingSquare(side: number): number {
    return this.kings[side === 1 ? 0 : 1]!;
  }

  /** Is `sq` attacked by `by` (1 white, -1 black)? */
  attacked(sq: number, by: number): boolean {
    const b = this.sq;
    // Pawns: a white pawn attacks upward, so it sits below the square.
    const pawnFrom = by === 1 ? [sq - 15, sq - 17] : [sq + 15, sq + 17];
    for (const p of pawnFrom) if (!(p & 0x88) && b[p] === by * PAWN) return true;
    for (const s of KNIGHT_STEPS) {
      const t = sq + s;
      if (!(t & 0x88) && b[t] === by * KNIGHT) return true;
    }
    for (const s of KING_STEPS) {
      const t = sq + s;
      if (!(t & 0x88) && b[t] === by * KING) return true;
    }
    for (const s of BISHOP_STEPS) {
      for (let t = sq + s; !(t & 0x88); t += s) {
        const p = b[t]!;
        if (p === EMPTY) continue;
        if (p === by * BISHOP || p === by * QUEEN) return true;
        break;
      }
    }
    for (const s of ROOK_STEPS) {
      for (let t = sq + s; !(t & 0x88); t += s) {
        const p = b[t]!;
        if (p === EMPTY) continue;
        if (p === by * ROOK || p === by * QUEEN) return true;
        break;
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.attacked(this.kingSquare(this.side), -this.side);
  }

  /** Pseudo-legal moves (may leave the own king in check); `capturesOnly` for quiescence. */
  pseudoMoves(capturesOnly = false): number[] {
    const out: number[] = [];
    const b = this.sq;
    const us = this.side;
    for (let from = 0; from < 128; from++) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      const p = b[from]! * us;
      if (p <= 0) continue;
      if (p === PAWN) {
        const fwd = us === 1 ? 16 : -16;
        const startRank = us === 1 ? 1 : 6;
        const promoRank = us === 1 ? 7 : 0;
        const one = from + fwd;
        if (!(one & 0x88) && b[one] === EMPTY) {
          if (one >> 4 === promoRank) {
            for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(encode(from, one, pr));
          } else if (!capturesOnly) {
            out.push(encode(from, one));
            const two = one + fwd;
            if (from >> 4 === startRank && b[two] === EMPTY) out.push(encode(from, two, 0, F_DOUBLE));
          }
        }
        for (const t of [one - 1, one + 1]) {
          if (t & 0x88) continue;
          if (b[t]! * us < 0) {
            if (t >> 4 === promoRank) for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(encode(from, t, pr));
            else out.push(encode(from, t));
          } else if (t === this.ep) {
            out.push(encode(from, t, 0, F_EP));
          }
        }
        continue;
      }
      const steps = p === KNIGHT ? KNIGHT_STEPS : p === BISHOP ? BISHOP_STEPS : p === ROOK ? ROOK_STEPS : KING_STEPS;
      const slides = p === BISHOP || p === ROOK || p === QUEEN;
      for (const s of steps) {
        for (let t = from + s; !(t & 0x88); t += s) {
          const q = b[t]! * us;
          if (q > 0) break;
          if (q < 0 || !capturesOnly) out.push(encode(from, t));
          if (q < 0 || !slides) break;
        }
      }
      if (p === KING && !capturesOnly) this.castleMoves(from, out);
    }
    return out;
  }

  private castleMoves(from: number, out: number[]): void {
    const b = this.sq;
    const us = this.side;
    const [k, q, home] = us === 1 ? [WK, WQ, 0x04] : [BK, BQ, 0x74];
    if (from !== home || this.attacked(home, -us)) return;
    if (this.castling & k && b[home + 1] === EMPTY && b[home + 2] === EMPTY && b[home + 3] === us * ROOK) {
      if (!this.attacked(home + 1, -us) && !this.attacked(home + 2, -us)) out.push(encode(home, home + 2, 0, F_CASTLE));
    }
    if (
      this.castling & q &&
      b[home - 1] === EMPTY &&
      b[home - 2] === EMPTY &&
      b[home - 3] === EMPTY &&
      b[home - 4] === us * ROOK
    ) {
      if (!this.attacked(home - 1, -us) && !this.attacked(home - 2, -us)) out.push(encode(home, home - 2, 0, F_CASTLE));
    }
  }

  /** Captured piece type at `to` (0 if none), for move ordering. */
  capturedType(m: number): number {
    if (moveFlag(m) === F_EP) return PAWN;
    return Math.abs(this.sq[moveTo(m)]!);
  }

  pieceType(sq: number): number {
    return Math.abs(this.sq[sq]!);
  }

  /** Makes a pseudo-legal move; returns false (and leaves the board unchanged) if it was illegal. */
  make(m: number): boolean {
    const b = this.sq;
    const from = moveFrom(m);
    const to = moveTo(m);
    const flag = moveFlag(m);
    const us = this.side;
    const piece = b[from]!;
    const undo: Undo = { move: m, captured: b[to]!, castling: this.castling, ep: this.ep, halfmove: this.halfmove };

    b[to] = movePromotion(m) ? us * movePromotion(m) : piece;
    b[from] = EMPTY;
    if (flag === F_EP) {
      const victim = to - (us === 1 ? 16 : -16);
      undo.captured = b[victim]!;
      b[victim] = EMPTY;
    } else if (flag === F_CASTLE) {
      if (to > from) {
        b[from + 1] = b[from + 3]!;
        b[from + 3] = EMPTY;
      } else {
        b[from - 1] = b[from - 4]!;
        b[from - 4] = EMPTY;
      }
    }
    if (Math.abs(piece) === KING) this.kings[us === 1 ? 0 : 1] = to;
    this.castling &= CASTLE_MASK[from]! & CASTLE_MASK[to]!;
    this.ep = flag === F_DOUBLE ? (from + to) >> 1 : -1;
    this.halfmove = Math.abs(piece) === PAWN || undo.captured !== EMPTY ? 0 : this.halfmove + 1;
    this.side = -us;
    this.history.push(undo);

    if (this.attacked(this.kingSquare(us), -us)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake(): void {
    const undo = this.history.pop()!;
    const b = this.sq;
    const m = undo.move;
    const from = moveFrom(m);
    const to = moveTo(m);
    const flag = moveFlag(m);
    this.side = -this.side;
    const us = this.side;
    const moved = movePromotion(m) ? us * PAWN : b[to]!;
    b[from] = moved;
    if (flag === F_EP) {
      b[to] = EMPTY;
      b[to - (us === 1 ? 16 : -16)] = undo.captured;
    } else {
      b[to] = undo.captured;
      if (flag === F_CASTLE) {
        if (to > from) {
          b[from + 3] = b[from + 1]!;
          b[from + 1] = EMPTY;
        } else {
          b[from - 4] = b[from - 1]!;
          b[from - 1] = EMPTY;
        }
      }
    }
    if (Math.abs(moved) === KING) this.kings[us === 1 ? 0 : 1] = from;
    this.castling = undo.castling;
    this.ep = undo.ep;
    this.halfmove = undo.halfmove;
  }

  /** Legal moves (generates pseudo-legal moves and filters them by making each one). */
  legalMoves(): number[] {
    return this.pseudoMoves().filter((m) => {
      if (!this.make(m)) return false;
      this.unmake();
      return true;
    });
  }
}

/** Counts leaf nodes at `depth` — the standard move generator correctness test. */
export function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of board.pseudoMoves()) {
    if (!board.make(m)) continue;
    n += perft(board, depth - 1);
    board.unmake();
  }
  return n;
}
