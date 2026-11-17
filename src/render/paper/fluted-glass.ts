import * as TSL from 'three/tsl';

// TSL port of Paper's Fluted Glass (Apache-2.0, see NOTICE): vertical lens
// strips that refract the image with a smooth-fract distortion profile,
// highlights at each flute's edge, soft shadows and a slight vertical blur.

const T: any = TSL;
const { Fn, vec2, vec3, float, floor, fract, pow, mix, smoothstep, abs, sin, cos, clamp, fwidth } = T;

/** smoothFract from the original: a fract with its seam smoothed. */
const smoothFract = (x: any) => {
  const f = fract(x);
  const w = fwidth(x);
  const edge = abs(f.sub(0.5)).sub(0.5);
  const band = smoothstep(w.negate(), w, edge);
  return mix(f, float(1.0).sub(f), band);
};

export interface FlutedParams { amount: any; size: any; angle: any; shape: any; distortion: any; shift: any; highlights: any; shadows: any; blur: any; stretch: any }

/**
 * Returns the refracted colour. `amount` 0..1 fades the whole effect in;
 * other params follow the original's ranges (size 0..1, angle degrees,
 * shape 1 = lines, 2 = irregular, 3 = wave, 4 = zigzag, 5 = pattern).
 */
export const flutedGlass = (tex: any, imageUV: any, aspect: any, o: FlutedParams) => {
  const rot = o.angle.mul(-Math.PI / 180);
  const patternSize = mix(float(200.0), float(5.0), o.size);
  const rotateAspect = (p: any, a: any) => {
    const q = vec2(p.x.mul(aspect), p.y);
    const r = vec2(q.x.mul(cos(a)).sub(q.y.mul(sin(a))), q.x.mul(sin(a)).add(q.y.mul(cos(a))));
    return vec2(r.x.div(aspect), r.y);
  };
  let p = imageUV.sub(0.5).mul(patternSize);
  p = rotateAspect(p, rot);
  const patternY = p.y.div(aspect);
  const sh = o.shape;
  const isIrr = T.step(1.5, sh).mul(T.step(sh, 2.5));
  const isWave = T.step(2.5, sh).mul(T.step(sh, 3.5));
  const curve = isIrr.mul(float(0.5).add(sin(p.x.mul(0.5)).mul(sin(p.x.mul(1.7))).mul(0.5))).add(isWave.mul(sin(patternY.mul(0.23)).mul(4.0)));
  const toFract = p.add(curve);
  const fractOrig = fract(p);
  const floorOrig = floor(p);
  const x = smoothFract(toFract.x);
  const xNon = fract(toFract.x).add(0.0001);
  // distortion shape 1 from the original
  let distortion = pow(x.mul(1.5), 3.0).negate().add(float(0.5).sub(o.shift));
  const aa = float(0.2).add(mix(float(0.2), float(0.0), o.size));
  const fadeX = smoothstep(0.0, aa, xNon).mul(smoothstep(1.0, float(1.0).sub(aa), xNon));
  distortion = mix(float(0.5), distortion, fadeX).mul(o.distortion.mul(3.0));
  const hw = float(2.0).mul(fwidth(toFract.x).max(0.001));
  const highlights = clamp(float(1.0).sub(smoothstep(0.0, hw, xNon).mul(smoothstep(1.0, float(1.0).sub(hw), xNon))).mul(o.highlights), 0.0, 1.0);
  const shadows = clamp(pow(x, 1.3).min(1.0).mul(pow(o.shadows, 2.0)), 0.0, 1.0);
  const fo = vec2(fractOrig.x.add(distortion), fractOrig.y);
  const back = rotateAspect(floorOrig, rot.negate()).add(rotateAspect(fo, rot.negate()));
  let uv2 = back.div(patternSize).add(0.5);
  const stretch = pow(float(1.0).sub(smoothstep(0.0, 0.5, xNon).mul(smoothstep(1.0, 0.5, xNon))), 2.0);
  uv2 = vec2(uv2.x, mix(uv2.y, float(0.5), o.stretch.mul(stretch)));
  // a few vertical taps stand in for the original's Gaussian
  const by = o.blur.mul(0.004);
  const img = tex.sample(uv2).rgb.mul(0.4)
    .add(tex.sample(uv2.add(vec2(0, by))).rgb.mul(0.2)).add(tex.sample(uv2.sub(vec2(0, by))).rgb.mul(0.2))
    .add(tex.sample(uv2.add(vec2(0, by.mul(2.0)))).rgb.mul(0.1)).add(tex.sample(uv2.sub(vec2(0, by.mul(2.0)))).rgb.mul(0.1));
  let col = vec3(1.0).mul(highlights);
  col = mix(col, vec3(0.0), shadows.mul(0.5).mul(highlights.oneMinus()));
  col = col.add(img.mul(float(1.0).sub(highlights.mul(0.6))).mul(float(1.0).sub(shadows.mul(0.35))));
  return mix(tex.sample(imageUV).rgb, col, o.amount);
};

void Fn;
