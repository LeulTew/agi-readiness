import { defineConfig, type Plugin } from 'vite';
import { FIELDS, STATE_LABEL, MILESTONES, NOW_MONTHS, AXIS_MONTHS, STORY_START } from './src/data';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (m: number) => {
  const t = STORY_START.m + Math.floor(m);
  return `${MONTHS[t % 12]} ${STORY_START.y + Math.floor(t / 12)}`;
};
const pct = (m: number) => `${((m / AXIS_MONTHS) * 100).toFixed(2)}%`;

// one slide per field; readable as a plain list without JS
function fieldSlides() {
  return FIELDS.map((f, i) => `
          <li class="slide field" data-shape="${f.shape}" data-state="${f.state}">
            <h3 class="field__name">${esc(f.name)}</h3>
            <p class="field__count">${String(i + 1).padStart(2, '0')} / ${FIELDS.length}<span class="field__group" title="${f.group === 'STEM' ? 'Science, technology, engineering and mathematics' : 'Fields beyond science, technology, engineering and mathematics'}">${f.group}</span></p>
            <p class="field__state"><i class="st st--${f.state}" aria-hidden="true"></i>${STATE_LABEL[f.state]}</p>
            <p class="field__note">${esc(f.note)}</p>
            ${f.refs?.length ? `<p class="field__refs">${f.refs.map((n) => `<a href="#src-${n}">[${n}]</a>`).join(' ')}</p>` : ''}
          </li>`).join('');
}

function tally() {
  const n = (s: string) => FIELDS.filter((f) => f.state === s).length;
  return `<b>${n('human')}</b> with human guidance · <b>${n('notyet')}</b> not there yet · <b>${n('solo')}</b> on its own`;
}

// "same story, slower clock": each milestone stretched by the authors' 70–90% pace estimate
function slipChart() {
  const years = [2026, 2027, 2028].map((y) => `<span style="left:${pct((y - STORY_START.y) * 12 - STORY_START.m)}">${y}</span>`).join('');
  const rows = MILESTONES.map((ms, i) => {
    const a = ms.m / 0.9, b = ms.m / 0.7;
    const range = monthName(a) === monthName(b) ? monthName(a) : `${monthName(a)} – ${monthName(b)}`;
    return `
            <li style="--i:${i};--s:${pct(ms.m)};--a:${pct(a)};--b:${pct(b)}">
              <span class="slip__label">${ms.label}</span>
              <span class="slip__track" aria-hidden="true"><i class="band"></i><i class="story-point"></i></span>
              <span class="slip__dates">Original <b>${monthName(ms.m)}</b><span class="sep"> · </span><span class="slow">At this pace <b>${range}</b></span></span>
            </li>`;
  }).join('');
  return `
          <div class="slip" style="--nowf:${(NOW_MONTHS / AXIS_MONTHS).toFixed(4)}" data-chart>
            <div class="slip__axis" aria-hidden="true"><span class="slip__now" style="left:${pct(NOW_MONTHS)}">Today</span>${years}</div>
            <ol>${rows}
            </ol>
          </div>`;
}

function buildHtml(): Plugin {
  return {
    name: 'build-html',
    transformIndexHtml: (html) => html
      .replace('<!--FIELDS-->', fieldSlides())
      .replace('<!--FIELD-INDEX-->', FIELDS.map((f, i) => `<button type="button" data-go="${i + 1}" style="--x:${((i + 1) / (FIELDS.length + 1)).toFixed(4)}" aria-label="Show ${esc(f.name)}" tabindex="${i === 0 ? 0 : -1}">${String(i + 1).padStart(2, '0')}</button>`).join(''))
      .replace('<!--TALLY-->', tally())
      .replace('<!--CHART-->', slipChart()),
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [buildHtml()],
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
