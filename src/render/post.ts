import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import type { Quadrant } from '../data/types';
import { QUADRANT_PALETTES, CB_PALETTES, hexToRgb } from './palettes';

const T: any = TSL;
const {
  Fn, uniform, vec2, vec3, vec4, float, floor, fract, max, min, mix, dot, sin, cos, clamp, smoothstep,
  step, abs, length, texture, texture3D, uv, hash, atan, pow, exp, luminance, hue, sqrt,
} = T;

// ── Glyph atlas: ASCII, braille and block ramps (our ASCII Magic replacement)
export const RAMPS = [' .:-=+*#%@', '⠀⠁⠃⠇⠏⠟⠿⡿⣿⣿', ' ░░▒▒▓▓███'];
const GLYPH_PX = 32;
let atlasTex: THREE.Texture | null = null;
export function glyphAtlas(): THREE.Texture {
  if (atlasTex) return atlasTex;
  const c = document.createElement('canvas');
  c.width = GLYPH_PX * 10; c.height = GLYPH_PX * RAMPS.length;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  RAMPS.forEach((ramp, row) => {
    ctx.font = `${row === 0 ? 30 : 34}px VT323, monospace`;
    [...ramp].forEach((ch, i) => ctx.fillText(ch, i * GLYPH_PX + GLYPH_PX / 2, row * GLYPH_PX + GLYPH_PX / 2 + 1));
  });
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.flipY = false;
  atlasTex = t;
  return t;
}
export function rebuildGlyphAtlas() { atlasTex?.dispose(); atlasTex = null; return glyphAtlas(); }

let bayerTex: THREE.DataTexture | null = null;
function bayer(): THREE.DataTexture {
  if (bayerTex) return bayerTex;
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const d = new Uint8Array(16 * 4);
  m.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(((v + 0.5) / 16) * 255); d[i * 4 + 3] = 255; });
  bayerTex = new THREE.DataTexture(d, 4, 4);
  bayerTex.magFilter = bayerTex.minFilter = THREE.NearestFilter;
  bayerTex.wrapS = bayerTex.wrapT = THREE.RepeatWrapping;
  bayerTex.needsUpdate = true;
  return bayerTex;
}

