import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { whiteTexture } from './textures';

const T: any = TSL;
const {
  Fn, uniform, vec2, vec3, vec4, float, floor, max, min, mix, dot, sin, cos, clamp, smoothstep,
  positionLocal, positionWorld, positionView, modelViewMatrix, cameraProjectionMatrix, normalWorld,
  uv, texture, varying, normalView, positionViewDirection, abs, pow, fract, length, oneMinus, hash,
} = T;

// ── Realm-wide uniforms, set before each pane's scene is drawn ──────────────
export const G = {
  time: uniform(0),
  snap: uniform(new THREE.Vector2(240, 135)),
  sunDir: uniform(new THREE.Vector3(0.3, 0.8, 0.4).normalize()),
  sunColor: uniform(new THREE.Color(1, 0.95, 0.85)),
  skyAmb: uniform(new THREE.Color(0.55, 0.6, 0.75)),
  groundAmb: uniform(new THREE.Color(0.35, 0.3, 0.35)),
  fogColor: uniform(new THREE.Color(0.8, 0.8, 0.9)),
  fogNear: uniform(20),
  fogFar: uniform(140),
  fogHeight: uniform(0.0), // height-fog density
  fogBase: uniform(0),
  wind: uniform(1),
  glass: uniform(0), // Dream Law: Glass night
  paper: uniform(0), // Dream Law: Paper night
  backwards: uniform(1), // Dream Law: Backwards (animation time sign)
  affine: uniform(0.7),
  memoryGlow: uniform(new THREE.Color(1, 0.85, 0.55)),
  dawn: uniform(0), // night progress brightening
};

export interface LoFiOptions {
  map?: THREE.Texture | null;
  color?: THREE.ColorRepresentation;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  repeat?: [number, number];
  wind?: number; // vertex wind amplitude
  unlit?: boolean;
  film?: number; // thin-film iridescence amount
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  noFog?: boolean;
  snap?: boolean;
  additive?: boolean;
  pulse?: boolean; // breathing glow
  depthWrite?: boolean;
  glyphy?: boolean; // scrolling glyph texture
  bob?: number; // per-instance vertical bobbing (instanced lanterns, moths)
}

let paperTex: THREE.Texture | null = null;
export function setPaperTexture(t: THREE.Texture) { paperTex = t; }

export interface LoFiMaterial extends THREE.MeshBasicNodeMaterial {
  uEmissive: any;
  uEmissiveI: any;
  uColor: any;
  uRemember: any;
  uPulse: any;
  uOpacity: any;
}

/** PS1 vertex snap in clip space onto a coarse grid. */
export const snappedClip = Fn(() => {
  const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1));
  const ndc = clip.xy.div(clip.w);
  const snapped = floor(ndc.mul(G.snap).add(0.5)).div(G.snap);
  return vec4(snapped.mul(clip.w), clip.z, clip.w);
});

export function windOffset(amount: number) {
  const t = G.time.mul(G.backwards);
  const wp = positionLocal; // local is fine: phase from object-local coordinates
  const h = max(positionLocal.y, 0);
  return vec3(
    sin(t.mul(1.3).add(wp.x.mul(0.7)).add(wp.z.mul(0.3))).mul(0.06),
    sin(t.mul(1.7).add(wp.z.mul(0.9))).mul(0.02),
    cos(t.mul(1.1).add(wp.x.mul(0.5))).mul(0.06),
  ).mul(h).mul(amount).mul(G.wind);
}

export function filmColor(tn: any) {
  return vec3(0.5).add(vec3(0.5).mul(cos(vec3(0.0, 0.33, 0.67).add(tn).mul(6.2831853))));
}

