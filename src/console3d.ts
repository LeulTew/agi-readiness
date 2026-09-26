import {
  NeutralToneMapping, CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, MathUtils, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Raycaster, Scene,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FIELDS, GUARDS, type LampState, type FieldDef } from './data';

const LAMP_RGB: Record<LampState, string> = { go: '#7DFFB0', amber: '#FFB23F', off: '#1A1C19', test: '#F4F1E6' };

type Shot = { look: [number, number, number]; dir: [number, number, number]; fitW: number; fitH: number; fov: number };
// camera stations for each chapter of the sticky stage (three.js Y-up; panel faces +Z).
// distance is solved per aspect ratio so the framed region always fits the canvas.
export const SHOTS: Shot[] = [
  { look: [0.02, 0.03, 0], dir: [-0.42, 0.16, 1], fitW: 2.4, fitH: 1.5, fov: 32 },
  { look: [-0.12, 0.2, 0], dir: [-0.2, 0.08, 1], fitW: 2.0, fitH: 0.7, fov: 32 },
  { look: [0.0, -0.33, 0], dir: [0.12, 0.5, 1], fitW: 2.0, fitH: 0.56, fov: 32 },
];

interface Lamp { mesh: Mesh; mat: MeshPhysicalMaterial; canvas: HTMLCanvasElement; tex: CanvasTexture; def: FieldDef | null; label: string; sub: string; state: LampState; hover: boolean }

export interface ConsoleHandle {
  setProgress(p: number): void;
  lampTest(): Promise<void>;
  setAllStates(): void;
  onHover(cb: (def: FieldDef | null, x: number, y: number) => void): void;
  dispose(): void;
}

function paintLens(l: Lamp) {
  const c = l.canvas, g = c.getContext('2d')!;
  const w = c.width, h = c.height;
  const lit = l.state !== 'off';
  const base = new Color(LAMP_RGB[l.state]);
  if (lit) {
    const grd = g.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, '#' + base.clone().offsetHSL(0, 0, 0.08).getHexString());
    grd.addColorStop(1, '#' + base.clone().offsetHSL(0, 0, -0.12).getHexString());
    g.fillStyle = grd;
  } else {
    g.fillStyle = '#1b1e1b';
  }
  g.fillRect(0, 0, w, h);
  if (l.hover) { g.strokeStyle = lit ? 'rgba(20,20,16,.55)' : 'rgba(236,232,218,.55)'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); }
  g.fillStyle = lit ? 'rgba(22,22,18,.92)' : 'rgba(236,232,218,.42)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const big = l.def === null;
  let size = big ? 150 : 40;
  g.font = `600 ${size}px "Jost Variable", Jost, sans-serif`;
  const maxW = w * 0.84;
  while (g.measureText(l.label).width > maxW && size > 18) { size -= 2; g.font = `600 ${size}px "Jost Variable", Jost, sans-serif`; }
  if (g.letterSpacing !== undefined) g.letterSpacing = big ? '0px' : '1.5px';
  g.fillText(l.label, w / 2, big ? h * 0.44 : h * 0.5);
  if (l.sub) {
    g.font = `500 ${big ? 30 : 18}px "Martian Mono", monospace`;
    g.fillText(l.sub, w / 2, big ? h * 0.74 : h * 0.8);
  }
  l.tex.needsUpdate = true;
  l.mat.emissiveIntensity = lit ? (l.state === 'test' ? 1.15 : 1.0) : 0.22;
  l.mat.color.setScalar(lit ? 0.12 : 1);
}

