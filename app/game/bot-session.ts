import { Chess } from 'chess.js';
import type { BotLevel } from '../../core/bot/search';
import { playMove } from '../ui/sound';
import { other, positionResult, type Color, type Result, type TimeControl } from './room';
import { isCapture, positionView, type Session, type View } from './session';

const LEVEL_NAME: Record<BotLevel, string> = { kolay: 'Bot · Kolay', orta: 'Bot · Orta', zor: 'Bot · Zor' };
/** The bot never answers faster than this: an instant reply feels wrong. */
const MIN_THINK_MS = 450;

export class BotSession implements Session {
  readonly kind = 'bot';
  private chess = new Chess();
  private result: Result | null = null;
  private clock: Record<Color, number> = { w: 0, b: 0 };
  private turnStartedAt = Date.now();
  private listeners: (() => void)[] = [];
  private worker: Worker;
  private request = 0;
  private thinking = false;
  private timer: number;

  constructor(
    private myColor: Color,
    private readonly level: BotLevel,
    private readonly tc: TimeControl | null,
    private readonly myName: string,
  ) {
    this.worker = new Worker(new URL('../bot.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<{ id: number; uci: string | null }>) => this.botAnswered(e.data);
    this.timer = window.setInterval(() => this.tick(), 100);
    this.reset();
  }

  private reset(): void {
    this.chess = new Chess();
    this.result = null;
    this.clock = { w: this.tc?.initialMs ?? 0, b: this.tc?.initialMs ?? 0 };
    this.turnStartedAt = Date.now();
    this.request++;
    this.thinking = false;
    this.maybeAskBot();
    this.emit();
  }

  view(): View {
    const pos = positionView(this.chess);
    const turn = this.chess.turn();
    const running = this.tc && !this.result && this.chess.history().length >= 2 ? turn : null;
    const clockOf = (c: Color) =>
      this.tc ? this.clock[c] - (running === c ? Date.now() - this.turnStartedAt : 0) : null;
    const player = (c: Color) => ({
      name: c === this.myColor ? this.myName : LEVEL_NAME[this.level],
      online: null,
      clockMs: clockOf(c),
      running: running === c,
    });
    const myTurn = !this.result && turn === this.myColor;
    return {
      ...pos,
      dests: myTurn ? pos.dests : new Map(),
      myColor: this.myColor,
      movable: myTurn ? this.myColor : null,
      sans: this.chess.history(),
      white: player('w'),
      black: player('b'),
      status: this.result ? 'over' : 'playing',
      result: this.result,
      drawOffer: null,
      rematch: 'none',
      info: this.thinking ? 'Bot düşünüyor…' : null,
      canTakeback: !this.result && this.chess.history().length >= (this.myColor === 'w' ? 1 : 2),
      canClaimAbandon: false,
      shareUrl: null,
    };
  }

  subscribe(cb: () => void): void {
    this.listeners.push(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  private play(from: string, to: string, promotion?: string): boolean {
    const capture = isCapture(this.chess, from, to);
    try {
      this.chess.move(promotion ? { from, to, promotion } : { from, to });
    } catch {
      return false;
    }
    const mover = other(this.chess.turn());
    if (this.tc) {
      const plies = this.chess.history().length;
      // Clocks start after both sides have moved once; from then on the thinking time is charged.
      if (plies > 2) this.clock[mover] -= Date.now() - this.turnStartedAt;
      if (plies > 2) this.clock[mover] += this.tc.incrementMs;
    }
    this.turnStartedAt = Date.now();
    this.result = positionResult(this.chess);
    playMove(capture);
    return true;
  }

  move(from: string, to: string, promotion?: string): void {
    if (this.result || this.chess.turn() !== this.myColor) return;
    if (!this.play(from, to, promotion)) return;
    this.maybeAskBot();
    this.emit();
  }

  private maybeAskBot(): void {
    if (this.result || this.chess.turn() === this.myColor) return;
    this.thinking = true;
    const id = ++this.request;
    const asked = Date.now();
    const fen = this.chess.fen();
    window.setTimeout(() => {
      if (id === this.request) this.worker.postMessage({ id, fen, level: this.level });
    }, Math.max(0, MIN_THINK_MS - (Date.now() - asked)));
  }

  private botAnswered({ id, uci }: { id: number; uci: string | null }): void {
    if (id !== this.request || this.result) return;
    this.thinking = false;
    if (uci) this.play(uci.slice(0, 2), uci.slice(2, 4), uci[4]);
    this.emit();
  }

  private tick(): void {
    if (!this.tc || this.result) return;
    const v = this.view();
    for (const c of ['w', 'b'] as const) {
      const p = c === 'w' ? v.white : v.black;
      if (p.running && (p.clockMs ?? 1) <= 0) {
        this.clock[c] = 0;
        this.result = { winner: other(c), reason: 'süre' };
        this.request++;
        this.thinking = false;
      }
    }
    this.emit();
  }

  resign(): void {
    if (this.result) return;
    this.result = { winner: other(this.myColor), reason: 'teslim' };
    this.request++;
    this.thinking = false;
    this.emit();
  }

  // No draw offers against the bot (the screen hides the button).
  offerDraw(): void {}

  answerDraw(): void {}

  takeback(): void {
    if (this.result) return;
    this.request++;
    this.thinking = false;
    // Back to the user's turn: undo the bot's reply (if any) and the user's last move.
    do this.chess.undo();
    while (this.chess.turn() !== this.myColor && this.chess.history().length > 0);
    this.turnStartedAt = Date.now();
    this.maybeAskBot();
    this.emit();
  }

  rematch(): void {
    this.myColor = other(this.myColor);
    this.reset();
  }

  claimAbandon(): void {}

  dispose(): void {
    window.clearInterval(this.timer);
    this.worker.terminate();
    this.listeners = [];
  }
}