export function makeLoFi(o: LoFiOptions = {}): LoFiMaterial {
  const mat = new THREE.MeshBasicNodeMaterial({
    transparent: !!o.transparent || !!o.additive,
    side: o.side ?? THREE.FrontSide,
    vertexColors: o.vertexColors ?? true,
    depthWrite: o.depthWrite ?? !o.additive,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }) as LoFiMaterial;
  mat.fog = false;
  mat.toneMapped = false;

  const map = o.map ?? whiteTexture();
  const uColor = uniform(new THREE.Color(o.color ?? 0xffffff));
  const uEmissive = uniform(new THREE.Color(o.emissive ?? 0x000000));
  const uEmissiveI = uniform(o.emissiveIntensity ?? (o.emissive ? 1 : 0));
  const uRemember = uniform(0);
  const uPulse = uniform(0);
  const uOpacity = uniform(o.opacity ?? 1);
  mat.uColor = uColor; mat.uEmissive = uEmissive; mat.uEmissiveI = uEmissiveI;
  mat.uRemember = uRemember; mat.uPulse = uPulse; mat.uOpacity = uOpacity;
  mat.userData.opts = o;

  if (o.wind || o.bob) {
    let p = positionLocal;
    if (o.wind) p = p.add(windOffset(o.wind));
    if (o.bob) {
      const ph = hash(T.instanceIndex.toFloat()).mul(6.283);
      p = p.add(vec3(sin(G.time.mul(0.9).add(ph)).mul(0.3), sin(G.time.mul(1.3).add(ph.mul(1.7))), cos(G.time.mul(0.7).add(ph)).mul(0.3)).mul(o.bob));
    }
    mat.positionNode = p;
  }
  if (o.snap !== false) mat.vertexNode = snappedClip();

  // Affine texture wobble: carry uv·w and w, divide per fragment.
  const clipW = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1)).w;
  const rep = vec2(o.repeat?.[0] ?? 1, o.repeat?.[1] ?? 1);
  const baseUV = uv().mul(rep);
  const uvw = varying(vec3(baseUV.mul(clipW), clipW));
  const affUV = uvw.xy.div(uvw.z);
  let uvNode = mix(baseUV, affUV, G.affine);
  if (o.glyphy) uvNode = uvNode.add(vec2(0, floor(G.time.mul(6)).mul(0.0625)));

  // Gouraud light, computed per vertex like the old hardware.
  const n = normalWorld;
  const lambert = max(dot(n, G.sunDir), 0.0);
  const hemi = mix(G.groundAmb, G.skyAmb, n.y.mul(0.5).add(0.5));
  const light = varying(hemi.mul(0.72).add(G.sunColor.mul(lambert).mul(0.62)));
  const viewDepth = varying(positionView.z.negate());
  const worldY = varying(positionWorld.y);

  mat.colorNode = Fn(() => {
    const tex = texture(map, uvNode);
    let base = tex.rgb.mul(uColor);
    if (paperTex) {
      const p = texture(paperTex, uvNode.mul(0.5)).rgb;
      base = mix(base, p.mul(dot(base, vec3(0.3, 0.59, 0.11)).mul(0.6).add(0.55)), G.paper);
    }
    let col = o.unlit ? base : base.mul(light.add(G.dawn.mul(0.15)));
    // nothing is fully dark
    col = max(col, base.mul(0.09));

    const fres = pow(oneMinus(abs(dot(normalView, positionViewDirection))), 2.0);
    if (o.film) col = col.add(filmColor(fres.mul(1.6).add(G.time.mul(0.05))).mul(fres.mul(0.7).add(0.15)).mul(o.film));
    // Glass night: everything turns to tinted glass
    col = mix(col, filmColor(fres.add(0.2)).mul(fres.mul(0.9).add(0.12)).add(base.mul(0.15)), G.glass);

    const pulse = sin(G.time.mul(4.0)).mul(0.5).add(0.5);
    let emis = uEmissive.mul(uEmissiveI);
    if (o.pulse) emis = emis.mul(sin(G.time.mul(1.7).add(worldY)).mul(0.35).add(0.85));
    col = col.add(emis);
    col = col.add(G.memoryGlow.mul(uRemember).mul(0.35).mul(fres.add(0.4)));
    col = col.add(vec3(1.0, 0.95, 0.85).mul(uPulse).mul(pulse.mul(0.6).add(0.4)));

    if (!o.noFog) {
      const f = smoothstep(G.fogNear, G.fogFar, viewDepth);
      const hf = clamp(G.fogHeight.mul(G.fogBase.sub(worldY).add(6.0)).mul(0.08), 0.0, 0.85);
      col = mix(col, G.fogColor, clamp(max(f, hf.mul(f.add(0.3))), 0.0, 1.0));
    }
    return col;
  })();

  if (mat.transparent) mat.opacityNode = uOpacity.mul(texture(map, uvNode).a);
  return mat;
}

// ── Cache so identical looks share one compiled program ─────────────────────
const cache = new Map<string, LoFiMaterial>();
export function lofi(key: string, o: LoFiOptions): LoFiMaterial {
  let m = cache.get(key);
  if (!m) { m = makeLoFi(o); cache.set(key, m); }
  return m;
}
export function clearMaterialCache(prefix: string) {
  for (const [k, m] of cache) if (k.startsWith(prefix)) { m.dispose(); cache.delete(k); }
}

