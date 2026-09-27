// Section-specific text effects. Techniques adapted from React Bits (ScrollReveal, VariableProximity,
// Shuffle, TextType, CountUp, TrueFocus, TextPressure, ScrambledText; MIT + Commons Clause) and rebuilt
// for vanilla TS + GSAP. Every visual copy is aria-hidden with a stable sr-only copy of the exact text,
// resting states always equal the real text, and pointer effects are enhancements with touch fallbacks.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitChars, lockLines, glyphBoxes, srCopy, labelOf, clamp01, lerp, easeInOut, easeOut3, axes, fine, SPACE_RE, isSpace } from './split';

// How the reveal system (main.ts) drives an effect that belongs to a revealed block:
// park = the block is hidden, ahead of the reader (set the starting frame); play = it is arriving;
// finish = it was shown without an entrance (on screen at load, or passed unseen): show the final text.
export interface Fx { park?(): void; play?(delay: number): void; finish?(): void }

type Pt = { x: number; y: number } | null;
let pointer: Pt = null;
const pointerSubs = new Set<() => void>();
let pointerOn = false;
function watchPointer(fn: () => void) {
  pointerSubs.add(fn);
  if (pointerOn) return;
  pointerOn = true;
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; pointer = { x: e.clientX, y: e.clientY }; pointerSubs.forEach((f) => f()); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; pointerSubs.forEach((f) => f()); });
}
const onFonts = (fn: () => void) => { if (document.fonts?.status === 'loaded') fn(); else document.fonts?.ready.then(fn); };
const resizers = new Set<() => void>();
let rzT = 0, rzW = innerWidth;
addEventListener('resize', () => { clearTimeout(rzT); rzT = window.setTimeout(() => { if (innerWidth === rzW) return; rzW = innerWidth; resizers.forEach((f) => f()); }, 300); });

// ---------------------------------------------------------------- definition claim: ScrollReveal
// words come into focus as the claim is read, scrubbed by scroll (touch and desktop alike)
export function scrollReveal(p: HTMLElement) {
  p.classList.add('fx');
  const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walk.nextNode()) nodes.push(walk.currentNode as Text);
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    for (const part of n.data.split(SPACE_RE)) {
      if (!part) continue;
      if (isSpace(part)) { frag.append(part); continue; }
      const s = document.createElement('span');
      s.className = 'sw';
      s.textContent = part;
      frag.append(s);
    }
    n.replaceWith(frag);
  }
  const words = [...p.querySelectorAll<HTMLElement>('.sw')];
  gsap.fromTo(words, { opacity: 0.16, filter: 'blur(4px)', yPercent: 14 }, {
    opacity: 1, filter: 'blur(0px)', yPercent: 0, ease: 'none', stagger: 0.12,
    scrollTrigger: { trigger: p, start: 'top 88%', end: 'bottom 60%', scrub: true },
    onComplete: () => gsap.set(words, { clearProps: 'filter' }),
  });
}

