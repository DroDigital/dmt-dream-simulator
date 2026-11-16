import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { EDGE_ROW, ATLAS_ROWS, ATLAS_COLS } from './modes';
import { windOffset, rippleMask, driftLetter, type LivingUniforms } from './living';

// Full-resolution compose: pick a cell size by depth band (Bayer-dithered
// boundary), read that layer's stable glyph code and colour, look the glyph
// up in the atlas, and lay it over the chosen backdrop.

const T: any = TSL;
const { Fn, uniform, vec2, vec3, vec4, float, floor, fract, max, min, abs, step, mix, texture, uv, hash, smoothstep, sin, perspectiveDepthToViewZ, luminance, clamp } = T;

export interface ComposeUniforms {
  paneSize: any; cellPx: any[]; depthNear: any; depthFar: any; depthCells: any; near: any; far: any;
  rowA: any; rowB: any; modeMix: any; coverage: any; opacity: any;
  backdropMode: any; backdropStrength: any; scanlines: any; layerCount: any;
}

export function makeComposeUniforms(): ComposeUniforms {
  return {
    paneSize: uniform(new THREE.Vector2(960, 540)), cellPx: [uniform(12), uniform(8), uniform(6)], depthNear: uniform(6), depthFar: uniform(40), depthCells: uniform(1),
    near: uniform(0.05), far: uniform(2400), rowA: uniform(0), rowB: uniform(0), modeMix: uniform(0), coverage: uniform(1), opacity: uniform(1),
    backdropMode: uniform(0), backdropStrength: uniform(0.45), scanlines: uniform(0), layerCount: uniform(3),
  };
}

export class ComposePass {
  rt: THREE.RenderTarget;
  quad: THREE.QuadMesh;
  hist: any[];
  col: any[];
  sceneNode: any;
  depthNode: any;
  backdropNode: any;
  constructor(public u: ComposeUniforms, public L: LivingUniforms, atlas: THREE.Texture, placeholder: THREE.Texture, depthPlaceholder: THREE.Texture) {
    this.rt = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.hist = [0, 1, 2].map(() => texture(placeholder));
    this.col = [0, 1, 2].map(() => texture(placeholder));
    const S = (this.sceneNode = texture(placeholder));
    const D = (this.depthNode = texture(depthPlaceholder));
    const B = (this.backdropNode = texture(placeholder));
    const A = texture(atlas);
    const bayer = Fn(([p]: any[]) => {
      // 4×4 Bayer via bit interleave
      const md = (a: any, n: number) => a.sub(floor(a.div(n)).mul(n));
      const x = md(floor(p.x), 4), y = md(floor(p.y), 4);
      const b0 = md(x, 2), b1 = floor(x.div(2.0)), c0 = md(y, 2), c1 = floor(y.div(2.0));
      const xb0 = abs(b0.sub(c0)), xb1 = abs(b1.sub(c1));
      return xb0.mul(8.0).add(c0.mul(4.0)).add(xb1.mul(2.0)).add(c1).add(0.5).div(16.0);
    });
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
    mat.colorNode = Fn(() => {
      const p = uv();
      const px = p.mul(u.paneSize);
      const lin = perspectiveDepthToViewZ(D.sample(p).x, u.near, u.far).negate();
      const dz = bayer(px).sub(0.5);
      const band = u.depthFar.sub(u.depthNear).mul(0.12);
      const nearW = step(lin.add(dz.mul(band)), u.depthNear);
      const farW = step(u.depthFar, lin.add(dz.mul(band)));
      const w0 = nearW.mul(u.depthCells), w2 = farW.mul(u.depthCells).mul(nearW.oneMinus());
      const w1 = float(1.0).sub(w0).sub(w2);
      const sky = step(u.far.mul(0.9), lin);

      const layer = (k: number) => {
        const cp = u.cellPx[k];
        const cell = floor(px.div(cp));
        const local = fract(px.div(cp));
        const cells = u.paneSize.div(cp);
        const cuv = cell.add(0.5).div(cells);
        const h = this.hist[k].sample(cuv);
        const c = this.col[k].sample(cuv);
        let code: any = h.x;
        // living text
        const isFill = step(code, 9.5);
        const windZone = mix(sky, float(1.0), step(1.5, L.windZone)).mul(step(0.5, L.windZone));
        code = clamp(code.add(windOffset(L, cell, windZone).mul(isFill)), 0.0, 9.0).mul(isFill).add(code.mul(isFill.oneMinus()));
        const rip = rippleMask(L, cell.add(0.5), cp, u.paneSize);
        const scrambleCode = floor(hash(cell.dot(vec2(1.0, 131.0)).add(floor(L.time.mul(20.0)))).mul(9.0)).add(1.0);
        code = mix(code, scrambleCode, step(0.5, rip));
        const dl = driftLetter(L, cell, cells.y);
        const drifting = dl.on.mul(mix(float(1.0), sky, L.driftZone));
        code = mix(code, dl.glyph, drifting);
        // coverage: a stable per-cell hash decides which cells may draw
        const hsh = fract(sin(cell.x.mul(12.9898).add(cell.y.mul(78.233))).mul(43758.5453));
        const covered = step(hsh, u.coverage);
        const edge = step(9.5, code);
        const col = mix(code, code.sub(10.0), edge);
        const rowFor = (row: any) => mix(row, float(EDGE_ROW), edge);
        const sampleRow = (row: any) => A.sample(vec2(col.add(local.x).div(ATLAS_COLS), rowFor(row).add(local.y).div(ATLAS_ROWS))).x;
        const mask = mix(sampleRow(u.rowA), sampleRow(u.rowB), u.modeMix).mul(max(covered, drifting));
        const glyphCol = mix(c.rgb, vec3(1.0, 0.95, 0.85).mul(c.a.add(0.4)), drifting.mul(0.5));
        return { mask, rgb: glyphCol };
      };
      const l0 = layer(0), l1 = layer(1), l2 = layer(2);
      const mask = l0.mask.mul(w0).add(l1.mask.mul(w1)).add(l2.mask.mul(w2));
      const gcol = l0.rgb.mul(w0).add(l1.rgb.mul(w1)).add(l2.rgb.mul(w2));
      // backdrop: blurred | black | original | transparent
      const bm = u.backdropMode;
      const isB = (k: number) => step(abs(bm.sub(k)), 0.5);
      const back = B.sample(p).rgb.mul(isB(0)).add(S.sample(p).rgb.mul(isB(2))).mul(u.backdropStrength);
      const m = mask.mul(u.opacity);
      let rgb: any = mix(back, gcol, m);
      // optional scanlines (tv-static)
      rgb = rgb.mul(float(1.0).sub(u.scanlines.mul(0.35).mul(step(0.5, fract(px.y.mul(0.5))))));
      const alpha = mix(float(1.0), m, isB(3));
      return vec4(rgb, alpha);
    })();
    this.quad = new THREE.QuadMesh(mat);
  }

  resize(w: number, h: number) {
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
  }

  render(renderer: THREE.WebGPURenderer) {
    renderer.setRenderTarget(this.rt);
    this.quad.render(renderer);
  }
}