/** A remembered or gazed-at object gets its own clone so the glow is per object. */
export function uniqueClone(src: LoFiMaterial, o: LoFiOptions): LoFiMaterial {
  const m = makeLoFi(o);
  m.uColor.value.copy(src.uColor.value);
  m.uEmissive.value.copy(src.uEmissive.value);
  m.uEmissiveI.value = src.uEmissiveI.value;
  return m;
}

// ── Sky dome: gradient, sky mandala calendar, two moons, stars ─────────────
export interface SkyUniforms {
  top: any; horizon: any; bottom: any; mandala: any; mandalaRot: any; moonA: any; moonB: any; moon3: any;
  stars: any; sun: any; sunColor: any; close: any;
}

export function makeSky(): { mesh: THREE.Mesh; u: SkyUniforms } {
  const u: SkyUniforms = {
    top: uniform(new THREE.Color('#203060')),
    horizon: uniform(new THREE.Color('#ffc0a0')),
    bottom: uniform(new THREE.Color('#101020')),
    mandala: uniform(0.6),
    mandalaRot: uniform(0),
    moonA: uniform(new THREE.Vector3(0.4, 0.5, -0.75).normalize()),
    moonB: uniform(new THREE.Vector3(-0.5, 0.35, -0.8).normalize()),
    moon3: uniform(0),
    stars: uniform(0.5),
    sun: uniform(new THREE.Vector3(0, 0.1, -1).normalize()),
    sunColor: uniform(new THREE.Color('#ffe0b0')),
    close: uniform(0), // mandala closes on night 365
  };
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  mat.fog = false;
  const dirV = varying(positionLocal.normalize());
  mat.colorNode = Fn(() => {
    const d = dirV.normalize();
    const y = d.y;
    let col = mix(u.horizon, u.top, smoothstep(0.0, 0.7, y));
    col = mix(col, u.bottom, smoothstep(0.0, -0.4, y));
    col = mix(col, col.mul(1.25).add(vec3(0.12, 0.1, 0.08)), G.dawn.mul(smoothstep(-0.1, 0.5, y.oneMinus())));
    // stars
    const sp = floor(d.mul(220.0));
    const st = hash(sp.x.add(sp.y.mul(157.0)).add(sp.z.mul(113.0)));
    const tw = sin(G.time.mul(2.0).add(st.mul(50.0))).mul(0.5).add(0.5);
    col = col.add(vec3(1.0).mul(smoothstep(0.985, 1.0, st)).mul(tw).mul(u.stars).mul(smoothstep(0.0, 0.3, y)));
    // sun glow
    const sd = max(dot(d, u.sun), 0.0);
    col = col.add(u.sunColor.mul(pow(sd, 64.0).mul(1.5).add(pow(sd, 6.0).mul(0.25))));
    // moons
    const ma = smoothstep(0.9993, 0.9996, dot(d, u.moonA));
    const mb = smoothstep(0.9990, 0.9994, dot(d, u.moonB));
    col = mix(col, vec3(1.0, 0.97, 0.9), ma);
    col = mix(col, vec3(0.85, 0.9, 1.0), mb);
    col = col.add(vec3(0.3, 0.3, 0.35).mul(pow(max(dot(d, u.moonA), 0.0), 300.0)));
    const m3dir = vec3(0.0, 0.5, 0.86).normalize();
    col = mix(col, vec3(1.0, 0.85, 0.95), smoothstep(0.9994, 0.9997, dot(d, m3dir)).mul(u.moon3));
    // sky mandala: polar SDF rings around the zenith, one notch per night
    const r = length(d.xz).div(max(y, 0.05));
    const a = T.atan(d.z, d.x).add(u.mandalaRot);
    const petals = abs(sin(a.mul(12.0))).mul(0.15);
    const rings = abs(fract(r.mul(1.6).add(petals)).sub(0.5));
    const spokes = abs(sin(a.mul(24.0).add(r.mul(2.0))));
    const close = smoothstep(u.close.mul(6.0), u.close.mul(6.0).add(0.4), r).oneMinus().mul(u.close);
    const ring = smoothstep(0.04, 0.0, rings).add(smoothstep(0.03, 0.0, spokes).mul(0.25)).mul(smoothstep(0.15, 0.5, y));
    col = col.add(u.horizon.mul(ring).mul(u.mandala).mul(0.35).mul(smoothstep(6.0, 1.0, r)));
    col = mix(col, vec3(1.0), close.mul(smoothstep(0.2, 0.6, y)));
    return col;
  })();
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, u };
}
