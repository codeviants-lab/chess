import type { BotLevel } from '../../core/bot/search';
import { newRoom, type Color } from '../game/room';
import { saveRoom } from '../game/online-session';
import { TC_LABEL, TIME_CONTROLS } from '../game/session';
import { load, me, randomId, save, setName } from '../lib/store';
import { transport } from '../net';
import { choice, h } from './dom';

type ColorChoice = Color | 'random';

interface Prefs {
  level: BotLevel;
  botColor: ColorChoice;
  botTc: string;
  friendColor: ColorChoice;
  friendTc: string;
  seekTc: string;
}

const DEFAULTS: Prefs = { level: 'orta', botColor: 'w', botTc: 'none', friendColor: 'random', friendTc: '10+5', seekTc: '10+5' };
const TCS = Object.keys(TIME_CONTROLS).map((k) => [k, TC_LABEL[k]!] as const);
const COLORS = [['w', 'Beyaz'], ['random', 'Rastgele'], ['b', 'Siyah']] as const;

function resolve(c: ColorChoice): Color {
  return c === 'random' ? (crypto.getRandomValues(new Uint8Array(1))[0]! % 2 ? 'w' : 'b') : c;
}

export function renderHome(root: HTMLElement, navigate: (hash: string) => void): () => void {
  const prefs: Prefs = { ...DEFAULTS, ...load<Partial<Prefs>>('prefs', {}) };
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    prefs[k] = v;
    save('prefs', prefs);
  };

  const nameInput = h('input', {
    id: 'name', type: 'text', maxlength: 24, placeholder: 'Takma adın', value: me().name, autocomplete: 'nickname',
  });
  nameInput.addEventListener('input', () => setName(nameInput.value));
  const ensureName = () => {
    if (!me().name) setName(`Misafir-${me().pid.slice(0, 4)}`);
    nameInput.value = me().name;
  };

  const startBot = () => {
    ensureName();
    navigate(`#/bot?level=${prefs.level}&color=${resolve(prefs.botColor)}&tc=${prefs.botTc}`);
  };
  const createRoom = () => {
    ensureName();
    const id = randomId();
    const color = resolve(prefs.friendColor);
    const self = { pid: me().pid, name: me().name };
    saveRoom(newRoom(id, TIME_CONTROLS[prefs.friendTc] ?? null, color === 'w' ? { w: self } : { b: self }));
    navigate(`#/g/${id}`);
  };
  const seek = () => {
    ensureName();
    navigate(`#/ara?tc=${prefs.seekTc}`);
  };

  const online = h('p', { class: 'online' });
  const site = transport.join('site', { pid: me().pid, name: me().name, since: Date.now() });
  site.onMembers((members) => {
    online.textContent = `Şu an sitede ${members.length} kişi` + (transport.kind === 'local' ? ' (yerel test modu)' : '');
  });

  root.replaceChildren(
    h('main', { class: 'home' },
      h('header', { class: 'brand' },
        h('img', { src: `${import.meta.env.BASE_URL}pieces/wN.svg`, alt: '', width: 44, height: 44 }),
        h('h1', {}, 'Satranç Kulübü'),
      ),
      online,
      h('label', { class: 'name', for: 'name' }, 'Adın', nameInput),
      h('section', { class: 'card' },
        h('h2', {}, 'Bota karşı'),
        choice('Seviye', [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']] as const, prefs.level, (v) => set('level', v)),
        choice('Renk', COLORS, prefs.botColor, (v) => set('botColor', v)),
        choice('Süre', TCS, prefs.botTc, (v) => set('botTc', v)),
        h('button', { class: 'primary', onclick: startBot }, 'Oyna'),
      ),
      h('section', { class: 'card' },
        h('h2', {}, 'Arkadaşınla'),
        h('p', { class: 'hint' }, 'Bir link oluştur, WhatsApp’tan gönder; açan kişi rakibin olur.'),
        choice('Renk', COLORS, prefs.friendColor, (v) => set('friendColor', v)),
        choice('Süre', TCS, prefs.friendTc, (v) => set('friendTc', v)),
        h('button', { class: 'primary', onclick: createRoom }, 'Davet linki oluştur'),
      ),
      h('section', { class: 'card' },
        h('h2', {}, 'Rastgele rakip'),
        h('p', { class: 'hint' }, 'Aynı süreyi seçmiş, bekleyen biriyle eşleşirsin.'),
        choice('Süre', TCS, prefs.seekTc, (v) => set('seekTc', v)),
        h('button', { class: 'primary', onclick: seek }, 'Rakip bul'),
      ),
      h('footer', {}, 'Puansız deneme sürümü · ', h('a', { href: 'https://github.com/codeviants-lab/chess' }, 'codeviants-lab')),
    ),
  );
  return () => site.leave();
}
