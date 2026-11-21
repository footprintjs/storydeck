// why — `storydeck log --run <n|id> --why <key> [--map <map>]` as text: why one value of a kept run is what it is,
// walked back from a record (footprint-story/record · whyFromRecord), nothing run again. Without --map the run's own
// record is read; with it, that map's own (maps.js keeps one a map, beside the run's). Every refusal names what there
// is: the run's maps, or, when it built none, why not and the deck's other maps.
/** The first version that kept a map's record. */
const SINCE = '0.34.0';
const quoted = (text) => JSON.stringify(String(text).replace(/\s+/g, ' ').trim().slice(0, 60));
const listed = (names) => names.join(', ');

/**
 * Why `key` is what it is in a kept run (`run`, as log.js · keptRuns reads it; `n` its number in the list). `map`, a
 * name: the answer comes from that map's own record instead. The name asked is only compared with the names kept:
 * no file is found by it.
 */
export async function whyText(run, n, key, {all = false, map = null} = {}) {
  const {whyFromRecord} = await import('footprint-story/record');
  if (map === null) return whyFromRecord({file: run.record, control: run.control, key, run: `run ${n}`, all, listed: `storydeck log --run ${n} shows what each stage wrote`, more: 'add --all'});
  const m = mapOf(run, n, map);
  // what there is to ask is what that map's run wrote, as the run kept it (maps.js): no list of the steps of our own
  const names = m.keys.length ? listed(m.keys) : 'at, view, names, …';
  // no key: what there is to ask of a map, on one line
  if (!key.trim()) return `run ${n} map ${m.name}: --why names a value its steps wrote — ${names}`;
  const said = await whyFromRecord({file: m.record, control: m.control, key, run: `run ${n} map ${m.name}`, all, listed: `a map's steps write ${names}`, more: 'add --all'});
  // a map flow that parted from the page's map is said before its answer: the page draws the deck's
  return m.differs ? `(this map flow did not build the map the page draws: ${m.differs})\n${said}` : said;
}

/** The map a run kept by that name, with its record — or a refusal that says what there is. */
function mapOf(run, n, map) {
  if (typeof map !== 'string' || !map.trim()) throw new Error('--map names one of the run\'s maps by the deck\'s name for it (--map map, as data-map says)');
  // a run from 0.34.0 on says which maps it built again, even none: a run with no list was kept before maps were
  if (run.maps === undefined) throw new Error(`run ${n} was kept before ${SINCE}, which kept no map records: run the build again, then ask that run`);
  const maps = run.maps;
  if (!maps.length) {
    if (run.verdict === 'broken') throw new Error(`run ${n} kept no map: its deck did not compile, so no map was built`);
    if (run.verdict === 'failed' && !run.flat.length) throw new Error(`run ${n} kept no map: it could not finish (${run.failure ?? 'the run stopped'})`);
    throw new Error(`run ${n} kept no map: its deck has no isometric map${run.flat.length ? ` — its maps are ${listed(run.flat)}, with no isometric piece` : ''}`);
  }
  const m = maps.find((x) => x.name === map.trim());
  if (!m) throw new Error(`run ${n} has no map ${quoted(map)}: its isometric maps are ${listed(maps.map((x) => x.name))}${run.flat.length ? ` (the deck's other maps, ${listed(run.flat)}, have no isometric piece)` : ''}`);
  if (!m.record) throw new Error(`run ${n}'s map ${m.name} kept no record (it could not be written, or its map flow did not finish${m.differs ? `: ${m.differs}` : ''}), so it cannot say why`);
  return m;
}
