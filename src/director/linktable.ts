import type { RealmId, Tag, Resonance } from '../data/types';
import { DREAM_REALMS, TAGS } from '../data/types';
import { REALMS } from '../data/realms';
import { PCG32 } from '../core/rng';

export type TagTable = Record<Tag, Record<string, number>>;

/** Base table from each realm's main link tags. */
export function baseTagTable(): TagTable {
  const t = {} as TagTable;
  for (const tag of TAGS) {
    t[tag] = {};
    for (const r of DREAM_REALMS) {
      const tags = REALMS[r].tags;
      t[tag][r] = tags.includes(tag) ? (r === 'school' ? 0.45 : 1) : 0.06;
    }
  }
  return t;
}

/** A new run re-rolls the link graph, within limits. */
export function rollTagTable(runSeed: number): TagTable {
  const rng = new PCG32(runSeed, 0x7a6);
  const t = baseTagTable();
  for (const tag of TAGS) {
    for (const r of DREAM_REALMS) t[tag][r] *= rng.range(0.55, 1.45);
    // each tag gains one surprising new home this run
    const surprise = rng.pick(DREAM_REALMS);
    t[tag][surprise] = Math.max(t[tag][surprise], rng.range(0.5, 0.9));
  }
  return t;
}

/** How well a realm fits the current chart position. */
export function affinity(realm: RealmId, res: Resonance): number {
  const h = REALMS[realm].home;
  const d2 = (h.x - res.x) ** 2 + (h.y - res.y) ** 2;
  return 0.25 + Math.exp(-d2 / 18);
}

export interface DestinationInput {
  tags: Tag[];
  current: RealmId;
  resonance: Resonance;
  lastSeenNight: Partial<Record<RealmId, number>>;
  night: number;
  table: TagTable;
  allowed?: RealmId[];
}

/** w_r = T(tag, r) · A_r(resonance) · N_r · [r ≠ current] */
export function realmWeights(inp: DestinationInput): Record<string, number> {
  const out: Record<string, number> = {};
  const pool = inp.allowed ?? DREAM_REALMS;
  for (const r of pool) {
    if (r === inp.current) { out[r] = 0; continue; }
    let T = 0;
    for (const tag of inp.tags.length ? inp.tags : TAGS) T += inp.table[tag][r] ?? 0.06;
    T /= Math.max(1, inp.tags.length || TAGS.length);
    const A = affinity(r, inp.resonance);
    const last = inp.lastSeenNight[r];
    const N = last === undefined || inp.night - last >= 5 ? 1.5 : 1;
    out[r] = T * A * N;
  }
  return out;
}

export function chooseDestination(inp: DestinationInput, rng: PCG32): RealmId {
  const w = realmWeights(inp);
  const ids = Object.keys(w) as RealmId[];
  const i = rng.weighted(ids.map((k) => w[k]));
  return i < 0 ? 'stair' : ids[i];
}
