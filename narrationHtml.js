// narrationHtml — a deck's narration in the page: the speaker's notes, a presenter window, and a listen mode
// that plays the deck by itself, in the speaker's voice. For decks built as HTML strings, on <deck-stage>.
//
//   page += notesData(steps.map(s => s.notes));     // each click's notes: { slide, step, steps, now: [], earlier: [] }
//   page += embedClips(texts, …).tags;              // the clips (storydeck/voice), when there are any
//   page += `<script>(${notesRuntime})();(${listenRuntime})();</script>`;   // and storydeck/narration.css
//
// N shows this click's notes in this window (practice); P opens a presenter window (a smaller slide, the notes,
// the next click, a clock) that moves with this one. L plays the deck: each click's narration in the speaker's
// voice (a clip from storydeck/voice) or, without one, the browser's; captions light sentence by sentence, and
// the deck moves on when a click's narration ends. Space pauses, ← → move (and keep reading), [ ] slower /
// faster, L or Esc stops. A line after [draft] — a bridge written for the deck — shows in amber.
// The runtimes are self-contained, so they can be inlined with `(${fn})()`.

/** Each click's notes as a JSON <script> the runtimes read (id deck-notes); safe inside HTML. */
export function notesData(notes) {
  return `<script type="application/json" id="deck-notes">${JSON.stringify(notes).replace(/</g, '\\u003c')}</script>`;
}

/** Runs in the page: N shows this click's notes here (practice); P opens a presenter window that stays in step. */
export function notesRuntime() {
  const stage = document.querySelector('deck-stage'), data = document.getElementById('deck-notes');
  if (!stage || !data) return;
  const notes = JSON.parse(data.textContent), presenter = window.name === 'deck-presenter';
  const panel = document.createElement('aside'); panel.className = 'notes-panel'; document.body.appendChild(panel);
  if (presenter) document.body.classList.add('presenter');
  const started = Date.now(); let other = null;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const para = (s) => s.split('\n').map((l) => `<p>${esc(l)}</p>`).join('');
  const show = (i) => {
    const n = notes[i] ?? {}, next = notes[i + 1];
    const ms = Date.now() - started, clock = new Date(ms).toISOString().slice(ms >= 36e6 ? 11 : ms >= 3.6e6 ? 12 : 14, 19);
    panel.innerHTML = `<header><b>${esc(n.slide ?? '')}</b><span>${n.steps ? `step ${esc(String(n.step))} of ${esc(String(n.steps))}` : ''}</span><span class="clock">${clock}</span></header>`
      + `<div class="now">${n.now?.length ? n.now.map(para).join('') : '<p class="none">(no note for this click)</p>'}</div>`
      + (n.earlier?.length ? `<div class="earlier">${n.earlier.map(para).join('')}</div>` : '')
      + `<footer>${next ? `next: ${esc(next.slide ?? '')}${next.step ? ` · step ${esc(String(next.step))}` : ''}` : 'last slide'} · ${i + 1} / ${notes.length}</footer>`;
  };
  const send = (i) => { try { (presenter ? window.opener : other)?.postMessage({ deckSync: i }, '*'); } catch { /* the other window is gone */ } };
  // a move that came from the other window is not sent back to it (two quick moves would bounce between them)
  let echo = null;
  stage.addEventListener('slidechange', (e) => { show(e.detail.index); if (e.detail.index === echo) echo = null; else send(e.detail.index); });
  window.addEventListener('message', (e) => { const i = e.data?.deckSync; if (Number.isInteger(i) && i !== stage.index) { echo = i; stage.goTo(i); } });
  window.addEventListener('keydown', (e) => {
    const t = e.target;   // keys typed into a field on a slide are the field's
    if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    if ((e.key === 'n' || e.key === 'N') && !presenter) { e.preventDefault(); e.stopImmediatePropagation(); document.body.classList.toggle('practice'); }
    if ((e.key === 'p' || e.key === 'P') && !presenter) {
      e.preventDefault(); e.stopImmediatePropagation();
      other = window.open(`${location.pathname}${location.search}#${stage.index + 1}`, 'deck-presenter', 'width=1500,height=900');
    }
  }, true);
  setInterval(() => show(stage.index), 1000);
  show(stage.index ?? 0);
}

