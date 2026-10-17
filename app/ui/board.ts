import type { Color } from '../game/room';

// The SVG chessboard. Moves: drag and drop or tap–tap. Drawing (like Lichess): right-drag draws an arrow,
// right-click a circle; with the pencil mode on, the same works with a finger. Shift = red, Alt = blue,
// Ctrl/Cmd = yellow, otherwise green. A normal click clears the drawing.

export type Promotion = 'q' | 'r' | 'b' | 'n';

export interface BoardState {
  fen: string;
  orientation: Color;
  lastMove: [string, string] | null;
  /** Square of a king in check. */
  check: string | null;
  /** Colour the user may move now (null: none). */
  movable: Color | null;
  /** Legal destinations per origin square for the movable colour. */
  dests: Map<string, string[]>;
}

const NS = 'http://www.w3.org/2000/svg';
const FILES = 'abcdefgh';
const SHAPE_COLORS = { green: '#15781b', red: '#882020', blue: '#003088', yellow: '#e68f00' } as const;
type ShapeColor = keyof typeof SHAPE_COLORS;

interface Shape {
  from: string;
  to: string;
  color: ShapeColor;
}

const pieceUrl = (color: string, type: string) => `${import.meta.env.BASE_URL}pieces/${color}${type.toUpperCase()}.svg`;

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Pieces by square from the placement part of a FEN, e.g. { e1: 'wK' }. */
function parsePlacement(fen: string): Map<string, string> {
  const out = new Map<string, string>();
  const rows = (fen.split(' ')[0] ?? '').split('/');
  rows.forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') file += Number(ch);
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        out.set(FILES[file]! + String(8 - i), color + ch.toUpperCase());
        file++;
      }
    }
  });
  return out;
}

export class Board {
  readonly element: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private state: BoardState | null = null;
  private key = '';
  private pieces = new Map<string, string>();
  private selected: string | null = null;
  private drag: { from: string; ghost: SVGImageElement; moved: boolean; wasSelected: boolean } | null = null;
  private shapeStart: { from: string; color: ShapeColor } | null = null;
  private shapes: Shape[] = [];
  private promotion: { from: string; to: string } | null = null;
  private hover: string | null = null;
  drawMode = false;

  constructor(private readonly onMove: (from: string, to: string, promotion?: Promotion) => void) {
    this.element = document.createElement('div');
    this.element.className = 'board';
    this.svg = el('svg', { viewBox: '0 0 8 8', role: 'img', 'aria-label': 'Satranç tahtası' });
    this.element.append(this.svg);
    this.svg.addEventListener('pointerdown', (e) => this.down(e));
    this.svg.addEventListener('pointermove', (e) => this.moveTo(e));
    this.svg.addEventListener('pointerup', (e) => this.up(e));
    this.svg.addEventListener('pointercancel', () => this.cancelDrag());
    this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  set(state: BoardState): void {
    // Screens call this on every clock tick; redraw only when something on the board changed
    // (a redraw in the middle of a drag would also drop the dragged piece).
    const key = [state.fen, state.orientation, state.movable, state.check].join('|');
    if (key === this.key) return;
    this.key = key;
    const moved = this.state?.fen !== state.fen;
    this.state = state;
    this.pieces = parsePlacement(state.fen);
    if (moved) {
      this.promotion = null;
      this.shapes = [];
    }
    if (this.selected && !state.dests.has(this.selected)) this.selected = null;
    if (!state.movable) this.selected = null;
    this.render();
  }

  clearShapes(): void {
    this.shapes = [];
    this.render();
  }

  // ---- geometry ----

  private xy(square: string): [number, number] {
    const f = FILES.indexOf(square[0]!);
    const r = Number(square[1]) - 1;
    return this.state?.orientation === 'b' ? [7 - f, r] : [f, 7 - r];
  }

  private squareAt(e: PointerEvent): string | null {
    const rect = this.svg.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    const [f, r] = this.state?.orientation === 'b' ? [7 - x, y] : [x, 7 - y];
    return FILES[f]! + String(r + 1);
  }

  private svgPoint(e: PointerEvent): [number, number] {
    const rect = this.svg.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * 8, ((e.clientY - rect.top) / rect.height) * 8];
  }

  // ---- input ----

  private shapeColor(e: PointerEvent): ShapeColor {
    if (e.ctrlKey || e.metaKey) return 'yellow';
    if (e.altKey) return 'blue';
    if (e.shiftKey) return 'red';
    return 'green';
  }