// ── 3D colour LUTs, one per quadrant, blended live by chart position ───────
const LUT_N = 16;
function buildLut(palette: string[]): THREE.Data3DTexture {
  const pal = palette.map(hexToRgb).map(([r, g, b]) => ({ c: [r, g, b], l: 0.3 * r + 0.59 * g + 0.11 * b }));
  pal.sort((a, b) => a.l - b.l);
  const ramp = (l: number) => {
    const x = Math.min(0.999, Math.max(0, l)) * (pal.length - 1);
    const i = Math.floor(x), f = x - i;
    const a = pal[i].c, b = pal[Math.min(pal.length - 1, i + 1)].c;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  const data = new Uint8Array(LUT_N * LUT_N * LUT_N * 4);
  let k = 0;
  for (let b = 0; b < LUT_N; b++) for (let g = 0; g < LUT_N; g++) for (let r = 0; r < LUT_N; r++) {
    const R = r / (LUT_N - 1), G = g / (LUT_N - 1), B = b / (LUT_N - 1);
    const l = 0.3 * R + 0.59 * G + 0.11 * B;
    const p = ramp(Math.pow(l, 0.85));
    // keep some of the original chroma, pull its tone into the palette
    const keep = 0.45;
    const out = [R * keep + p[0] * (1 - keep), G * keep + p[1] * (1 - keep), B * keep + p[2] * (1 - keep)];
    data[k++] = Math.round(Math.min(1, out[0]) * 255);
    data[k++] = Math.round(Math.min(1, out[1]) * 255);
    data[k++] = Math.round(Math.min(1, out[2]) * 255);
    data[k++] = 255;
  }
  const t = new THREE.Data3DTexture(data, LUT_N, LUT_N, LUT_N);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

const LUTS: Record<string, THREE.Data3DTexture> = {};
export function luts(colourBlind: boolean) {
  const key = colourBlind ? 'cb' : 'std';
  if (!LUTS[key + 'halo']) {
    const src = colourBlind ? CB_PALETTES : QUADRANT_PALETTES;
    (['halo', 'bloom', 'hush', 'undertow'] as Quadrant[]).forEach((q) => (LUTS[key + q] = buildLut(src[q])));
  }
  return [LUTS[key + 'halo'], LUTS[key + 'bloom'], LUTS[key + 'hush'], LUTS[key + 'undertow']];
}

function rt(w: number, h: number, nearest: boolean, depth = false) {
  const r = new THREE.RenderTarget(w, h, {
    type: THREE.HalfFloatType,
    depthBuffer: depth,
    minFilter: nearest ? THREE.NearestFilter : THREE.LinearFilter,
    magFilter: nearest ? THREE.NearestFilter : THREE.LinearFilter,
    generateMipmaps: false,
  });
  r.texture.wrapS = r.texture.wrapT = THREE.ClampToEdgeWrapping;
  return r;
}

export interface PostUniforms {
  time: any; tProgress: any; tKind: any; tActive: any;
  bloomStrength: any; bloomThreshold: any; godrays: any; sunScreen: any;
  glyph: any; glyphCell: any; glyphRow: any;
  trail: any; trailDecay: any; trailZoom: any; trailRot: any;
  grade: any; gradeW: any; hueRot: any; fringe: any; vignette: any; grain: any; kaleido: any;
  mirror: any; tape: any; staticAmt: any; fadeColor: any; fadeAmount: any; gentle: any;
  levels: any; lowSize: any; paneSize: any; mono: any; invert: any; flashCap: any; wobble: any;
}

/** One dreamer's post chain: lo-fi body → hi-fi light → dream lens. */
export class PanePost {
  lowA = rt(480, 270, true, true);
  lowB = rt(480, 270, true, true);
  bright = rt(240, 135, false);
  blurH = rt(240, 135, false);
  blurV = rt(240, 135, false);
  out = [rt(960, 540, false), rt(960, 540, false)];
  frame = 0;
  u: PostUniforms;
  private brightQuad: THREE.QuadMesh;
  private blurHQuad: THREE.QuadMesh;
  private blurVQuad: THREE.QuadMesh;
  private postQuad: THREE.QuadMesh;
  private histNode: any;
  lowW = 480; lowH = 270; outW = 960; outH = 540;

  constructor(colourBlind = false) {
    const u: PostUniforms = (this.u = {
      time: uniform(0), tProgress: uniform(0), tKind: uniform(0), tActive: uniform(0),
      bloomStrength: uniform(0.9), bloomThreshold: uniform(0.72), godrays: uniform(0), sunScreen: uniform(new THREE.Vector2(0.5, 0.3)),
      glyph: uniform(0), glyphCell: uniform(8), glyphRow: uniform(0),
      trail: uniform(0.6), trailDecay: uniform(0.82), trailZoom: uniform(0.004), trailRot: uniform(0.00175),
      grade: uniform(0.55), gradeW: uniform(new THREE.Vector4(0.25, 0.25, 0.25, 0.25)), hueRot: uniform(0),
      fringe: uniform(1), vignette: uniform(0.45), grain: uniform(0.035), kaleido: uniform(0.25),
      mirror: uniform(0), tape: uniform(0), staticAmt: uniform(0), fadeColor: uniform(new THREE.Color(1, 1, 1)), fadeAmount: uniform(0),
      gentle: uniform(0), levels: uniform(6), lowSize: uniform(new THREE.Vector2(480, 270)), paneSize: uniform(new THREE.Vector2(960, 540)),
      mono: uniform(0), invert: uniform(0), flashCap: uniform(0.7), wobble: uniform(0),
    });

    const A = texture(this.lowA.texture);
    const B = texture(this.lowB.texture);

    // bright pass (threshold, mixed across a transition)
    const brightMat = new THREE.MeshBasicNodeMaterial();
    brightMat.colorNode = Fn(() => {
      const p = uv();
      const a = A.sample(p).rgb, b = B.sample(p).rgb;
      const c = mix(a, b, u.tProgress.mul(u.tActive));
      const l = luminance(c);
      return c.mul(smoothstep(u.bloomThreshold, u.bloomThreshold.add(0.35), l));
    })();
    this.brightQuad = new THREE.QuadMesh(brightMat);

    const blur = (src: THREE.RenderTarget, dir: [number, number]) => {
      const m = new THREE.MeshBasicNodeMaterial();
      const S = texture(src.texture);
      const texel = uniform(new THREE.Vector2(1 / 240, 1 / 135));
      (m as any).texel = texel;
      m.colorNode = Fn(() => {
        const p = uv();
        const d = vec2(dir[0], dir[1]).mul(texel).mul(1.8);
        const w = [0.227, 0.194, 0.121, 0.054, 0.016];
        let c = S.sample(p).rgb.mul(w[0]);
        for (let i = 1; i < 5; i++) {
          c = c.add(S.sample(p.add(d.mul(i))).rgb.mul(w[i]));
          c = c.add(S.sample(p.sub(d.mul(i))).rgb.mul(w[i]));
        }
        return c;
      })();
      return new THREE.QuadMesh(m);
    };
    this.blurHQuad = blur(this.bright, [1, 0]);
    this.blurVQuad = blur(this.blurH, [0, 1]);

    const bloomT = texture(this.blurV.texture);
    const hist = (this.histNode = texture(this.out[1].texture));
    const atlas = texture(glyphAtlas());
    const bay = texture(bayer());
    const [L0, L1, L2, L3] = luts(colourBlind).map((t) => texture3D(t));
    this.lutNodes = [L0, L1, L2, L3];

    const postMat = new THREE.MeshBasicNodeMaterial();
    postMat.colorNode = Fn(() => {
      const p = uv().toVar();
      const aspect = u.paneSize.x.div(u.paneSize.y);
      const q = vec2(mix(p.x, p.x.oneMinus(), u.mirror), p.y).toVar();

      // kaleidoscopic breathing at the screen edges
      const c0 = q.sub(0.5).mul(vec2(aspect, 1));
      const r0 = length(c0);
      const seg = float(Math.PI / 3);
      const ang = atan(c0.y, c0.x).add(u.time.mul(0.05));
      const a2 = ang.div(seg.mul(2));
      const fa = abs(a2.sub(floor(a2)).mul(seg.mul(2)).sub(seg));
      const kal = vec2(cos(fa), sin(fa)).mul(r0).div(vec2(aspect, 1)).add(0.5);
      const kw = smoothstep(0.42, 0.85, r0).mul(u.kaleido).mul(sin(u.time.mul(0.4)).mul(0.25).add(0.75));
      q.assign(mix(q, kal, kw));

      // tape jitter + dream wobble
      const row = floor(q.y.mul(u.lowSize.y));
      q.x.addAssign(hash(row.add(floor(u.time.mul(30)).mul(7.0))).sub(0.5).mul(0.012).mul(u.tape));
      q.x.addAssign(sin(q.y.mul(9.0).add(u.time.mul(1.3))).mul(0.004).mul(u.wobble));
      q.y.addAssign(sin(q.x.mul(7.0).add(u.time.mul(1.1))).mul(0.004).mul(u.wobble));

      const quant = (cc: any, pq: any) => {
        const pix = floor(pq.mul(u.lowSize));
        const bd = bay.sample(pix.div(4.0)).r;
        const g = sqrt(clamp(cc, 0.0, 1.0));
        const qq = floor(g.mul(u.levels.sub(1.0)).add(bd)).div(u.levels.sub(1.0));
        return qq.mul(qq).add(max(cc.sub(1.0), 0.0));
      };

      // lo-fi body with chromatic fringe
      const dir = q.sub(0.5).mul(u.fringe).mul(0.006);
      const a = vec3(A.sample(q.add(dir)).r, A.sample(q).g, A.sample(q.sub(dir)).b);
      const colA = quant(a, q);
      const colB = quant(B.sample(q).rgb, q);

      // link transition masks
      const t = u.tProgress;
      const k = u.tKind;
      const isK = (n: number) => step(abs(k.sub(n)), 0.5);
      const nCol = hash(floor(q.x.mul(48.0)).add(3.0));
      const pourEdge = t.mul(1.6).sub(nCol.mul(0.6));
      const mPour = smoothstep(pourEdge, pourEdge.sub(0.05), q.y);
      const strip = floor(q.x.mul(7.0));
      const ts = clamp(t.mul(1.9).sub(strip.div(7.0).mul(0.9)), 0.0, 1.0);
      const mFold = step(0.5, ts);
      const cell = floor(q.mul(vec2(14.0, 8.0)).add(vec2(hash(floor(q.y.mul(8.0))).mul(0.6), 0.0)));
      const mShatter = step(hash(cell.x.add(cell.y.mul(31.0))), t.mul(1.25).sub(0.1));
      const mBloom = smoothstep(0.42, 0.62, t);
      const nDis = hash(floor(q.mul(u.lowSize).div(3.0)).dot(vec2(1.0, 157.0)));
      const mDis = step(nDis, t);
      const rr = length(q.sub(0.5).mul(vec2(aspect, 1)));
      const mIris = step(rr, t.mul(1.15));
      const melt = q.y.add(sin(q.x.mul(18.0).add(t.mul(6.0))).mul(0.06)).add(hash(floor(q.x.mul(30.0))).mul(0.15));
      const mMelt = smoothstep(t.mul(1.4).sub(0.2), t.mul(1.4).sub(0.3), melt);
      const mask = clamp(
        isK(0).mul(t).add(isK(1).mul(mPour)).add(isK(2).mul(mFold)).add(isK(3).mul(mShatter))
          .add(isK(4).mul(mBloom)).add(isK(5).mul(mDis)).add(isK(6).mul(mIris)).add(isK(7).mul(mMelt)),
        0.0, 1.0).mul(u.tActive);
      const col = mix(colA, colB, mask).toVar();
      const creaseShade = isK(2).mul(sin(ts.mul(Math.PI)).mul(0.45)).mul(u.tActive);
      col.mulAssign(creaseShade.oneMinus());
      const flash = isK(4).mul(sin(t.mul(Math.PI))).mul(u.tActive).mul(u.flashCap);
      col.addAssign(vec3(1.0, 0.96, 0.9).mul(flash));
      col.addAssign(vec3(0.6, 0.9, 1.0).mul(isK(3).mul(u.tActive).mul(step(0.97, hash(cell.x.mul(7.0).add(cell.y))).mul(sin(t.mul(Math.PI))))));

      // hi-fi light: bloom + god rays, sampled smooth at full resolution
      const bl = bloomT.sample(q).rgb;
      col.addAssign(bl.mul(u.bloomStrength));
      const toSun = u.sunScreen.sub(q);
      let rays = vec3(0.0);
      for (let i = 0; i < 10; i++) {
        const f = i / 10;
        rays = rays.add(bloomT.sample(q.add(toSun.mul(f * 0.9))).rgb.mul(1.0 - f * 0.8));
      }
      col.addAssign(rays.mul(0.12).mul(u.godrays));

      // glyph pass: characters instead of pixels
      const px = q.mul(u.paneSize);
      const cellC = floor(px.div(u.glyphCell)).add(0.5).mul(u.glyphCell).div(u.paneSize);
      const src = A.sample(cellC).rgb.add(bloomT.sample(cellC).rgb.mul(0.6));
      const gi = floor(clamp(luminance(src), 0.0, 0.999).mul(10.0));
      const local = fract(px.div(u.glyphCell));
      const gm = atlas.sample(vec2(gi.add(local.x).div(10.0), u.glyphRow.add(local.y).div(3.0))).r;
      col.assign(mix(col, src.mul(gm).mul(1.5).add(src.mul(0.04)), u.glyph));

      // feedback trails: last frame, zoomed and turned a hair
      const hc = q.sub(0.5);
      const cs = cos(u.trailRot), sn = sin(u.trailRot);
      const hq = vec2(hc.x.mul(cs).sub(hc.y.mul(sn)), hc.x.mul(sn).add(hc.y.mul(cs))).mul(float(1.0).sub(u.trailZoom)).add(0.5);
      const h = hist.sample(hq).rgb;
      col.assign(mix(col, max(col, h.mul(u.trailDecay)), u.trail));

      // resonance grade: four LUTs blended by chart position
      const cl = clamp(col, 0.0, 1.0);
      const g = L0.sample(cl).rgb.mul(u.gradeW.x).add(L1.sample(cl).rgb.mul(u.gradeW.y))
        .add(L2.sample(cl).rgb.mul(u.gradeW.z)).add(L3.sample(cl).rgb.mul(u.gradeW.w));
      col.assign(mix(col, g.add(max(col.sub(1.0), 0.0)), u.grade));
      col.assign(hue(col, u.hueRot));
      const lum = luminance(col);
      col.assign(mix(col, vec3(lum), u.mono));
      col.assign(mix(col, vec3(1.0).sub(clamp(col, 0.0, 1.0)), u.invert));

      // worn tape, watcher static
      const scan = sin(q.y.mul(u.lowSize.y).mul(Math.PI)).mul(0.5).add(0.5);
      col.mulAssign(float(1.0).sub(u.tape.mul(0.22).mul(scan)));
      const nz = hash(q.mul(u.paneSize).add(vec2(u.time.mul(91.0), u.time.mul(37.0))));
      col.addAssign(vec3(nz.sub(0.5)).mul(u.tape.mul(0.18).add(u.staticAmt.mul(0.35))));
      col.assign(mix(col, vec3(nz), u.staticAmt.mul(0.18)));

      // lens: vignette, grain
      col.mulAssign(float(1.0).sub(u.vignette.mul(smoothstep(0.35, 0.95, rr))));
      col.addAssign(vec3(nz.sub(0.5)).mul(u.grain));

      // photosensitivity: clamp per-frame luminance jumps in gentle mode
      const hr = hist.sample(p).rgb;
      const dl = luminance(col).sub(luminance(hr));
      const lim = mix(float(10.0), float(0.07), u.gentle);
      const sc = min(float(1.0), lim.div(max(abs(dl), 0.0001)));
      col.assign(mix(hr, col, sc));

      col.assign(mix(col, u.fadeColor, u.fadeAmount));
      return max(col, vec3(0.0));
    })();
    this.postQuad = new THREE.QuadMesh(postMat);
  }

  lutNodes: any[];
  setColourBlind(cb: boolean) {
    const l = luts(cb);
    this.lutNodes.forEach((n, i) => (n.value = l[i]));
  }

  /** Fit the buffers to a pane of w×h pixels. */
  resize(w: number, h: number, lightScale: number, internalH = 270) {
    const aspect = w / Math.max(1, h);
    const lowH = internalH;
    const lowW = Math.max(64, Math.round((lowH * aspect) / 4) * 4);
    if (lowW !== this.lowW || lowH !== this.lowH) {
      this.lowW = lowW; this.lowH = lowH;
      this.lowA.setSize(lowW, lowH);
      this.lowB.setSize(lowW, lowH);
      const bw = Math.max(32, Math.round(lowW / 2)), bh = Math.max(32, Math.round(lowH / 2));
      this.bright.setSize(bw, bh); this.blurH.setSize(bw, bh); this.blurV.setSize(bw, bh);
      ((this.blurHQuad.material as any).texel.value as THREE.Vector2).set(1 / bw, 1 / bh);
      ((this.blurVQuad.material as any).texel.value as THREE.Vector2).set(1 / bw, 1 / bh);
    }
    const ow = Math.max(64, Math.round((w * lightScale) / 16) * 16);
    const oh = Math.max(64, Math.round((h * lightScale) / 16) * 16);
    if (ow !== this.outW || oh !== this.outH) {
      this.outW = ow; this.outH = oh;
      this.out[0].setSize(ow, oh); this.out[1].setSize(ow, oh);
    }
    this.u.lowSize.value.set(this.lowW, this.lowH);
    this.u.paneSize.value.set(this.outW, this.outH);
  }

  /** Run bloom + composite. Scene passes must already be in lowA (and lowB during a link). */
  composite(renderer: THREE.WebGPURenderer): THREE.Texture {
    renderer.setRenderTarget(this.bright); this.brightQuad.render(renderer);
    renderer.setRenderTarget(this.blurH); this.blurHQuad.render(renderer);
    renderer.setRenderTarget(this.blurV); this.blurVQuad.render(renderer);
    const cur = this.out[this.frame & 1];
    const prev = this.out[(this.frame + 1) & 1];
    this.histNode.value = prev.texture;
    renderer.setRenderTarget(cur); this.postQuad.render(renderer);
    renderer.setRenderTarget(null);
    this.frame++;
    return cur.texture;
  }

  get output(): THREE.RenderTarget { return this.out[(this.frame + 1) & 1]; }

  dispose() {
    [this.lowA, this.lowB, this.bright, this.blurH, this.blurV, ...this.out].forEach((r) => r.dispose());
  }
}

// ── Split-screen compositor: up to 4 panes, soft seams in dreamer colours ──
export class Compositor {
  quad: THREE.QuadMesh;
  rects = [0, 1, 2, 3].map(() => uniform(new THREE.Vector4(0, 0, 1, 1)));
  active = [0, 1, 2, 3].map(() => uniform(0));
  colours = [0, 1, 2, 3].map(() => uniform(new THREE.Color(1, 1, 1)));
  asleep = [0, 1, 2, 3].map(() => uniform(0));
  texNodes: any[];
  seam = uniform(1);
  time = uniform(0);
  mandala = uniform(0);
  screen = uniform(new THREE.Vector2(1920, 1080));

  constructor(placeholder: THREE.Texture) {
    this.texNodes = [0, 1, 2, 3].map(() => texture(placeholder));
    const m = new THREE.MeshBasicNodeMaterial();
    m.colorNode = Fn(() => {
      const p = uv();
      // background: a slow sky mandala, shown in an empty quarter
      const c = p.sub(0.5).mul(vec2(this.screen.x.div(this.screen.y), 1.0));
      const r = length(c);
      const a = atan(c.y, c.x).add(this.time.mul(0.03));
      const ring = smoothstep(0.03, 0.0, abs(fract(r.mul(8.0).add(abs(sin(a.mul(8.0))).mul(0.2))).sub(0.5)));
      let col = mix(vec3(0.03, 0.03, 0.08), vec3(0.12, 0.08, 0.2), smoothstep(0.8, 0.0, r)).add(vec3(0.5, 0.45, 0.8).mul(ring).mul(0.25)).mul(this.mandala);
      for (let i = 0; i < 4; i++) {
        const R = this.rects[i];
        const inside = step(R.x, p.x).mul(step(p.x, R.x.add(R.z))).mul(step(R.y, p.y)).mul(step(p.y, R.y.add(R.w))).mul(this.active[i]);
        const local = p.sub(R.xy).div(R.zw);
        let pc = this.texNodes[i].sample(local).rgb;
        const sl = luminance(pc);
        pc = mix(pc, vec3(sl).mul(vec3(0.7, 0.75, 1.0)).mul(0.6), this.asleep[i]);
        const ex = min(min(local.x, local.x.oneMinus()).mul(R.z).mul(this.screen.x), min(local.y, local.y.oneMinus()).mul(R.w).mul(this.screen.y));
        const glow = exp(ex.negate().div(6.0)).mul(this.seam);
        pc = pc.add(this.colours[i].mul(glow).mul(0.9));
        col = mix(col, pc, inside);
      }
      return col;
    })();
    this.quad = new THREE.QuadMesh(m);
  }

  render(renderer: THREE.WebGPURenderer) {
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }
}

/** Downsample a pane output for journal frame scoring and polaroids. */
export class Snapshotter {
  small = new THREE.RenderTarget(64, 36, { type: THREE.UnsignedByteType });
  photo = new THREE.RenderTarget(384, 288, { type: THREE.UnsignedByteType });
  private src: any;
  private quad: THREE.QuadMesh;
  private photoQuad: THREE.QuadMesh;
  private crop = uniform(new THREE.Vector4(0, 0, 1, 1));
  constructor(placeholder: THREE.Texture) {
    this.src = texture(placeholder);
    const m = new THREE.MeshBasicNodeMaterial();
    m.colorNode = Fn(() => {
      const c = this.src.sample(uv()).rgb;
      return pow(clamp(c, 0.0, 1.0), vec3(1 / 2.2));
    })();
    this.quad = new THREE.QuadMesh(m);
    const pm = new THREE.MeshBasicNodeMaterial();
    pm.colorNode = Fn(() => {
      const c = this.src.sample(this.crop.xy.add(uv().mul(this.crop.zw))).rgb;
      return pow(clamp(c, 0.0, 1.0), vec3(1 / 2.2));
    })();
    this.photoQuad = new THREE.QuadMesh(pm);
  }
  async score(renderer: THREE.WebGPURenderer, tex: THREE.Texture): Promise<Uint8Array> {
    this.src.value = tex;
    renderer.setRenderTarget(this.small); this.quad.render(renderer); renderer.setRenderTarget(null);
    return (await renderer.readRenderTargetPixelsAsync(this.small, 0, 0, 64, 36)) as Uint8Array;
  }
  async capture(renderer: THREE.WebGPURenderer, tex: THREE.Texture, aspect: number): Promise<ImageData> {
    this.src.value = tex;
    // centre-crop to the polaroid's 4:3
    const target = 4 / 3;
    if (aspect > target) { const w = target / aspect; this.crop.value.set((1 - w) / 2, 0, w, 1); }
    else { const h = aspect / target; this.crop.value.set(0, (1 - h) / 2, 1, h); }
    renderer.setRenderTarget(this.photo); this.photoQuad.render(renderer); renderer.setRenderTarget(null);
    const px = (await renderer.readRenderTargetPixelsAsync(this.photo, 0, 0, 384, 288)) as Uint8Array;
    return new ImageData(new Uint8ClampedArray(px) as any, 384, 288);
  }
}
