import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';

// Cell-resolution analysis: brightness (3×3 pre-blurred), edge strength and
// direction (Sobel on linear depth and normals, difference-of-Gaussians on
// luminance), and the cell's colour in the chosen colour mode.

const T: any = TSL;
const { Fn, uniform, vec2, vec3, vec4, float, floor, max, min, abs, clamp, sqrt, atan, mix, smoothstep, dot, pow, length, luminance, texture, uv, step, select, perspectiveDepthToViewZ, Loop, If } = T;

export interface CellUniforms {
  cellPx: any; paneSize: any; near: any; far: any;
  wDepth: any; wNormal: any; wLuma: any;
  black: any; white: any; gamma: any; contrast: any; invert: any;
  colourMode: any; saturation: any; boost: any; keyA: any; keyB: any; ink: any; phosphor: any;
  gaze: any; gazeR: any;
}

export function makeCellUniforms(): CellUniforms {
  return {
    cellPx: uniform(8), paneSize: uniform(new THREE.Vector2(960, 540)), near: uniform(0.05), far: uniform(2400),
    wDepth: uniform(1), wNormal: uniform(0.8), wLuma: uniform(0.6),
    black: uniform(0.04), white: uniform(0.9), gamma: uniform(0.9), contrast: uniform(0.4), invert: uniform(0),
    colourMode: uniform(0), saturation: uniform(1.1), boost: uniform(1.35),
    keyA: uniform(new THREE.Color('#ffd27a')), keyB: uniform(new THREE.Color('#5ae0ff')), ink: uniform(new THREE.Color('#3a2c2a')),
    phosphor: uniform(new THREE.Color('#ffb000')),
    gaze: uniform(0), gazeR: uniform(0.05),
  };
}

/** Remap mirrored from schema.remapBrightness. */
export const remapNode = Fn(([l, black, white, gamma, contrast, invert]: any[]) => {
  const x0 = clamp(l.sub(black).div(max(white.sub(black), 0.0001)), 0.0, 1.0);
  const x1 = pow(x0, gamma);
  const s = x1.mul(x1).mul(float(3.0).sub(x1.mul(2.0)));
  const x2 = clamp(x1.add(s.sub(x1).mul(contrast)), 0.0, 1.0);
  return mix(x2, float(1.0).sub(x2), invert);
});

/**
 * Edge bin mirrored from schema.edgeBin: tangent = gradient rotated 90°,
 * angle in [0, π) → 0 '_', 1 '\', 2 '|', 3 '/'.
 */
export const edgeBinNode = Fn(([gx, gy]: any[]) => {
  const a = atan(gx, gy.negate());
  const pi = float(Math.PI);
  const m = a.sub(floor(a.div(pi)).mul(pi));
  return floor(m.div(pi.div(4.0)).add(0.5)).sub(floor(floor(m.div(pi.div(4.0)).add(0.5)).div(4.0)).mul(4.0));
});

export class CellPass {
  info: THREE.RenderTarget; // r = l', g = edge strength, b = edge bin/4, a = linear depth
  colour: THREE.RenderTarget; // rgb = cell colour, a = l'
  infoQuad: THREE.QuadMesh;
  colourQuad: THREE.QuadMesh;
  sceneNode: any;
  normalNode: any;
  depthNode: any;
  w = 1; h = 1;

  constructor(public u: CellUniforms, placeholder: THREE.Texture, depthPlaceholder: THREE.Texture, paletteTex: THREE.Texture) {
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false };
    this.info = new THREE.RenderTarget(1, 1, opts);
    this.colour = new THREE.RenderTarget(1, 1, opts);
    const S = (this.sceneNode = texture(placeholder));
    const N = (this.normalNode = texture(placeholder));
    const D = (this.depthNode = texture(depthPlaceholder));
    const PAL = texture(paletteTex);

    const cellUV = (o: any) => {
      const cells = u.paneSize.div(u.cellPx);
      const c = floor(uv().mul(cells)).add(0.5).add(o);
      return c.div(cells);
    };
    const linDepth = (p: any) => perspectiveDepthToViewZ(D.sample(p).x, u.near, u.far).negate();
    // perceptual brightness (the scene buffer is linear)
    const lumAt = (p: any) => pow(max(luminance(S.sample(p).rgb), 0.0), float(1 / 2.2));
    const nAt = (p: any) => N.sample(p).xyz;

