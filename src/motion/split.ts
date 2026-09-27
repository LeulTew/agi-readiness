// Shared splitting helpers. Visual copies are always aria-hidden and paired with one stable,
// unselectable sr-only copy of the exact text, so animated glyphs never reach assistive tech.
export const SPACE_RE = /([ \t\n\r\f]+)/;
export const isSpace = (s: string) => /^[ \t\n\r\f]+$/.test(s);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const labelOf = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();

export function srCopy(el: HTMLElement, label = labelOf(el)) {
  const sr = document.createElement('span');
  sr.className = 'sr-only sr-copy';
  sr.textContent = label;
  el.append(sr);
  return sr;
}

export interface Chars { wrap: HTMLElement; words: HTMLElement[]; chars: HTMLElement[] }
// Letters become inline spans (not inline-block), so kerning survives whenever their styles match;
// each word is kept whole. Only for short plain-text lines (no links inside).
export function splitChars(el: HTMLElement, cls = 'ch'): Chars {
  const label = labelOf(el);
  const text = el.textContent || '';
  el.textContent = '';
  const wrap = document.createElement('span');
  wrap.className = `${cls}-v`;
  wrap.setAttribute('aria-hidden', 'true');
  const words: HTMLElement[] = [];
  const chars: HTMLElement[] = [];
  for (const part of text.trim().split(SPACE_RE)) {
    if (!part) continue;
    if (isSpace(part)) { wrap.append(' '); continue; }
    const w = document.createElement('span');
    w.className = `${cls}-w`;
    for (const c of part) {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = c;
      w.append(s);
      chars.push(s);
    }
    wrap.append(w);
    words.push(w);
  }
  el.append(wrap);
  srCopy(el, label);
  return { wrap, words, chars };
}

// Freezes the current line breaks (one nowrap block per rendered line), so glyphs can change width
// without words jumping between lines. Measure only while every glyph is at its resting style.
export function lockLines(wrap: HTMLElement) {
  unlockLines(wrap);
  const words = [...wrap.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
  if (!words.length) return;
  const rects = words.map((w) => w.getBoundingClientRect());
  const tol = rects[0].height * 0.5;
  const groups: HTMLElement[][] = [];
  let last = -Infinity;
  words.forEach((w, i) => {
    if (rects[i].top - last > tol) { groups.push([]); last = rects[i].top; }
    groups[groups.length - 1].push(w);
  });
  for (const g of groups) {
    const ln = document.createElement('span');
    ln.className = 'ln';
    g[0].before(ln);
    const end = g[g.length - 1];
    let n: Node | null = g[0];
    while (n) { const next: Node | null = n.nextSibling; ln.append(n); if (n === end) break; n = next; }
  }
}
export function unlockLines(wrap: HTMLElement) {
  wrap.querySelectorAll(':scope > .ln').forEach((ln) => ln.replaceWith(...ln.childNodes));
}

// Rendered box of every character of an element's text, relative to `to` (kerning and letter-spacing
// included), for overlays that must sit exactly on top of the real text.
export interface Glyph { ch: string; x: number; y: number; w: number; h: number }
export function glyphBoxes(el: Element, to: Element): Glyph[] {
  const base = to.getBoundingClientRect();
  const out: Glyph[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walk.nextNode()) {
    const n = walk.currentNode as Text;
    if (n.parentElement?.closest('.sr-only')) continue;
    let i = 0;
    for (const ch of n.data) {
      const len = ch.length;
      if (!isSpace(ch) && ch !== '\u00a0') {
        range.setStart(n, i); range.setEnd(n, i + len);
        const r = range.getClientRects()[0];
        if (r) out.push({ ch, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
      }
      i += len;
    }
  }
  return out;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
// Mona Sans only has wdth 75–125 and wght 200–900; every axis value is clamped to that range and snapped to a
// small grid (wdth 2, wght 20), so animated letters reuse a few font instances instead of creating one per frame
export const axes = (w: number, g: number) => `'wdth' ${Math.max(75, Math.min(125, Math.round(w / 2) * 2))}, 'wght' ${Math.max(200, Math.min(900, Math.round(g / 20) * 20))}`;
export const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
