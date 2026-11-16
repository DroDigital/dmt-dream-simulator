// Glyph Lab (dev only): a slowly turning statue in a room, a scripted camera
// pan, every GlyphStyle field on a Tweakpane panel, presets, shuffle, save
// preset as JSON, an A/B split view and a frame-time readout. It also exposes
// window.lab for the Playwright verification suite.
import '@fontsource/vt323';
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { Pane } from 'tweakpane';
import { GlyphSuite } from '../render/glyph';
import { PRESETS, preset, DEFAULT_STYLE, MODES, BACKDROPS, COLOURS, type GlyphStyle } from '../render/glyph/styles';
import { makeLoFi, G, setPaperTexture } from '../render/materials';
import { TextureBank } from '../render/textures';
import { Shape } from '../realms/kit';
import { sharedAtlas } from '../render/glyph/atlas';

const T: any = TSL;
const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const W = +(q.get('w') ?? 960), H = +(q.get('h') ?? 540);

async function main() {
  await document.fonts.load('32px VT323').catch(() => {});
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: q.has('webgl') });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  await renderer.init();
  sharedAtlas().draw();
  const bank = new TextureBank({ palette: ['#3a2c40', '#e0a070', '#f0e0c8', '#80b0d0', '#ffd27a'], mood: 0, era: 0, seed: 5 });
  setPaperTexture(bank.get('paper'));
  const scene = new THREE.Scene();
  const sceneKind = q.get('scene') ?? 'room';
  const statue = new THREE.Group();
  let cube: THREE.Mesh | null = null;
  if (sceneKind === 'cube') {
    // edge test: one lit cube against a flat background
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), makeLoFi({ color: '#202a3a', unlit: true, noFog: true, snap: false }));
    bg.position.z = -60; scene.add(bg);
    cube = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), makeLoFi({ color: '#f0d0a0', snap: false, noFog: true }));
    cube.rotation.set(0.5, 0.7, 0.2);
    cube.position.z = -16;
    scene.add(cube);
  } else {
    const room = new Shape();
    const wall = makeLoFi({ map: bank.get('wallpaper'), color: '#e8d8c8' });
    const floor = makeLoFi({ map: bank.get('wood') });
    room.box(floor, 20, 0.2, 20, 0, -0.1, 0, { uv: 2 });
    room.box(wall, 20, 8, 0.3, 0, 4, -10, { uv: 3 }); room.box(wall, 0.3, 8, 20, -10, 4, 0, { uv: 3 }); room.box(wall, 0.3, 8, 20, 10, 4, 0, { uv: 3 });
    room.box(makeLoFi({ map: bank.get('window'), emissive: '#ffd27a', emissiveIntensity: 0.8 }), 4, 3, 0.1, -3, 4, -9.8);
    room.box(makeLoFi({ map: bank.get('window'), emissive: '#ffd27a', emissiveIntensity: 0.8 }), 4, 3, 0.1, 3, 4, -9.8);
    scene.add(room.build());
    // a procedural statue on a plinth (stand-in for a CC0 scan)
    const marble = makeLoFi({ map: bank.get('marble'), color: '#f4f0ff' });
    const s = new Shape();
    s.box(marble, 1.6, 1.2, 1.6, 0, 0.6, 0);
    s.add(marble, new THREE.LatheGeometry([new THREE.Vector2(0.7, 0), new THREE.Vector2(0.55, 0.8), new THREE.Vector2(0.4, 1.6), new THREE.Vector2(0.5, 2.0), new THREE.Vector2(0.3, 2.3), new THREE.Vector2(0, 2.35)], 14), 0, 1.2, 0);
    s.sphere(marble, 0.35, 0, 3.8, 0, { w: 12, h: 8 });
    s.box(marble, 1.8, 0.18, 0.3, 0, 3.2, 0, { rz: 0.25 });
    s.torus(makeLoFi({ emissive: '#ffd27a', emissiveIntensity: 1.5, unlit: true }), 0.45, 0.04, 0, 4.35, 0, { rx: Math.PI / 2 });
    statue.add(s.build());
    statue.position.set(0, 0, -4);
    scene.add(statue);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 16, 8), makeLoFi({ color: '#405080', unlit: true, side: THREE.BackSide, noFog: true }));
    scene.add(sky);
  }
  G.fogNear.value = 30; G.fogFar.value = 160; G.fogColor.value.set('#405080');
  const cam = new THREE.PerspectiveCamera(70, W / H, 0.1, 400);

  // scene pass with MRT: colour + view normals, plus a depth texture
  const low = new THREE.RenderTarget(480, 270, { count: 2, type: THREE.HalfFloatType, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  low.textures[0].name = 'output'; low.textures[1].name = 'normal';
  low.depthTexture = new THREE.DepthTexture(480, 270);
  const mrtNode = T.mrt({ output: T.output, normal: T.normalView });

  const suite = new GlyphSuite();
  suite.setPalette(['#3a2c40', '#e0a070', '#f0e0c8', '#80b0d0', '#ffd27a']);
  let style: GlyphStyle = { ...preset(q.get('preset') ?? 'desert-day') };
  suite.setStyle(style);

  // final view: A/B split (left raw, right styled)
  const rawNode = T.texture(low.textures[0]);
  const glyphNode = T.texture(low.textures[0]);
  const split = T.uniform(q.has('ab') ? 0.5 : 0);
  const fin = new THREE.MeshBasicNodeMaterial();
  fin.colorNode = T.Fn(() => {
    const p = T.uv();
    const raw = rawNode.sample(p).rgb;
    const g = glyphNode.sample(p).rgb;
    const left = T.step(p.x, split);
    return T.mix(g, raw, left).add(T.vec3(1, 1, 1).mul(T.step(T.abs(p.x.sub(split)), 0.001)).mul(T.step(0.001, split)));
  })();
  const finQuad = new THREE.QuadMesh(fin);

  let frame = 0;
  let living = true;
  const state = { auto: !q.has('manual'), pan: true, ab: q.has('ab'), lucidity: 0, gaze: 0, preset: style.name ?? 'desert-day', ms: 0 };
  const times: number[] = [];
  let maskMode = false;
  const maskMat = new THREE.MeshBasicNodeMaterial(); maskMat.colorNode = T.vec3(1, 1, 1);

  function renderFrame(dt = 1 / 60) {
    const t0 = performance.now();
    frame++;
    const t = frame / 60;
    G.time.value = t;
    if (state.pan) {
      // scripted slow pan
      const a = Math.sin(t * 0.25) * 0.35;
      cam.position.set(Math.sin(a) * 9, 2.2, Math.cos(a) * 9 - 4);
      cam.lookAt(0, 2.2, -4);
    } else { cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); }
    if (sceneKind === 'cube') { cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); }
    statue.rotation.y = t * 0.2;
    cam.aspect = W / H; cam.updateProjectionMatrix();
    G.snap.value.set(240, 135);
    renderer.setMRT(mrtNode);
    renderer.setRenderTarget(low);
    renderer.render(scene, cam);
    renderer.setMRT(null);
    const tex = suite.render(renderer, {
      scene: low.textures[0], normal: low.textures[1], depth: low.depthTexture!, near: cam.near, far: cam.far, paneW: W, paneH: H, fov: cam.fov,
      dt, time: living ? t : 0, gaze: state.gaze, lucidity: state.lucidity, gentle: false, windZone: 2, drift: living ? 1 : 0, driftZone: 1,
      quality: q.has('four') ? 2 : 1,
    });
    glyphNode.value = tex;
    split.value = state.ab ? 0.5 : 0;
    renderer.setRenderTarget(null);
    finQuad.render(renderer);
    const ms = performance.now() - t0;
    times.push(ms); if (times.length > 120) times.shift();
    return ms;
  }

  // ── Tweakpane: every GlyphStyle field ─────────────────────────────────
  if (!q.has('nopanel')) {
    const pane: any = new (Pane as any)({ title: 'Glyph Lab' });
    const presetNames = Object.keys(PRESETS).sort();
    pane.addBinding(state, 'preset', { options: Object.fromEntries(presetNames.map((n) => [n, n])) }).on('change', () => { style = { ...preset(state.preset) }; suite.setStyle(style); suite.reset(); pane.refresh(); });
    pane.addButton({ title: 'Shuffle' }).on('click', () => { state.preset = presetNames[Math.floor(Math.random() * presetNames.length)]; style = { ...preset(state.preset) }; suite.setStyle(style); pane.refresh(); });
    pane.addButton({ title: 'Save preset as JSON' }).on('click', () => { const a = document.createElement('a'); a.download = `${style.name ?? 'custom'}.json`; a.href = URL.createObjectURL(new Blob([JSON.stringify(style, null, 2)], { type: 'application/json' })); a.click(); });
    pane.addBinding(state, 'ab', { label: 'A/B split' });
    pane.addBinding(state, 'pan');
    pane.addBinding(state, 'lucidity', { min: 0, max: 3, step: 1 });
    pane.addBinding(state, 'gaze', { min: 0, max: 1 });
    pane.addBinding(state, 'ms', { readonly: true, label: 'frame ms', interval: 250 });
    const f = pane.addFolder({ title: 'GlyphStyle' });
    const apply = () => suite.setStyle(style);
    const num = (k: keyof GlyphStyle, min: number, max: number, step?: number) => f.addBinding(style as any, k, { min, max, step }).on('change', apply);
    f.addBinding(style as any, 'mode', { options: Object.fromEntries(MODES.map((m) => [m, m])) }).on('change', () => { style.ramp = ({ ascii: ' .:-=+*#%@', braille: '⠀⠁⠃⠇⠏⠟⠿⡿⣿⣿', blocks: ' ░░▒▒▓▓███' } as any)[style.mode]; apply(); });
    f.addBinding(style as any, 'ramp').on('change', apply);
    f.addBinding(style as any, 'font').on('change', apply);
    num('cellPx', 4, 24, 1); f.addBinding(style as any, 'depthCells').on('change', apply); num('depthNear', 0, 40); num('depthFar', 5, 200);
    num('edgeThreshold', 0, 2); num('edgeDepthWeight', 0, 4); num('edgeNormalWeight', 0, 4); num('edgeLumaWeight', 0, 4);
    f.addBinding(style as any, 'edgeThickness', { options: { '1': 1, '2': 2 } }).on('change', apply);
    f.addBinding(style as any, 'backdropMode', { options: Object.fromEntries(BACKDROPS.map((m) => [m, m])) }).on('change', apply);
    num('backdropStrength', 0, 1); num('backdropBlur', 0, 8);
    f.addBinding(style as any, 'colourMode', { options: Object.fromEntries(COLOURS.map((m) => [m, m])) }).on('change', apply);
    num('colourSaturation', 0, 3); num('colourBoost', 0, 4); num('black', 0, 1); num('white', 0, 1); num('gamma', 0.2, 3); num('contrast', 0, 2); num('coverage', 0, 1);
    f.addBinding(style as any, 'invert').on('change', apply); f.addBinding(style as any, 'shadowLift').on('change', apply);
    num('hysteresis', 0, 0.5); num('holdFrames', 0, 20, 1);
    f.addBinding(style as any, 'ripples').on('change', apply); f.addBinding(style as any, 'gazeSettle').on('change', apply);
    f.addBinding(style.paper, 'aberration', { min: 0, max: 1 }).on('change', apply);
    f.addBinding(style.paper, 'flutedGlass', { min: 0, max: 1 }).on('change', apply);
    num('glyphOpacity', 0, 1);
  }

  const ft = document.getElementById('ft')!;
  function loop() {
    if (state.auto) {
      state.ms = renderFrame();
      const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
      ft.textContent = `${style.name ?? ''} · frame ${avg.toFixed(2)} ms (CPU+submit)`;
    }
    requestAnimationFrame(loop);
  }
  loop();

  // ── test API ──────────────────────────────────────────────────────────
  (window as any).lab = {
    presets: Object.keys(PRESETS).sort(),
    setPreset(n: string) { style = { ...preset(n) }; suite.setStyle(style); suite.reset(); state.preset = n; },
    patch(p: Partial<GlyphStyle>) { style = { ...style, ...p }; suite.setStyle(style); },
    setLiving(on: boolean) { living = on; style = { ...style, ripples: on && style.ripples, wind: on ? style.wind : null }; suite.setStyle(style); },
    setAuto(on: boolean) { state.auto = on; },
    setPan(on: boolean) { state.pan = on; },
    reset() { suite.reset(); frame = 0; },
    step(n = 1) { let ms = 0; for (let i = 0; i < n; i++) ms += renderFrame(); return ms / n; },
    async codes() { const c = await suite.readCodes(renderer, 1); return { w: c.w, h: c.h, codes: Array.from(c.codes) }; },
    /** silhouette mask of the cube at pane resolution (cube scene only) */
    async mask() {
      if (!cube) return null;
      const mrt = new THREE.RenderTarget(W, H, { type: THREE.UnsignedByteType });
      const bgMats = new Map<THREE.Object3D, THREE.Material>();
      scene.traverse((o: any) => { if (o.isMesh) { bgMats.set(o, o.material); o.material = o === cube ? maskMat : (() => { const m = new THREE.MeshBasicNodeMaterial(); m.colorNode = T.vec3(0, 0, 0); return m; })(); } });
      renderer.setRenderTarget(mrt); renderer.render(scene, cam); renderer.setRenderTarget(null);
      scene.traverse((o: any) => { if (bgMats.has(o)) o.material = bgMats.get(o); });
      const px = (await renderer.readRenderTargetPixelsAsync(mrt, 0, 0, W, H)) as Uint8Array;
      mrt.dispose();
      return { w: W, h: H, backend: (renderer.backend as any).isWebGPUBackend ? 'webgpu' : 'webgl', px: Array.from(px.filter((_, i) => i % 4 === 0)) };
    },
    cellPx() { return style.depthCells ? style.cellSizes[1] : style.cellPx; },
    times() { return times.slice(); },
    style() { return style; },
    backend: (renderer.backend as any).isWebGPUBackend ? 'webgpu' : 'webgl',
  };
  (window as any).labReady = true;
  void maskMode; void DEFAULT_STYLE;
}
main().catch((e) => { (window as any).err = String(e?.stack || e); console.error(e); });
