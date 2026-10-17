import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Channel, Member, Transport } from './transport';

// Online transport over Supabase Realtime: broadcast for messages, presence for who is in the channel.
// Only the public anon key is used; nothing is stored in the database yet (P0 is unrated and ephemeral).

export function supabaseTransport(url: string, anonKey: string): Transport {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  return {
    kind: 'supabase',
    join(name, self) {
      const ch: RealtimeChannel = client.channel(`chess:${name}`, {
        config: { broadcast: { self: false }, presence: { key: self.pid } },
      });
      let messageCb: (from: string, payload: unknown) => void = () => {};
      let membersCb: (members: Member[]) => void = () => {};
      const queue: unknown[] = [];
      let ready = false;

      const members = (): Member[] => {
        const state = ch.presenceState<Member>();
        const list = Object.values(state).flatMap((metas) => metas.slice(0, 1));
        return list.some((m) => m.pid === self.pid) ? list : [self, ...list];
      };

      ch.on('broadcast', { event: 'm' }, ({ payload }) => {
        const p = payload as { from: string; data: unknown };
        messageCb(p.from, p.data);
      });
      ch.on('presence', { event: 'sync' }, () => membersCb(members()));
      ch.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        ready = true;
        void ch.track(self);
        for (const data of queue.splice(0)) void ch.send({ type: 'broadcast', event: 'm', payload: { from: self.pid, data } });
      });

      return {
        send(data) {
          if (!ready) queue.push(data);
          else void ch.send({ type: 'broadcast', event: 'm', payload: { from: self.pid, data } });
        },
        onMessage: (cb) => (messageCb = cb),
        onMembers: (cb) => {
          membersCb = cb;
          cb(members());
        },
        leave: () => void client.removeChannel(ch),
      };
    },
  };
}
