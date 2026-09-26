import {
  BufferAttribute, BufferGeometry, Color, Group, Mesh, NormalBlending, PerspectiveCamera, Points,
  Scene, ShaderMaterial, Vector3, WebGLRenderer, MathUtils,
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
}

const vert = /* glsl */`
  attribute vec3 aA;
  attribute vec3 aB;
  attribute vec4 aR;
  uniform float uMix, uTime, uSize, uScatter, uPR, uPush;
  uniform vec3 uMouse;
  varying float vAlpha;
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
    p += 0.012 * vec3(sin(uTime * 1.3 + aR.z * 20.0), cos(uTime * 1.1 + aR.z * 17.0), sin(uTime * 0.9 + aR.z * 13.0));
    float sweep = clamp((aA.x + 1.0) * 0.5 * 0.7 + h * 0.3, 0.0, 1.0);
    float s = smoothstep(sweep * 0.6, sweep * 0.6 + 0.4, uScatter);
    vec3 dir = normalize(vec3(0.9 + aR.w, 0.45 + aR.z, aR.x - 0.5));
    p += dir * s * (0.5 + aR.z * 2.4);
    p.x += sin(uTime * 0.8 + aR.z * 40.0) * 0.12 * s;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec2 d = world.xy - uMouse.xy;
    float dist = length(d);
    world.xy += normalize(d + 1e-4) * uPush * smoothstep(0.6, 0.0, dist) * 0.26 * (1.0 - s);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + aR.x * 0.9) * uPR / -mv.z;
    float depth = clamp((-mv.z - 3.2) / 3.0, 0.0, 1.0);
    vAlpha = (1.0 - s * s * 0.95) * mix(1.0, 0.5, depth) * (0.72 + 0.28 * aR.x);
  }`;

const frag = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.22, r) * vAlpha * uOpacity);
  }`;

export interface AgentHandle {
  set(s: Partial<AgentState>): void;
  setActive(on: boolean): void;
  intro(): void;
  dispose(): void;
}

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
  const tmp = new Vector3();
  gltf.scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    let g = m.geometry as BufferGeometry;
    if (g.index) g = g.toNonIndexed();
    const mesh = new Mesh(g);
    const sampler = new MeshSurfaceSampler(mesh).build();
    const pts: [number, number, number][] = [];
    for (let i = 0; i < N; i++) { sampler.sample(tmp); pts.push([tmp.x, tmp.y, tmp.z]); }
    // sort top-to-bottom so morphs travel coherently instead of scrambling
    pts.sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
    const arr = new Float32Array(N * 3);
    pts.forEach((p, i) => arr.set(p, i * 3));
    shapes.set(m.name, arr);
  });

  const geo = new BufferGeometry();
  const aA = new BufferAttribute(new Float32Array(shapes.get('agent')!), 3);
  const aB = new BufferAttribute(new Float32Array(shapes.get('agent')!), 3);
  const rnd = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) rnd[i] = Math.random();
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
    },
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  const group = new Group();
  group.add(points);
  scene.add(group);

  const target: AgentState = { from: 'agent', to: 'agent', mix: 0, scatter: 0, x: 0.28, y: 0.02, scale: 1, dim: 1 };
  const cur = { mix: 0, scatter: opts.reducedMotion ? 0 : 1, x: target.x, y: target.y, scale: 1, dim: 1 };
  let pair = 'agent>agent';
  let active = true;
  let halfW = 1, halfH = 1;

  const size = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * camera.aspect;
  };
  addEventListener('resize', size);
  size();

  const mouse = new Vector3(99, 99, 0);
  let pushTarget = 0;
  addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1, 0);
    mouse.x *= halfW; mouse.y *= halfH;
    pushTarget = e.pointerType === 'mouse' ? 1 : 0;
  }, { passive: true });

  let last = performance.now();
  let time = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!active) return;
    time += opts.reducedMotion ? 0 : dt;
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
    const u = mat.uniforms;
    u.uMix.value = cur.mix; u.uScatter.value = cur.scatter; u.uTime.value = time; u.uOpacity.value = cur.dim;
    u.uPush.value += (pushTarget - u.uPush.value) * k;
    (u.uMouse.value as Vector3).copy(mouse);
    const fit = Math.min(halfW, halfH) * 0.62 * cur.scale;
    group.scale.setScalar(fit);
    group.position.set(cur.x * halfW, cur.y * halfH, 0);
    group.rotation.y = opts.reducedMotion ? -0.35 : Math.sin(time * 0.22) * 0.55 + (mouse.x / Math.max(halfW, 1)) * 0.12 * (pushTarget);
    group.rotation.x = opts.reducedMotion ? 0.12 : 0.12 + Math.sin(time * 0.17) * 0.08;
    u.uSize.value = 13 * Math.max(0.85, Math.min(1.25, innerWidth / 1440 + 0.35));
    renderer.render(scene, camera);
  };
  let raf = requestAnimationFrame(loop);

  return {
    set(s) { Object.assign(target, s); },
    setActive(on) { active = on; if (on) last = performance.now(); },
    intro() { cur.scatter = opts.reducedMotion ? 0 : 1; target.scatter = 0; },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); geo.dispose(); mat.dispose(); },
  };
}