// ---------------------------------------------------------------- definition key line: autonomy wave + VariableProximity
// "without a human constantly guiding it." starts narrow and light (wdth 75, wght 300) and gains its
// full width and weight letter by letter as it rises into view. Once resting, letters near a fine
// pointer push to wdth 125 / wght 900; everyone gets one pulse across the line when it settles.
export function autonomyWave(em: HTMLElement) {
  em.classList.add('fx');
  const { wrap, chars } = splitChars(em, 'kc');
  const n = chars.length;
  const cs = getComputedStyle(em);
  const rest = { w: parseFloat(cs.fontStretch) || 118, g: parseFloat(cs.fontWeight) || 800 };
  const from = { w: 75, g: 300 };
  const push = { w: 125, g: 900 };
  const prox = new Float32Array(n);
  const cx = new Float32Array(n), cy = new Float32Array(n);
  const pulse = { pos: -99 };
  let p = 0, raf = 0, lastP = 0, pulsed = 0, fs = parseFloat(cs.fontSize);
  const measure = () => {
    chars.forEach((c) => c.style.removeProperty('font-variation-settings'));
    lockLines(wrap);
    const base = em.getBoundingClientRect();
    chars.forEach((c, i) => { const r = c.getBoundingClientRect(); cx[i] = r.left - base.left + r.width / 2; cy[i] = r.top - base.top + r.height / 2; });
    fs = parseFloat(getComputedStyle(em).fontSize);
    render();
  };
  const render = () => {
    for (let i = 0; i < n; i++) {
      const e = easeInOut(clamp01(p * 1.6 - (i / Math.max(1, n - 1)) * 0.6));
      const extra = Math.max(prox[i], 0.8 * Math.exp(-(((i - pulse.pos) / 2.4) ** 2))) * e;
      if (e >= 1 && extra < 0.003) { chars[i].style.removeProperty('font-variation-settings'); continue; }
      chars[i].style.fontVariationSettings = axes(lerp(from.w, rest.w, e) + (push.w - rest.w) * extra, lerp(from.g, rest.g, e) + (push.g - rest.g) * extra);
    }
  };
  const tick = () => {
    raf = 0;
    const r = em.getBoundingClientRect();
    // rest is already 118/800, so the push to 125/900 reads through its reach rather than its depth
    const R = fs * 1.6;
    let live = false;
    for (let i = 0; i < n; i++) {
      let t = 0;
      if (pointer && p >= 1) {
        const d = Math.hypot(pointer.x - (r.left + cx[i]), (pointer.y - (r.top + cy[i])) * 1.3);
        t = Math.pow(clamp01(1 - d / R), 1.1);
      }
      prox[i] += (t - prox[i]) * 0.22;
      if (Math.abs(t - prox[i]) > 0.003 || prox[i] > 0.003) live = true;
    }
    render();
    if (live) raf = requestAnimationFrame(tick);
  };
  if (fine()) watchPointer(() => { if (!raf) raf = requestAnimationFrame(tick); });
  ScrollTrigger.create({
    trigger: em, start: 'top 92%', end: 'top 46%', scrub: true,
    onUpdate: (st) => {
      p = st.progress;
      if (p >= 1 && lastP < 0.98 && performance.now() - pulsed > 4000) {
        pulsed = performance.now();
        gsap.fromTo(pulse, { pos: -4 }, { pos: n + 4, duration: 1.25, ease: 'power1.inOut', onUpdate: render, onComplete: () => { pulse.pos = -99; render(); } });
      }
      lastP = p;
      render();
    },
  });
  onFonts(measure);
  resizers.add(measure);
}

