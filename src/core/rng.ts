// PCG32 — every random choice in a night goes through this, never Math.random,
// so Afterimage replays and dream codes reproduce exactly.

const MASK64 = (1n << 64n) - 1n;
const MULT = 6364136223846793005n;

export class PCG32 {
  private state = 0n;
  private inc = 0n;

  constructor(seed: number | bigint = 0x853c49e6748fea9bn, stream: number | bigint = 0xda3e39cb94b95bdbn) {
    this.reseed(seed, stream);
  }

  reseed(seed: number | bigint, stream: number | bigint = 0xda3e39cb94b95bdbn) {
    this.state = 0n;
    this.inc = ((BigInt(stream) << 1n) | 1n) & MASK64;
    this.nextU32();
    this.state = (this.state + (BigInt(seed) & MASK64)) & MASK64;
    this.nextU32();
  }

  nextU32(): number {
    const old = this.state;
    this.state = (old * MULT + this.inc) & MASK64;
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn);
    const rot = Number(old >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  }

  /** float in [0, 1) */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Weighted pick. Returns index, or -1 when all weights are zero. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  gaussian(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  fork(salt: number | string): PCG32 {
    return new PCG32(hash32(this.nextU32(), typeof salt === 'string' ? hashString(salt) : salt));
  }
}

/** 32-bit integer hash mixing (murmur3 finaliser style). */
export function mix32(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function hash32(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = mix32((h ^ mix32(p >>> 0)) + 0x7f4a7c15 + (h << 6) + (h >>> 2));
  }
  return h >>> 0;
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return mix32(h >>> 0);
}

/** Night seed = hash(save seed, night number). */
export function nightSeed(saveSeed: number, night: number): number {
  return hash32(saveSeed, night, 0x4e49);
}

/** Realm-visit seed = hash(night seed, link index). */
export function visitSeed(nightSeedValue: number, linkIndex: number): number {
  return hash32(nightSeedValue, linkIndex, 0x5649);
}

export function rngFor(...parts: number[]): PCG32 {
  return new PCG32(hash32(...parts), hash32(parts.length, ...parts) | 1);
}
