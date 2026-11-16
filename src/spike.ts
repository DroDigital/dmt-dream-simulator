import * as THREE from 'three/webgpu';
import { makeLoFi, G, makeSky } from './render/materials';
import { PanePost, Compositor } from './render/post';
import { TextureBank } from './render/textures';

(async () => {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const forceWebGL = location.search.includes('webgl');
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL });
  renderer.setSize(960, 540, false);
  await renderer.init();
  (window as any).backend = (renderer.backend as any).isWebGPUBackend ? 'webgpu' : 'webgl';
  const bank = new TextureBank({ palette: ['#203040', '#ff6090', '#ffd070', '#90e0ff', '#c0ff90'], mood: 0, era: 0, seed: 7 });
  const scene = new THREE.Scene();
  const sky = makeSky(); scene.add(sky.mesh);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 20, 20).rotateX(-Math.PI / 2), makeLoFi({ map: bank.get('tile'), repeat: [20, 20] }));
  scene.add(ground);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), makeLoFi({ map: bank.get('brick'), emissive: i % 3 === 0 ? '#ff80c0' : undefined, emissiveIntensity: 1.4 }));
    m.position.set(Math.cos(i) * 10, 2, -10 - i * 3);
    scene.add(m);
  }
  const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.4, 0), makeLoFi({ emissive: '#ffd070', emissiveIntensity: 2 }), 50);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 50; i++) { mtx.makeTranslation(Math.sin(i) * 15, 3 + (i % 5), -i * 1.5); inst.setMatrixAt(i, mtx); }
  scene.add(inst);
  const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 2000);
  cam.position.set(0, 1.6, 6);
  const post = new PanePost();
  post.resize(960, 540, 1);
  const comp = new Compositor(post.out[0].texture);
  comp.active[0].value = 1;
  comp.rects[0].value.set(0, 0, 1, 1);
  comp.seam.value = 0;
  const glyph = location.search.includes('glyph');
  post.u.glyph.value = glyph ? 1 : 0;
  let f = 0;
  const loop = () => {
    G.time.value = f / 60;
    post.u.time.value = f / 60;
    cam.rotation.y = Math.sin(f / 100) * 0.3;
    if (location.search.includes('direct')) { renderer.setRenderTarget(null); renderer.render(scene, cam); f++; (window as any).frames = f; requestAnimationFrame(loop); return; }
    renderer.setRenderTarget(post.lowA);
    renderer.render(scene, cam);
    if (f === 30) renderer.readRenderTargetPixelsAsync(post.lowA, 0, 0, 8, 8).then((px: any) => { (window as any).dbg = Array.from(px.slice(0, 16)); });
    if (f === 40) renderer.readRenderTargetPixelsAsync(post.out[0], 0, 0, 8, 8).then((px: any) => { (window as any).dbg2 = Array.from(px.slice(0, 16)); });
    const tex = post.composite(renderer);
    comp.texNodes[0].value = tex;
    comp.render(renderer);
    f++;
    (window as any).frames = f;
    requestAnimationFrame(loop);
  };
  loop();
})().catch((e) => { (window as any).err = String(e?.stack || e); console.error(e); });
