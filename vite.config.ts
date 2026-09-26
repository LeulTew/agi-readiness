import { defineConfig, type Plugin } from 'vite';
import { FIELDS, MILESTONES, NOW_MONTHS, AXIS_MONTHS, STORY_START } from './src/data';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (m: number) => {
  const t = STORY_START.m + Math.floor(m);
  return `${MONTHS[t % 12]} ${STORY_START.y + Math.floor(t / 12)}`;
};
const pct = (m: number) => `${((m / AXIS_MONTHS) * 100).toFixed(2)}%`;

// "same story, slower clock": each milestone stretched by the authors' 70–90% pace estimate
function slipChart() {
  const years = [2026, 2027, 2028].map((y) => {
    const m = (y - STORY_START.y) * 12 - STORY_START.m;
    return `<span style="left:${pct(m)}">${y}</span>`;
  }).join('');
  const rows = MILESTONES.map((ms, i) => {
    const a = ms.m / 0.9, b = ms.m / 0.7;
    const range = monthName(a) === monthName(b) ? monthName(a) : `${monthName(a)} – ${monthName(b)}`;
    return `
          <li style="--i:${i};--s:${pct(ms.m)};--a:${pct(a)};--b:${pct(b)}">
            <span class="slip__label">${ms.label}</span>
            <span class="slip__track" aria-hidden="true"><i class="band"></i><i class="story"></i></span>
            <span class="slip__dates">Story: <b>${monthName(ms.m)}</b><span class="sep"> · </span><span class="slow">Slower clock: <b>${range}</b></span></span>
          </li>`;
  }).join('');
  return `
        <div class="slip" style="--nowf:${(NOW_MONTHS / AXIS_MONTHS).toFixed(4)}" data-chart>
          <div class="slip__axis" aria-hidden="true"><span class="slip__now" style="left:${pct(NOW_MONTHS)}">Today</span>${years}</div>
          <ol>${rows}
          </ol>
        </div>`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STATE_WORD: Record<string, string> = { amber: 'With a human steering', off: 'Not yet', go: 'On its own' };
const CHIP: Record<string, string> = { amber: 'amber', off: 'pending', go: 'go' };

// renders the HTML twin of the 3D lamp matrix from the same data, so it works without JS
function fieldList(): Plugin {
  const group = (g: 'stem' | 'arts') => FIELDS.filter((f) => f.group === g).map((f) => `
          <li><details>
            <summary><span>${esc(f.label)}</span><span class="chip chip--${CHIP[f.state]}" title="${STATE_WORD[f.state]}"><i></i><span class="sr-only">${STATE_WORD[f.state]}</span></span></summary>
            <p>${esc(f.note)}</p>
          </details></li>`).join('');
  return {
    name: 'field-list',
    transformIndexHtml: (html) => html
      .replace('<!--FIELDS:stem-->', group('stem'))
      .replace('<!--FIELDS:arts-->', group('arts'))
      .replace('<!--CHART-->', slipChart()),
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [fieldList()],
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
