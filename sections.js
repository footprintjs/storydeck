// Grouping: fold consecutive deck slides that share a `data-group` into ONE section with N steps.
//   Read view  -> one figure = the LAST step (the fully-built diagram) + one authored body.
//   Watch view -> plays EVERY step of every section (the full progressive deck).
// Slides with no group stand alone (a 1-step section). This is what lets a progressive build
// (several slides of one diagram) read as a single annotated figure instead of a slide dump.

export function parseGroup(html) {
  const m = /data-group\s*=\s*"([^"]+)"/.exec(html);
  return m ? m[1] : null;
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
