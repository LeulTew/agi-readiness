import '@fontsource-variable/jost';
import '@fontsource-variable/public-sans';
import '@fontsource/martian-mono/400.css';
import '@fontsource/martian-mono/500.css';
import './styles.css';

document.documentElement.classList.add('js');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- countdown to the end of 2027
const clock = document.querySelector<HTMLElement>('[data-clock]');
if (clock) {
  const end = new Date('2028-01-01T00:00:00');
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 864e5));
  clock.innerHTML = `T&minus;<b>${days}</b> DAYS TO THE END OF 2027`;
}

// ---------------------------------------------------------------- nav: active section lamp
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.nameplate nav a')];
const byId = new Map(navLinks.map((a) => [a.hash.slice(1), a]));
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    navLinks.forEach((a) => a.removeAttribute('aria-current'));
    byId.get(e.target.id)?.setAttribute('aria-current', 'true');
  }
}, { rootMargin: '-45% 0px -50% 0px' });
byId.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

// ---------------------------------------------------------------- poll: plan rows light as they cross mid-screen
const rows = [...document.querySelectorAll<HTMLElement>('.plan li[data-status]')];
if (!reducedMotion && 'IntersectionObserver' in window) {
  const pollIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-polled'); pollIO.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -38% 0px' });
  rows.forEach((r) => pollIO.observe(r));
} else rows.forEach((r) => r.classList.add('is-polled'));

// ---------------------------------------------------------------- slip chart: draw on first view
const chart = document.querySelector<SVGSVGElement>('[data-chart]');
if (chart && !reducedMotion) {
  chart.classList.add('is-armed');
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { chart.classList.add('is-drawn'); o.disconnect(); } }, { threshold: 0.35 }).observe(chart);
}

// ---------------------------------------------------------------- citation links open the sources drawer
const sources = document.querySelector<HTMLDetailsElement>('.sources');
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#src-"]');
  if (a && sources) sources.open = true;
});
if (location.hash.startsWith('#src-') && sources) sources.open = true;

// ---------------------------------------------------------------- 3D console
const stage = document.querySelector<HTMLElement>('.stage');
const canvas = document.querySelector<HTMLCanvasElement>('#console');
const tip = document.querySelector<HTMLElement>('.lamp-tip');
const testBtn = document.querySelector<HTMLButtonElement>('[data-lamp-test]');
const chapters = [...document.querySelectorAll<HTMLElement>('.chapter')];

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const STATE_TEXT: Record<string, string> = { amber: 'WITH A HUMAN', off: 'NOT YET', go: 'ON ITS OWN' };

async function boot() {
  if (!stage || !canvas || !webglOK()) { testBtn?.remove(); return; }
  const { createConsole } = await import('./console3d');
  const con = await createConsole(canvas, { reducedMotion, modelUrl: `${import.meta.env.BASE_URL}models/console.glb` });
  stage.classList.add('is-live');

  const update = () => {
    // progress = chapter index + fraction through it, measured at the viewport middle
    const mid = innerHeight * 0.5;
    let p = 0;
    chapters.forEach((ch, i) => {
      const r = ch.getBoundingClientRect();
      if (r.top <= mid) p = i + Math.min(1, (mid - r.top) / Math.max(1, r.height));
    });
    con.setProgress(Math.max(0, p - 0.5));
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();

  con.onHover((def, x, y) => {
    if (!tip) return;
    if (!def) { tip.classList.remove('is-on'); return; }
    const st = STATE_TEXT[def.state] ?? '';
    tip.innerHTML = `<strong><span>${def.label}</span><span class="chip chip--${def.state === 'off' ? 'pending' : def.state}"><i></i>${st}</span></strong>${def.note}`;
    const sr = stage.getBoundingClientRect();
    const w = tip.offsetWidth || 300;
    tip.style.left = `${Math.min(Math.max(12, x + 18), sr.width - w - 12)}px`;
    tip.style.top = `${Math.max(12, y - 20)}px`;
    tip.classList.add('is-on');
  });

  const run = async () => {
    if (!testBtn) return con.lampTest();
    testBtn.disabled = true;
    await con.lampTest();
    testBtn.disabled = false;
  };
  testBtn?.addEventListener('click', run);
  // first lamp test once the stage is actually on screen
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); run(); } }, { threshold: 0.4 }).observe(stage);
}

// idle boot keeps first paint fast; the poster render covers the gap
const start = () => boot().catch((err) => { console.warn('console failed, keeping poster', err); testBtn?.remove(); });
if ('requestIdleCallback' in window) (window as Window).requestIdleCallback(start, { timeout: 1200 }); else setTimeout(start, 300);