// ---------------------------------------------------------------- field names: Shuffle, driven by the particle morph
// The incoming name is laid over its own (hidden) text at each letter's real, kerned position. Letters
// rise through a mask left to right as the object forms, each first showing the outgoing field's letter
// in that slot, then a random one, then its own. At rest the overlay is removed and the plain text shows.
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = LOWER.toUpperCase();
interface Roll { h: HTMLElement; text: HTMLElement; name: string; over: HTMLElement | null; cells: { el: HTMLElement; g: { h: number }; a: string; b: string; c: string; now: string }[] }
export function fieldRoll(names: HTMLElement[]) {
  const rolls: Roll[] = names.map((h) => {
    const name = labelOf(h);
    h.classList.add('fx');
    h.textContent = '';
    const text = document.createElement('span');
    text.className = 'fr-t';
    text.setAttribute('aria-hidden', 'true');
    text.textContent = name;
    h.append(text);
    srCopy(h, name);
    return { h, text, name, over: null, cells: [] };
  });
  let cur = -1;
  const clear = (r: Roll) => { r.over?.remove(); r.over = null; r.cells = []; r.h.classList.remove('is-rolling'); };
  const build = (r: Roll, prev: string, seed: number) => {
    clear(r);
    const over = document.createElement('span');
    over.className = 'fr-o';
    over.setAttribute('aria-hidden', 'true');
    r.h.append(over);
    const boxes = glyphBoxes(r.text, r.h);
    const chars = [...r.name.replace(/\s/g, '')];
    r.cells = boxes.map((g, i) => {
      const el = document.createElement('span');
      el.className = 'fr-c';
      Object.assign(el.style, { left: `${g.x}px`, top: `${g.y}px`, height: `${g.h}px`, lineHeight: `${g.h}px` });
      const pool = chars[i] === chars[i].toUpperCase() ? UPPER : LOWER;
      const rnd = pool[(i * 7 + seed * 13 + 5) % pool.length];
      const a = prev ? ([...prev.replace(/\s/g, '')][i] ?? rnd) : pool[(i * 11 + seed * 3) % pool.length];
      over.append(el);
      return { el, g, a, b: rnd, c: g.ch, now: '' };
    });
    r.over = over;
    r.h.classList.add('is-rolling');
  };
  return {
    // active slide index into `names` (-1 = none), where the previous name came from, roll progress 0..1
    set(active: number, from: number, p: number) {
      if (active !== cur) {
        if (cur >= 0 && rolls[cur]) clear(rolls[cur]);
        cur = active;
        if (active >= 0 && rolls[active] && p < 1) build(rolls[active], from >= 0 ? rolls[from]?.name ?? '' : '', active);
      }
      const r = rolls[active];
      if (!r) return;
      if (p >= 1) { if (r.over) clear(r); return; }
      if (!r.over) build(r, from >= 0 ? rolls[from]?.name ?? '' : '', active);
      const n = r.cells.length;
      r.cells.forEach((c, i) => {
        const t = clamp01(p * 1.55 - (i / Math.max(1, n - 1)) * 0.55);
        const ch = t < 0.34 ? c.a : t < 0.62 ? c.b : c.c;
        if (ch !== c.now) { c.el.textContent = ch; c.now = ch; }
        const y = (1 - easeOut3(clamp01(t / 0.8))) * (c.g.h * 1.08);
        const pad = c.g.h * 0.08;
        c.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        c.el.style.clipPath = `inset(${(-y - pad).toFixed(1)}px -.3em ${(y - pad).toFixed(1)}px -.3em)`;
      });
    },
    reset() { rolls.forEach(clear); cur = -1; },
  };
}

// ---------------------------------------------------------------- HAL: TextType
// All letters are laid out from the start (nothing reflows); they appear one by one at about 45 ms a
// letter with a human, uneven rhythm, a hesitation before the ellipsis, and a red block caret that blinks
// three times and goes. Passing the line without waiting shows it whole (skip).
export function typeLine(p: HTMLElement) {
  p.classList.add('fx');
  const { wrap, chars } = splitChars(p, 'tc');
  wrap.classList.add('tt');
  chars.forEach((c) => c.classList.add('is-off'));
  let state: 'idle' | 'armed' | 'typing' | 'done' = 'idle';
  let done: (() => void)[] = [];
  let timer = 0;
  // the notes under the line are released as soon as the last letter is down; the caret blinks on over them
  const release = () => {
    if (state === 'done') return;
    state = 'done';
    wrap.classList.add('is-typed');
    done.forEach((f) => f()); done = [];
  };
  const finish = () => {
    clearTimeout(timer);
    chars.forEach((c) => c.classList.remove('is-off', 'is-cur'));
    wrap.classList.remove('is-armed', 'is-blink');
    wrap.classList.add('is-done');
    release();
  };
  return {
    get done() { return state === 'done'; },
    whenDone(f: () => void) { if (state === 'done') f(); else done.push(f); },
    arm() { if (state === 'idle') { state = 'armed'; wrap.classList.add('is-armed'); } },
    play() {
      if (state === 'typing' || state === 'done') return;
      state = 'typing';
      wrap.classList.add('is-armed');
      let i = 0;
      const step = () => {
        if (i > 0) chars[i - 1].classList.remove('is-cur');
        if (i >= chars.length) { chars[chars.length - 1].classList.add('is-cur'); wrap.classList.add('is-blink'); release(); timer = window.setTimeout(finish, 1560); return; }
        const c = chars[i];
        c.classList.remove('is-off');
        c.classList.add('is-cur');
        wrap.classList.remove('is-armed');
        const next = chars[i + 1]?.textContent || '';
        const wordEnd = c.parentElement?.lastElementChild === c;
        i++;
        timer = window.setTimeout(step, next === '…' ? 560 : c.textContent === '…' ? 320 : 28 + Math.random() * 30 + (wordEnd ? 42 : 0));
      };
      timer = window.setTimeout(step, 240);
    },
    skip: finish,
  };
}

