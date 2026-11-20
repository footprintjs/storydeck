// portsWritten — a piece's ports as its tag writes them (data-ports), read once for a block (iso.js) and for a piece
// that stands on the floor by its footprint (footprint.js): one reading, one set of words for what is wrong.
import {readPorts} from 'footprint-story/isometric';

const PORT = /^\s*([A-Za-z0-9_-]{1,60})\s*:\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+(right|left|back-left|back-right|top))?\s*$/;
/**
 * A block's ports as written — data-ports="p1: 0.4 2 0.3 | p3: 1.4 2 0.3 left": each a name, x y z in the block's own
 * tiles (x along its width, y along its depth, z up from its base) and, at a corner, the side — checked as the kit
 * checks them (footprint-story/isometric · readPorts), so a wrong one is refused here, naming the piece and the fix.
 */
export function portsWritten(a, kind, size, told) {
  if (!a) return [];
  if (a.bare || a.twice) throw new Error(`${told}: its ports are written data-ports="p1: 0.4 2 0.3 | p3: 1.4 2 0.3", once, with quotes`);
  if (kind === 'floor') throw new Error(`${told}: a floor has no ports — give them to a block that stands on it`);
  const ports = a.value.split('|').filter((part) => part.trim()).map((part) => {
    const m = PORT.exec(part);
    if (!m) throw new Error(`${told}: data-ports="${a.value.length > 80 ? `${a.value.slice(0, 79)}…` : a.value}" — each port is "name: x y z", in the block's own tiles, with its side after it at a corner (right, left, back-left, back-right); they are parted by "|"`);
    return {name: m[1], at: [Number(m[2]), Number(m[3]), Number(m[4])], ...(m[5] ? {face: m[5]} : {})};
  });
  try { return readPorts(ports, size, kind === 'cylinder', told).map(({name, at, face}) => ({name, at: [...at], face})); }
  catch (e) { throw new Error(e.message.replace(/^isometric: /, ''), {cause: e}); }
}
