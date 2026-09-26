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
const mobile = () => innerWidth <= 820;
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
  // Sections land flush with the top so pinned chapters start exactly at their first frame
  // (their own padding clears the nav); smaller targets such as sources clear the 64px nav.
  // A numeric target also stops Lenis adding scroll-padding-top on top of this offset.
  const y = el.getBoundingClientRect().top + scrollY - (el.tagName === 'SECTION' ? 0 : 80);
  // opening the sources drawer grows the page; refresh Lenis' cached scroll limit first
  lenis?.resize();
  if (lenis) lenis.scrollTo(Math.max(0, y), { duration: 1, onComplete: focus });
  else { scrollTo({ top: Math.max(0, y), behavior: 'instant' }); focus(); }
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
    // lit by the time the last line reaches the lower fifth, so the closing condition is at full strength where it is read
    gsap.to(words, { opacity: 1, ease: 'none', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 80%', scrub: 0.6 } });
  });
}

// ---------------------------------------------------------------- the agent (particles)
let agent: AgentHandle | null = null;
const pending: Partial<AgentState> = {};
const setAgent = (s: Partial<AgentState>) => { Object.assign(pending, s); agent?.set(s); };
const NAV = 64;
// On phones the object sits centred in the band between the nav and the text block,
// so every slide keeps the same object-to-text rhythm whatever the text length.
const band = (el: HTMLElement | undefined, max: number) => {
  const top = el?.offsetTop || innerHeight * 0.5;
  const room = Math.max(140, top - NAV);
  const scale = Math.min(max, (room - 24) / (0.62 * Math.min(innerWidth, innerHeight)));
  return { x: 0, y: 1 - (2 * (NAV + room / 2)) / innerHeight, scale };
};
const place = {
  hero: () => (mobile() ? { x: 0, y: 0.4, scale: 1 } : { x: 0.56, y: 0.32, scale: 0.77 }),
  fields: () => (mobile() ? band(slides[1], 1.06) : { x: 0.47, y: 0.13, scale: 0.96 }),
  asi: () => (mobile() ? band(lines[0], 0.94) : { x: 0.5, y: 0.16, scale: 0.82 }),
};

// ---------------------------------------------------------------- text reveal
// Text blocks animate in each time they enter the reading band and out when they leave it, in both
// directions (styles: "text reveal"). Targets are found by structure, not by copy. JS only ever adds
// hidden states, and only to blocks that are off screen, so nothing is lost if this never runs.
type RvState = 'in' | 'above' | 'below' | 'before' | 'after';
interface RvItem { el: HTMLElement; st: RvState | ''; ctl: boolean; t: number; kids: HTMLElement[] }
const RV_GROUP = '.slide, .entry, .terms > div, .endings > div, .verdict__cols > div, .stats > div, .trace, .asi__line--3';
const RV_DISPLAY = 'main h1, main h2, .verdict__big, .foot__name, .field__name, .asi__line--1, .asi__line--2, .asi__big';
const RV_BODY = 'main p, main li, main h3, main h4, main dt, main dd, .chart figcaption, .hero__cue, .foot p, .foot li, .sources';
const RV_SKIP = '.sr-only, .nav, .fields__index, .fields__skip, .slip__axis';
const RV_TOP = NAV + 48; // blocks leave just below the nav, so the exit is seen
const RV_BOTTOM = 0.06;
const rvMap = new Map<Element, RvItem>();
const rvNow = new Set<HTMLElement>();
let rvIO: IntersectionObserver | null = null;
let rvRaf = 0;
let rvTimer = 0;

// display type: every word becomes its own masked inline-block; one clean copy stays for assistive tech
function splitDisplay(el: HTMLElement) {
  if (el.dataset.rw) return el.dataset.rw === '1';
  if (el.querySelector('a, button, input, select, textarea, [tabindex]')) { el.dataset.rw = '0'; return false; }
  const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walk.nextNode()) nodes.push(walk.currentNode as Text);
  let wi = 0;
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    // split on breaking spaces only, so no-break spaces keep their words on one line
    n.data.split(/([ \t\n\r\f]+)/).forEach((part) => {
      if (!part) return;
      if (/^[ \t\n\r\f]+$/.test(part)) { frag.append(part); return; }
      const w = document.createElement('span');
      w.className = 'rw';
      w.setAttribute('aria-hidden', 'true');
      w.style.setProperty('--wi', String(Math.min(wi++, 18)));
      w.textContent = part;
      frag.append(w);
    });
    n.replaceWith(frag);
  }
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = label;
  el.append(sr);
  el.dataset.rw = '1';
  return true;
}

