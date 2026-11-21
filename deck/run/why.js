// why — `storydeck log --run <n|id> --why <key> [--map <map>]` as text: why one value of a kept run is what it is,
// walked back from a record (footprint-story/record · whyFromRecord), nothing run again. Without --map the run's own
// record is read; with it, that map's own (maps.js keeps one a map, beside the run's). Every refusal names what there
// is: the run's maps, or, when it built none, why not and the deck's other maps.
/** The first version that kept a map's record. */
const SINCE = '0.34.0';
const quoted = (text) => JSON.stringify(String(text).replace(/\s+/g, ' ').trim().slice(0, 60));
const listed = (names) => names.join(', ');
/** Text from a kept file, on one line: a line break in it cannot start a line of the answer. */
const oneLine = (text) => String(text).replace(/\s+/g, ' ').trim();

/**
 * Why `key` is what it is in a kept run (`run`, as log.js · keptRuns reads it; `n` how it was asked for — its number
 * in the list, or its id — and so how every line names it). `map`, a name: the answer comes from that map's own record
 * instead. The name asked is only compared with the names kept: no file is found by it. No key is refused, as the
 * reader refuses it, with what there is to ask: the run's own, or that map's.
 */
export async function whyText(run, n, key, {all = false, map = null} = {}) {
  const {whyFromRecord} = await import('footprint-story/record');
  const own = `storydeck log --run ${n} shows what each stage wrote`;
  if (map === null) {
    if (!key.trim()) throw new Error(`why names a value of the run, one of what its stages wrote (${own})`);
    return whyFromRecord({file: run.record, control: run.control, key, run: `run ${n}`, all, listed: own, more: 'add --all'});
  }
  const m = mapOf(run, n, map);
  // what there is to ask is what that map's run wrote, as the run kept it (maps.js): no list of the steps of our own
  const names = `a map's steps write ${m.keys.length ? listed(m.keys) : 'at, view, names, …'}`;
  if (!key.trim()) throw new Error(`why names a value of run ${n} map ${m.name}, one of what its steps wrote (${names})`);
  const said = await whyFromRecord({file: m.record, control: m.control, key, run: `run ${n} map ${m.name}`, all, listed: names, more: 'add --all'});
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
    if (run.verdict === 'failed' && !run.flat.length) throw new Error(`run ${n} kept no map: it could not finish (${oneLine(run.failure ?? 'the run stopped')})`);
    throw new Error(`run ${n} kept no map: its deck has no isometric map${run.flat.length ? ` — its maps are ${listed(run.flat)}, with no isometric piece` : ''}`);
  }
  const m = maps.find((x) => x.name === map.trim());
  if (!m) throw new Error(`run ${n} has no map ${quoted(map)}: its isometric maps are ${listed(maps.map((x) => x.name))}${run.flat.length ? ` (the deck's other maps, ${listed(run.flat)}, have no isometric piece)` : ''}`);
  if (!m.record) throw new Error(`run ${n}'s map ${m.name} kept no record (it could not be written, or its map flow did not finish${m.differs ? `: ${m.differs}` : ''}), so it cannot say why`);
  return m;
}
