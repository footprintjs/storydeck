// focusHtml — a focus plan (focus.js) written into slide HTML, for decks built as HTML strings.
//
//   const {html, pieces} = readPieces(mapHtml);          // every element with data-k="name …" is a piece
//   const {looks} = planFocus(steps, {pieces, area});      // one look per click
//   looks.map(look => wrapStage(drawFocus(html, look), look) + focusOverlay(look, {area}));
//
// Pieces are read from their inline style (left/top/width/height in px; an <svg>'s width/height
// attributes too): a piece without left/top keeps its place whatever the strategy, and one without a
// size moves by its top-left corner. focus.css draws the classes; focusRuntime (inlined in the page)
// makes a jump or a step back land at once, so only a forward click animates.

const PIECE = attr => new RegExp(`<([a-zA-Z][\\w-]*)\\b([^>]*?)\\s${attr}="([^"]+)"([^>]*)>`, 'g');

/** The px value of a CSS property in an inline style, or null. */
function px(style, prop) {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(-?[\\d.]+)px`).exec(style);
  return m ? Number(m[1]) : null;
}

/**
 * The pieces of a slide: every element carrying `attr` (data-k) — its names, and its box when its inline
 * style places it. Returns {html, pieces}: the same HTML with each piece numbered (data-sd-i), and the
 * pieces in order.
 */
export function readPieces(html, {attr = 'data-k'} = {}) {
  const pieces = [];
  const out = html.replace(PIECE(attr), (_, tag, a, k, b) => {
    const at = a + b, style = /\sstyle="([^"]*)"/.exec(at)?.[1] ?? '';
    const attrPx = name => { const m = new RegExp(`\\s${name}="([\\d.]+)"`).exec(at); return m ? Number(m[1]) : null; };
    const x = px(style, 'left'), y = px(style, 'top'), w = px(style, 'width') ?? attrPx('width'), h = px(style, 'height') ?? attrPx('height');
    pieces.push({keys: k.trim().split(/\s+/), box: x === null || y === null ? null : {x, y, w: w ?? 0, h: h ?? 0}});
    return `<${tag}${a} ${attr}="${k}" data-sd-i="${pieces.length - 1}"${b}>`;
  });
  return {html: out, pieces};
}

/** The classes and style a piece gets for its look. */
function pieceLook(p) {
  const cls = ['sd', `sd-${p.state}`];
  if (p.change) cls.push(`sd-${p.change}`);
  if (p.look && p.look !== 'grey') cls.push(`sd-${p.look}`);
  if (p.hot) cls.push('sd-hot');
  if (p.hotIn) cls.push('sd-hot-in');
  const vars = [];
  if (p.move) { cls.push('sd-moved'); vars.push(`--sd-dx:${p.move.dx}px`, `--sd-dy:${p.move.dy}px`, `--sd-s:${p.move.s}`); }
  if (p.from) { cls.push('sd-move'); vars.push(`--sd-dx0:${p.from.dx}px`, `--sd-dy0:${p.from.dy}px`, `--sd-s0:${p.from.s}`); }
  if ((p.move ?? p.from)?.origin === 'top-left') cls.push('sd-origin-tl');
  return {cls: cls.join(' '), style: vars.join(';')};
}

/** The slide HTML (as readPieces returned it) with each piece dressed for this click's look. */
export function drawFocus(html, look) {
  return html.replace(/<([a-zA-Z][\w-]*)\b([^>]*?)\sdata-sd-i="(\d+)"([^>]*)>/g, (_, tag, a, i, b) => {
    const p = look.pieces[Number(i)];
    if (!p) throw new Error(`piece ${i} is not in this look (read the pieces and plan the look from the same HTML)`);
    const {cls, style} = pieceLook(p);
    let at = a + b;
    at = /\sclass="/.test(at) ? at.replace(/\sclass="([^"]*)"/, (_, c) => ` class="${c} ${cls}"`) : `${at} class="${cls}"`;
    if (style) at = /\sstyle="/.test(at) ? at.replace(/\sstyle="([^"]*)"/, (_, s) => ` style="${s.replace(/;\s*$/, '')};${style}"`) : `${at} style="${style}"`;
    return `<${tag}${at}>`;
  });
}

/** The pieces' HTML inside the stage the view moves (a zoom); unchanged when nothing moves the view. */
export function wrapStage(inner, look) {
  if (!look.stage) return inner;
  const {move, from} = look.stage, vars = [];
  if (move) vars.push(`--sd-tx:${move.x}px`, `--sd-ty:${move.y}px`, `--sd-ts:${move.s}`);
  if (from) vars.push(`--sd-tx0:${from.x}px`, `--sd-ty0:${from.y}px`, `--sd-ts0:${from.s}`);
  return `<div class="sd-stage${from ? ' sd-move' : ''}"${vars.length ? ` style="${vars.join(';')}"` : ''}>${inner}</div>`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/**
 * The overlay of a click (a blur with holes, a frame and its label), in slide pixels. `area` ([x0, y0, x1, y1])
 * limits the blur, so a headline above it stays clear. Empty when the click has none.
 */
export function focusOverlay(look, {canvas = {w: 1920, h: 1080}, area} = {}) {
  const o = look.overlay;
  if (!o || !o.rects.length) return '';
  const [x0, y0, x1, y1] = area ?? [0, 0, canvas.w, canvas.h];
  const holes = o.rects.map(([x, y, w, h]) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`).join(' ');
  const veil = `<div class="sd-veil sd-veil-${o.phase}" style="width:${canvas.w}px;height:${canvas.h}px;clip-path:path(evenodd,'M${x0} ${y0}H${x1}V${y1}H${x0}Z ${holes}')"></div>`;
  if (o.phase === 'out') return veil;
  const [x, y, w, h] = o.rects[0];
  return `${veil}<div class="sd-frame${o.phase === 'in-new' ? ' sd-new' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${o.label ? `<span>${esc(o.label)}</span>` : ''}</div>`;
}

/**
 * Runs in the page (inline it: `(${focusRuntime})()`): only a forward click animates its changes; a jump,
 * a deep link or a step back lands on the click at once — what you arrive at is a place, not a change.
 */
export function focusRuntime() {
  const stage = document.querySelector('deck-stage');
  if (!stage) return;
  stage.addEventListener('slidechange', e => {
    document.querySelectorAll('[data-sd-instant]').forEach(s => s.removeAttribute('data-sd-instant'));
    if (e.detail.slide && e.detail.index !== e.detail.previousIndex + 1) e.detail.slide.setAttribute('data-sd-instant', '');
  });
}
