import '@fontsource-variable/mona-sans/standard.css';
import '@fontsource-variable/geist-mono';
import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import type { AgentHandle, AgentState } from './agent';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => innerWidth < 820;
const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => [...el.querySelectorAll<T>(s)];

// ---------------------------------------------------------------- smooth scroll
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const go = (hash: string) => {
  const el = document.getElementById(hash.slice(1));
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 }); else el.scrollIntoView();
};
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a || a.hash.length < 2) return;
  if (a.hash.startsWith('#src-')) { const d = $<HTMLDetailsElement>('.sources'); if (d) d.open = true; requestAnimationFrame(() => ScrollTrigger.refresh()); }
  e.preventDefault();
  history.replaceState(null, '', a.hash);
  requestAnimationFrame(() => go(a.hash));
});
if (location.hash.startsWith('#src-')) { const d = $<HTMLDetailsElement>('.sources'); if (d) d.open = true; }

// ---------------------------------------------------------------- nav colour follows the section under it
const nav = $('[data-nav]')!;
const themed = $$('[data-theme]');
const navLinks = $$<HTMLAnchorElement>('.nav nav a');
const navIds = navLinks.map((a) => a.hash.slice(1));
const updateNav = () => {
  const y = 32;
  let theme = 'blue';
  for (const s of themed) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) { theme = s.dataset.theme!; break; } }
  nav.dataset.on = theme;
  nav.classList.toggle('is-scrolled', scrollY > 40);
  const mid = innerHeight * 0.45;
  let current = '';
  for (const id of navIds) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= mid) current = id; }
  navLinks.forEach((a) => (a.hash === `#${current}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
};

// ---------------------------------------------------------------- word-by-word reveal
function splitWords(el: HTMLElement) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walk.nextNode()) nodes.push(walk.currentNode as Text);
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    n.data.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) frag.append(part);
      else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.append(s); }
    });
    n.replaceWith(frag);
  }
  return $$('.w', el);
}
if (!reduced) {
  $$('[data-reveal]').forEach((el) => {
    const words = splitWords(el);
    gsap.to(words, { opacity: 1, ease: 'none', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 58%', scrub: 0.6 } });
  });
}

// ---------------------------------------------------------------- the agent (particles)
let agent: AgentHandle | null = null;
const pending: Partial<AgentState> = {};
const setAgent = (s: Partial<AgentState>) => { Object.assign(pending, s); agent?.set(s); };
const place = {
  hero: () => (mobile() ? { x: 0, y: 0.33, scale: 0.95 } : { x: 0.47, y: 0.1, scale: 0.92 }),
  fields: () => (mobile() ? { x: 0, y: 0.36, scale: 0.9 } : { x: 0.42, y: 0.06, scale: 1 }),
  asi: () => (mobile() ? { x: 0, y: 0.38, scale: 0.9 } : { x: 0.44, y: 0.08, scale: 1 }),
  verdict: () => (mobile() ? { x: 0.35, y: 0.55, scale: 0.46 } : { x: 0.55, y: 0.18, scale: 0.72 }),
};

// ---------------------------------------------------------------- fields: pinned specimen morph
const fieldsSec = $('#fields')!;
const slides = $$('.slide', fieldsSec);
const shapesOf = slides.map((s) => s.dataset.shape || 'agent');
const meter = $('.fields__meter span', fieldsSec);
let fieldsP = 0;
const applyFields = () => {
  const p = fieldsP * (slides.length - 1);
  const k = Math.min(slides.length - 2, Math.floor(p));
  const f = p - k;
  const mix = gsap.utils.clamp(0, 1, (f - 0.18) / 0.5);
  const active = f < 0.43 ? k : k + 1;
  slides.forEach((s, i) => s.classList.toggle('is-active', i === active));
  meter?.style.setProperty('--p', String(fieldsP));
  const state = slides[active].dataset.state;
  setAgent({ from: shapesOf[k], to: shapesOf[k + 1], mix, scatter: 0, dim: state === 'notyet' ? 0.62 : 1, ...place.fields() });
};

// ---------------------------------------------------------------- not a god: snap
const asiSec = $('#asi')!;
const lines = $$('.asi__line', asiSec);
let asiP = 0;
const applyAsi = () => {
  const i = asiP < 0.3 ? 0 : asiP < 0.64 ? 1 : 2;
  lines.forEach((l, j) => l.classList.toggle('is-active', j === i));
  const base = place.asi();
  if (i === 0) setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...base });
  else if (i === 1) setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 1, dim: 1, ...base });
  else setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...base, scale: base.scale * 0.62 });
};

if (!reduced) {
  root.classList.add('pinned-on');
  fieldsSec.classList.add('pinned');
  ScrollTrigger.create({
    trigger: fieldsSec, pin: $('.fields__pin', fieldsSec), start: 'top top', end: () => `+=${innerHeight * (slides.length - 1) * 0.85}`,
    scrub: true, onUpdate: (st) => { fieldsP = st.progress; applyFields(); },
    onToggle: (st) => { if (st.isActive) applyFields(); },
  });
  applyFields();
  asiSec.classList.add('pinned-asi');
  ScrollTrigger.create({
    trigger: asiSec, pin: $('.asi__pin', asiSec), start: 'top top', end: () => `+=${innerHeight * 2.4}`,
    scrub: true, onUpdate: (st) => { asiP = st.progress; applyAsi(); },
    onToggle: (st) => { if (st.isActive) applyAsi(); },
  });
  applyAsi();

  // reality check scrolls sideways on wide screens
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1081px)', () => {
    const check = $('#check')!;
    const track = $('.check__track', check)!;
    check.classList.add('h-scroll');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: $('.check__viewport', check), pin: check, start: () => `bottom-=${Math.min(innerHeight, check.offsetHeight)} top`, end: () => `+=${dist()}`, scrub: 0.8, invalidateOnRefresh: true },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); gsap.set(track, { clearProps: 'transform' }); check.classList.remove('h-scroll'); };
  });
}

// which particle state applies, by the section under the middle of the viewport
const agentSecs = $$('[data-agent]');
let lastZone = '';
const updateZone = () => {
  const mid = innerHeight * 0.5;
  let zone = 'off';
  for (const s of agentSecs) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { zone = s.dataset.agent!; break; } }
  const paperOnTop = $$('.s-paper, .foot').some((s) => { const r = s.getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight; });
  agent?.setActive(!paperOnTop);
  if (zone === lastZone && zone !== 'hero' && zone !== 'verdict') return;
  lastZone = zone;
  if (reduced && zone !== 'hero') { setAgent({ dim: 0 }); return; }
  if (zone === 'hero') setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...place.hero() });
  else if (zone === 'verdict') setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 0.42, ...place.verdict() });
  else if (zone === 'fields') applyFields();
  else if (zone === 'asi') applyAsi();
  else setAgent({ dim: 0 });
};

// ---------------------------------------------------------------- chart draws on first view
const chart = $('[data-chart]');
if (chart && !reduced) {
  chart.classList.add('is-armed');
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { chart.classList.add('is-drawn'); o.disconnect(); } }, { threshold: 0.3 }).observe(chart);
}

// ---------------------------------------------------------------- neuralese: words dissolve into numbers as you scroll
const trace = $('[data-scramble]');
if (trace && !reduced) {
  const tl = $$('.trace__line', trace).map((el) => {
    const text = el.dataset.text || el.textContent || '';
    const order = [...text].map((_, i) => i).sort(() => Math.random() - 0.5);
    const rank = new Array(text.length); order.forEach((c, r) => (rank[c] = r / text.length));
    el.setAttribute('aria-label', text);
    return { el, text, rank };
  });
  const digits = '0123456789';
  let lastQ = -1;
  ScrollTrigger.create({
    trigger: trace, start: 'top 70%', end: 'bottom 20%', scrub: true,
    onUpdate: (st) => {
      const q = Math.round(st.progress * 60);
      if (q === lastQ) return;
      lastQ = q;
      const p = st.progress * 1.15;
      tl.forEach(({ el, text, rank }, li) => {
        const local = gsap.utils.clamp(0, 1, p * 1.3 - li * 0.15);
        let html = '';
        [...text].forEach((ch, i) => {
          if (ch === ' ' || rank[i] >= local) { html += ch === '<' ? '&lt;' : ch; return; }
          const d = digits[(i * 7 + li * 3 + q) % 10];
          html += `<span class="n">${i % 5 === 0 ? '.' : d}</span>`;
        });
        el.innerHTML = html;
      });
    },
  });
}

// ---------------------------------------------------------------- per-frame bookkeeping
const onScroll = () => { updateNav(); updateZone(); };
if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { lastZone = ''; onScroll(); });
onScroll();

// ---------------------------------------------------------------- boot the particles once the page is idle
function webgl() { try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; } }
async function boot() {
  const canvas = $<HTMLCanvasElement>('#agent');
  if (!canvas || !webgl()) return;
  const { createAgent } = await import('./agent');
  agent = await createAgent(canvas, { url: `${import.meta.env.BASE_URL}models/fields.glb`, reducedMotion: reduced, count: innerWidth < 820 ? 9000 : 18000 });
  agent.set({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...place.hero(), ...pending });
  root.classList.add('agent-live');
  agent.intro();
  lastZone = '';
  updateZone();
}
const start = () => boot().catch((e) => console.warn('particles unavailable', e));
if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 900 }); else setTimeout(start, 200);
addEventListener('load', () => ScrollTrigger.refresh());
