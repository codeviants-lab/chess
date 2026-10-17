import { formatClock, resultText, type PlayerView, type Session, type View } from '../game/session';
import type { Color } from '../game/room';
import { Board } from './board';
import { h } from './dom';
import { soundEnabled, toggleSound } from './sound';

function playerBar(): { el: HTMLElement; update: (p: PlayerView, color: Color) => void } {
  const dot = h('span', { class: 'dot', 'aria-hidden': 'true' });
  const name = h('span', { class: 'pname' });
  const clock = h('span', { class: 'clock' });
  const el = h('div', { class: 'player' }, dot, name, clock);
  return {
    el,
    update(p, color) {
      dot.dataset.online = p.online === null ? 'na' : String(p.online);
      dot.title = p.online === null ? '' : p.online ? 'Çevrimiçi' : 'Bağlı değil';
      name.textContent = p.name;
      el.dataset.color = color;
      clock.hidden = p.clockMs === null;
      clock.textContent = p.clockMs === null ? '' : formatClock(p.clockMs);
      clock.classList.toggle('running', p.running);
      clock.classList.toggle('low', p.clockMs !== null && p.clockMs < 20_000);
    },
  };
}

export function renderGame(root: HTMLElement, session: Session, navigate: (hash: string) => void): () => void {
  let flipped = false;
  const board = new Board((from, to, promotion) => session.move(from, to, promotion));
  const top = playerBar();
  const bottom = playerBar();
  const status = h('div', { class: 'status', role: 'status' });
  const moves = h('ol', { class: 'moves' });
  const share = h('div', { class: 'share' });

  const btn = (label: string, title: string, onclick: () => void, cls = '') =>
    h('button', { class: `tool ${cls}`, title, 'aria-label': title, onclick }, label);
  const flipBtn = btn('⇅', 'Tahtayı çevir', () => {
    flipped = !flipped;
    update();
  });
  const penBtn = btn('✎', 'Ok çizme modu', () => {
    board.drawMode = !board.drawMode;
    penBtn.setAttribute('aria-pressed', String(board.drawMode));
  });
  penBtn.setAttribute('aria-pressed', 'false');
  const soundBtn = btn(soundEnabled() ? '🔊' : '🔈', 'Ses', () => {
    soundBtn.textContent = toggleSound() ? '🔊' : '🔈';
  });
  const takebackBtn = btn('↶', 'Geri al', () => session.takeback());
  const drawBtn = btn('½', 'Beraberlik teklif et', () => session.offerDraw());
  const resignBtn = btn('⚑', 'Teslim ol', () => {
    if (confirm('Teslim olmak istediğine emin misin?')) session.resign();
  });
  const homeBtn = btn('⌂', 'Ana sayfa', () => navigate('#/'));
  const tools = h('div', { class: 'tools' }, homeBtn, flipBtn, penBtn, soundBtn, takebackBtn, drawBtn, resignBtn);

  root.replaceChildren(
    h('main', { class: 'game' },
      h('div', { class: 'board-col' }, top.el, board.element, bottom.el),
      h('aside', { class: 'side' }, status, share, tools, moves),
    ),
  );

  let shareFor: string | null = null;
  function renderShare(url: string | null) {
    if (url === shareFor) return;
    shareFor = url;
    if (!url) {
      share.replaceChildren();
      return;
    }
    const text = `Satranç oynayalım mı? ${url}`;
    const copy = h('button', { class: 'secondary', onclick: async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = 'Kopyalandı ✓';
      } catch {
        prompt('Linki kopyala:', url);
      }
    } }, 'Linki kopyala');
    share.replaceChildren(
      h('input', { class: 'link', readonly: true, value: url, onfocus: (e: Event) => (e.target as HTMLInputElement).select() }),
      h('div', { class: 'row' },
        h('a', { class: 'primary whatsapp', href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener' }, 'WhatsApp’ta gönder'),
        copy,
        'share' in navigator
          ? h('button', { class: 'secondary', onclick: () => void navigator.share({ title: 'Satranç', text, url }).catch(() => {}) }, 'Paylaş…')
          : null,
      ),
    );
  }

  function renderStatus(v: View) {
    const parts: (Node | string)[] = [];
    if (v.result) {
      const t = resultText(v.result, v.myColor);
      parts.push(h('strong', { class: 'result' }, t.title), h('span', { class: 'detail' }, t.detail));
      if (session.kind === 'bot') {
        parts.push(h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => session.rematch() }, 'Tekrar oyna (renk değişir)')));
      } else if (v.myColor) {
        const label = v.rematch === 'mine' ? 'Rövanş teklif edildi…' : v.rematch === 'theirs' ? 'Rövanşı kabul et' : 'Rövanş teklif et';
        parts.push(h('div', { class: 'row' },
          h('button', { class: 'primary', disabled: v.rematch === 'mine', onclick: () => session.rematch() }, label),
          h('button', { class: 'secondary', onclick: () => navigate('#/') }, 'Ana sayfa'),
        ));
      }
    } else if (v.drawOffer === 'theirs') {
      parts.push(h('span', {}, 'Rakip beraberlik teklif ediyor.'), h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => session.answerDraw(true) }, 'Kabul'),
        h('button', { class: 'secondary', onclick: () => session.answerDraw(false) }, 'Reddet'),
      ));
    } else {
      if (v.info) parts.push(h('span', {}, v.info));
      if (v.drawOffer === 'mine') parts.push(h('span', {}, 'Beraberlik teklifin bekliyor.'));
      if (v.canClaimAbandon)
        parts.push(h('button', { class: 'primary', onclick: () => session.claimAbandon() }, 'Rakip ayrıldı — galibiyeti al'));
      if (!parts.length && v.status === 'playing')
        parts.push(h('span', {}, v.movable ? 'Sıra sende' : v.myColor ? 'Rakibin sırası' : ''));
    }
    status.replaceChildren(...parts);
  }

  let lastStatusKey = '';
  let lastMovesKey = '';
  function update() {
    const v = session.view();
    const orientation: Color = (v.myColor ?? 'w') === 'w' ? (flipped ? 'b' : 'w') : flipped ? 'w' : 'b';
    board.set({ fen: v.fen, orientation, lastMove: v.lastMove, check: v.check, movable: v.movable, dests: v.dests });
    const topColor: Color = orientation === 'w' ? 'b' : 'w';
    top.update(topColor === 'w' ? v.white : v.black, topColor);
    bottom.update(topColor === 'w' ? v.black : v.white, topColor === 'w' ? 'b' : 'w');

    const statusKey = JSON.stringify([v.result, v.drawOffer, v.info, v.canClaimAbandon, v.rematch, v.status, Boolean(v.movable)]);
    if (statusKey !== lastStatusKey) {
      lastStatusKey = statusKey;
      renderStatus(v);
    }
    renderShare(v.shareUrl);

    const playing = v.status === 'playing' && v.myColor !== null;
    takebackBtn.hidden = session.kind !== 'bot';
    takebackBtn.disabled = !v.canTakeback;
    drawBtn.hidden = session.kind === 'bot';
    drawBtn.disabled = !playing || v.drawOffer !== null;
    resignBtn.disabled = !playing;

    const movesKey = v.sans.join(' ');
    if (movesKey !== lastMovesKey) {
      lastMovesKey = movesKey;
      const items: HTMLElement[] = [];
      for (let i = 0; i < v.sans.length; i += 2) {
        items.push(h('li', {}, h('span', {}, v.sans[i]!), h('span', {}, v.sans[i + 1] ?? '')));
      }
      moves.replaceChildren(...items);
      moves.scrollTop = moves.scrollHeight;
      moves.scrollLeft = moves.scrollWidth;
    }
  }

  session.subscribe(update);
  update();
  return () => session.dispose();
}