// ---------------------------------------------------------------- stats and tally: CountUp with meaning
// Shares of the story's pace count down from 100 (the story's own pace) to the measured value; a range
// of years starts at its first year and the far end slips out; plain counts rise from zero. The visible
// copy always holds the final text unless the block is parked ahead of the reader; the sr-only copy is
// the final text throughout.
export function countUp(b: HTMLElement, dur = 1.9): Fx {
  const label = labelOf(b);
  const nums = [...label.matchAll(/\d+/g)].map((m) => +m[0]);
  if (!nums.length) return {};
  b.classList.add('fx');
  const years = nums.every((v) => v >= 1900 && v < 2100);
  const from = label.includes('%') ? nums.map(() => 100) : years ? nums.map(() => nums[0]) : nums.map(() => 0);
  b.textContent = '';
  const vis = document.createElement('span');
  vis.className = 'cu';
  vis.setAttribute('aria-hidden', 'true');
  vis.textContent = label;
  b.append(vis);
  srCopy(b, label);
  const show = (t: number) => { let k = 0; vis.textContent = label.replace(/\d+/g, () => String(Math.round(lerp(from[k], nums[k++], t)))); };
  let tw: gsap.core.Tween | null = null;
  let parked = false;
  const stop = () => { tw?.kill(); tw = null; };
  return {
    park() { stop(); parked = true; show(0); },
    play(delay = 0) {
      if (!parked) return;
      parked = false;
      stop();
      const o = { t: 0 };
      tw = gsap.to(o, { t: 1, duration: dur, delay, ease: 'power3.out', onUpdate: () => show(o.t), onComplete: () => { vis.textContent = label; tw = null; } });
    },
    finish() { stop(); parked = false; vis.textContent = label; },
  };
}

