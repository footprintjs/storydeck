// Grouping: fold consecutive deck slides that share a `data-group` into ONE section with N steps.
//   Read view  -> one figure = the LAST step (the fully-built diagram) + one authored body.
//   Watch view -> plays EVERY step of every section (the full progressive deck).
// Slides with no group stand alone (a 1-step section). This is what lets a progressive build
// (several slides of one diagram) read as a single annotated figure instead of a slide dump.

export function parseGroup(html) {
  const m = /data-group\s*=\s*"([^"]+)"/.exec(html);
  return m ? m[1] : null;
}

// ── Additive builds (cross-slide accumulation) ────────────────────────────────
// A deck slide whose OPENING tag carries data-build="add" layers on top of the
// previous slide instead of replacing it (the Watch engine stacks the live
// slides — see deck-stage.js USAGE (h)). For the static lenses we pre-stack:
// the composite of an additive slide = its chain (nearest earlier non-additive
// slide + every additive slide since) concatenated in order. Sibling sections
// stack absolutely inside a figure canvas, additive layers are transparent,
// and non-final layers hide their [data-chrome] furniture (storydeck.css) —
// so a Read/Scrolly figure shows the same fully-built composite the Watch
// deck shows on that slide.

const ADDITIVE_RE = /^\s*<section\b[^>]*\bdata-build\s*=\s*"add"/i;

export function isAdditiveSlide(html) {
  return ADDITIVE_RE.test(html || '');
}

// slides: [{ label, html }] -> same shape, html replaced by the composite.
// A deck with no data-build attributes comes back with identical html.
export function compositeSlides(slides) {
  const out = [];
  let chain = [];
  for (const slide of slides) {
    if (out.length && isAdditiveSlide(slide.html)) chain.push(slide.html);
    else chain = [slide.html];
    out.push({ ...slide, html: chain.join('\n') });
  }
  return out;
}

// slides: [{ label, html, group? }]  ->  [{ key, label, heading, body, steps: [html, ...] }]
export function buildSections(slides, { headings = {}, bodies = {} } = {}) {
  const out = [];
  for (const slide of slides) {
    const group = slide.group ?? parseGroup(slide.html);
    const key = group || slide.label;
    const prev = out[out.length - 1];
    if (group && prev && prev.key === key) {
      prev.steps.push(slide.html); // extend the current group
      continue;
    }
    out.push({
      key,
      label: slide.label,
      heading: headings[key] || slide.label,
      body: bodies[key] || '',
      steps: [slide.html],
    });
  }
  return out;
}

// The single figure shown in the Read view for a section = its final built step.
export function finalStep(section) {
  return section.steps[section.steps.length - 1];
}

// All slides, in order, for the Watch deck.
export function allSteps(sections) {
  return sections.flatMap((s) => s.steps);
}
