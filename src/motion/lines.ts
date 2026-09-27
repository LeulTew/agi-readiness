// Body copy rises line by line behind a mask, like type being set. Words are wrapped only while they
// move and are unwrapped afterwards; existing nodes (links, citations, <em>, <strong>) are kept, never
// re-created, so focus, listeners and nested semantics survive. No letter split, no blur.
import { SPACE_RE, isSpace } from './split';

const BREAK_AFTER = /(?<=[-–—/])(?=[^ \t\n\r\f])/;
const MAX_CHARS = 900;
const LINE_STEP = 0.065;
const DUR = 0.9;
const SKIP = '.sr-only, .fx, .rw, [aria-hidden="true"], svg, details, button, input, textarea, select';

interface Live { words: HTMLElement[]; timer: number }
const live = new Map<HTMLElement, Live>();

const flowDisplay = (el: HTMLElement) => { const d = getComputedStyle(el).display; return d === 'block' || d === 'list-item'; };

// the block-level elements that directly hold text inside `root` (root included)
export function textLeaves(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (el: HTMLElement) => {
    if (el.matches(SKIP) || el.dataset.rw === '1') return;
    const direct = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && /\S/.test((n as Text).data));
    if (direct) {
      if (flowDisplay(el) && (el.textContent || '').length <= MAX_CHARS) out.push(el);
      return;
    }
    for (const c of el.children) if (c instanceof HTMLElement) visit(c);
  };
  visit(root);
  return out;
}

function wrapWords(leaf: HTMLElement) {
  const walk = document.createTreeWalker(leaf, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (/\S/.test((n as Text).data) && !n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes: Text[] = [];
  while (walk.nextNode()) nodes.push(walk.currentNode as Text);
  const words: HTMLElement[] = [];
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    for (const part of n.data.split(SPACE_RE)) {
      if (!part) continue;
      if (isSpace(part)) { frag.append(part); continue; }
      for (const tok of part.split(BREAK_AFTER)) {
        const o = document.createElement('span');
        o.className = 'lw';
        const i = document.createElement('span');
        i.className = 'lwi';
        i.textContent = tok;
        o.append(i);
        frag.append(o);
        words.push(o);
      }
    }
    n.replaceWith(frag);
  }
  return words;
}

export function stopLines(leaf: HTMLElement) {
  const l = live.get(leaf);
  if (!l) return;
  clearTimeout(l.timer);
  live.delete(leaf);
  for (const w of l.words) if (w.isConnected) w.replaceWith(...[...(w.firstChild?.childNodes || [])]);
  leaf.classList.remove('lw-on', 'lw-go');
  leaf.style.removeProperty('--d0');
  leaf.normalize();
}
export function stopLinesIn(root: HTMLElement) {
  for (const leaf of [...live.keys()]) if (root.contains(leaf)) stopLines(leaf);
}

// leaves are processed as a batch: all wraps (writes), then one layout read, then the start
export function riseLines(batch: { leaf: HTMLElement; delay: number }[]) {
  const jobs = batch.map(({ leaf, delay }) => {
    stopLines(leaf);
    leaf.classList.add('lw-on');
    return { leaf, delay, words: wrapWords(leaf) };
  }).filter((j) => j.words.length);
  const lines = jobs.map(({ words }) => {
    const tops = words.map((w) => w.getBoundingClientRect());
    let line = -1;
    let last = -Infinity;
    return tops.map((r) => { if (r.top - last > r.height * 0.55) { line++; last = r.top; } return line; });
  });
  jobs.forEach(({ leaf, delay, words }, k) => {
    words.forEach((w, i) => w.style.setProperty('--ld', String(Math.min(lines[k][i], 14))));
    leaf.style.setProperty('--d0', `${delay.toFixed(3)}s`);
    const n = lines[k][lines[k].length - 1] + 1;
    live.set(leaf, { words, timer: window.setTimeout(() => stopLines(leaf), (delay + Math.min(n, 15) * LINE_STEP + DUR + 0.12) * 1000) });
  });
  if (jobs.length) void jobs[0].leaf.offsetWidth;
  jobs.forEach(({ leaf }) => leaf.classList.add('lw-go'));
}