/** Runs in the page: L plays the deck by itself, in the speaker's voice (clips) or the browser's, with captions. */
export function listenRuntime() {
  const stage = document.querySelector('deck-stage'), data = document.getElementById('deck-notes');
  if (!stage || !data || !('speechSynthesis' in window)) return;
  const notes = JSON.parse(data.textContent), synth = window.speechSynthesis;
  const panel = document.createElement('aside'); panel.className = 'train-panel'; document.body.appendChild(panel);
  let on = false, paused = false, rate = 1, voice = null, token = 0, timer = 0, at = 0, said = 0;
  const pickVoice = () => {
    const vs = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    voice = vs.find((v) => /Samantha|Daniel|Google US English|Karen|Moira/i.test(v.name)) ?? vs.find((v) => v.default) ?? vs[0] ?? null;
  };
  pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice);
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const count = (s) => (s.replace(/\[draft\]/g, '').match(/\S+/g) ?? []).length;
  const wordsOf = (i) => count((notes[i]?.now ?? []).join(' '));
  const total = notes.reduce((n, _, i) => n + wordsOf(i), 0);
  // a click's narration as sentences; in each note, what follows [draft] is the deck's bridge
  const sentences = (i) => {
    const out = [];
    let lead = '';
    for (const note of notes[i]?.now ?? []) {
      let draft = false;
      for (const part of note.split(/(\[draft\])/)) {
        if (part === '[draft]') { draft = true; continue; }
        for (const t of part.trim().replace(/([.?!])\s+/g, '$1\u0000').split('\u0000').map((x) => x.trim()).filter(Boolean)) {
          // a sentence with no letter and no digit (a lone "...") is never said: it joins its neighbour, as the voice's split does
          if (/[\p{L}\p{N}]/u.test(t)) { out.push({ t: lead + t, draft }); lead = ''; }
          else if (out.length) out[out.length - 1].t += ` ${t}`;
          else lead += `${t} `;
        }
      }
    }
    return out;
  };
  // the speaker's own voice: one clip per click, carried in the page (storydeck/voice · embedClips); else the browser's
  const vdata = JSON.parse(document.getElementById('deck-voice')?.textContent ?? 'null'), urls = {}, audio = new Audio();
  const clipOf = (i) => { const key = vdata?.steps?.[i]; return key ? { key, ...vdata.clips[key] } : null; };
  const urlOf = (key) => urls[key] ??= URL.createObjectURL(new Blob([Uint8Array.from(atob(document.getElementById(`vc-${key}`).textContent.trim()), (c) => c.charCodeAt(0))], { type: 'audio/mp4' }));
  const render = (i, k) => {
    const n = notes[i] ?? {}, ss = sentences(i), done = notes.slice(0, i).reduce((a, _, j) => a + wordsOf(j), 0), min = (w) => (w / 150 / rate).toFixed(1);
    panel.innerHTML = `<header><b>${esc(n.slide ?? '')}</b><span>${n.steps ? `click ${esc(String(n.step))} of ${esc(String(n.steps))}` : 'slide'}</span><span>#${i + 1} of ${notes.length}</span>`
      + `<span class="time">${min(done)} of ${min(total)} min</span><span class="who">${clipOf(i) ? 'your voice' : 'browser voice'}</span><span class="keys">${paused ? 'paused · Space resumes' : 'Space pause'} · ← → move · [ ] speed ${rate.toFixed(1)}× · L stop</span></header>`
      + `<div class="say">${ss.length ? ss.map((x, j) => `<span class="${x.draft ? 'draft ' : ''}${j < k ? 'past' : j === k ? 'now' : 'next'}">${esc(x.t)}</span>`).join(' ') : '<span class="none">(no narration on this click)</span>'}</div>`
      + '<footer><i class="d"></i> amber = a [draft] bridge line · white = your own words</footer>';
  };
  const next = (i, my) => { if (my === token && on && !paused) { if (i + 1 < notes.length) stage.goTo(i + 1); else stop(); } };
  const speak = (i, from = 0) => {
    const my = ++token; synth.cancel(); audio.pause(); clearTimeout(timer); at = i; said = from;
    const ss = sentences(i), clip = clipOf(i);
    render(i, ss.length ? from : -1);
    if (!ss.length) { timer = setTimeout(() => next(i, my), 2500); return; }
    if (clip) {
      // the caption follows the voice: each sentence lights from its first word's aligned start
      const starts = clip.s.length === ss.length ? clip.s : ss.map((_, k) => clip.d * ss.slice(0, k).reduce((a, x) => a + x.t.length, 0) / ss.reduce((a, x) => a + x.t.length, 0));
      audio.src = urlOf(clip.key); audio.playbackRate = rate;
      audio.ontimeupdate = () => { if (my !== token) return; let k = 0; while (k + 1 < starts.length && starts[k + 1] <= audio.currentTime) k++; if (k !== said) { said = k; render(i, k); } };
      audio.onended = () => { if (my === token) { render(i, ss.length); timer = setTimeout(() => next(i, my), 800); } };
      audio.onloadedmetadata = () => { if (my === token) { audio.currentTime = from ? Math.max(0, starts[from] - 0.1) : 0; audio.play().catch(() => {}); } };
      return;
    }
    ss.slice(from).forEach((x, j) => {
      const k = from + j, u = new SpeechSynthesisUtterance(x.t);
      if (voice) u.voice = voice; u.rate = rate;
      u.onstart = () => { if (my === token) { said = k; render(i, k); } };
      if (k === ss.length - 1) u.onend = () => { if (my === token) { render(i, ss.length); timer = setTimeout(() => next(i, my), 800); } };
      synth.speak(u);
    });
  };
  const start = () => { on = true; paused = false; document.body.classList.add('train'); speak(stage.index ?? 0); };
  const stop = () => { on = false; paused = false; token++; synth.cancel(); audio.pause(); clearTimeout(timer); document.body.classList.remove('train'); };
  stage.addEventListener('slidechange', (e) => { if (on) { paused = false; speak(e.detail.index); } });
  window.addEventListener('keydown', (e) => {
    const t = e.target;   // keys typed into a field on a slide are the field's
    if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    const k = e.key;
    if (k === 'l' || k === 'L') { e.preventDefault(); e.stopImmediatePropagation(); on ? stop() : start(); return; }
    if (!on) return;
    if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stop(); }
    else if (k === ' ') {
      e.preventDefault(); e.stopImmediatePropagation(); paused = !paused;
      const own = clipOf(at);
      if (paused) { own ? audio.pause() : synth.pause(); clearTimeout(timer); render(at, said); }
      else if (own) { audio.ended ? speak(at, said) : audio.play().catch(() => {}); render(at, said); }
      else { synth.resume(); if (!synth.speaking) speak(at, said); else render(at, said); }
    } else if (k === '[' || k === ']') {
      e.preventDefault(); e.stopImmediatePropagation();
      rate = Math.min(1.6, Math.max(0.6, rate + (k === ']' ? 0.1 : -0.1)));
      if (clipOf(at)) { audio.playbackRate = rate; render(at, said); } else speak(at, said);
    }
  }, true);
}
