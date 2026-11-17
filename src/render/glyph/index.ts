import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { CellPass, makeCellUniforms, type CellUniforms } from './cells';
import { HistoryPass, makeHistoryUniforms, type HistoryUniforms } from './history';
import { ComposePass, makeComposeUniforms, type ComposeUniforms } from './compose';
import { makeLivingUniforms, MAX_RIPPLES, type LivingUniforms } from './living';
import { sharedAtlas } from './atlas';
import { MODE_TABLE } from './modes';
import { COLOURS, BACKDROPS, DEFAULT_STYLE, lucid, gentle as gentleStyle, type GlyphStyle } from './styles';
import { aberration } from '../paper/aberration';
import { flutedGlass } from '../paper/fluted-glass';
import { hexToRgb } from '../palettes';

// The Glyph Suite: a per-pane post-process at the "realm effects" stage.
// cells (brightness + edges at cell res) → history (stable glyphs) →
// compose (depth-sized cells, living text, backdrop) → Paper ports.

const T: any = TSL;
const { Fn, uniform, vec2, vec3, vec4, float, texture, uv, mix, step, abs } = T;

export interface GlyphFrame {
  scene: THREE.Texture;
  normal: THREE.Texture;
  depth: THREE.Texture;
  near: number;
  far: number;
  paneW: number;
  paneH: number;
  fov: number;
  dt: number;
  time: number;
  gaze: number; // 0..1 how settled the view is
  lucidity: number; // 0..3
  gentle: boolean;
  windZone?: 0 | 1 | 2;
  driftZone?: 0 | 1;
  drift?: number;
  reset?: boolean;
  quality?: 1 | 2; // 2 = 4-player preset (cells one size larger, ripples off)
}

export interface Ripple { x: number; y: number; t: number; strength: number }

export class GlyphSuite {
  layers: { cells: CellPass; hist: HistoryPass }[] = [];
  cu: CellUniforms[] = [];
  hu: HistoryUniforms[] = [];
  compose: ComposePass;
  ku: ComposeUniforms;
  lu: LivingUniforms;
  paletteTex: THREE.DataTexture;
  backdropA: THREE.RenderTarget;
  backdropB: THREE.RenderTarget;
  private downQuad: THREE.QuadMesh;
  private blurH: THREE.QuadMesh;
  private blurV: THREE.QuadMesh;
  private bdScene: any;
  private bdTexel = uniform(new THREE.Vector2(1, 1));
  private bdRadius = uniform(2);
  out: THREE.RenderTarget;
  private paperQuad: THREE.QuadMesh;
  private paperSrc: any;
  pu = { aberration: uniform(0), fluted: uniform(0), aspect: uniform(16 / 9), time: uniform(0) };
  style: GlyphStyle = { ...DEFAULT_STYLE };
  styleB: GlyphStyle | null = null;
  modeMix = 0;
  ripples: Ripple[] = [];
  private needReset = true;
  private placeholder: THREE.Texture;

