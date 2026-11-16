// Dream codes: 12 characters (Crockford base32) = night seed + laws + start.
import { LAWS } from '../data/laws';

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export interface DreamCode { seed: number; laws: string[]; start: number /* 0-4 quadrant/centre */; deep: boolean }

function checksum(v: bigint): number {
  let h = 0x2f;
  let x = v;
  for (let i = 0; i < 7; i++) { h = (h * 31 + Number(x & 0xffn)) & 0x3ff; x >>= 8n; }
  return h;
}

export function encodeDreamCode(c: DreamCode): string {
  const l1 = c.laws[0] ? LAWS.findIndex((l) => l.id === c.laws[0]) + 1 : 0;
  const l2 = c.laws[1] ? LAWS.findIndex((l) => l.id === c.laws[1]) + 1 : 0;
  let v = BigInt(c.seed >>> 0);
  v = (v << 6n) | BigInt(l1 & 63);
  v = (v << 6n) | BigInt(l2 & 63);
  v = (v << 3n) | BigInt(c.start & 7);
  v = (v << 3n) | BigInt(c.deep ? 1 : 0);
  v = (v << 10n) | BigInt(checksum(v));
  let s = '';
  for (let i = 0; i < 12; i++) { s = ALPHA[Number(v & 31n)] + s; v >>= 5n; }
  return s;
}

export function decodeDreamCode(code: string): DreamCode | null {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== 12) return null;
  let v = 0n;
  for (const ch of clean) {
    const i = ALPHA.indexOf(ch);
    if (i < 0) return null;
    v = (v << 5n) | BigInt(i);
  }
  const sum = Number(v & 0x3ffn); v >>= 10n;
  if (checksum(v) !== sum) return null;
  const deep = Number(v & 7n) === 1; v >>= 3n;
  const start = Number(v & 7n); v >>= 3n;
  const l2 = Number(v & 63n); v >>= 6n;
  const l1 = Number(v & 63n); v >>= 6n;
  const seed = Number(v & 0xffffffffn);
  const laws = [l1, l2].filter((x) => x > 0 && x <= LAWS.length).map((x) => LAWS[x - 1].id);
  return { seed, laws, start, deep };
}