    const infoMat = new THREE.MeshBasicNodeMaterial();
    infoMat.colorNode = Fn(() => {
      const K = [-1, 0, 1];
      const cells0 = u.paneSize.div(u.cellPx);
      const ld: any[] = [], ll: any[] = [], nn: any[] = [];
      for (const y of K) for (const x of K) {
        const p = cellUV(vec2(x, y));
        // brightness: average 4 taps inside each cell so swimming texels can't alias
        const q = vec2(0.25).div(cells0);
        const la = lumAt(p.add(q.mul(vec2(-1, -1)))).add(lumAt(p.add(q.mul(vec2(1, -1))))).add(lumAt(p.add(q.mul(vec2(-1, 1))))).add(lumAt(p.add(q.mul(vec2(1, 1))))).mul(0.25);
        ld.push(linDepth(p)); ll.push(la); nn.push(nAt(p));
      }
      // 3×3 pre-blurred brightness, so dither and jitter never pick glyphs
      const wts = [1, 2, 1, 2, 4, 2, 1, 2, 1];
      let lb: any = float(0);
      wts.forEach((w, i) => { lb = lb.add(ll[i].mul(w / 16)); });
      const sob = (v: any[]) => ({
        gx: v[2].add(v[5].mul(2)).add(v[8]).sub(v[0]).sub(v[3].mul(2)).sub(v[6]),
        gy: v[6].add(v[7].mul(2)).add(v[8]).sub(v[0]).sub(v[1].mul(2)).sub(v[2]),
      });
      const sd = sob(ld);
      const dc = max(ld[4], 0.001);
      const dgx = sd.gx.div(dc), dgy = sd.gy.div(dc);
      // discontinuities, not slopes: the depth Laplacian is ~0 across any plane
      const lapX = abs(ld[3].add(ld[5]).sub(ld[4].mul(2.0))).div(dc);
      const lapY = abs(ld[1].add(ld[7]).sub(ld[4].mul(2.0))).div(dc);
      const depthEdge = max(lapX, lapY).mul(3.0);
      // normals: Sobel per component
      const ng = [0, 1, 2].map((k) => sob(nn.map((n) => n.element(k))));
      const normalEdge = max(sqrt(ng.reduce((a: any, g: any) => a.add(g.gx.mul(g.gx)).add(g.gy.mul(g.gy)), float(0))).mul(0.25).sub(0.35), 0.0).mul(1.6);
      const ngx = ng[0].gx.add(ng[1].gx).add(ng[2].gx), ngy = ng[0].gy.add(ng[1].gy).add(ng[2].gy);
      // luminance: difference-of-Gaussians for edges painted inside textures
      const sl = sob(ll);
      let ring: any = float(0);
      [0, 1, 2, 3, 5, 6, 7, 8].forEach((i) => { ring = ring.add(ll[i]); });
      const dog = max(abs(ll[4].sub(ring.div(8.0))).mul(3.0).sub(0.12), 0.0);
      const de = depthEdge.mul(u.wDepth), ne = normalEdge.mul(u.wNormal), le = dog.mul(u.wLuma);
      const strength = max(de, max(ne, le));
      const useD = step(max(ne, le), de);
      const useN = step(le, ne).mul(useD.oneMinus());
      const gx = mix(mix(sl.gx, ngx, useN), dgx, useD);
      const gy = mix(mix(sl.gy, ngy, useN), dgy, useD);
      const bin = edgeBinNode(gx, gy);
      // gaze settle: what you look at becomes calm and legible
      const toC = uv().sub(0.5).mul(vec2(u.paneSize.x.div(u.paneSize.y), 1.0));
      const inGaze = smoothstep(u.gazeR, u.gazeR.mul(0.6), length(toC)).mul(u.gaze);
      const lp = remapNode(lb, u.black, u.white, u.gamma, u.contrast.add(inGaze.mul(0.4)), u.invert);
      return vec4(lp, strength, bin.div(4.0).add(0.01), ld[4]);
    })();
    this.infoQuad = new THREE.QuadMesh(infoMat);

    const colMat = new THREE.MeshBasicNodeMaterial();
    colMat.colorNode = Fn(() => {
      // average colour over the cell (4 taps inside it)
      const cells = u.paneSize.div(u.cellPx);
      const base = floor(uv().mul(cells));
      let c: any = vec3(0);
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) c = c.add(S.sample(base.add(vec2(ox, oy)).div(cells)).rgb);
      c = c.mul(0.25);
      const l = pow(max(luminance(c), 0.0), float(1 / 2.2));
      const lp = remapNode(l, u.black, u.white, u.gamma, u.contrast, u.invert);
      // full: saturation + boost
      const full = mix(vec3(l), c, u.saturation).mul(u.boost);
      const mono = u.ink.mul(lp.mul(0.8).add(0.2)).mul(u.boost);
      const duo = mix(u.keyB, u.keyA, lp).mul(lp.mul(0.7).add(0.3)).mul(u.boost);
      // palette: nearest of the realm's 32 colours
      const best = vec3(0).toVar();
      const bd = float(1e9).toVar();
      Loop(32, ({ i }: any) => {
        const pc = PAL.sample(vec2(float(i).add(0.5).div(32.0), 0.5)).rgb;
        const d = dot(pc.sub(c), pc.sub(c));
        If(d.lessThan(bd), () => { bd.assign(d); best.assign(pc); });
      });
      const pal = best.mul(u.boost);
      const pho = u.phosphor.mul(lp.mul(1.2)).mul(u.boost);
      const m = u.colourMode;
      const isM = (k: number) => step(abs(m.sub(k)), 0.5);
      const out = full.mul(isM(0)).add(mono.mul(isM(1))).add(duo.mul(isM(2))).add(pal.mul(isM(3))).add(pho.mul(isM(4)));
      return vec4(out, lp);
    })();
    this.colourQuad = new THREE.QuadMesh(colMat);
  }

  resize(paneW: number, paneH: number, cellPx: number) {
    const w = Math.max(1, Math.ceil(paneW / cellPx)), h = Math.max(1, Math.ceil(paneH / cellPx));
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.info.setSize(w, h);
      this.colour.setSize(w, h);
      return true;
    }
    return false;
  }

  render(renderer: THREE.WebGPURenderer) {
    renderer.setRenderTarget(this.info); this.infoQuad.render(renderer);
    renderer.setRenderTarget(this.colour); this.colourQuad.render(renderer);
  }

  dispose() { this.info.dispose(); this.colour.dispose(); }
}