  private down(e: PointerEvent): void {
    if (!this.state) return;
    const sq = this.squareAt(e);
    if (!sq) return;
    if (this.promotion) return; // the chooser has its own handlers

    const drawing = e.button === 2 || (this.drawMode && e.button === 0);
    if (drawing) {
      e.preventDefault();
      this.shapeStart = { from: sq, color: this.shapeColor(e) };
      this.svg.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    if (this.shapes.length) this.shapes = [];

    const piece = this.pieces.get(sq);
    const own = piece !== undefined && piece[0] === this.state.movable;
    if (this.selected && this.selected !== sq && this.state.dests.get(this.selected)?.includes(sq)) {
      this.tryMove(this.selected, sq);
      return;
    }
    if (own && this.state.dests.has(sq)) {
      const wasSelected = this.selected === sq;
      this.selected = sq;
      const ghost = el('image', { href: pieceUrl(piece[0]!, piece[1]!), width: 1, height: 1, class: 'ghost' });
      this.drag = { from: sq, ghost, moved: false, wasSelected };
      this.svg.setPointerCapture(e.pointerId);
      this.render();
      this.positionGhost(e);
      return;
    }
    this.selected = null;
    this.render();
  }

  private moveTo(e: PointerEvent): void {
    if (this.drag) {
      this.drag.moved = true;
      this.positionGhost(e);
      const sq = this.squareAt(e);
      if (sq !== this.hover) {
        this.hover = sq;
        this.render();
      }
    }
  }

  private up(e: PointerEvent): void {
    const sq = this.squareAt(e);
    if (this.shapeStart) {
      const { from, color } = this.shapeStart;
      this.shapeStart = null;
      if (sq) this.toggleShape({ from, to: sq, color });
      return;
    }
    if (!this.drag) return;
    const { from, moved, wasSelected } = this.drag;
    this.drag = null;
    this.hover = null;
    if (sq && sq !== from && this.state?.dests.get(from)?.includes(sq)) {
      this.tryMove(from, sq);
      return;
    }
    // Released on the same square: a tap selects; tapping the selected piece again deselects.
    if (sq === from && !moved && wasSelected) this.selected = null;
    this.render();
  }

  private cancelDrag(): void {
    this.drag = null;
    this.shapeStart = null;
    this.hover = null;
    this.render();
  }

  private positionGhost(e: PointerEvent): void {
    if (!this.drag) return;
    const [x, y] = this.svgPoint(e);
    this.drag.ghost.setAttribute('x', String(x - 0.5));
    this.drag.ghost.setAttribute('y', String(y - 0.5));
  }

  private toggleShape(s: Shape): void {
    const i = this.shapes.findIndex((x) => x.from === s.from && x.to === s.to);
    if (i >= 0) {
      const same = this.shapes[i]!.color === s.color;
      this.shapes.splice(i, 1);
      if (!same) this.shapes.push(s);
    } else {
      this.shapes.push(s);
    }
    this.render();
  }

  private tryMove(from: string, to: string): void {
    this.selected = null;
    const piece = this.pieces.get(from);
    const lastRank = to[1] === '8' || to[1] === '1';
    if (piece?.[1] === 'P' && lastRank) {
      this.promotion = { from, to };
      this.render();
      return;
    }
    this.onMove(from, to);
  }

  // ---- drawing ----

  private render(): void {
    const s = this.state;
    this.svg.replaceChildren();
    if (!s) return;

    const lightDark = (f: number, r: number) => ((f + r) % 2 === 0 ? 'dark' : 'light');
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f]! + String(r + 1);
        const [x, y] = this.xy(sq);
        this.svg.append(el('rect', { x, y, width: 1, height: 1, class: `sq ${lightDark(f, r)}` }));
      }
    }
    const mark = (sq: string, cls: string) => {
      const [x, y] = this.xy(sq);
      this.svg.append(el('rect', { x, y, width: 1, height: 1, class: cls }));
    };
    if (s.lastMove) s.lastMove.forEach((sq) => mark(sq, 'last'));
    if (this.selected) mark(this.selected, 'selected');
    if (this.hover && this.drag && this.hover !== this.drag.from) mark(this.hover, 'hover');
    if (s.check) {
      const [x, y] = this.xy(s.check);
      this.svg.append(el('circle', { cx: x + 0.5, cy: y + 0.5, r: 0.5, class: 'check' }));
    }

    // Coordinates along the bottom and left edges.
    for (let i = 0; i < 8; i++) {
      const file = s.orientation === 'w' ? FILES[i]! : FILES[7 - i]!;
      const rank = s.orientation === 'w' ? String(8 - i) : String(i + 1);
      const fileText = el('text', { x: i + 0.96, y: 7.95, class: `coord ${i % 2 ? 'on-light' : 'on-dark'}`, 'text-anchor': 'end' });
      fileText.textContent = file;
      const rankText = el('text', { x: 0.04, y: i + 0.22, class: `coord ${i % 2 ? 'on-dark' : 'on-light'}` });
      rankText.textContent = rank;
      this.svg.append(fileText, rankText);
    }

    for (const [sq, piece] of this.pieces) {
      if (this.drag?.from === sq && this.drag.moved) continue;
      const [x, y] = this.xy(sq);
      this.svg.append(el('image', { href: pieceUrl(piece[0]!, piece[1]!), x, y, width: 1, height: 1, class: 'piece' }));
    }

    const from = this.drag?.from ?? this.selected;
    if (from) {
      for (const to of s.dests.get(from) ?? []) {
        const [x, y] = this.xy(to);
        const occupied = this.pieces.has(to);
        this.svg.append(
          occupied
            ? el('circle', { cx: x + 0.5, cy: y + 0.5, r: 0.46, class: 'dest capture' })
            : el('circle', { cx: x + 0.5, cy: y + 0.5, r: 0.16, class: 'dest' }),
        );
      }
    }

    this.renderShapes();
    if (this.drag?.moved) this.svg.append(this.drag.ghost);
    if (this.promotion) this.renderPromotion();
  }

  private renderShapes(): void {
    if (!this.shapes.length) return;
    const defs = el('defs');
    for (const [name, color] of Object.entries(SHAPE_COLORS)) {
      const marker = el('marker', { id: `arrow-${name}`, orient: 'auto', markerWidth: 4, markerHeight: 4, refX: 2.05, refY: 2 });
      marker.append(el('path', { d: 'M0,0 V4 L3,2 Z', fill: color }));
      defs.append(marker);
    }
    this.svg.append(defs);
    for (const shape of this.shapes) {
      const [x1, y1] = this.xy(shape.from).map((v) => v + 0.5) as [number, number];
      const [x2, y2] = this.xy(shape.to).map((v) => v + 0.5) as [number, number];
      const color = SHAPE_COLORS[shape.color];
      if (shape.from === shape.to) {
        this.svg.append(el('circle', { cx: x1, cy: y1, r: 0.46, fill: 'none', stroke: color, 'stroke-width': 0.0625, opacity: 0.85, class: 'shape' }));
        continue;
      }
      // Stop short of the target centre so the arrowhead lands inside the square.
      const len = Math.hypot(x2 - x1, y2 - y1);
      const k = (len - 0.3) / len;
      this.svg.append(
        el('line', {
          x1, y1, x2: x1 + (x2 - x1) * k, y2: y1 + (y2 - y1) * k,
          stroke: color, 'stroke-width': 0.16, 'stroke-linecap': 'round', opacity: 0.8,
          'marker-end': `url(#arrow-${shape.color})`, class: 'shape',
        }),
      );
    }
  }

  private renderPromotion(): void {
    const p = this.promotion!;
    const color = this.pieces.get(p.from)?.[0] ?? 'w';
    const [x, y0] = this.xy(p.to);
    const dir = y0 === 0 ? 1 : -1;
    const shade = el('rect', { x: 0, y: 0, width: 8, height: 8, class: 'promo-shade' });
    shade.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.promotion = null;
      this.render();
    });
    this.svg.append(shade);
    (['q', 'n', 'r', 'b'] as const).forEach((type, i) => {
      const y = y0 + dir * i;
      const g = el('g', { class: 'promo-choice', role: 'button', 'aria-label': type });
      g.append(el('circle', { cx: x + 0.5, cy: y + 0.5, r: 0.5, class: 'promo-bg' }));
      g.append(el('image', { href: pieceUrl(color, type), x: x + 0.05, y: y + 0.05, width: 0.9, height: 0.9 }));
      g.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.promotion = null;
        this.onMove(p.from, p.to, type);
      });
      this.svg.append(g);
    });
  }
}
