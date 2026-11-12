/*
  The stroke order of a character as a short animation: the glyph in grey, the strokes drawn one after the other as thin lines over it.
  The data is one file per character, https://cdn.qatt.org/stroke/r1/<HEX>.json (made in the private repository qtng/chunom-private); there is none for every character.

    StrokeOrder.load("國")  -> Promise of the record, null when there is none
    StrokeOrder.play(host, record, options) -> { restart(), stop() }   draws into host (an element), a click on the drawing starts it again
      options: numbers (show the number of every stroke, default false), fadeTo (the opacity the strokes before fade to, 0 = they vanish, a viewer may keep some),
               speed (1), hold (ms to wait after the last stroke before onEnd, 2000), onEnd (called then), color / ghost (CSS colours)

  Every stroke but the last fades while the next ones are drawn, so that two or three are to be seen at a time (the lines sit only about where the glyph has its strokes,
  this hides it). The look comes from CSS variables of the page: --so-ink (default --cinnabar, else a red), --so-ghost (default a mid grey that shows on light and on dark themes).
*/
(() => {
const BASE = 'https://cdn.qatt.org/stroke/r1/';
const NS = 'http://www.w3.org/2000/svg';
const cache = new Map();

function load(ch) {
  if (!ch || Array.from(ch).length !== 1) return Promise.resolve(null);
  if (!cache.has(ch)) {
    const hex = ch.codePointAt(0).toString(16).toUpperCase();
    cache.set(ch, fetch(BASE + hex + '.json').then(r => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get(ch);
}

function addCss() {
  if (document.getElementById('stroke-order-css')) return;
  const style = document.createElement('style');
  style.id = 'stroke-order-css';
  style.textContent = `
.so-svg { display: block; width: 100%; height: 100%; --so-fade-to: 0; }
.so-svg .so-ghost { fill: var(--so-ghost, #8a8a8a); fill-opacity: .42; }
.so-svg .so-s { fill: none; stroke: var(--so-ink, var(--cinnabar, #a8362a)); stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1 1; stroke-dashoffset: 1;
  animation: so-draw var(--t) ease-in-out var(--b) forwards, so-fade var(--fd) linear var(--e) forwards; }
.so-svg .so-s.so-last { animation: so-draw var(--t) ease-in-out var(--b) forwards; }
.so-svg .so-n { opacity: 0; animation: so-pop .15s var(--a) forwards; }
.so-svg .so-n circle { fill: var(--so-ink, var(--cinnabar, #a8362a)); stroke: #fff; stroke-width: 1.2; }
.so-svg .so-n text { fill: #fff; font: 700 8.5px system-ui, sans-serif; text-anchor: middle; }
@keyframes so-draw { to { stroke-dashoffset: 0; } }
@keyframes so-fade { to { opacity: var(--so-fade-to); } }
@keyframes so-pop { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .so-svg .so-s { animation-duration: .01s !important; animation-delay: 0s !important; } }`;
  document.head.append(style);
}

function pathLength(d) {   // about, from the points of the path
  const n = (d.match(/-?\d+\.?\d*/g) || []).map(Number); let len = 0;
  for (let i = 2; i + 1 < n.length; i += 2) len += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]);
  return len;
}

// the drawing as an element and its length in ms
function build(rec, o = {}) {
  const speed = o.speed || 1, svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('class', 'so-svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', rec.c);
  if (o.fadeTo != null) svg.style.setProperty('--so-fade-to', String(o.fadeTo));
  if (o.color) svg.style.setProperty('--so-ink', o.color);
  if (o.ghost) svg.style.setProperty('--so-ghost', o.ghost);
  const el = (name, attrs, parent) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.append(e); return e; };
  el('path', { class: 'so-ghost', d: rec.G }, svg);
  const groups = rec.g, slots = [];   // the time of every stroke (seconds)
  let t = 0.3;
  groups.forEach((g, gi) => {
    const first = t, lines = g.map(j => { const d = Math.max(0.35, 0.18 + pathLength(rec.L[j]) * 0.0045) / speed; const s = { j, b: t, d }; t += d; return s; });
    slots.push({ gi, first, end: t, lines });
    t += 0.18 / speed;
  });
  const mean = (t - 0.3) / Math.max(1, groups.length), fade = Math.max(0.6, mean * 2.5);   // two or three strokes are to be seen at a time
  slots.forEach(s => {
    s.lines.forEach(l => {
      const p = el('path', { class: 'so-s' + (s.gi === groups.length - 1 ? ' so-last' : ''), pathLength: 1, d: rec.L[l.j] }, svg);
      p.style.cssText = `--b:${l.b.toFixed(2)}s;--t:${l.d.toFixed(2)}s;--e:${s.end.toFixed(2)}s;--fd:${fade.toFixed(2)}s`;
    });
    if (o.numbers) {
      const n = (rec.L[s.lines[0].j].match(/-?\d+\.?\d*/g) || []).map(Number), dx = n[2] - n[0], dy = n[3] - n[1], dd = Math.hypot(dx, dy) || 1, k = Math.min(10, dd / 2);
      const x = n[0] + dx / dd * k, y = n[1] + dy / dd * k;
      const g = el('g', { class: 'so-n' }, svg); g.style.setProperty('--a', s.end.toFixed(2) + 's');
      el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 6.5 }, g);
      const tx = el('text', { x: x.toFixed(1), y: (y + 3).toFixed(1) }, g); tx.textContent = s.gi + 1;
    }
  });
  return { svg, ms: t * 1000 };
}

function play(host, rec, o = {}) {
  addCss();
  let timer = null, alive = true;
  const start = () => {
    clearTimeout(timer);
    const { svg, ms } = build(rec, o);
    host.replaceChildren(svg);
    if (o.restartOnClick !== false) { svg.style.cursor = 'pointer'; svg.addEventListener('click', ev => { ev.stopPropagation(); start(); }); }
    timer = setTimeout(() => { if (alive && host.isConnected) o.onEnd?.(); }, ms + (o.hold ?? 2000));
  };
  start();
  return { restart: start, stop() { alive = false; clearTimeout(timer); } };
}

window.StrokeOrder = { load, play, build };
})();
