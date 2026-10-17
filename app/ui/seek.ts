import { myPairing } from '../game/match';
import { newRoom } from '../game/room';
import { saveRoom } from '../game/online-session';
import { TC_LABEL, TIME_CONTROLS } from '../game/session';
import { me } from '../lib/store';
import { transport } from '../net';
import { h } from './dom';

export function renderSeek(root: HTMLElement, tcKey: string, navigate: (hash: string) => void): () => void {
  const tc = tcKey in TIME_CONTROLS ? tcKey : '10+5';
  const self = { pid: me().pid, name: me().name, since: Date.now() };
  const lobby = transport.join(`lobby:${tc}`, self);
  const count = h('p', { class: 'hint' }, 'Bağlanılıyor…');
  let done = false;

  lobby.onMembers((members) => {
    if (done) return;
    const pair = myPairing(members, self.pid);
    if (pair) {
      done = true;
      const seat = (m: { pid: string; name: string }) => ({ pid: m.pid, name: m.name });
      saveRoom(newRoom(pair.room, TIME_CONTROLS[tc] ?? null, { w: seat(pair.seats.w), b: seat(pair.seats.b) }));
      navigate(`#/g/${pair.room}`);
      return;
    }
    const others = members.length - 1;
    count.textContent = others > 0 ? `Sırada ${others} kişi daha var, eşleştiriliyor…` : 'Şu an başka bekleyen yok. Bekleyebilir ya da arkadaşına link atabilirsin.';
  });

  root.replaceChildren(
    h('main', { class: 'seek' },
      h('div', { class: 'spinner', 'aria-hidden': 'true' }),
      h('h2', {}, `Rakip aranıyor · ${TC_LABEL[tc]}`),
      count,
      h('button', { class: 'secondary', onclick: () => navigate('#/') }, 'Vazgeç'),
    ),
  );
  return () => lobby.leave();
}