// ---------------------------------------------------------------- verdict: TrueFocus, scrubbed
// Corner brackets frame "Broadly right." while the second line waits out of focus, then travel down
// to it as it sharpens; at the end both lines are sharp and the frame lets go.
export function trueFocus(big: HTMLElement) {
  const lines = [...big.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.classList.contains('sr-only'));
  if (lines.length < 2) return;
  const frame = document.createElement('span');
  frame.className = 'tf';
  frame.setAttribute('aria-hidden', 'true');
  frame.innerHTML = '<i></i><i></i><i></i><i></i>';
  big.append(frame);
  big.classList.add('has-tf');
  let boxes: { x: number; y: number; w: number; h: number }[] = [];
  const measure = () => {
    boxes = lines.slice(0, 2).map((ln) => {
      const parts = [...ln.querySelectorAll<HTMLElement>('.rw')];
      const els = parts.length ? parts : [ln];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const e of els) {
        let x = 0, y = 0;
        for (let n: HTMLElement | null = e; n && n !== big; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop; }
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + e.offsetWidth); y1 = Math.max(y1, y + e.offsetHeight);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
  };
  let p = 0;
  const render = () => {
    if (!boxes.length) measure();
    const [A, B] = boxes;
    const m = easeInOut(clamp01((p - 0.42) / 0.3));
    const z = clamp01((p - 0.84) / 0.14);
    const pad = parseFloat(getComputedStyle(big).fontSize) * 0.09;
    const x = lerp(A.x, B.x, m) - pad, y = lerp(A.y, B.y, m) - pad * 0.6;
    const w = lerp(A.w, B.w, m) + pad * 2, h = lerp(A.h, B.h, m) + pad * 1.2;
    Object.assign(frame.style, { transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`, width: `${w.toFixed(1)}px`, height: `${h.toFixed(1)}px`, opacity: String(clamp01(p / 0.14) * (1 - z)) });
    const bA = 4.5 * Math.sin(m * Math.PI / 2) * (1 - z), bB = 7 * (1 - m);
    lines[0].style.filter = bA > 0.05 ? `blur(${bA.toFixed(2)}px)` : '';
    lines[0].style.opacity = String(lerp(1, 0.55, m * (1 - z)));
    lines[1].style.filter = bB > 0.05 ? `blur(${bB.toFixed(2)}px)` : '';
    lines[1].style.opacity = String(lerp(0.4, 1, m));
  };
  ScrollTrigger.create({ trigger: big, start: 'top 84%', end: 'center 40%', scrub: true, onUpdate: (st) => { p = st.progress; render(); }, onRefresh: (st) => { measure(); p = st.progress; render(); } });
  onFonts(() => { measure(); render(); });
}

// ---------------------------------------------------------------- footer name: TextPressure
// Letters under a fine pointer are pressed: narrower (wdth 125 -> 80) and heavier (wght -> 900), so the
// name is never wider than at rest. Touch: a tap sends a ripple from the tap point. Everyone sees one
// pressure wave run through the name when it arrives.
export function textPressure(el: HTMLElement) {
  el.classList.add('fx');
  const { wrap, chars } = splitChars(el, 'pc');
  const n = chars.length;
  const cs = getComputedStyle(el);
  const rest = { w: parseFloat(cs.fontStretch) || 125, g: parseFloat(cs.fontWeight) || 820 };
  const cur = new Float32Array(n), tgt = new Float32Array(n);
  const cx = new Float32Array(n), cy = new Float32Array(n);
  const wave = { pos: -99 };
  const ripple = { t: 1, i0: 0 };
  let raf = 0, fs = parseFloat(cs.fontSize);
  const measure = () => {
    chars.forEach((c) => c.style.removeProperty('font-variation-settings'));
    lockLines(wrap);
    const base = el.getBoundingClientRect();
    chars.forEach((c, i) => { const r = c.getBoundingClientRect(); cx[i] = r.left - base.left + r.width / 2; cy[i] = r.top - base.top + r.height / 2; });
    fs = parseFloat(getComputedStyle(el).fontSize);
  };
  const tick = () => {
    raf = 0;
    const r = el.getBoundingClientRect();
    const R = fs * 1.6;
    let live = false;
    for (let i = 0; i < n; i++) {
      let t = 0.85 * Math.exp(-(((i - wave.pos) / 1.7) ** 2));
      if (ripple.t < 1) t = Math.max(t, (1 - ripple.t) * Math.exp(-(((Math.abs(i - ripple.i0) - ripple.t * (n * 0.9)) / 1.4) ** 2)));
      if (pointer) {
        const d = Math.hypot(pointer.x - (r.left + cx[i]), (pointer.y - (r.top + cy[i])) * 0.8);
        t = Math.max(t, Math.pow(clamp01(1 - d / R), 1.6));
      }
      tgt[i] = t;
      cur[i] += (t - cur[i]) * 0.18;
      if (cur[i] < 0.003 && t < 0.003) { cur[i] = 0; chars[i].style.removeProperty('font-variation-settings'); continue; }
      live = true;
      chars[i].style.fontVariationSettings = axes(rest.w - 45 * cur[i], rest.g + (900 - rest.g) * cur[i]);
    }
    if (live || wave.pos > -99 || ripple.t < 1) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  if (fine()) watchPointer(kick);
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const base = el.getBoundingClientRect();
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(cx[i] - (e.clientX - base.left)) < Math.abs(cx[best] - (e.clientX - base.left))) best = i;
    ripple.i0 = best;
    gsap.fromTo(ripple, { t: 0 }, { t: 1, duration: 1.2, ease: 'power1.out', onUpdate: kick });
  });
  onFonts(measure);
  resizers.add(measure);
  let waved = false;
  return {
    play() {
      if (waved) return;
      waved = true;
      gsap.fromTo(wave, { pos: -3 }, { pos: n + 3, duration: 1.5, delay: 0.5, ease: 'power1.inOut', onUpdate: kick, onComplete: () => { wave.pos = -99; kick(); } });
    },
  } satisfies Fx;
}

// ---------------------------------------------------------------- neuralese: ScrambledText as a shrinking reading lens
// As you scroll, whole words turn into numbers of the same length (so nothing reflows). A fine pointer
// can still read the words under it, but the lens shrinks to nothing as the trace goes fully numeric.
export function neuralese(trace: HTMLElement) {
  const lines = [...trace.querySelectorAll<HTMLElement>('.trace__line')];
  let seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const token = (len: number, k: number) => {
    seed = 1 + ((len * 7919 + k * 104729) % 2147483646);
    const d = (m: number) => Array.from({ length: Math.max(0, m) }, () => Math.floor(rand() * 10)).join('');
    if (len <= 2) return d(len);
    if (len === 3) return rand() < 0.5 ? `.${d(2)}` : `${d(1)}.${d(1)}`;
    const r = rand();
    if (len >= 7 && r < 0.3) return `-${d(1)}.${d(len - 6)}e-${d(1)}`;
    if (len >= 6 && r < 0.55) return `${d(1)}.${d(len - 4)}e${d(1)}`;
    if (r < 0.8) return `0.${d(len - 2)}`;
    return `-${d(1)}.${d(len - 3)}`;
  };
  const rows = lines.map((el, li) => {
    const text = el.dataset.text || el.textContent || '';
    el.textContent = '';
    const words: { el: HTMLElement; w: string; rank: number; num: boolean; tok: number }[] = [];
    text.split(SPACE_RE).forEach((part) => {
      if (!part) return;
      if (isSpace(part)) { el.append(' '); return; }
      const s = document.createElement('span');
      s.className = 'tw';
      s.textContent = part;
      el.append(s);
      words.push({ el: s, w: part, rank: 0, num: false, tok: -1 });
    });
    const order = words.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((wi, r) => (words[wi].rank = (r + 0.5) / words.length));
    return { li, words };
  });
  let prog = 0;
  let raf = 0;
  const render = () => {
    raf = 0;
    const q = prog * 1.15;
    const tick = Math.floor(prog * 28);
    const R = 150 * (1 - clamp01(prog * 1.3));
    for (const { li, words } of rows) {
      const local = clamp01(q * 1.3 - li * 0.15);
      for (const w of words) {
        let num = w.rank < local;
        if (num && pointer && R > 4) {
          const r = w.el.getBoundingClientRect();
          if (Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2)) < R) num = false;
        }
        if (num !== w.num || (num && w.tok !== tick)) {
          w.num = num;
          w.tok = tick;
          w.el.textContent = num ? token([...w.w].length, tick + w.rank * 1000) : w.w;
          w.el.classList.toggle('n', num);
        }
      }
    }
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(render); };
  if (fine()) watchPointer(() => { const r = trace.getBoundingClientRect(); if (pointer && pointer.y > r.top - 200 && pointer.y < r.bottom + 200) kick(); else if (!pointer) kick(); });
  ScrollTrigger.create({ trigger: trace, start: 'top 70%', end: 'bottom 20%', scrub: true, onUpdate: (st) => { prog = st.progress; kick(); } });
}
