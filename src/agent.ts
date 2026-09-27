import {
  BufferAttribute, BufferGeometry, Color, Group, Mesh, NormalBlending, PerspectiveCamera, Points,
  Scene, ShaderMaterial, Vector3, WebGLRenderer, MathUtils, Euler,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface AgentState {
  from: string; to: string; mix: number; // morph pair
  scatter: number; // 0 = formed, 1 = blown to dust ("in a snap")
  x: number; y: number; // offset as fraction of half viewport (-1..1)
  scale: number; // 1 = fits ~42% of the short side
  dim: number; // 0..1 opacity multiplier
  color: string; // particle colour (hex); tweened
  heat: number; // 0..1 how strongly the centre of the shape glows hotter (HAL's pinpoint)
}

const vert = /* glsl */`
  attribute vec3 aA;
  attribute vec3 aB;
  attribute vec4 aR;
  uniform float uMix, uTime, uSize, uScatter, uPR, uPush;
  uniform vec3 uMouse;
  uniform float uHeat;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float h = aR.y;
    float t = clamp((uMix - h * 0.35) / 0.65, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(aA, aB, t);
    float sw = sin(3.14159 * t);
    p += sw * 0.34 * vec3(
      sin(aR.z * 6.283 + uTime * 0.7 + p.y * 2.1),
      cos(aR.z * 5.0 + uTime * 0.6 + p.x * 1.9),
      sin(aR.z * 4.0 + uTime * 0.5 + p.z * 2.3));
    p += 0.004 * vec3(sin(uTime * 1.3 + aR.z * 20.0), cos(uTime * 1.1 + aR.z * 17.0), sin(uTime * 0.9 + aR.z * 13.0));
    float sweep = clamp((aA.x + 1.0) * 0.5 * 0.7 + h * 0.3, 0.0, 1.0);
    float s = smoothstep(sweep * 0.6, sweep * 0.6 + 0.4, uScatter);
    float angle = aR.z * 6.283185;
    vec3 dust = vec3(cos(angle) * sqrt(aR.w) * 1.1,
                     sin(angle) * sqrt(aR.w) * 0.9,
                     (aR.x - 0.5) * 1.2);
    p = mix(p, dust, s);
    p.x += sin(uTime * 0.8 + aR.z * 40.0) * 0.08 * s;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec2 d = world.xy - uMouse.xy;
    float dist = length(d);
    world.xy += normalize(d + 1e-4) * uPush * smoothstep(0.6, 0.0, dist) * 0.26 * (1.0 - s);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + aR.x * 0.9) * uPR / -mv.z;
    float depth = clamp((-mv.z - 3.2) / 3.0, 0.0, 1.0);
    vAlpha = (1.0 - s * 0.22) * mix(1.0, 0.65, depth) * (0.72 + 0.28 * aR.x);
    vHeat = uHeat * smoothstep(0.26, 0.0, length(p.xy)) * (1.0 - s);
  }`;

const frag = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    gl_FragColor = vec4(mix(uColor, uHot, vHeat), smoothstep(0.5, 0.22, r) * vAlpha * uOpacity);
  }`;

export interface AgentHandle {
  set(s: Partial<AgentState>): void;
  setActive(on: boolean): void;
  intro(): void;
  dispose(): void;
}

// Ambient drift only runs while the reader is doing something, then eases to rest,
// so nothing moves on its own for more than a few seconds (WCAG 2.2.2).
const IDLE_MS = 2500;
const HOT = '#ffd9a0'; // HAL's pinpoint: the centre of the red eye burns towards white-gold

export async function createAgent(canvas: HTMLCanvasElement, opts: { url: string; reducedMotion: boolean; count: number }): Promise<AgentHandle> {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  const pr = Math.min(devicePixelRatio, 1.75);
  renderer.setPixelRatio(pr);
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(opts.url);
  const N = opts.count;
  const shapes = new Map<string, Float32Array>();
  const tmp = new Vector3(), normal = new Vector3();
  let seed = 41;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  gltf.scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    let g = m.geometry as BufferGeometry;
    if (g.index) g = g.toNonIndexed();
    const mesh = new Mesh(g);
    const sampler = Object.assign(new MeshSurfaceSampler(mesh), { randomFunction: random }).build();
    const yaw = ({ photography: -0.24, architecture: -0.18, software: 0, philosophy: 0, hal: 0 } as Record<string, number>)[m.name] ?? -0.1;
    const angle = new Euler(0.04, yaw, 0);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      // Bias towards the visible face, retaining enough side samples for depth.
      for (let attempt = 0; attempt < 4; attempt++) {
        sampler.sample(tmp, normal);
        if (normal.z > -0.15 || attempt === 3) break;
      }
      tmp.applyEuler(angle);
      pts.push([tmp.x, tmp.y, tmp.z]);
    }
    // sort top-to-bottom so morphs travel coherently instead of scrambling
    pts.sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
    const arr = new Float32Array(N * 3);
    pts.forEach((p, i) => arr.set(p, i * 3));
    shapes.set(m.name, arr);
    if (g !== m.geometry) g.dispose();
  });

  const geo = new BufferGeometry();
  const aA = new BufferAttribute(new Float32Array(shapes.get('agent')!), 3);
  const aB = new BufferAttribute(new Float32Array(shapes.get('agent')!), 3);
  const rnd = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) rnd[i] = random();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aA', aA);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aR', new BufferAttribute(rnd, 4));
  geo.boundingSphere = null;

  const mat = new ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: 11 }, uScatter: { value: 1 }, uPR: { value: pr },
      uPush: { value: 0 }, uMouse: { value: new Vector3(99, 99, 0) }, uColor: { value: new Color('#ffffff') }, uOpacity: { value: 1 },
      uHot: { value: new Color(HOT) }, uHeat: { value: 0 },
    },
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  const group = new Group();
  group.add(points);
  scene.add(group);

  const target: AgentState = { from: 'agent', to: 'agent', mix: 0, scatter: 0, x: 0.28, y: 0.02, scale: 1, dim: 1, color: '#ffffff', heat: 0 };
  const cur = { mix: 0, scatter: opts.reducedMotion ? 0 : 1, x: target.x, y: target.y, scale: 1, dim: 1, heat: 0 };
  const curColor = new Color(target.color), goalColor = new Color(target.color);
  let pair = 'agent>agent';
  let active = true;
  const moving = !opts.reducedMotion;
  let flow = moving ? 1 : 0;
  let lastInput = performance.now();
  let dirty = true;
  let halfW = 1, halfH = 1;

  const size = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * camera.aspect;
    dirty = true;
    schedule();
  };
  addEventListener('resize', size);

  const mouse = new Vector3(99, 99, 0);
  let pushTarget = 0;
  const poke = () => { lastInput = performance.now(); schedule(); };
  const onPointer = (e: PointerEvent) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1, 0);
    mouse.x *= halfW; mouse.y *= halfH;
    pushTarget = moving && e.pointerType === 'mouse' ? 1 : 0;
    dirty = true;
    poke();
  };
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('scroll', poke, { passive: true });
  addEventListener('keydown', poke);

  let last = performance.now();
  let time = 0;
  let raf = 0;
  const schedule = () => { if (!raf && active && !document.hidden) raf = requestAnimationFrame(loop); };
  const visibility = () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else { last = performance.now(); dirty = true; schedule(); }
  };
  document.addEventListener('visibilitychange', visibility);
  const loop = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!active) return;
    flow = moving ? 1 - MathUtils.smoothstep(now - lastInput, IDLE_MS - 500, IDLE_MS) : 0;
    time += dt * flow;
    const k = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    const key = `${target.from}>${target.to}`;
    if (key !== pair) {
      const a = shapes.get(target.from), b = shapes.get(target.to);
      if (a && b) { (aA.array as Float32Array).set(a); (aB.array as Float32Array).set(b); aA.needsUpdate = aB.needsUpdate = true; }
      pair = key;
      cur.mix = target.mix;
    }
    cur.mix += (target.mix - cur.mix) * k;
    cur.scatter += (target.scatter - cur.scatter) * (opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6));
    cur.x += (target.x - cur.x) * k * 0.8;
    cur.y += (target.y - cur.y) * k * 0.8;
    cur.scale += (target.scale - cur.scale) * k * 0.8;
    cur.dim += (target.dim - cur.dim) * k;
    // colour and heat ease a little slower than the shape, so a recolour reads as the glow warming up
    const kc = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);
    goalColor.set(target.color);
    curColor.lerp(goalColor, kc);
    cur.heat += (target.heat - cur.heat) * kc;
    const u = mat.uniforms;
    (u.uColor.value as Color).copy(curColor);
    u.uHeat.value = cur.heat;
    u.uMix.value = cur.mix; u.uScatter.value = cur.scatter; u.uTime.value = time; u.uOpacity.value = cur.dim;
    u.uPush.value += (pushTarget - u.uPush.value) * k;
    (u.uMouse.value as Vector3).copy(mouse);
    const fit = Math.min(halfW, halfH) * 0.62 * cur.scale;
    group.scale.setScalar(fit);
    group.position.set(cur.x * halfW, cur.y * halfH, 0);
    group.rotation.y = Math.sin(time * 0.22) * 0.075;
    group.rotation.x = Math.sin(time * 0.17) * 0.035;
    u.uSize.value = innerWidth < 820 ? 8.5 : 10.5;
    renderer.render(scene, camera);
    const colorGap = Math.abs(curColor.r - goalColor.r) + Math.abs(curColor.g - goalColor.g) + Math.abs(curColor.b - goalColor.b);
    const unsettled = (['mix', 'scatter', 'x', 'y', 'scale', 'dim', 'heat'] as const).some((key) => Math.abs(cur[key] - target[key]) > 0.001)
      || colorGap > 0.003
      || Math.abs(u.uPush.value - pushTarget) > 0.002;
    dirty = unsettled;
    if (flow > 0 || dirty) schedule();
  };
  size();

  return {
    set(s) { Object.assign(target, s); dirty = true; poke(); },
    setActive(on) {
      if (active === on) return;
      active = on;
      if (on) { last = performance.now(); dirty = true; poke(); }
      else { cancelAnimationFrame(raf); raf = 0; renderer.clear(); }
    },
    intro() { cur.scatter = opts.reducedMotion ? 0 : 1; target.scatter = 0; poke(); },
    dispose() {
      active = false; cancelAnimationFrame(raf);
      removeEventListener('resize', size); removeEventListener('pointermove', onPointer);
      removeEventListener('scroll', poke); removeEventListener('keydown', poke);
      document.removeEventListener('visibilitychange', visibility);
      gltf.scene.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose(); });
      renderer.dispose(); geo.dispose(); mat.dispose();
    },
  };
}
