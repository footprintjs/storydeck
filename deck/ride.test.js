import {describe, it, expect} from 'vitest';
import {hiddenRamps, rideProfile, rideSeconds, showStops, speedAt, withHold} from './ride.js';

/** Where a ride's stops (rideProfile) put the packet at `time`: straight between them, as CSS's linear() does. */
const at = (stops, time) => {
  const k = stops.findIndex(([t]) => t >= time);
  if (k <= 0) return stops[Math.max(0, k)][1];
  const [[t0, p0], [t1, p1]] = [stops[k - 1], stops[k]];
  return t1 === t0 ? p1 : p0 + ((p1 - p0) * (time - t0)) / (t1 - t0);
};

describe('ride.js: the numbers of a packet\'s ride', () => {
  it('times a ride from a speed in px a second: 300 px at 300 px/s is 1 s; eased ends take longer at the same steady speed', () => {
    expect(rideSeconds(300, 300)).toBe(1);
    expect(rideSeconds(452, 226)).toBe(2);
    // gathered and shed evenly, an eased stretch takes twice the time the steady speed would: (1 + a + b) times the line
    expect(rideSeconds(1000, 260, [0.15, 0.2])).toBeCloseTo((1000 * 1.35) / 260, 10);
  });

  it('a steady ride is two stops; eased, it starts and ends at rest and keeps one steady speed between the eased ends', () => {
    expect(rideProfile()).toEqual([[0, 0], [1, 1]]);
    expect(rideProfile([0, 0], 900)).toEqual([[0, 0], [1, 1]]);
    const length = 1000, ease = [0.15, 0.2], stops = rideProfile(ease, length), T = rideSeconds(length, 260, ease);
    expect(stops[0]).toEqual([0, 0]);
    expect(stops.at(-1)).toEqual([1, 1]);
    // time and progress never go back
    stops.slice(1).forEach(([t, p], k) => { expect(t).toBeGreaterThanOrEqual(stops[k][0]); expect(p).toBeGreaterThanOrEqual(stops[k][1]); });
    // the steady stretch, from 15% of the length to 80%: one straight line at the steady speed, 260 px/s
    const from = stops.findIndex(([, p]) => Math.abs(p - 0.15) < 1e-12), to = stops.findIndex(([, p]) => Math.abs(p - 0.8) < 1e-12);
    expect(to).toBe(from + 1);
    const [[t0, p0], [t1, p1]] = [stops[from], stops[to]];
    expect(((p1 - p0) * length) / ((t1 - t0) * T)).toBeCloseTo(260, 6);
    // and every stretch of the ride is at or under that speed: it peaks at the steady speed, never over it
    const steps = 400, speeds = Array.from({length: steps}, (_, k) => ((at(stops, (k + 1) / steps) - at(stops, k / steps)) * length) / (T / steps));
    expect(Math.max(...speeds)).toBeLessThanOrEqual(260 + 1e-6);
    expect(speeds[0]).toBeLessThan(30);   // out of rest
    expect(speeds.at(-1)).toBeLessThan(30);   // into rest
  });

  it('keeps every eased stop within 0.4 px of the true ease (a page rounds the rest of half a px), more stops on a longer line, never past 40 an end', () => {
    for (const length of [100, 1000, 5000]) {
      const ease = [0.2, 0.3], stops = rideProfile(ease, length), whole = 1 + ease[0] + ease[1];
      // the true place at a time, from rest: a·(t / ta)² in, 1 − b·((1 − t) / tb)² out
      const truth = (t) => (t < (2 * ease[0]) / whole ? ease[0] * (t / ((2 * ease[0]) / whole)) ** 2 : t > 1 - (2 * ease[1]) / whole ? 1 - ease[1] * ((1 - t) / ((2 * ease[1]) / whole)) ** 2 : null);
      for (let k = 0; k <= 2000; k++) { const want = truth(k / 2000); if (want !== null) expect(Math.abs(at(stops, k / 2000) - want) * length).toBeLessThanOrEqual(0.4 + 1e-9); }
    }
    expect(rideProfile([0.5, 0.5], 1e7).length).toBeLessThanOrEqual(1 + 40 + 40);
    expect(rideProfile([0.5, 0.5], 10)).toEqual(expect.arrayContaining([[0.5, 0.5]]));   // all ease, no steady stretch: in to the middle and out
  });

  it('only one end eased: the other starts or ends at the steady speed', () => {
    const start = rideProfile([0.25, 0], 400), end = rideProfile([0, 0.25], 400);
    expect(start.at(-2)).toEqual([0.4, 0.25]);   // eased in over 2·0.25/1.25 of the time, then straight to the end
    expect(end[1]).toEqual([0.6, 0.75]);   // straight from the start, then eased out
    expect(speedAt(0.1, [0.25, 0])).toBeCloseTo(Math.sqrt(0.4), 12);
    expect(speedAt(0.5, [0.25, 0.25])).toBe(1);
    expect(speedAt(0.95, [0, 0.2])).toBeCloseTo(0.5, 12);
  });

  it('a ride with a rest at the end takes its share of the run and then stays at 1', () => {
    expect(withHold([[0, 0], [1, 1]], 1)).toEqual([[0, 0], [1, 1]]);
    expect(withHold([[0, 0], [0.5, 0.4], [1, 1]], 0.75)).toEqual([[0, 0], [0.375, 0.4], [0.75, 1], [1, 1]]);
  });

  it('shows the packet as deck.css shows it today, or keeps it at the end where it rests', () => {
    expect(showStops()).toEqual([[0, 0], [0.12, 1], [0.85, 1], [1, 0]]);   // sdRun: in over 12%, out over the last 15%
    expect(showStops(0.5, {end: true})).toEqual([[0, 0], [0.06, 1], [1, 1]]);
    expect(showStops(1, {end: true})).toEqual([[0, 0], [0.12, 1], [1, 1]]);
  });

  it('fades out before a hidden stretch and back after it, over three frames at the speed it has there', () => {
    // 600 px at 300 px/s: three frames are 15 px
    const [[outFrom, outTo, backFrom, backTo]] = hiddenRamps([[300, 360]], 600, 300);
    expect([outFrom * 600, outTo * 600, backFrom * 600, backTo * 600].map((v) => +v.toFixed(9))).toEqual([285, 300, 360, 375]);
    // slower where it eases: 30 px into a 0.25 ease of a 600 px line it has sqrt(30 / 150) of its steady speed
    const [[eased]] = hiddenRamps([[30, 60]], 600, 300, [0.25, 0]);
    expect(30 - eased * 600).toBeCloseTo(15 * Math.sqrt(30 / 150), 9);
    // at the line's start it is hidden from the start; at its end it stays hidden; a fade is never under 2 px
    expect(hiddenRamps([[0, 40]], 400, 300)).toEqual([[0, 0, 0.1, (40 + 15) / 400]]);
    expect(hiddenRamps([[380, 400]], 400, 300)).toEqual([[(380 - 15) / 400, 0.95, 1, 1]]);
    expect(hiddenRamps([[100, 120]], 400, 1)[0][0]).toBeCloseTo(98 / 400, 12);
    // a stretch past the line is cut to it; one with no length, or a line with none, is nothing
    expect(hiddenRamps([[350, 900]], 400, 300)).toEqual([[(350 - 15) / 400, 0.875, 1, 1]]);
    expect(hiddenRamps([[50, 50]], 400, 300)).toEqual([]);
    expect(hiddenRamps([[0, 10]], 0, 300)).toEqual([]);
    // with the packet's radius: gone when its front reaches the stretch, back once its back has left it
    expect(hiddenRamps([[300, 360]], 600, 300, [0, 0], {radius: 7}).map((r) => r.map((v) => +(v * 600).toFixed(9)))).toEqual([[278, 293, 367, 382]]);
    expect(hiddenRamps([[5, 40]], 400, 300, [0, 0], {radius: 7})).toEqual([[0, 0, 47 / 400, 62 / 400]]);   // too near the start to fade out: hidden from it
  });
});
