import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notesData, notesRuntime, listenRuntime } from './narrationHtml';

const NOTES = [
  { slide: 'Intro', step: 0, steps: 1, now: ['Hello there. Second line.'], earlier: [] },
  { slide: 'Intro', step: 1, steps: 1, now: ['Mine. [draft] A bridge.'], earlier: ['Hello there.'] },
  { slide: 'Empty', now: [] },
];

/** A <deck-stage> stand-in: index, goTo, and the slidechange event the runtimes listen to. */
function mountDeck(notes = NOTES, voice = null) {
  document.body.innerHTML = '';
  document.body.className = '';
  const stage = document.createElement('deck-stage');
  stage.index = 0;
  stage.goTo = vi.fn((i) => { const previousIndex = stage.index; stage.index = i; stage.dispatchEvent(new CustomEvent('slidechange', { detail: { index: i, previousIndex } })); });
  document.body.append(stage);
  document.body.insertAdjacentHTML('beforeend', notesData(notes));
  if (voice) document.body.insertAdjacentHTML('beforeend', voice);
  return stage;
}
const press = (key, extra = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));

// Each runtime adds window listeners for good (a page runs it once); a test removes its own afterwards.
let added = [];
const addListener = window.addEventListener.bind(window);
beforeEach(() => {
  added = [];
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => { added.push([type, fn, opts]); addListener(type, fn, opts); });
});
afterEach(() => {
  for (const [type, fn, opts] of added) window.removeEventListener(type, fn, opts);
  vi.restoreAllMocks();
});

describe('narrationHtml · the notes in the page', () => {
  it('writes the notes as JSON a page can carry (no closing tag inside)', () => {
    const tag = notesData([{ now: ['a </script> b'] }]);
    expect(tag).toMatch(/^<script type="application\/json" id="deck-notes">/);
    expect(tag).not.toContain('</script> b');
    expect(JSON.parse(tag.replace(/^<script[^>]*>|<\/script>$/g, ''))).toEqual([{ now: ['a </script> b'] }]);
  });
});

