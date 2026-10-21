// transforms — the drawing helpers a deck's HTML may use, applied before its pieces are read. Plain strings in,
// plain strings out; no deck code runs, so a dev server never executes what it serves.
//
//   <i data-k="wire1" class="wire pkt" data-arrow="252 352 318 352"></i>   a wire: an SVG arrow in slide pixels
//   <i class="ic" data-icon="server"></i>                                  a drawn identity: icons/server.svg inline
//
// A wire is `x1 y1 x2 y2` and an optional bend (px off the straight line, + to the left of travel): a quadratic
// curve with an arrow head, in an <svg> placed and sized to hold it, so it is a focus piece like any other (its
// data-k and class are kept, and "wire" is added to its class). Class "pkt" adds a packet that a deck's CSS can run
// along it (hidden at rest, so print, a jump and reduced motion show the plain wire).

const fixed = (v) => +v.toFixed(1);

/** One wire's SVG: the element's own attributes kept, a box that holds the curve, the curve, the head, and its packet. */
function wireSvg(attrs, spec) {
  const parts = spec.trim().split(/[\s,]+/).map(Number);
  if ((parts.length !== 4 && parts.length !== 5) || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`data-arrow="${spec}": a wire is "x1 y1 x2 y2" and an optional bend, in slide px`);
  }
  const [x1, y1, x2, y2, bend = 0] = parts;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const cx = (x1 + x2) / 2 - (dy / len) * bend, cy = (y1 + y2) / 2 + (dx / len) * bend;
  const tl = Math.hypot(x2 - cx, y2 - cy) || 1, ux = (x2 - cx) / tl, uy = (y2 - cy) / tl, hs = 18;
  const pad = 20, X = Math.min(x1, x2, cx) - pad, Y = Math.min(y1, y2, cy) - pad;
  const W = Math.max(x1, x2, cx) + pad - X, H = Math.max(y1, y2, cy) + pad - Y, f = fixed;
  const ex = x2 - ux * hs * 0.8, ey = y2 - uy * hs * 0.8;
  const d = `M${f(x1 - X)} ${f(y1 - Y)} Q${f(cx - X)} ${f(cy - Y)} ${f(ex - X)} ${f(ey - Y)}`;
  const tip = [x2 - X, y2 - Y], back = [tip[0] - ux * hs, tip[1] - uy * hs], nx = -uy * hs * 0.6, ny = ux * hs * 0.6;
  const head = `<path class="head" d="M${f(tip[0])} ${f(tip[1])}L${f(back[0] + nx)} ${f(back[1] + ny)}L${f(back[0] - nx)} ${f(back[1] - ny)}Z"/>`;
  let at = attrs.replace(/\sclass="([^"]*)"/, (_, c) => ` class="${/(^|\s)wire(\s|$)/.test(c) ? c : `wire ${c}`}"`);
  if (!/\sclass="/.test(at)) at += ' class="wire"';
  const pkt = /\bpkt\b/.test(at)
    ? `<rect class="pkt" x="${f(x1 - X - 8)}" y="${f(y1 - Y - 6)}" width="16" height="12" rx="3" style="--pdx:${f(ex - x1)}px;--pdy:${f(ey - y1)}px"/>`
    : '';
  return `<svg${at} style="left:${f(X)}px;top:${f(Y)}px;width:${f(W)}px;height:${f(H)}px" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><path d="${d}"/>${head}${pkt}</svg>`;
}

/** Every <i data-arrow="…"></i> as its wire. */
export function wires(html) {
  return html.replace(/<i\b([^>]*?)\sdata-arrow="([^"]+)"([^>]*)><\/i>/g, (_, a, spec, b) => wireSvg(a + b, spec));
}

/** An icon file's drawing: {viewBox, body} from a whole <svg …>…</svg>. */
export function readIcon(name, svg) {
  const m = /<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*<\?xml[^>]*>/, '').trim());
  if (!m) throw new Error(`icon "${name}": an icon file is one <svg viewBox="…">…</svg>`);
  const viewBox = /\sviewBox=(["'])([^"']+)\1/.exec(m[1])?.[2];
  if (!viewBox) throw new Error(`icon "${name}": its <svg> has no viewBox — give it one (e.g. viewBox="0 0 64 64")`);
  return {viewBox, body: m[2].trim()};
}

/** Every <i … data-icon="name"></i> as that icon's SVG, keeping the element's other attributes. */
export function icons(html, set = {}) {
  return html.replace(/<i\b([^>]*?)\sdata-icon="([\w-]+)"([^>]*)><\/i>/g, (_, a, key, b) => {
    const icon = set[key];
    if (!icon) {
      const known = Object.keys(set);
      throw new Error(`no icon "${key}" (${known.length ? `there are ${known.join(', ')}` : 'the deck has no icons'}) — add icons/${key}.svg`);
    }
    return `<svg${a}${b} viewBox="${icon.viewBox}" aria-hidden="true">${icon.body}</svg>`;
  });
}

/** The built-in helpers, in the order they run: icons first (a wire never holds one), then wires. */
export function applyTransforms(html, {icons: set = {}} = {}) {
  return wires(icons(html, set));
}
