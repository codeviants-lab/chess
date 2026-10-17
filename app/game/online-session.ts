import { load, randomId, save, type Me } from '../lib/store';
import { transport } from '../net';
import type { Channel, Member } from '../net/transport';
import { playMove } from '../ui/sound';
import {
  clocks,
  colorOf,
  other,
  reduce,
  replay,
  sideToMove,
  type Color,
  type Msg,
  type RoomState,
} from './room';
import { isCapture, positionView, type Session, type View } from './session';

/** After this long without the opponent in the room, the remaining player may claim the game. */
const ABANDON_MS = 30_000;

const roomKey = (id: string) => `room:${id}`;

/** Remembers a room locally: the creator's or a matched pair's settings, and later every update. */
export function saveRoom(state: RoomState): void {
  save(roomKey(state.id), state);
}

export function roomLink(id: string): string {
  return `${location.origin}${location.pathname}#/g/${id}`;
}

export class OnlineSession implements Session {
  readonly kind = 'online';
  private state: RoomState | null;
  private channel: Channel;
  private members: Member[] = [];
  private turnStartedAt = Date.now();
  private opponentGoneSince: number | null = null;
  private listeners: (() => void)[] = [];
  private timer: number;
  private flagSent = false;

  constructor(
    private readonly id: string,
    private readonly me: Me,
    private readonly navigate: (hash: string) => void,
  ) {
    this.state = load<RoomState | null>(roomKey(id), null);
    this.channel = transport.join(`room:${id}`, { pid: me.pid, name: me.name, since: Date.now() });
    this.channel.onMessage((from, payload) => this.apply(from, payload as Msg));
    this.channel.onMembers((members) => {
      this.members = members;
      this.emit();
    });
    this.channel.send({ t: 'hello', name: me.name } satisfies Msg);
    this.timer = window.setInterval(() => this.tick(), 200);
  }

  private apply(from: string, msg: Msg): void {
    const before = this.state;
    const out = reduce(this.state, from, msg, this.me.pid);
    this.state = out.state;
    if (out.reply) this.channel.send(out.reply);
    if (!this.state || this.state === before) return;
    saveRoom(this.state);

    const added = this.state.moves.length - (before?.moves.length ?? 0);
    if (added > 0) {
      this.turnStartedAt = Date.now();
      this.flagSent = false;
      if (added === 1 && before) {
        const last = this.state.moves[this.state.moves.length - 1]!;
        playMove(isCapture(replay(before.moves), last.uci.slice(0, 2), last.uci.slice(2, 4)));
      }
    }
    if (this.state.next && this.state.next !== before?.next) this.goToRematch(this.state);
    this.emit();
  }

  /** Applies a message of our own and sends it to the others. */
  private act(msg: Msg): void {
    this.channel.send(msg);
    this.apply(this.me.pid, msg);
  }

  private goToRematch(state: RoomState): void {
    const next = state.next!;
    if (!load<RoomState | null>(roomKey(next), null)) {
      const { w, b } = state.seats;
      saveRoom({
        id: next,
        tc: state.tc,
        seats: { ...(b ? { w: b } : {}), ...(w ? { b: w } : {}) },
        moves: [],
        result: null,
        drawOffer: null,
        rematchOffer: null,
        next: null,
      });
    }
    window.setTimeout(() => this.navigate(`#/g/${next}`), 600);
  }

  private myColor(): Color | null {
    return this.state ? colorOf(this.state, this.me.pid) : null;
  }

  private opponentOnline(): boolean | null {
    const mine = this.myColor();
    const opp = mine && this.state?.seats[other(mine)];
    if (!opp) return null;
    return this.members.some((m) => m.pid === opp.pid);
  }

