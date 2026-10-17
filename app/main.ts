import type { BotLevel } from '../core/bot/search';
import { BotSession } from './game/bot-session';
import { OnlineSession } from './game/online-session';
import type { Color } from './game/room';
import { TIME_CONTROLS } from './game/session';
import { me, setName } from './lib/store';
import { renderGame } from './ui/game-screen';
import { renderHome } from './ui/home';
import { renderSeek } from './ui/seek';
import './style.css';

// Routes (hash-based, so the static host needs no rewrite rules):
//   #/                       home
//   #/bot?level=&color=&tc=  game against the bot
//   #/g/<room>               online game (the link that is shared)
//   #/ara?tc=                random opponent search

const root = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function navigate(hash: string): void {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route(): void {
  cleanup?.();
  cleanup = null;
  window.scrollTo(0, 0);
  const [path = '', query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'bot') {
    const level = (['kolay', 'orta', 'zor'] as const).find((l) => l === params.get('level')) ?? 'orta';
    const color: Color = params.get('color') === 'b' ? 'b' : 'w';
    const tc = TIME_CONTROLS[params.get('tc') ?? 'none'] ?? null;
    cleanup = renderGame(root, new BotSession(color, level as BotLevel, tc, me().name || 'Sen'), navigate);
  } else if (parts[0] === 'g' && parts[1]) {
    if (!me().name) {
      const name = prompt('Oyunda görünecek adın:')?.trim() ?? '';
      setName(name || `Misafir-${me().pid.slice(0, 4)}`);
    }
    cleanup = renderGame(root, new OnlineSession(parts[1], me(), navigate), navigate);
  } else if (parts[0] === 'ara') {
    cleanup = renderSeek(root, params.get('tc') ?? '10+5', navigate);
  } else {
    cleanup = renderHome(root, navigate);
  }
}

addEventListener('hashchange', route);
route();
