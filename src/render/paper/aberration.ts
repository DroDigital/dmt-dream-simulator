import * as TSL from 'three/tsl';

// Aberration: RGB channel offset along a radial direction (original
// implementation; the pinned Paper package has no aberration shader).

const T: any = TSL;
const { vec2, vec3, length, smoothstep } = T;

export function aberration(tex: any, p: any, amount: any, aspect: any) {
  const c = p.sub(0.5);
  const r = length(c.mul(vec2(aspect, 1.0)));
  const dir = c.mul(amount.mul(0.018)).mul(smoothstep(0.0, 0.7, r).add(0.25));
  return vec3(tex.sample(p.add(dir)).r, tex.sample(p).g, tex.sample(p.sub(dir)).b);
}
