// "in a snap." turns to dust. The phrase is rasterised at the exact position of every rendered letter,
// so the first frame on the canvas matches the real text pixel for pixel. Scroll then erodes it left to
// right: most pixels simply crumble away, and a sample of them (about 2,500 on desktop, 1,200 on phones)
// become grains that are drawn up into the particle agent, which scatters straight after. Every frame is a
// pure function of scroll progress, so scrolling back re-forms the phrase. The canvas only exists while
// the ASI chapter is pinned. Decorative only (aria-hidden); the real text stays in the DOM.
import { glyphBoxes } from './split';

const STRETCH: [number, string][] = [[62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded']];
const LIFE = 0.46;   // a grain's flight, in units of dust progress
const FRAY = 0.05;   // how long a plain pixel takes to crumble
const LEVELS = 6;    // grain alpha buckets (one fill per bucket)

export interface Target { x: number; y: number; r: number }
export interface Dust { update(d: number): void; invalidate(): void; release(): void; destroy(): void }

export function createDust(src: HTMLElement, host: HTMLElement, target: () => Target, grains: () => number): Dust {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let text: HTMLCanvasElement | null = null;   // the eroding phrase, drawn per pixel
  let tctx: CanvasRenderingContext2D | null = null;
  let img: ImageData | null = null;
  let buf: Uint32Array | null = null;
  let built = false;
  let last = -1;
  let dpr = 1, ox = 0, oy = 0, tw = 0, th = 0;
  let px: Uint32Array = new Uint32Array(0);    // pixel index in the text raster
  let col: Uint32Array = new Uint32Array(0);   // premultiplied-free RGBA of that pixel
  let delay: Float32Array = new Float32Array(0);
  // grains: home, control point, end (device px), phase, size, base alpha, delay
  let g: Float32Array = new Float32Array(0);
  let gn = 0;
  const GS = 10;
  let rgb = '255,255,255';

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'dust';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    ctx = canvas.getContext('2d');
  }

  function build() {
    ensureCanvas();
    const r = src.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    if (!r.width || !r.height || !hr.width || !ctx || !canvas) return false;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.ceil(hr.width * dpr);
    canvas.height = Math.ceil(hr.height * dpr);
    const cs = getComputedStyle(src);
    const fs = parseFloat(cs.fontSize);
    const pad = fs * 0.35;
    ox = Math.floor((r.left - hr.left - pad) * dpr);
    oy = Math.floor((r.top - hr.top - pad) * dpr);
    tw = Math.ceil((r.width + pad * 2) * dpr);
    th = Math.ceil((r.height + pad * 2) * dpr);
    text = document.createElement('canvas');
    text.width = tw; text.height = th;
    tctx = text.getContext('2d', { willReadFrequently: true });
    if (!tctx) return false;
    const pct = parseFloat(cs.fontStretch) || 100;
    const kw = STRETCH.reduce((a, b) => (Math.abs(b[0] - pct) < Math.abs(a[0] - pct) ? b : a))[1];
    tctx.save();
    tctx.scale(dpr, dpr);
    tctx.font = `${cs.fontStyle} ${kw} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    tctx.fillStyle = cs.color;
    tctx.textBaseline = 'alphabetic';
    const m = tctx.measureText('H');
    const asc = m.fontBoundingBoxAscent ?? fs * 0.9;
    const desc = m.fontBoundingBoxDescent ?? fs * 0.25;
    for (const b of glyphBoxes(src, src)) tctx.fillText(b.ch, pad + b.x, pad + b.y + (b.h - (asc + desc)) / 2 + asc);
    tctx.restore();
    const data = tctx.getImageData(0, 0, tw, th).data;
    const c = cs.color.match(/[\d.]+/g) || ['255', '255', '255'];
    rgb = `${c[0]},${c[1]},${c[2]}`;
    const idx: number[] = [];
    for (let i = 0, n = tw * th; i < n; i++) if (data[i * 4 + 3] > 6) idx.push(i);
    const n = idx.length;
    px = new Uint32Array(n); col = new Uint32Array(n); delay = new Float32Array(n);
    const x0 = pad * dpr, x1 = (pad + r.width) * dpr;
    for (let k = 0; k < n; k++) {
      const i = idx[k];
      px[k] = i;
      col[k] = (data[i * 4 + 3] << 24) | (data[i * 4 + 2] << 16) | (data[i * 4 + 1] << 8) | data[i * 4];
      const u = Math.min(1, Math.max(0, ((i % tw) - x0) / (x1 - x0)));
      // left to right, with grain, so the edge frays instead of wiping
      delay[k] = u * 0.4 + Math.random() * 0.14;
    }
    // grains fly into a disc on the agent, arcing upwards on the way
    const T = target();
    const tx = (T.x - hr.left) * dpr, ty = (T.y - hr.top) * dpr, tr = T.r * dpr;
    gn = Math.min(grains(), n);
    g = new Float32Array(gn * GS);
    const step = n / Math.max(1, gn);
    for (let j = 0; j < gn; j++) {
      const k = Math.min(n - 1, Math.floor(j * step + Math.random() * step));
      const hx = ox + (px[k] % tw), hy = oy + Math.floor(px[k] / tw);
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * tr * 0.9;
      const ex = tx + Math.cos(a) * rr, ey = ty + Math.sin(a) * rr;
      const dx = ex - hx, dy = ey - hy, dist = Math.hypot(dx, dy) || 1;
      const lift = dist * (0.18 + Math.random() * 0.34);
      const o = j * GS;
      g[o] = hx; g[o + 1] = hy;
      g[o + 2] = hx + dx * (0.3 + Math.random() * 0.25) + (dy / dist) * lift * 0.4;
      g[o + 3] = hy + dy * 0.3 - lift;
      g[o + 4] = ex; g[o + 5] = ey;
      g[o + 6] = Math.random() * Math.PI * 2;
      g[o + 7] = dpr * (1.3 + Math.random() * 1.1);
      g[o + 8] = (col[k] >>> 24) / 255;
      g[o + 9] = delay[k];
    }
    img = tctx.createImageData(tw, th);
    buf = new Uint32Array(img.data.buffer);
    built = true;
    last = -1;
    return true;
  }

  function draw(d: number) {
    if (!ctx || !canvas || !tctx || !img || !buf || !text) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // the phrase, minus every pixel that has already gone
    buf.fill(0);
    for (let k = 0, n = px.length; k < n; k++) {
      const t = (d - delay[k]) / FRAY;
      if (t >= 1) continue;
      if (t <= 0) { buf[px[k]] = col[k]; continue; }
      const a = Math.round((col[k] >>> 24) * (1 - t) * (1 - t));
      if (a > 4) buf[px[k]] = (a << 24) | (col[k] & 0xffffff);
    }
    tctx.putImageData(img, 0, 0);
    ctx.drawImage(text, ox, oy);
    // grains, bucketed by alpha so each bucket is one fill
    const paths: Path2D[] = Array.from({ length: LEVELS }, () => new Path2D());
    const used = new Uint8Array(LEVELS);
    const amp = 6 * dpr;
    for (let j = 0; j < gn; j++) {
      const o = j * GS;
      const t = (d - g[o + 9]) / LIFE;
      if (t <= 0 || t >= 1) continue;
      const e = Math.pow(t, 1.55);
      const u = 1 - e;
      let x = u * u * g[o] + 2 * u * e * g[o + 2] + e * e * g[o + 4];
      let y = u * u * g[o + 1] + 2 * u * e * g[o + 3] + e * e * g[o + 5];
      const w = Math.sin(Math.PI * t) * amp;
      x += Math.sin(g[o + 6] + t * 9) * w;
      y += Math.cos(g[o + 6] + t * 7) * w;
      const fade = t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38;
      const a = Math.min(1, g[o + 8] + 0.4 * e) * fade;
      if (a < 0.04) continue;
      const lv = Math.min(LEVELS - 1, Math.floor(a * LEVELS));
      const s = g[o + 7] * (1 - 0.45 * t);
      paths[lv].rect(x - s / 2, y - s / 2, s, s);
      used[lv] = 1;
    }
    for (let lv = 0; lv < LEVELS; lv++) {
      if (!used[lv]) continue;
      ctx.fillStyle = `rgba(${rgb},${((lv + 0.5) / LEVELS).toFixed(3)})`;
      ctx.fill(paths[lv]);
    }
  }

  const hide = () => {
    if (canvas?.classList.contains('is-on')) { canvas.classList.remove('is-on'); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
  };
  const free = () => {
    canvas?.remove(); canvas = null; ctx = null; text = null; tctx = null; img = null; buf = null;
    px = new Uint32Array(0); col = new Uint32Array(0); delay = new Float32Array(0); g = new Float32Array(0); gn = 0;
    built = false;
  };

  return {
    update(d) {
      const on = d > 0.001 && d < 0.999;
      src.classList.toggle('is-dust', d > 0.001);
      if (!on) { hide(); last = d; return; }
      if (!built && !build()) { src.classList.remove('is-dust'); return; }
      if (Math.abs(d - last) < 0.0015) return;
      last = d;
      draw(d);
      canvas!.classList.add('is-on');
    },
    invalidate() { built = false; },
    // the chapter is no longer pinned: drop the canvas and its buffers until it is needed again
    release() { free(); src.classList.remove('is-dust'); last = -1; },
    destroy() { free(); src.classList.remove('is-dust'); },
  };
}
