import type { Channel, Member, Transport } from './transport';

// Local development transport: tabs of the same browser talk over BroadcastChannel. Presence is emulated with
// heartbeats. Lets the online modes be developed and tested without a Supabase project.

const HEARTBEAT_MS = 1000;
const EXPIRE_MS = 3500;

type Wire =
  | { k: 'msg'; from: string; payload: unknown }
  | { k: 'here'; member: Member; reply: boolean }
  | { k: 'bye'; pid: string };

export const localTransport: Transport = {
  kind: 'local',
  join(name, self) {
    const bc = new BroadcastChannel(`chess:${name}`);
    const seen = new Map<string, { member: Member; at: number }>();
    let messageCb: (from: string, payload: unknown) => void = () => {};
    let membersCb: (members: Member[]) => void = () => {};
    let lastKey = '';

    const emitMembers = () => {
      const list = [self, ...[...seen.values()].map((s) => s.member)];
      const key = list.map((m) => m.pid).sort().join(',');
      if (key !== lastKey) {
        lastKey = key;
        membersCb(list);
      }
    };
    const post = (w: Wire) => bc.postMessage(w);

    bc.onmessage = (e: MessageEvent<Wire>) => {
      const w = e.data;
      if (w.k === 'msg') messageCb(w.from, w.payload);
      else if (w.k === 'here') {
        const known = seen.has(w.member.pid);
        seen.set(w.member.pid, { member: w.member, at: Date.now() });
        if (w.reply || !known) post({ k: 'here', member: self, reply: false });
        emitMembers();
      } else if (w.k === 'bye') {
        seen.delete(w.pid);
        emitMembers();
      }
    };
    const timer = setInterval(() => {
      post({ k: 'here', member: self, reply: false });
      const now = Date.now();
      for (const [pid, s] of seen) if (now - s.at > EXPIRE_MS) seen.delete(pid);
      emitMembers();
    }, HEARTBEAT_MS);
    const onUnload = () => post({ k: 'bye', pid: self.pid });
    addEventListener('pagehide', onUnload);

    const channel: Channel = {
      send: (payload) => post({ k: 'msg', from: self.pid, payload }),
      onMessage: (cb) => (messageCb = cb),
      onMembers: (cb) => {
        membersCb = cb;
        lastKey = '';
        emitMembers();
      },
      leave() {
        clearInterval(timer);
        removeEventListener('pagehide', onUnload);
        onUnload();
        bc.close();
      },
    };
    queueMicrotask(() => post({ k: 'here', member: self, reply: true }));
    return channel;
  },
};