const rvFlushNow = () => {
  if (rvRaf) return;
  // two frames: the hidden state must be painted once with transitions off before they come back
  rvRaf = requestAnimationFrame(() => { rvRaf = requestAnimationFrame(() => { rvRaf = 0; rvNow.forEach((el) => el.classList.remove('rv-now')); rvNow.clear(); }); });
};
function setRv(it: RvItem, st: RvState, instant = false, i = 0) {
  if (it.st === st) return;
  it.st = st;
  const el = it.el;
  if (instant) { el.classList.add('rv-now'); rvNow.add(el); el.dataset.rv = st; rvFlushNow(); return; }
  el.style.setProperty('--rv-i', String(i));
  el.dataset.rv = st;
  el.classList.add('rv-busy');
  clearTimeout(it.t);
  it.t = window.setTimeout(() => el.classList.remove('rv-busy'), st === 'in' ? 2400 : 700);
}
// the pinned chapters drive their own slides and lines through this
function rvSet(el: HTMLElement, st: RvState) {
  const it = rvMap.get(el);
  if (it?.ctl) setRv(it, st, !it.st);
}
function rvRelease(els: HTMLElement[]) {
  for (const el of els) { const it = rvMap.get(el); if (it?.ctl) { it.ctl = false; el.classList.remove('rv-ctl'); rvIO?.observe(el); } }
}
// Stacked pinned blocks share one spot, so focus must never keep an outgoing one on screen.
// Move it to the incoming block's control first; the outgoing block then leaves normally.
function handOff(from: HTMLElement | undefined, to: HTMLElement | undefined) {
  const f = document.activeElement;
  if (!from || !to || !(f instanceof HTMLElement) || !from.contains(f)) return;
  if (!to.matches('a, button, [tabindex]')) to.tabIndex = -1;
  to.focus({ preventScroll: true });
}

function rvRegister() {
  const pool = new Set<HTMLElement>();
  $$(`${RV_GROUP}, ${RV_DISPLAY}, ${RV_BODY}`).forEach((el) => { if (!el.closest(RV_SKIP)) pool.add(el); });
  const nestedIn = (el: HTMLElement) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (pool.has(p)) return true; return false; };
  const add = (el: HTMLElement, ctl: boolean) => {
    if (rvMap.has(el)) return;
    const it: RvItem = { el, st: '', ctl, t: 0, kids: [] };
    if (el.matches(RV_GROUP)) {
      el.classList.add('rv-g');
      it.kids = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.classList.contains('sr-only'));
      it.kids.forEach((k, i) => {
        k.style.setProperty('--ci', String(Math.min(i, 6)));
        k.classList.add(k.matches(RV_DISPLAY) && splitDisplay(k) ? 'rv-d' : 'rv-c');
      });
    } else if (el.matches(RV_DISPLAY) && splitDisplay(el)) el.classList.add('rv-d');
    else el.classList.add('rv-b');
    if (ctl) el.classList.add('rv-ctl');
    rvMap.set(el, it);
  };
  for (const el of pool) {
    if (nestedIn(el)) continue;
    const ctl = el.matches('.pinned .slide, .pinned-asi .asi__line');
    // a group taller than most of the screen would finish its cascade off screen: reveal its parts one by one
    if (!ctl && el.matches(RV_GROUP) && el.offsetHeight > innerHeight * 0.75) {
      [...el.children].forEach((c) => { if (c instanceof HTMLElement && !c.classList.contains('sr-only')) add(c, false); });
      continue;
    }
    add(el, ctl);
  }
}

