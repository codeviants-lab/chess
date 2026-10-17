import { Chess, type Square } from 'chess.js';
import type { Color, Reason, Result, TimeControl } from './room';

// What a game screen shows and what it can do — the same for bot games and online games.

export interface PlayerView {
  name: string;
  /** null when presence does not apply (the bot, yourself). */
  online: boolean | null;
  clockMs: number | null;
  running: boolean;
}

export interface View {
  fen: string;
  lastMove: [string, string] | null;
  check: string | null;
  myColor: Color | null;
  movable: Color | null;
  dests: Map<string, string[]>;
  sans: string[];
  white: PlayerView;
  black: PlayerView;
  status: 'waiting' | 'playing' | 'over';
  result: Result | null;
  drawOffer: 'mine' | 'theirs' | null;
  rematch: 'none' | 'mine' | 'theirs';
  info: string | null;
  canTakeback: boolean;
  canClaimAbandon: boolean;
  /** Link to send to the opponent while waiting. */
  shareUrl: string | null;
}

export interface Session {
  readonly kind: 'bot' | 'online';
  view(): View;
  subscribe(cb: () => void): void;
  move(from: string, to: string, promotion?: string): void;
  resign(): void;
  offerDraw(): void;
  answerDraw(accept: boolean): void;
  takeback(): void;
  rematch(): void;
  claimAbandon(): void;
  dispose(): void;
}

export const TIME_CONTROLS: Record<string, TimeControl | null> = {
  none: null,
  '3+2': { initialMs: 180_000, incrementMs: 2_000 },
  '5+0': { initialMs: 300_000, incrementMs: 0 },
  '10+5': { initialMs: 600_000, incrementMs: 5_000 },
};

export const TC_LABEL: Record<string, string> = { none: 'Süresiz', '3+2': '3+2', '5+0': '5+0', '10+5': '10+5' };

/** Board-facing facts about a position. */
export function positionView(chess: Chess): Pick<View, 'fen' | 'lastMove' | 'check' | 'dests'> {
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  let check: string | null = null;
  if (chess.inCheck()) {
    const king = chess.board().flat().find((p) => p && p.type === 'k' && p.color === chess.turn());
    check = king?.square ?? null;
  }
  const dests = new Map<string, string[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    if (!list.includes(m.to)) list.push(m.to);
    dests.set(m.from, list);
  }
  return { fen: chess.fen(), lastMove: last ? [last.from, last.to] : null, check, dests };
}

export function isCapture(chess: Chess, from: string, to: string): boolean {
  return chess.get(to as Square) !== undefined || (chess.get(from as Square)?.type === 'p' && from[0] !== to[0]);
}

const REASON_TEXT: Record<Reason, string> = {
  mat: 'Şah mat',
  pat: 'Pat',
  tekrar: 'Üç kez tekrar',
  'elli-hamle': '50 hamle kuralı',
  'yetersiz-materyal': 'Yetersiz materyal',
  teslim: 'Teslim',
  süre: 'Süre bitti',
  anlaşma: 'Anlaşmalı beraberlik',
  terk: 'Rakip oyunu bıraktı',
};

export function resultText(result: Result, myColor: Color | null): { title: string; detail: string } {
  const detail = REASON_TEXT[result.reason];
  if (result.winner === null) return { title: 'Berabere', detail };
  if (myColor === null) return { title: result.winner === 'w' ? 'Beyaz kazandı' : 'Siyah kazandı', detail };
  return { title: result.winner === myColor ? 'Kazandın!' : 'Kaybettin', detail };
}

export function formatClock(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `0:0${s.toFixed(1)}`;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
