// How two devices talk. The game logic only sees this interface; it does not know whether the messages go
// through Supabase Realtime or, in local development, between tabs of the same browser.

export interface Member {
  pid: string;
  name: string;
  /** Wall-clock ms when this member joined the channel (used to order a matchmaking queue). */
  since: number;
}

export interface Channel {
  /** Sends to everyone else in the channel (not to self). */
  send(payload: unknown): void;
  onMessage(cb: (from: string, payload: unknown) => void): void;
  /** Called with the full member list (self included) whenever it changes. */
  onMembers(cb: (members: Member[]) => void): void;
  leave(): void;
}

export interface Transport {
  /** Human-readable, shown in the UI ("çevrimiçi" / "yerel test"). */
  readonly kind: 'supabase' | 'local';
  join(name: string, self: Member): Channel;
}
