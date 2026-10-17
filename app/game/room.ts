import { Chess } from 'chess.js';

// The online game protocol. Every client keeps a RoomState and passes every message — its own and the
// opponent's — through `reduce`, so all clients reach the same state. Pure: no network, no clock, no DOM.
// P0 is unrated and peer-to-peer (no server authority); the event log of SPEC.md replaces this in M3.

export type Color = 'w' | 'b';

export interface TimeControl {
  initialMs: number;
  incrementMs: number;
}

export interface Seat {
  pid: string;
  name: string;
}

export interface PlayedMove {
  uci: string;
  san: string;
  /** Mover's remaining time after this move (increment included); null in untimed games. */
  clockAfter: number | null;
}

export type Reason =
  | 'mat'
  | 'pat'
  | 'tekrar'
  | 'elli-hamle'
  | 'yetersiz-materyal'
  | 'teslim'
  | 'süre'
  | 'anlaşma'
  | 'terk';

export interface Result {
  winner: Color | null;
  reason: Reason;
}

export interface RoomState {
  id: string;
  /** null = untimed. */
  tc: TimeControl | null;
  seats: { w?: Seat; b?: Seat };
  moves: PlayedMove[];
  result: Result | null;
  drawOffer: Color | null;
  rematchOffer: { by: Color; room: string } | null;
  /** Agreed rematch room: both clients move there with colours swapped. */
  next: string | null;
}

export type Msg =
  | { t: 'hello'; name: string }
  | { t: 'state'; state: RoomState }
  | { t: 'move'; ply: number; uci: string; clockAfter: number | null }
  | { t: 'resign' }
  | { t: 'draw'; action: 'offer' | 'accept' | 'decline' }
  | { t: 'flag'; color: Color }
  | { t: 'abandon' }
  | { t: 'rematch'; action: 'offer' | 'accept'; room: string };

export function newRoom(id: string, tc: TimeControl | null, seats: RoomState['seats']): RoomState {
  return { id, tc, seats, moves: [], result: null, drawOffer: null, rematchOffer: null, next: null };
}

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function colorOf(state: RoomState, pid: string): Color | null {
  if (state.seats.w?.pid === pid) return 'w';
  if (state.seats.b?.pid === pid) return 'b';
  return null;
}

export function sideToMove(state: RoomState): Color {
  return state.moves.length % 2 === 0 ? 'w' : 'b';
}

export function replay(moves: readonly { uci: string }[]): Chess {
  const chess = new Chess();
  for (const m of moves) chess.move(m.uci);
  return chess;
}

/** The result the position itself decides (mate, stalemate, draws by rule), if any. */
export function positionResult(chess: Chess): Result | null {
  if (chess.isCheckmate()) return { winner: other(chess.turn()), reason: 'mat' };
  if (chess.isStalemate()) return { winner: null, reason: 'pat' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'yetersiz-materyal' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'tekrar' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'elli-hamle' };
  return null;
}

/**
 * Applies a message from `from` to `state`, as seen by the client `self`. Invalid messages leave the state
 * unchanged. `state` is null while a guest has not yet received the room from someone already in it.
 */
export function reduce(state: RoomState | null, from: string, msg: Msg, self: string): { state: RoomState | null; reply?: Msg } {
  if (msg.t === 'state') return { state: state ? merge(state, msg.state) : msg.state };
  if (!state) return { state };

  if (msg.t === 'hello') {
    // Only seated clients answer, so that a crowd of spectators does not flood the channel.
    if (!colorOf(state, self)) return { state };
    let next = state;
    if (!colorOf(state, from) && from !== self) {
      const free: Color | null = !state.seats.w ? 'w' : !state.seats.b ? 'b' : null;
      if (free) next = { ...state, seats: { ...state.seats, [free]: { pid: from, name: msg.name } } };
    }
    return { state: next, reply: { t: 'state', state: next } };
  }

  const color = colorOf(state, from);
  if (!color) return { state }; // spectators cannot act

  if (msg.t === 'rematch') {
    if (!state.result) return { state };
    if (msg.action === 'offer' && !state.rematchOffer) return { state: { ...state, rematchOffer: { by: color, room: msg.room } } };
    if (msg.action === 'accept' && state.rematchOffer && state.rematchOffer.by !== color && state.rematchOffer.room === msg.room)
      return { state: { ...state, next: msg.room } };
    return { state };
  }

  if (state.result) return { state };

  switch (msg.t) {
    case 'move': {
      if (sideToMove(state) !== color || msg.ply !== state.moves.length) return { state };
      const chess = replay(state.moves);
      let san: string;
      try {
        san = chess.move(msg.uci).san;
      } catch {
        return { state };
      }
      const moves = [...state.moves, { uci: msg.uci, san, clockAfter: msg.clockAfter }];
      return { state: { ...state, moves, drawOffer: null, result: positionResult(chess) } };
    }
    case 'resign':
      return { state: { ...state, result: { winner: other(color), reason: 'teslim' } } };
    case 'draw':
      if (msg.action === 'offer') return { state: { ...state, drawOffer: color } };
      if (state.drawOffer !== other(color)) return { state };
      if (msg.action === 'accept') return { state: { ...state, drawOffer: null, result: { winner: null, reason: 'anlaşma' } } };
      return { state: { ...state, drawOffer: null } };
    case 'flag':
      // Either player may report that a clock ran out; clocks only run once both sides have moved.
      if (!state.tc || state.moves.length < 2 || sideToMove(state) !== msg.color) return { state };
      return { state: { ...state, result: { winner: other(msg.color), reason: 'süre' } } };
    case 'abandon':
      return { state: { ...state, result: { winner: color, reason: 'terk' } } };
  }
}

/** Combines two views of the same room (e.g. after a reload): never loses a seat, a move or a result. */
export function merge(mine: RoomState, theirs: RoomState): RoomState {
  if (mine.id !== theirs.id) return mine;
  const seats = { w: mine.seats.w ?? theirs.seats.w, b: mine.seats.b ?? theirs.seats.b };
  const prefix = mine.moves.every((m, i) => theirs.moves[i]?.uci === m.uci);
  const longer = theirs.moves.length > mine.moves.length && prefix;
  return {
    ...mine,
    seats: Object.fromEntries(Object.entries(seats).filter(([, s]) => s)) as RoomState['seats'],
    tc: mine.tc ?? theirs.tc,
    moves: longer ? theirs.moves : mine.moves,
    drawOffer: longer ? theirs.drawOffer : mine.drawOffer ?? theirs.drawOffer,
    result: mine.result ?? theirs.result,
    rematchOffer: mine.rematchOffer ?? theirs.rematchOffer,
    next: mine.next ?? theirs.next,
  };
}

/** Remaining time per side, given when the side to move started thinking (local clock). */
export function clocks(state: RoomState, turnStartedAt: number, now: number): { w: number; b: number; running: Color | null } {
  if (!state.tc) return { w: 0, b: 0, running: null };
  const last = (c: Color): number => {
    for (let i = state.moves.length - 1; i >= 0; i--) {
      if ((i % 2 === 0 ? 'w' : 'b') === c) return state.moves[i]!.clockAfter ?? state.tc!.initialMs;
    }
    return state.tc!.initialMs;
  };
  const running = !state.result && state.moves.length >= 2 ? sideToMove(state) : null;
  const w = last('w') - (running === 'w' ? now - turnStartedAt : 0);
  const b = last('b') - (running === 'b' ? now - turnStartedAt : 0);
  return { w: Math.max(0, w), b: Math.max(0, b), running };
}