function rvStateOf(r: DOMRectReadOnly, H: number, W: number, pad = 0): RvState {
  if (r.bottom <= RV_TOP - pad) return 'above';
  if (r.top >= H * (1 - RV_BOTTOM) + pad) return 'below';
  if (r.right <= -pad) return 'before';
  if (r.left >= W + pad) return 'after';
  return 'in';
}
function rvObserve(entries: IntersectionObserverEntry[]) {
  const H = innerHeight, W = innerWidth;
  const arriving: { it: RvItem; r: DOMRectReadOnly }[] = [];
  for (const e of entries) {
    const it = rvMap.get(e.target);
    if (!it || it.ctl) continue;
    const r = e.boundingClientRect;
    if (!it.st) {
      // first placement: anything on screen at all stays as it is; the rest is parked off screen
      const onScreen = r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
      setRv(it, onScreen ? 'in' : rvStateOf(r, H, W), true);
      continue;
    }
    const st = e.isIntersecting ? 'in' : rvStateOf(r, H, W);
    if (st === 'in') arriving.push({ it, r }); else setRv(it, st);
  }
  // blocks arriving together cascade in reading order
  arriving.sort((a, b) => (a.r.top - b.r.top) || (a.r.left - b.r.left)).forEach(({ it }, i) => setRv(it, 'in', false, Math.min(i, 8)));
}
// Settle pass once scrolling stops. Hidden blocks are offset by their own lift, so a block parked at the
// very end of the page could otherwise never cross into the band; this also re-arms blocks that were
// already on screen at load, so their next entry animates too.
function rvCheck() {
  const H = innerHeight, W = innerWidth;
  const arriving: RvItem[] = [];
  for (const it of rvMap.values()) {
    if (it.ctl || !it.st) continue;
    const r = it.el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (it.st !== 'in') { if (rvStateOf(r, H, W, 34) === 'in') arriving.push(it); }
    else if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) setRv(it, rvStateOf(r, H, W), true);
  }
  arriving.forEach((it, i) => setRv(it, 'in', false, Math.min(i, 8)));
}
const rvSettle = () => { clearTimeout(rvTimer); rvTimer = window.setTimeout(rvCheck, 180); };
function rvStart() {
  rvIO = new IntersectionObserver(rvObserve, { rootMargin: `-${RV_TOP}px 0px -${RV_BOTTOM * 100}% 0px` });
  rvMap.forEach((it) => { if (!it.ctl) rvIO!.observe(it.el); });
}
// crossing a breakpoint can change which groups are too tall to cascade; rebuild the uncontrolled part
let rvWidth = innerWidth;
function rvRebuild() {
  if (innerWidth === rvWidth || !rvIO) return;
  rvWidth = innerWidth;
  rvIO.disconnect();
  for (const it of [...rvMap.values()]) {
    if (it.ctl) continue;
    clearTimeout(it.t);
    delete it.el.dataset.rv;
    it.el.classList.remove('rv-b', 'rv-g', 'rv-busy', 'rv-now');
    it.el.style.removeProperty('--rv-i');
    it.kids.forEach((k) => { k.classList.remove('rv-c'); k.style.removeProperty('--ci'); });
    rvMap.delete(it.el);
  }
  rvRegister();
  rvStart();
}

