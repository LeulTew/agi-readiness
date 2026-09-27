// Section-specific text effects. Techniques adapted from React Bits (ScrollReveal, VariableProximity;
// MIT + Commons Clause) and rebuilt for vanilla TS + GSAP. Every visual copy is aria-hidden with a stable
// sr-only copy of the exact text, resting states always equal the real text, and pointer effects are
// enhancements with touch fallbacks.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitChars, lockLines, clamp01, lerp, easeInOut, axes, fine, SPACE_RE, isSpace } from './split';

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