  view(): View {
    const state = this.state;
    const myColor = this.myColor();
    const chess = replay(state?.moves ?? []);
    const pos = positionView(chess);
    const c = state ? clocks(state, this.turnStartedAt, Date.now()) : { w: 0, b: 0, running: null };
    const seated = Boolean(state?.seats.w && state?.seats.b);
    const status = !state || !seated ? 'waiting' : state.result ? 'over' : 'playing';
    const myTurn = status === 'playing' && myColor !== null && sideToMove(state!) === myColor;

    const player = (color: Color) => {
      const seat = state?.seats[color];
      const isMe = seat?.pid === this.me.pid;
      return {
        name: seat?.name || (seat ? 'Misafir' : 'Bekleniyor…'),
        online: !seat || isMe ? null : this.members.some((m) => m.pid === seat.pid),
        clockMs: state?.tc ? c[color] : null,
        running: c.running === color,
      };
    };

    let info: string | null = null;
    if (!state) info = 'Oyuna bağlanılıyor…';
    else if (!seated) info = 'Rakip bekleniyor — linki gönder.';
    else if (myColor === null) info = 'İzleyici olarak bakıyorsun.';
    else if (status === 'playing' && this.opponentOnline() === false) info = 'Rakibin bağlantısı koptu…';

    return {
      ...pos,
      dests: myTurn ? pos.dests : new Map(),
      myColor,
      movable: myTurn ? myColor : null,
      sans: state?.moves.map((m) => m.san) ?? [],
      white: player('w'),
      black: player('b'),
      status,
      result: state?.result ?? null,
      drawOffer: !state?.drawOffer || !myColor ? null : state.drawOffer === myColor ? 'mine' : 'theirs',
      rematch: !state?.rematchOffer || !myColor ? 'none' : state.rematchOffer.by === myColor ? 'mine' : 'theirs',
      info,
      canTakeback: false,
      canClaimAbandon:
        status === 'playing' &&
        myColor !== null &&
        this.opponentGoneSince !== null &&
        Date.now() - this.opponentGoneSince > ABANDON_MS,
      shareUrl: status === 'waiting' && myColor ? roomLink(this.id) : null,
    };
  }

  subscribe(cb: () => void): void {
    this.listeners.push(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  private tick(): void {
    const state = this.state;
    if (!state || state.result) return;
    const online = this.opponentOnline();
    if (online === false) this.opponentGoneSince ??= Date.now();
    else this.opponentGoneSince = null;

    const c = clocks(state, this.turnStartedAt, Date.now());
    if (c.running && c[c.running] <= 0 && !this.flagSent && this.myColor()) {
      this.flagSent = true;
      this.act({ t: 'flag', color: c.running });
    }
    this.emit();
  }

  move(from: string, to: string, promotion?: string): void {
    const state = this.state;
    const color = this.myColor();
    if (!state || !color || state.result || sideToMove(state) !== color) return;
    let clockAfter: number | null = null;
    if (state.tc) {
      const c = clocks(state, this.turnStartedAt, Date.now());
      clockAfter = state.moves.length < 2 ? c[color] : c[color] + state.tc.incrementMs;
    }
    this.act({ t: 'move', ply: state.moves.length, uci: from + to + (promotion ?? ''), clockAfter });
  }

  resign(): void {
    this.act({ t: 'resign' });
  }

  offerDraw(): void {
    this.act({ t: 'draw', action: 'offer' });
  }

  answerDraw(accept: boolean): void {
    this.act({ t: 'draw', action: accept ? 'accept' : 'decline' });
  }

  takeback(): void {}

  rematch(): void {
    const offer = this.state?.rematchOffer;
    if (offer && offer.by !== this.myColor()) this.act({ t: 'rematch', action: 'accept', room: offer.room });
    else if (!offer) this.act({ t: 'rematch', action: 'offer', room: randomId() });
  }

  claimAbandon(): void {
    this.act({ t: 'abandon' });
  }

  dispose(): void {
    window.clearInterval(this.timer);
    this.channel.leave();
    this.listeners = [];
  }
}