export async function createConsole(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; modelUrl: string }): Promise<ConsoleHandle> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new DirectionalLight('#fff7ee', 1.7); key.position.set(-2, 2.6, 3); scene.add(key);
  const rim = new DirectionalLight('#cfe6ff', 0.9); rim.position.set(2.6, 1.2, 0.8); scene.add(rim);
  scene.add(new HemisphereLight('#dde8e3', '#1b2220', 0.35));

  const camera = new PerspectiveCamera(SHOTS[0].fov, 1, 0.05, 40);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.5, 0.12, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  await document.fonts.load('600 40px "Jost Variable"').catch(() => undefined);
  await document.fonts.load('500 18px "Martian Mono"').catch(() => undefined);

  const gltf = await new GLTFLoader().loadAsync(opts.modelUrl);
  const root: Group = gltf.scene;
  scene.add(root);

  const lamps: Lamp[] = [];
  const guards: Object3D[] = [];
  const pickables: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const std = m.material as MeshStandardMaterial;
    if (std?.name === 'console_paint') { std.roughness = 0.58; }
    if (std?.name === 'chrome') { std.roughness = 0.42; std.envMapIntensity = 0.45; }
    const match = /^lens_(\d)_(\d)$/.exec(o.name) || (o.name === 'lens_master' ? ['', 'm', 'm'] : null);
    if (match) {
      const isMaster = match[1] === 'm';
      const def = isMaster ? null : FIELDS[+match[1] * 6 + +match[2]];
      const cv = document.createElement('canvas');
      cv.width = isMaster ? 512 : 384; cv.height = isMaster ? 512 : 288;
      const tex = new CanvasTexture(cv);
      tex.colorSpace = SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;
      const mat = new MeshPhysicalMaterial({ map: tex, emissiveMap: tex, emissive: new Color('#ffffff'), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
      m.material = mat;
      const lamp: Lamp = { mesh: m, mat, canvas: cv, tex, def, label: isMaster ? 'AGI' : def!.label, sub: isMaster ? 'ONE AGENT · NO BABYSITTER' : '', state: 'off', hover: false };
      paintLens(lamp);
      lamps.push(lamp);
      pickables.push(m);
    }
  });
  for (let i = 0; i < GUARDS.length; i++) {
    const g = root.getObjectByName(`guard_${i}`);
    if (g) guards.push(g);
  }
  // engraved legends live as decal planes so the GLB carries no text geometry
  const decal = (w: number, h: number, x: number, y: number, z: number, px: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) => {
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = Math.round(px * (h / w));
    const g = cv.getContext('2d')!;
    g.fillStyle = '#ECE8DA'; g.textBaseline = 'middle';
    draw(g, cv.width, cv.height);
    const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4;
    const mesh = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, depthWrite: false }));
    mesh.position.set(x, y, z);
    root.add(mesh);
  };
  const setFont = (g: CanvasRenderingContext2D, f: string, spacing = '0px') => { g.font = f; if (g.letterSpacing !== undefined) g.letterSpacing = spacing; };
  decal(1.9, 0.09, 0, 0.53, 0.0549, 2048, (g, W, H) => {
    setFont(g, `600 ${H * 0.52}px "Jost Variable"`, '2px'); g.textAlign = 'left'; g.fillText('AGI READINESS', 20, H / 2);
    setFont(g, `500 ${H * 0.26}px "Martian Mono"`, '3px'); g.textAlign = 'right'; g.fillText('CONSOLE 27  ·  REV 26 SEP 2026', W - 20, H / 2);
  });
  decal(0.44, 0.18, 0.72, -0.31, 0.0567, 880, (g, W, H) => {
    g.textAlign = 'center';
    setFont(g, `600 ${H * 0.2}px "Jost Variable"`, '3px'); g.fillText('NOT REQUIRED', W / 2, H * 0.38);
    setFont(g, `500 ${H * 0.095}px "Martian Mono"`, '2px'); g.fillStyle = 'rgba(236,232,218,.72)'; g.fillText('THAT’S ASI TERRITORY', W / 2, H * 0.68);
  });
  [-0.707, -0.235, 0.237].forEach((x, i) => decal(0.3, 0.04, x, -0.445, 0.0557, 900, (g, W, H) => {
    g.textAlign = 'center'; setFont(g, `500 ${H * 0.42}px "Martian Mono"`, '3px'); g.fillText(GUARDS[i], W / 2, H / 2);
  }));

  const target = new Vector3(...SHOTS[0].look);
  const curPos = new Vector3(0, 0, 4);
  const curLook = target.clone();
  let curFov = SHOTS[0].fov;
  let primed = false;
  let progress = 0;
  let guardOpen = 0;
  let dirty = true;
  let running = true;
  let visible = true;

  const size = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const ro = new ResizeObserver(size); ro.observe(canvas); size();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) dirty = true; });
  io.observe(canvas);

  const shotPos = (s: Shot) => {
    const t = Math.tan(MathUtils.degToRad(s.fov / 2));
    const d = Math.max(s.fitH / 2 / t, s.fitW / 2 / (t * camera.aspect));
    return new Vector3(...s.dir).normalize().multiplyScalar(d).add(new Vector3(...s.look));
  };
  const shotAt = (p: number) => {
    const seg = Math.min(SHOTS.length - 2, Math.floor(p));
    const t = MathUtils.smootherstep(p - seg, 0, 1);
    const a = SHOTS[seg], b = SHOTS[seg + 1];
    const pos = shotPos(a).lerp(shotPos(b), t);
    const look = new Vector3(...a.look).lerp(new Vector3(...b.look), t);
    return { pos, look, fov: MathUtils.lerp(a.fov, b.fov, t) };
  };

  let pointer: Vector2 | null = null;
  const ray = new Raycaster();
  let hoverCb: ((def: FieldDef | null, x: number, y: number) => void) | null = null;
  let hovered: Lamp | null = null;
  const onPoint = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    const lamp = hit ? lamps.find((l) => l.mesh === hit.object) ?? null : null;
    if (lamp !== hovered) {
      if (hovered) { hovered.hover = false; paintLens(hovered); }
      hovered = lamp;
      if (lamp) { lamp.hover = true; paintLens(lamp); }
      canvas.style.cursor = lamp ? 'help' : '';
      dirty = true;
    }
    hoverCb?.(lamp ? (lamp.def ?? MASTER_DEF) : null, e.clientX - r.left, e.clientY - r.top);
  };
  canvas.addEventListener('pointermove', onPoint);
  canvas.addEventListener('pointerdown', onPoint);
  canvas.addEventListener('pointerleave', () => {
    if (hovered) { hovered.hover = false; paintLens(hovered); hovered = null; dirty = true; }
    hoverCb?.(null, 0, 0);
  });

  let last = performance.now();
  const tick = (now: number) => {
    if (!running) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const s = shotAt(progress);
    if (!primed) { curPos.copy(s.pos); curLook.copy(s.look); curFov = s.fov; primed = true; dirty = true; }
    const k = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 5.5);
    const before = curPos.clone();
    curPos.lerp(s.pos, k); curLook.lerp(s.look, k); curFov = MathUtils.lerp(curFov, s.fov, k);
    const gTarget = MathUtils.clamp((progress - 1.35) / 0.5, 0, 1);
    const gPrev = guardOpen;
    guardOpen = opts.reducedMotion ? gTarget : MathUtils.lerp(guardOpen, gTarget, 1 - Math.exp(-dt * 4));
    guards.forEach((g, i) => {
      const local = MathUtils.clamp(guardOpen * 1.6 - i * 0.3, 0, 1);
      g.rotation.x = -MathUtils.degToRad(104) * MathUtils.smootherstep(local, 0, 1);
    });
    if (before.distanceToSquared(curPos) > 1e-9 || Math.abs(gPrev - guardOpen) > 1e-5) dirty = true;
    if (!dirty || !visible) return;
    camera.position.copy(curPos); camera.fov = curFov; camera.updateProjectionMatrix(); camera.lookAt(curLook);
    composer.render();
    dirty = false;
  };
  requestAnimationFrame(tick);

  const setState = (l: Lamp, st: LampState) => { l.state = st; paintLens(l); dirty = true; };
  const finalState = (l: Lamp): LampState => (l.def ? l.def.state : MASTER_DEF.state);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return {
    setProgress(p) { progress = MathUtils.clamp(p, 0, SHOTS.length - 1); dirty = true; },
    setAllStates() { lamps.forEach((l) => setState(l, finalState(l))); },
    async lampTest() {
      if (opts.reducedMotion) { lamps.forEach((l) => setState(l, finalState(l))); return; }
      lamps.forEach((l) => setState(l, 'off'));
      await wait(250);
      lamps.forEach((l) => setState(l, 'test'));
      await wait(650);
      lamps.forEach((l) => setState(l, 'off'));
      await wait(350);
      const order = [...lamps].sort((a, b) => (a.def ? a.def.order : 99) - (b.def ? b.def.order : 99));
      for (const l of order) { setState(l, finalState(l)); await wait(l.def ? 95 : 420); }
    },
    onHover(cb) { hoverCb = cb; },
    dispose() { running = false; ro.disconnect(); io.disconnect(); renderer.dispose(); pmrem.dispose(); },
  };
}

export const MASTER_DEF: FieldDef = {
  id: 'agi', label: 'AGI', group: 'stem', state: 'off', order: 99,
  note: 'Lights only when every field is green with no human steering. Not lit as of September 2026.',
};
