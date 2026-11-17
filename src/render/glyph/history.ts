import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';

// Per-cell history: only change a cell's glyph when brightness moves past the
// hysteresis band, or after a new choice has persisted for holdFrames. Edge
// glyphs follow the same rule on direction. A cell may not flip between
// near-black and near-white more than 3 times a second (photosensitivity).
// WebGPU and WebGL 2 both use ping-pong render targets here.

const T: any = TSL;
const { Fn, uniform, vec2, vec4, float, floor, max, min, abs, step, mix, texture, uv, select, length, smoothstep } = T;

export interface HistoryUniforms {
  hysteresis: any; holdFrames: any; reset: any; dt: any; threshold: any; thickness: any; rampCount: any; shadowLift: any;
  minFlipGap: any; gaze: any; gazeR: any; aspect: any;
}

export function makeHistoryUniforms(): HistoryUniforms {
  return {
    hysteresis: uniform(0.06), holdFrames: uniform(3), reset: uniform(1), dt: uniform(1 / 60), threshold: uniform(0.35), thickness: uniform(1),
    rampCount: uniform(10), shadowLift: uniform(1), minFlipGap: uniform(0.34), gaze: uniform(0), gazeR: uniform(0.05), aspect: uniform(16 / 9),
  };
}

export class HistoryPass {
  rts: [THREE.RenderTarget, THREE.RenderTarget];
  frame = 0;
  quad: THREE.QuadMesh;
  infoNode: any;
  prevNode: any;
  w = 1; h = 1;

  constructor(public u: HistoryUniforms, placeholder: THREE.Texture) {
    const opts = { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false };
    this.rts = [new THREE.RenderTarget(1, 1, opts), new THREE.RenderTarget(1, 1, opts)];
    const I = (this.infoNode = texture(placeholder));
    const H = (this.prevNode = texture(placeholder));
    // transparent + NoBlending so alpha (time since the last flip) is written through, not forced to 1
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
    mat.colorNode = Fn(() => {
      const p = uv();
      const info = I.sample(p);
      const texel = vec2(1.0).div(vec2(T.textureSize(I).xy));
      // edge thickness 2: dilate by one cell, adopting the strongest neighbour
      let strength: any = info.y;
      let binv: any = info.z;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = I.sample(p.add(vec2(ox, oy).mul(texel)));
        const take = step(strength, n.y).mul(step(1.5, u.thickness));
        strength = mix(strength, n.y.mul(0.95), take);
        binv = mix(binv, n.z, take);
      }
      const l = info.x;
      const prev = H.sample(p);
      const code = prev.x, lastL = prev.y, pending = prev.z, sinceFlip = prev.w;
      // edge hysteresis: an edge cell stays an edge until the edge clearly fades
      const wasEdge = step(9.5, code);
      const isEdge = step(u.threshold.mul(mix(float(1.15), float(0.75), wasEdge)), strength);
      const bin = floor(binv.mul(4.0));
      const fill = floor(min(l, 0.999).mul(u.rampCount));
      const fillL = max(fill, u.shadowLift);
      const want = mix(fillL, bin.add(10.0), isEdge);

      const toC = p.sub(0.5).mul(vec2(u.aspect, 1.0));
      const inGaze = smoothstep(u.gazeR, u.gazeR.mul(0.6), length(toC)).mul(u.gaze);
      const hys = u.hysteresis.mul(inGaze.add(1.0));
      const same = step(abs(want.sub(code)), 0.5);
      // Schmitt-style band: a fill glyph holds while l stays within its own
      // brightness range widened by the hysteresis; edges compare to lastL
      const lo = code.div(u.rampCount).sub(hys), hi = code.add(1.0).div(u.rampCount).add(hys);
      const outOfBand = max(step(l, lo), step(hi, l));
      const moved = mix(outOfBand, step(hys, abs(l.sub(lastL))), wasEdge);
      const bigMove = moved.mul(step(0.001, hys)).max(step(u.holdFrames, 0.5).mul(step(hys, 0.0001)));
      // the *same* new choice must persist for holdFrames (pending = candidate + count/100)
      const cand = floor(pending.add(0.001));
      const cnt = floor(pending.sub(cand).mul(100.0).add(0.5));
      const sameCand = step(abs(want.sub(cand)), 0.5);
      const newCnt = mix(float(1.0), cnt.add(1.0), sameCand);
      const persisted = step(u.holdFrames, newCnt);
      let doSwitch: any = same.oneMinus().mul(max(bigMove, persisted));
      // photosensitivity: dark↔bright flips at most every 0.34 s (≤ 3/s)
      const isDark = (c: any) => step(c, 1.5).mul(step(c, 9.5));
      const isBright = (c: any) => step(7.5, c).mul(step(c, 9.5));
      const flip = max(isDark(code).mul(isBright(want)), isBright(code).mul(isDark(want)));
      const blocked = flip.mul(step(sinceFlip, u.minFlipGap));
      doSwitch = doSwitch.mul(blocked.oneMinus());
      const newCode = mix(code, want, doSwitch);
      const newLastL = mix(lastL, l, max(doSwitch, same));
      const newPending = mix(want.add(min(newCnt, 60.0).div(100.0)), newCode, max(doSwitch, same));
      const newSince = mix(min(sinceFlip.add(u.dt), 10.0), float(0.0), flip.mul(doSwitch));
      const out = vec4(newCode, newLastL, newPending, newSince);
      // reset on link transitions and camera cuts
      return mix(out, vec4(want, l, want, 10.0), u.reset);
    })();
    this.quad = new THREE.QuadMesh(mat);
  }

  get current(): THREE.RenderTarget { return this.rts[(this.frame + 1) & 1]; }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.rts.forEach((r) => r.setSize(w, h));
    this.u.reset.value = 1;
  }

  render(renderer: THREE.WebGPURenderer, info: THREE.Texture) {
    const cur = this.rts[this.frame & 1];
    const prev = this.rts[(this.frame + 1) & 1];
    this.infoNode.value = info;
    this.prevNode.value = prev.texture;
    renderer.setRenderTarget(cur);
    this.quad.render(renderer);
    this.frame++;
  }

  dispose() { this.rts.forEach((r) => r.dispose()); }
}
