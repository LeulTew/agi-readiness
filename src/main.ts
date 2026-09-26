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
const canAnimate = !reduced && webgl();
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
  const focus = () => { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); };
  if (lenis) lenis.scrollTo(el, { offset: -64, duration: 1, onComplete: focus });
  else { el.scrollIntoView(); focus(); }
};
const menuButton = $<HTMLButtonElement>('[data-menu]')!;
const closeMenu = () => { $('[data-nav]')?.classList.remove('menu-open'); menuButton.setAttribute('aria-expanded', 'false'); };
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  $('[data-nav]')?.classList.toggle('menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); }
});
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a || a.hash.length < 2 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  if (a.hash.startsWith('#src-')) { const d = $<HTMLDetailsElement>('.sources'); if (d) d.open = true; requestAnimationFrame(() => ScrollTrigger.refresh()); }
  e.preventDefault();
  closeMenu();
  history.pushState(null, '', a.hash);
  requestAnimationFrame(() => go(a.hash));
});
addEventListener('popstate', () => { if (location.hash) go(location.hash); });
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
  hero: () => (mobile() ? { x: 0, y: 0.4, scale: 1 } : { x: 0.56, y: 0.32, scale: 0.77 }),
  fields: () => (mobile() ? { x: 0, y: 0.4, scale: 1.06 } : { x: 0.47, y: 0.13, scale: 0.96 }),
  asi: () => (mobile() ? { x: 0, y: 0.42, scale: 0.94 } : { x: 0.5, y: 0.16, scale: 0.82 }),
};

// ---------------------------------------------------------------- fields: pinned specimen morph
const fieldsSec = $('#fields')!;
const slides = $$('.slide', fieldsSec);
const shapesOf = slides.map((s) => s.dataset.shape || 'agent');
const meter = $('.fields__meter span', fieldsSec);
let fieldsP = 0;
let fieldTrigger: ScrollTrigger | null = null;
const fieldSelect = $<HTMLSelectElement>('[data-field-select]')!;
const applyFields = () => {
  const p = fieldsP * (slides.length - 1);
  const k = Math.min(slides.length - 2, Math.floor(p));
  const f = p - k;
  const mix = gsap.utils.clamp(0, 1, (f - 0.18) / 0.5);
  const active = f < 0.43 ? k : k + 1;
  slides.forEach((s, i) => {
    s.classList.toggle('is-active', i === active);
    s.inert = fieldsSec.classList.contains('pinned') && i !== active;
  });
  fieldSelect.value = String(active);
  meter?.style.setProperty('--p', String(fieldsP));
  setAgent({ from: shapesOf[k], to: shapesOf[k + 1], mix, scatter: 0, dim: 1, ...place.fields() });
};
fieldSelect.addEventListener('change', () => {
  if (!fieldTrigger) return;
  const y = fieldTrigger.start + Number(fieldSelect.value) / (slides.length - 1) * (fieldTrigger.end - fieldTrigger.start);
  if (lenis) lenis.scrollTo(y, { duration: 0.7 }); else scrollTo({ top: y, behavior: 'instant' });
});
const unpinFields = () => {
  fieldTrigger?.kill(true); fieldTrigger = null;
  fieldsSec.classList.remove('pinned');
  slides.forEach((s) => { s.inert = false; });
  fieldsSec.dataset.agent = 'off';
};
$('[data-read-fields]')!.addEventListener('click', () => {
  unpinFields(); ScrollTrigger.refresh(); go('#fields');
});

// ---------------------------------------------------------------- not a god: snap
const asiSec = $('#asi')!;
const lines = $$('.asi__line', asiSec);
let asiP = 0;
const applyAsi = () => {
  const i = asiP < 0.3 ? 0 : asiP < 0.64 ? 1 : 2;
  lines.forEach((l, j) => l.classList.toggle('is-active', j === i));
  const base = place.asi();
  if (i === 0) setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...base });
  else if (i === 1) setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: gsap.utils.clamp(0, 1, (asiP - 0.3) / 0.16), dim: 1, ...base });
  else setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...base, scale: base.scale * 0.62 });
};

if (canAnimate) {
  root.classList.add('pinned-on');
  fieldsSec.classList.add('pinned');
  fieldTrigger = ScrollTrigger.create({
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
  mm.add('(min-width: 1081px) and (min-height: 760px)', () => {
    const check = $('#check')!;
    const track = $('.check__track', check)!;
    check.classList.add('h-scroll');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: $('.check__viewport', check), pin: check, start: () => `bottom-=${Math.min(innerHeight, check.offsetHeight)} top`, end: () => `+=${dist()}`, scrub: 0.8, invalidateOnRefresh: true },
    });
    const revealFocused = (e: FocusEvent) => {
      const entry = (e.target as Element).closest<HTMLElement>('.entry');
      const st = tween.scrollTrigger;
      if (!entry || !st) return;
      const x = Math.min(dist(), Math.max(0, entry.offsetLeft - 48));
      if (lenis) lenis.scrollTo(st.start + x, { immediate: true }); else scrollTo(0, st.start + x);
      // Focus also scrolls the native overflow box; GSAP already owns that axis.
      requestAnimationFrame(() => { track.parentElement!.scrollLeft = 0; });
    };
    track.addEventListener('focusin', revealFocused);
    return () => { track.removeEventListener('focusin', revealFocused); tween.scrollTrigger?.kill(); tween.kill(); gsap.set(track, { clearProps: 'transform' }); check.classList.remove('h-scroll'); };
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
  agent?.setActive(!paperOnTop && (zone === 'hero' || zone === 'fields' || zone === 'asi'));
  if (zone === lastZone && zone !== 'hero' && zone !== 'verdict') return;
  lastZone = zone;
  if (reduced && zone !== 'hero') { setAgent({ dim: 0 }); return; }
  if (zone === 'hero') setAgent({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...place.hero() });
  else if (zone === 'verdict') setAgent({ dim: 0 });
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
    el.setAttribute('aria-hidden', 'true');
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
  const motionButton = $<HTMLButtonElement>('[data-motion]')!;
  motionButton.hidden = reduced;
  motionButton.addEventListener('click', () => {
    const paused = motionButton.getAttribute('aria-pressed') !== 'true';
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.textContent = paused ? 'Resume motion' : 'Pause motion';
    root.classList.toggle('ambient-paused', paused);
    agent?.setMotion(!paused);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    root.classList.remove('agent-live');
    agent?.dispose(); agent = null;
    unpinFields();
    ScrollTrigger.getAll().filter((st) => st.trigger === asiSec).forEach((st) => st.kill(true));
    asiSec.classList.remove('pinned-asi');
    motionButton.hidden = true;
    ScrollTrigger.refresh();
  }, { once: true });
  agent.intro();
  lastZone = '';
  updateZone();
}
const start = () => boot().catch((e) => {
  unpinFields();
  ScrollTrigger.getAll().filter((st) => st.trigger === asiSec).forEach((st) => st.kill(true));
  asiSec.classList.remove('pinned-asi');
  ScrollTrigger.refresh();
  console.warn('particles unavailable; showing the reading layout', e);
});
if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 900 }); else setTimeout(start, 200);
addEventListener('load', () => ScrollTrigger.refresh());
