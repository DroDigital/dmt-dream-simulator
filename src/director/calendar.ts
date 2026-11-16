// The real-world calendar: a third moon on real full-moon nights, longer
// timers on the winter solstice, a lantern party on a night you choose.

const SYNODIC = 29.530588853;
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14) / 86400000;

export function moonAge(d: Date): number {
  const days = d.getTime() / 86400000 - KNOWN_NEW;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}
export function isFullMoon(d: Date): boolean {
  return Math.abs(moonAge(d) - SYNODIC / 2) < 1.0;
}
export function isWinterSolstice(d: Date): boolean {
  const m = d.getMonth(), day = d.getDate();
  return m === 11 && day >= 20 && day <= 22;
}
export function isLanternParty(d: Date, month: number, day: number): boolean {
  return d.getMonth() + 1 === month && d.getDate() === day;
}
/** One seed per real-world day, the same for everyone. */
export function dailySeed(d: Date): number {
  const key = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  let h = key ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