  constructor() {
    const ph = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); ph.needsUpdate = true;
    const dph = new THREE.DepthTexture(1, 1);
    this.placeholder = ph;
    const pal = new Float32Array(32 * 4).fill(1);
    this.paletteTex = new THREE.DataTexture(pal, 32, 1, THREE.RGBAFormat, THREE.FloatType);
    this.paletteTex.magFilter = this.paletteTex.minFilter = THREE.NearestFilter;
    this.paletteTex.needsUpdate = true;
    for (let k = 0; k < 3; k++) {
      const cu = makeCellUniforms(), hu = makeHistoryUniforms();
      this.cu.push(cu); this.hu.push(hu);
      this.layers.push({ cells: new CellPass(cu, ph, dph, this.paletteTex), hist: new HistoryPass(hu, ph) });
    }
    this.lu = makeLivingUniforms();
    this.ku = makeComposeUniforms();
    const atlas = sharedAtlas();
    this.compose = new ComposePass(this.ku, this.lu, atlas.texture, ph, dph);
    // backdrop: quarter-res blur of the scene colour
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.backdropA = new THREE.RenderTarget(1, 1, rtOpts);
    this.backdropB = new THREE.RenderTarget(1, 1, rtOpts);
    this.bdScene = texture(ph);
    const dm = new THREE.MeshBasicNodeMaterial(); dm.colorNode = this.bdScene.sample(uv()).rgb;
    this.downQuad = new THREE.QuadMesh(dm);
    const blur = (src: THREE.RenderTarget, dir: [number, number]) => {
      const S = texture(src.texture);
      const m = new THREE.MeshBasicNodeMaterial();
      m.colorNode = Fn(() => {
        const d = vec2(dir[0], dir[1]).mul(this.bdTexel).mul(this.bdRadius);
        const w = [0.227, 0.194, 0.121, 0.054, 0.016];
        let c: any = S.sample(uv()).rgb.mul(w[0]);
        for (let i = 1; i < 5; i++) c = c.add(S.sample(uv().add(d.mul(i))).rgb.mul(w[i])).add(S.sample(uv().sub(d.mul(i))).rgb.mul(w[i]));
        return c;
      })();
      return new THREE.QuadMesh(m);
    };
    this.blurH = blur(this.backdropA, [1, 0]);
    this.blurV = blur(this.backdropB, [0, 1]);
    this.compose.backdropNode.value = this.backdropA.texture;
    // Paper pass
    this.out = new THREE.RenderTarget(1, 1, { ...rtOpts });
    this.paperSrc = texture(this.compose.rt.texture);
    const pm = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.NoBlending });
    pm.colorNode = Fn(() => {
      const p = uv();
      const src = this.paperSrc;
      const ab = aberration(src, p, this.pu.aberration, this.pu.aspect);
      const base = vec4(mix(src.sample(p).rgb, ab, step(0.001, this.pu.aberration)), src.sample(p).a);
      const fl = flutedGlass(src, p, this.pu.aspect, {
        amount: this.pu.fluted, size: float(0.55), angle: float(0), shape: float(1), distortion: float(0.5), shift: float(0),
        highlights: float(0.12), shadows: float(0.3), blur: float(1), stretch: float(0.15),
      });
      return vec4(mix(base.rgb, fl, step(0.001, this.pu.fluted)), base.a);
    })();
    this.paperQuad = new THREE.QuadMesh(pm);
  }

  /** The realm's 32 palette colours (5 keys × shades), for 'palette', 'mono', 'duotone'. */
  setPalette(keys: string[]) {
    const d = this.paletteTex.image.data as Float32Array;
    const shades = [0.28, 0.5, 0.72, 0.9, 1.0, 1.15];
    let k = 0;
    for (const hex of keys.slice(0, 5)) for (const s of shades) {
      const [r, g, b] = hexToRgb(hex);
      d[k * 4] = Math.pow(Math.min(1, r * s), 2.2); d[k * 4 + 1] = Math.pow(Math.min(1, g * s), 2.2); d[k * 4 + 2] = Math.pow(Math.min(1, b * s), 2.2); d[k * 4 + 3] = 1;
      k++;
    }
    while (k < 32) { d[k * 4] = k === 30 ? 0.005 : 0.92; d[k * 4 + 1] = k === 30 ? 0.004 : 0.9; d[k * 4 + 2] = k === 30 ? 0.006 : 0.85; d[k * 4 + 3] = 1; k++; }
    this.paletteTex.needsUpdate = true;
    const lin = (h: string) => new THREE.Color(h);
    for (const cu of this.cu) { cu.keyA.value.copy(lin(keys[4] ?? '#ffd27a')); cu.keyB.value.copy(lin(keys[1] ?? '#5ae0ff')); }
  }

  /** Set the style; pass b and t to crossfade (modes render both and mix). */
  setStyle(a: GlyphStyle, b: GlyphStyle | null = null, t = 0) {
    if (a.mode !== this.style.mode || a.ramp !== this.style.ramp) {
      const m = MODE_TABLE[a.mode];
      sharedAtlas().setRow(m.row, a.ramp, a.mode === 'ascii' ? a.font : m.font);
    }
    this.style = a; this.styleB = b; this.modeMix = b ? t : 0;
  }

  addRipple(r: Ripple) {
    this.ripples.push(r);
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
  }

  reset() { this.needReset = true; }

  render(renderer: THREE.WebGPURenderer, f: GlyphFrame): THREE.Texture {
    let s = lucid(f.gentle ? gentleStyle(this.style) : this.style, f.lucidity);
    if (f.quality === 2) s = { ...s, cellPx: s.cellPx + 2, cellSizes: s.cellSizes.map((c) => c + 2) as [number, number, number], ripples: false, scramble: s.scramble };
    const sB = this.styleB;
    const W = Math.max(16, Math.round(f.paneW)), H = Math.max(16, Math.round(f.paneH));
    const sizes = s.depthCells ? s.cellSizes : [s.cellPx, s.cellPx, s.cellPx];
    const reset = this.needReset || !!f.reset;
    const gazeR = Math.tan((6 * Math.PI) / 180) / Math.tan((f.fov * Math.PI) / 360) * 0.5;
    const colourIdx = COLOURS.indexOf(s.colourMode);
    for (let k = 0; k < 3; k++) {
      if (!s.depthCells && k !== 1) continue;
      const cu = this.cu[k], hu = this.hu[k];
      const L = this.layers[k];
      cu.cellPx.value = sizes[k];
      cu.paneSize.value.set(W, H);
      cu.near.value = f.near; cu.far.value = f.far;
      cu.wDepth.value = s.edgeDepthWeight; cu.wNormal.value = s.edgeNormalWeight; cu.wLuma.value = s.edgeLumaWeight;
      cu.black.value = s.black; cu.white.value = s.white; cu.gamma.value = s.gamma; cu.contrast.value = s.contrast; cu.invert.value = s.invert ? 1 : 0;
      cu.colourMode.value = colourIdx; cu.saturation.value = s.colourSaturation; cu.boost.value = s.colourBoost;
      if (s.inkColour) cu.ink.value.set(s.inkColour);
      cu.phosphor.value.set(s.phosphor === 'green' ? '#33ff66' : '#ffb000');
      cu.gaze.value = s.gazeSettle ? f.gaze : 0; cu.gazeR.value = gazeR;
      hu.hysteresis.value = s.hysteresis; hu.holdFrames.value = s.holdFrames; hu.threshold.value = s.edgeThreshold;
      hu.thickness.value = s.edgeThickness; hu.rampCount.value = [...s.ramp].length; hu.shadowLift.value = s.shadowLift ? 1 : 0;
      hu.dt.value = f.dt; hu.gaze.value = cu.gaze.value; hu.gazeR.value = gazeR; hu.aspect.value = W / H;
      hu.reset.value = reset ? 1 : 0;
      L.cells.sceneNode.value = f.scene; L.cells.normalNode.value = f.normal; L.cells.depthNode.value = f.depth;
      if (L.cells.resize(W, H, sizes[k])) { L.hist.resize(L.cells.w, L.cells.h); hu.reset.value = 1; }
      L.cells.render(renderer);
      L.hist.render(renderer, L.cells.info.texture);
      this.compose.hist[k].value = L.hist.current.texture;
      this.compose.col[k].value = L.cells.colour.texture;
      this.ku.cellPx[k].value = sizes[k];
    }
    this.needReset = false;
    // backdrop
    const bw = Math.max(8, Math.round(W / 4)), bh = Math.max(8, Math.round(H / 4));
    if (this.backdropA.width !== bw || this.backdropA.height !== bh) { this.backdropA.setSize(bw, bh); this.backdropB.setSize(bw, bh); }
    if (s.backdropMode === 'blurred' && s.backdropStrength > 0) {
      this.bdScene.value = f.scene;
      this.bdTexel.value.set(1 / bw, 1 / bh);
      this.bdRadius.value = Math.max(0.5, (s.backdropBlur * sizes[1]) / 4 / 3);
      renderer.setRenderTarget(this.backdropA); this.downQuad.render(renderer);
      renderer.setRenderTarget(this.backdropB); this.blurH.render(renderer);
      renderer.setRenderTarget(this.backdropA); this.blurV.render(renderer);
    }
    // compose
    const ku = this.ku;
    ku.paneSize.value.set(W, H);
    ku.depthNear.value = s.depthNear; ku.depthFar.value = s.depthFar; ku.depthCells.value = s.depthCells ? 1 : 0;
    ku.near.value = f.near; ku.far.value = f.far;
    ku.rowA.value = MODE_TABLE[s.mode].row;
    ku.rowB.value = MODE_TABLE[(sB ?? s).mode].row;
    ku.modeMix.value = this.modeMix;
    ku.coverage.value = s.coverage; ku.opacity.value = s.glyphOpacity;
    ku.backdropMode.value = BACKDROPS.indexOf(s.backdropMode); ku.backdropStrength.value = s.backdropStrength;
    ku.scanlines.value = s.scanlines ?? 0;
    this.compose.sceneNode.value = f.scene; this.compose.depthNode.value = f.depth;
    const L = this.lu;
    L.time.value = f.time;
    L.windSpeed.value = s.wind ? s.wind.speed : 0;
    if (s.wind) L.windDir.value.set(s.wind.dir[0], s.wind.dir[1]).normalize();
    L.windZone.value = s.wind ? f.windZone ?? 1 : 0;
    L.rippleOn.value = s.ripples ? 1 : 0;
    L.scramble.value = (s as any).scramble ?? 1;
    L.drift.value = f.drift ?? 0;
    L.driftZone.value = f.driftZone ?? 1;
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[i];
      L.ripples[i].value.set(r?.x ?? 0, r?.y ?? 0, r?.t ?? -10, r?.strength ?? 0);
    }
    this.compose.resize(W, H);
    this.compose.render(renderer);
    // Paper ports
    this.pu.aberration.value = s.paper.aberration;
    this.pu.fluted.value = s.paper.flutedGlass;
    this.pu.aspect.value = W / H;
    if (s.paper.aberration > 0 || s.paper.flutedGlass > 0) {
      if (this.out.width !== W || this.out.height !== H) this.out.setSize(W, H);
      renderer.setRenderTarget(this.out); this.paperQuad.render(renderer);
      renderer.setRenderTarget(null);
      return this.out.texture;
    }
    renderer.setRenderTarget(null);
    return this.compose.rt.texture;
  }

  /** Current glyph codes of the middle layer (for tests): returns {w,h,codes}. */
  async readCodes(renderer: THREE.WebGPURenderer, layer = 1): Promise<{ w: number; h: number; codes: Float32Array }> {
    const h = this.layers[layer].hist;
    const rt = h.current;
    const px = (await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height)) as Float32Array;
    const codes = new Float32Array(rt.width * rt.height);
    for (let i = 0; i < codes.length; i++) codes[i] = px[i * 4];
    return { w: rt.width, h: rt.height, codes };
  }

  dispose() {
    for (const l of this.layers) { l.cells.dispose(); l.hist.dispose(); }
    this.compose.rt.dispose(); this.backdropA.dispose(); this.backdropB.dispose(); this.out.dispose();
  }
}
export { DEFAULT_STYLE };
void vec3; void abs;
