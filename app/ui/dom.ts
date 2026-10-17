// Minimal DOM helper: h('button', { class: 'x', onclick: fn }, 'text', child)

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== false) e.append(c);
  return e;
}

/** A row of mutually exclusive choices; returns the element and a getter for the current value. */
export function choice<T extends string>(
  label: string,
  options: readonly (readonly [T, string])[],
  initial: T,
  onChange: (v: T) => void = () => {},
): HTMLElement {
  let value = initial;
  const buttons = options.map(([v, text]) =>
    h('button', { type: 'button', class: 'opt', 'aria-pressed': String(v === value), onclick: () => select(v) }, text),
  );
  function select(v: T) {
    value = v;
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i]![0] === v)));
    onChange(v);
  }
  return h('div', { class: 'choice' }, h('span', { class: 'choice-label' }, label), h('div', { class: 'opts', role: 'group' }, ...buttons));
}
