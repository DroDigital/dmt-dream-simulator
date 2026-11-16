import type { Tag } from '../data/types';
import { PCG32 } from '../core/rng';

// Three-line poems assembled from phrase tables keyed to the tags touched.

const OPENERS: Record<Tag | 'none', string[]> = {
  water: ['the sea came up the stairs', 'I drank a glass of evening', 'rain fell into the wrong sky', 'a tide went out of the room'],
  light: ['a lantern breathed beside me', 'the light had a weight tonight', 'dawn was folded in my pocket', 'something glowed and did not mind'],
  paper: ['the city folded itself away', 'a crane unfolded into wind', 'my name was written very small', 'the walls were thin as letters'],
  glass: ['the windows rang like bells', 'I walked through coloured weather', 'a cathedral held its breath', 'every edge became a rainbow'],
  flesh: ['the walls were warm and listening', 'the coral breathed with me', 'a heartbeat under the floor', 'the pipes were singing softly'],
  glyph: ['the dunes were made of words', 'my footprints spelled a question', 'the sky was written, not drawn', 'letters drifted on the wind'],
  machine: ['a vending machine hummed my name', 'the train ran on without us', 'the televisions grew like flowers', 'a telephone rang in the grass'],
  none: ['I stood still for a long time', 'nothing happened, beautifully', 'the night was very quiet', 'I could not find a door'],
};
const MIDDLES = [
  'and somebody I never met', 'and the moons traded places', 'while the kite stayed out of reach', 'and the clocks forgot the hour',
  'and the lantern woman turned away', 'and the street went on forever', 'and the Lanternfolk sat down', 'while a bus waited for no one',
  'and my shadow went on ahead', 'and every surface was a door', 'and the music thinned to nothing', 'and the sky closed one more notch',
];
const CLOSERS = [
  'then morning, like a soft cut.', 'and then I was awake.', 'I will look for it tomorrow.', 'it was enough to be there.',
  'I kept a little of it.', 'the futon was still warm.', 'the telephone stopped ringing.', 'and the window let me go.',
  'I almost remembered why.', 'it is still there, I think.', 'the city outside was new.', 'I left the light on for it.',
];

export function composePoem(tags: Tag[], seed: number, lines = 3): string[] {
  const rng = new PCG32(seed);
  const counts = new Map<Tag, number>();
  for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const main: Tag | 'none' = sorted[0] ?? 'none';
  const out = [rng.pick(OPENERS[main]), rng.pick(MIDDLES), rng.pick(CLOSERS)];
  if (sorted[1]) out[1] = rng.chance(0.5) ? out[1] : 'and ' + rng.pick(OPENERS[sorted[1]]);
  return out.slice(0, lines);
}

export function poemLine(tags: Tag[], seed: number): string {
  const rng = new PCG32(seed);
  const t: Tag | 'none' = tags.length ? rng.pick(tags) : 'none';
  return rng.pick(OPENERS[t]);
}