describe('narrationHtml · notes runtime (N, P)', () => {
  beforeEach(() => { vi.useFakeTimers(); window.name = ''; });
  afterEach(() => { vi.useRealTimers(); });

  it('does nothing without a deck or notes', () => {
    document.body.innerHTML = '';
    notesRuntime();
    expect(document.querySelector('.notes-panel')).toBe(null);
  });

  it('shows this click\'s notes, the ones before, what comes next; N toggles them in this window', () => {
    const stage = mountDeck();
    notesRuntime();
    const panel = document.querySelector('.notes-panel');
    expect(panel.querySelector('.now').textContent).toBe('Hello there. Second line.');
    expect(panel.querySelector('footer').textContent).toBe('next: Intro · step 1 · 1 / 3');
    stage.goTo(1);
    expect(panel.querySelector('.earlier').textContent).toBe('Hello there.');
    stage.goTo(2);
    expect(panel.querySelector('.now').textContent).toBe('(no note for this click)');
    expect(panel.querySelector('footer').textContent).toBe('last slide · 3 / 3');
    press('n');
    expect(document.body.classList.contains('practice')).toBe(true);
    press('N', { metaKey: true });   // with a modifier: not ours
    expect(document.body.classList.contains('practice')).toBe(true);
    vi.advanceTimersByTime(1000);    // the clock ticks
    expect(panel.querySelector('.clock').textContent).toBe('00:01');
  });

  it('P opens a presenter window; the windows keep each other on the same click', () => {
    const stage = mountDeck();
    const other = { postMessage: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(other);
    notesRuntime();
    press('p');
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/#1$/), 'deck-presenter', 'width=1500,height=900');
    stage.goTo(1);
    expect(other.postMessage).toHaveBeenCalledWith({ deckSync: 1 }, '*');
    window.dispatchEvent(new MessageEvent('message', { data: { deckSync: 2 } }));
    expect(stage.goTo).toHaveBeenLastCalledWith(2);
    window.dispatchEvent(new MessageEvent('message', { data: { deckSync: 'x' } }));
    expect(stage.goTo).toHaveBeenCalledTimes(2);
    open.mockRestore();
  });

  it('in the presenter window: the presenter look, and N and P are the main window\'s', () => {
    window.name = 'deck-presenter';
    mountDeck();
    const open = vi.spyOn(window, 'open');
    notesRuntime();
    expect(document.body.classList.contains('presenter')).toBe(true);
    press('p'); press('n');
    expect(open).not.toHaveBeenCalled();
    expect(document.body.classList.contains('practice')).toBe(false);
    open.mockRestore();
  });
});

/** The browser's speech, faked: utterances queue, and the test says when each starts and ends. */
function fakeSpeech() {
  const queue = [];
  const synth = { speaking: false, cancel: vi.fn(() => queue.splice(0)), pause: vi.fn(), resume: vi.fn(), speak: vi.fn((u) => queue.push(u)),
    getVoices: () => [{ lang: 'fr-FR', name: 'Amelie' }, { lang: 'en-US', name: 'Samantha' }], addEventListener: vi.fn() };
  window.speechSynthesis = synth;
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  return { synth, queue };
}
/** Audio, faked: the test fires its events. */
function fakeAudio() {
  const made = [];
  window.Audio = function () { this.play = vi.fn(() => Promise.resolve()); this.pause = vi.fn(); this.currentTime = 0; this.ended = false; made.push(this); };
  window.URL.createObjectURL = vi.fn(() => 'blob:clip');
  return made;
}

describe('narrationHtml · listen runtime (L)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); delete window.speechSynthesis; });

  it('does nothing where the browser cannot speak', () => {
    mountDeck();
    delete window.speechSynthesis;
    listenRuntime();
    expect(document.querySelector('.train-panel')).toBe(null);
  });

  it('reads a click in the browser\'s voice, lights each sentence, and moves on when it ends', () => {
    const { synth, queue } = fakeSpeech(); fakeAudio();
    const stage = mountDeck();
    listenRuntime();
    press('l');
    expect(document.body.classList.contains('train')).toBe(true);
    expect(queue.map((u) => u.text)).toEqual(['Hello there.', 'Second line.']);
    expect(queue[0].voice.name).toBe('Samantha');
    const panel = document.querySelector('.train-panel');
    expect(panel.querySelector('.who').textContent).toBe('browser voice');
    queue[1].onstart();
    expect(panel.querySelector('.say .now').textContent).toBe('Second line.');
    queue[1].onend();
    vi.advanceTimersByTime(800);
    expect(stage.goTo).toHaveBeenCalledWith(1);
    // the next click: a [draft] bridge line shows apart
    expect(panel.querySelectorAll('.say .draft')).toHaveLength(1);
    // [ ] change the speed (the browser's voice starts the sentence again at the new rate)
    press(']');
    expect(panel.querySelector('.keys').textContent).toContain('1.1×');
    press('[');
    expect(panel.querySelector('.keys').textContent).toContain('1.0×');
    // Space pauses and resumes; L stops
    press(' ');
    expect(synth.pause).toHaveBeenCalled();
    expect(panel.querySelector('.keys').textContent).toContain('paused');
    press(' ');
    expect(synth.resume).toHaveBeenCalled();
    press('L');
    expect(document.body.classList.contains('train')).toBe(false);
  });

  it('waits on a click without narration, and stops after the last click', () => {
    const { queue } = fakeSpeech(); fakeAudio();
    const stage = mountDeck();
    stage.index = 2;
    listenRuntime();
    press('l');
    expect(queue).toHaveLength(0);
    expect(document.querySelector('.train-panel .none').textContent).toBe('(no narration on this click)');
    vi.advanceTimersByTime(2500);
    expect(document.body.classList.contains('train')).toBe(false);
    press('Escape');   // not listening: Escape is the page's
    press('x');
  });

  it('plays the speaker\'s own clip when the page carries one, captions following the clip\'s sentence starts', () => {
    fakeSpeech();
    const audios = fakeAudio();
    const voice = `<script type="application/json" id="deck-voice">${JSON.stringify({ steps: ['k1', null, null], clips: { k1: { d: 4, s: [0, 2] } } })}</script>`
      + `<script type="application/octet-stream" id="vc-k1">${btoa('m4a')}</script>`;
    const stage = mountDeck(NOTES, voice);
    listenRuntime();
    const audio = audios[0];
    press('l');
    expect(audio.src).toBe('blob:clip');
    expect(document.querySelector('.train-panel .who').textContent).toBe('your voice');
    audio.onloadedmetadata();
    expect(audio.play).toHaveBeenCalled();
    audio.currentTime = 2.5; audio.ontimeupdate();
    expect(document.querySelector('.train-panel .say .now').textContent).toBe('Second line.');
    press(' ');                       // pause the clip
    expect(audio.pause).toHaveBeenCalled();
    press(' ');                       // and play it on
    expect(audio.play).toHaveBeenCalledTimes(2);
    press(']');
    expect(audio.playbackRate).toBeCloseTo(1.1);
    audio.onended();
    vi.advanceTimersByTime(800);
    expect(stage.goTo).toHaveBeenCalledWith(1);
  });

  it('spreads the captions over the clip by length when its sentence starts do not line up', () => {
    fakeSpeech();
    const audios = fakeAudio();
    const voice = `<script type="application/json" id="deck-voice">${JSON.stringify({ steps: ['k1'], clips: { k1: { d: 10, s: [0] } } })}</script>`
      + `<script type="application/octet-stream" id="vc-k1">${btoa('m4a')}</script>`;
    mountDeck([{ slide: 'S', now: ['Aaaa. Bbbb.'] }], voice);
    listenRuntime();
    press('l');
    const audio = audios[0];
    audio.currentTime = 4.9; audio.ontimeupdate();
    expect(document.querySelector('.train-panel .say .now').textContent).toBe('Aaaa.');
    audio.currentTime = 5.1; audio.ontimeupdate();
    expect(document.querySelector('.train-panel .say .now').textContent).toBe('Bbbb.');
    // a clip that already ended plays its sentence again on resume
    press(' '); audio.ended = true; press(' ');
    audio.onloadedmetadata();
    expect(audio.currentTime).toBeCloseTo(4.9);
  });
});