// ---------------------------------------------------------------- fields: pinned specimen morph
const fieldsSec = $('#fields')!;
const slides = $$('.slide', fieldsSec);
const shapesOf = slides.map((s) => s.dataset.shape || 'agent');
const meter = $('.fields__meter span', fieldsSec);
const ticks = $$<HTMLButtonElement>('.fields__index button', fieldsSec);
let fieldsP = 0;
let fieldTrigger: ScrollTrigger | null = null;
let activeSlide = -1;
const applyFields = () => {
  const p = fieldsP * (slides.length - 1);
  const k = Math.min(slides.length - 2, Math.floor(p));
  const f = p - k;
  const mix = gsap.utils.clamp(0, 1, (f - 0.18) / 0.5);
  const active = f < 0.43 ? k : k + 1;
  if (active !== activeSlide) {
    const roving = gsap.utils.clamp(1, ticks.length, active) - 1;
    // keyboard focus in the outgoing field moves to the incoming field's index button
    handOff(slides[activeSlide], ticks[roving] ?? slides[active]);
    activeSlide = active;
    slides.forEach((s, i) => s.classList.toggle('is-active', i === active));
    ticks.forEach((b, i) => {
      b.tabIndex = i === roving ? 0 : -1;
      if (i + 1 === active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }
  meter?.style.setProperty('--p', String(fieldsP));
  slides.forEach((s, i) => rvSet(s, i === active ? 'in' : i < active ? 'above' : 'below'));
  setAgent({ from: shapesOf[k], to: shapesOf[k + 1], mix, scatter: 0, dim: 1, ...place.fields() });
};
const jumpToSlide = (i: number, immediate = false) => {
  if (!fieldTrigger) return;
  const y = fieldTrigger.start + (i / (slides.length - 1)) * (fieldTrigger.end - fieldTrigger.start);
  if (lenis) lenis.scrollTo(y, { duration: 0.9, immediate }); else scrollTo({ top: y, behavior: 'instant' });
};
// the index is one tab stop; arrows move along it and bring that field up
ticks.forEach((b) => b.addEventListener('click', () => jumpToSlide(Number(b.dataset.go))));
$('.fields__index', fieldsSec)?.addEventListener('keydown', (e) => {
  const i = ticks.indexOf(document.activeElement as HTMLButtonElement);
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? ticks.length - 1 : step !== undefined ? gsap.utils.clamp(0, ticks.length - 1, i + step) : -1;
  if (i < 0 || to < 0) return;
  e.preventDefault();
  ticks.forEach((b, n) => (b.tabIndex = n === to ? 0 : -1));
  ticks[to].focus();
  jumpToSlide(Number(ticks[to].dataset.go));
});
// hidden slides stay in the accessibility tree; focusing into one brings it on screen
fieldsSec.addEventListener('focusin', (e) => {
  const slide = (e.target as Element).closest<HTMLElement>('.slide');
  if (slide && fieldTrigger) jumpToSlide(slides.indexOf(slide), true);
});
const unpinFields = () => {
  fieldTrigger?.kill(true); fieldTrigger = null;
  fieldsSec.classList.remove('pinned');
  fieldsSec.dataset.agent = 'off';
  rvRelease(slides);
  slideStops();
};
// On phones a pinned slide scrolls, and Chrome makes any scroller without focusable children a tab stop.
// A hidden slide's entrance lift briefly overflows it, so it would become a stop and then drop focus
// to <body> once the lift settles. A slide is a stop only if its settled content really needs scrolling.
function slideStops() {
  const pinned = fieldsSec.classList.contains('pinned');
  slides.forEach((s) => {
    if (!pinned) { s.removeAttribute('tabindex'); return; }
    const last = [...s.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.classList.contains('sr-only')).pop();
    const scrolls = getComputedStyle(s).overflowY !== 'visible' && !!last && last.offsetTop + last.offsetHeight > s.clientHeight + 1;
    s.tabIndex = scrolls && !s.querySelector('a, button') ? 0 : -1;
  });
}

// ---------------------------------------------------------------- not a god: snap
const asiSec = $('#asi')!;
const lines = $$('.asi__line', asiSec);
let asiP = 0;
const applyAsi = () => {
  const i = asiP < 0.3 ? 0 : asiP < 0.64 ? 1 : 2;
  lines.forEach((l, j) => { if (j !== i) handOff(l, lines[i]); });
  lines.forEach((l, j) => { l.classList.toggle('is-active', j === i); rvSet(l, j === i ? 'in' : j < i ? 'above' : 'below'); });
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
      scrollTrigger: { trigger: check, pin: check, start: 'top top', end: () => `+=${dist()}`, scrub: 0.8, invalidateOnRefresh: true },
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

// ---------------------------------------------------------------- chart: bars draw each time their row is revealed (styles: .slip li[data-rv])

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
const onScroll = () => { updateNav(); updateZone(); if (rvIO) rvSettle(); };
if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
let rvResizeT = 0;
addEventListener('resize', () => { lastZone = ''; onScroll(); clearTimeout(rvResizeT); rvResizeT = window.setTimeout(() => { rvRebuild(); slideStops(); }, 400); });
onScroll();
slideStops();
document.fonts?.ready.then(slideStops);

// start the reveal once the pinned chapters exist, so their slides are handed to the pin logic
if (!reduced) {
  rvRegister();
  rvStart();
  if (fieldTrigger) applyFields();
  if (asiSec.classList.contains('pinned-asi')) applyAsi();
}

// ---------------------------------------------------------------- boot the particles once the page is idle
function webgl() { try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; } }
async function boot() {
  const canvas = $<HTMLCanvasElement>('#agent');
  if (!canvas || !webgl()) return;
  const { createAgent } = await import('./agent');
  agent = await createAgent(canvas, { url: `${import.meta.env.BASE_URL}models/fields.glb`, reducedMotion: reduced, count: innerWidth < 820 ? 9000 : 18000 });
  agent.set({ from: 'agent', to: 'agent', mix: 1, scatter: 0, dim: 1, ...place.hero(), ...pending });
  root.classList.add('agent-live');
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    root.classList.remove('agent-live');
    agent?.dispose(); agent = null;
    unpinFields();
    ScrollTrigger.getAll().filter((st) => st.trigger === asiSec).forEach((st) => st.kill(true));
    asiSec.classList.remove('pinned-asi');
    rvRelease(lines);
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
  rvRelease(lines);
  ScrollTrigger.refresh();
  console.warn('particles unavailable; showing the reading layout', e);
});
if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 900 }); else setTimeout(start, 200);
addEventListener('load', () => ScrollTrigger.refresh());
