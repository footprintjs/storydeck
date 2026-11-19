// chart — a run of a deck, wiring only: the folder read and compiled once, read against every rule, measured in a
// browser when asked, written when asked, and given a verdict. Each stage's logic is in stages.js; the browser is an
// adapter with a chart of its own (measure.js), mounted where a measure is asked for; engine.js builds this list with
// footprintjs. `run` is one run's working memory: what was asked, the deck as compiled, its page.
import {measureMount, measureWiring} from './measure.js';
import {broken, checkRules, clean, compiles, countProblems, fix, measureAsked, notAsked, readDeck, readNotes, verdict, writePage, writes} from './stages.js';

export function runWiring(run) {
  const with_ = (stage) => (scope) => stage(scope, run);
  return [
    {id: 'read-deck', name: 'read deck', about: 'The deck folder read and compiled once, or why it cannot be', run: with_(readDeck)},
    {id: 'compiles', name: 'compiles?', about: 'Whether the deck compiled', run: compiles(run), branches: [
      {id: 'check-rules', name: 'check rules', about: 'Every rule a compiled deck is read against', run: with_(checkRules)},
      {id: 'broken', name: 'broken', about: 'It does not compile: that one problem is the answer, and the run stops', run: broken},
    ]},
    {id: 'read-notes', name: 'read notes', about: 'The notes the person left in their dev page', run: with_(readNotes)},
    {id: 'measure-asked', name: 'measure asked?', about: 'Whether the page is measured in a browser', run: measureAsked(run), branches: [
      {id: 'measure', name: 'measure layout', wiring: measureWiring(run), ...measureMount},
      {id: 'not-asked', name: 'not asked', about: 'No measure was asked for', run: notAsked},
    ]},
    {id: 'writes', name: 'write asked?', about: 'Whether the page is written', run: writes(run), branches: [
      {id: 'write-page', name: 'write page', about: 'The page written: the same reading that was checked', run: with_(writePage)},
      {id: 'check-only', name: 'check only', about: 'Only a check was asked for: nothing is written', run: () => {}},
    ]},
    {id: 'count-problems', name: 'count problems', about: 'How many errors, warnings and notes', run: countProblems},
    {id: 'verdict', name: 'verdict', about: 'Whether there is anything to fix', run: verdict(run), branches: [
      {id: 'fix', name: 'fix', about: 'There is something to fix', run: fix},
      {id: 'clean', name: 'clean', about: 'Nothing to fix', run: clean},
    ]},
  ];
}
