"""
Field specimens for the particle agent. Blender 5.x headless:

  blender -b --factory-startup --python build_fields.py -- <out_dir> [--render] [--samples N]

Exports <out_dir>/fields.glb: one mesh per field (plus the neutral "agent"),
each centred and scaled to a unit bounding sphere. The web samples particles
from these surfaces. --render also renders a clay "specimen plate" still.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else "out")
RENDER = "--render" in argv
SAMPLES = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 128
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = bpy.data.collections.new("fields")
scene.collection.children.link(col)
CLAY = bpy.data.materials.new("clay")


def link(o):
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    return o


def active():
    return bpy.context.active_object


def apply_all(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    if o.type != "MESH":
        bpy.ops.object.convert(target="MESH")
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return bpy.context.active_object


def join(objs, name):
    objs = [apply_all(o) for o in objs]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    return o


def normalize(o):
    """centre on bounding box and scale to radius 1"""
    me = o.data
    vs = [v.co for v in me.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    c = (mn + mx) / 2
    r = max((v - c).length for v in vs)
    me.transform(Matrix.Translation(-c))
    me.transform(Matrix.Scale(1 / r, 4))
    me.update()
    o.location = (0, 0, 0)
    o.data.materials.clear()
    o.data.materials.append(CLAY)
    link(o)
    return o


def cube(size, loc, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = active()
    o.scale = size
    if bevel:
        b = o.modifiers.new("b", "BEVEL"); b.width = bevel; b.segments = 3
    return o


def cyl(r, d, loc, rot=(0, 0, 0), verts=48, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d, location=loc, rotation=rot)
    return active()


def glyph(txt, size=1.0, extrude=0.18, bevel=0.03):
    cu = bpy.data.curves.new("t", "FONT")
    cu.body = txt
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = 2
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    o = bpy.data.objects.new("t", cu)
    scene.collection.objects.link(o)
    o.rotation_euler = (math.radians(90), 0, 0)
    return o


def spin_profile(profile, steps=64):
    """lathe a list of (r, z) around Z"""
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in profile]
    for a, b in zip(vs, vs[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    me = bpy.data.meshes.new("lathe")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("lathe", me)
    scene.collection.objects.link(o)
    return o


def tube_curve(points, radius, cyclic=False, res=12):
    cu = bpy.data.curves.new("c", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new("c", cu)
    scene.collection.objects.link(o)
    return o


made = []

# ---------------------------------------------------------------- agent: a sphere with an inner core
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1)
a = active()
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=0.42)
made.append(normalize(join([a, active()], "agent")))

# ---------------------------------------------------------------- software: </>
code_strokes = [
    [(-0.45, 0, 0.52), (-1.0, 0, 0), (-0.45, 0, -0.52)],
    [(0.45, 0, 0.52), (1.0, 0, 0), (0.45, 0, -0.52)],
    [(-0.2, 0, -0.68), (0.2, 0, 0.68)],
]
made.append(normalize(join([tube_curve(points, 0.075) for points in code_strokes], "software")))

# ---------------------------------------------------------------- architecture: temple front
parts = [cube((2.4, 1.0, 0.12), (0, 0, -0.9)), cube((2.2, 0.9, 0.12), (0, 0, -0.78)), cube((2.0, 0.8, 0.12), (0, 0, -0.66))]
for i in range(6):
    x = -0.85 + i * 0.34
    parts.append(cyl(0.085, 1.2, (x, -0.2, 0.0)))
    parts.append(cyl(0.085, 1.2, (x, 0.2, 0.0)))
    parts.append(cube((0.22, 0.22, 0.06), (x, -0.2, 0.63)))
parts.append(cube((2.0, 0.8, 0.2), (0, 0, 0.76)))
bm = bmesh.new()
tri = [bm.verts.new(v) for v in [(-1.05, -0.42, 0.86), (1.05, -0.42, 0.86), (0, -0.42, 1.35), (-1.05, 0.42, 0.86), (1.05, 0.42, 0.86), (0, 0.42, 1.35)]]
bm.faces.new((tri[0], tri[1], tri[2])); bm.faces.new((tri[5], tri[4], tri[3]))
bm.faces.new((tri[0], tri[3], tri[4], tri[1])); bm.faces.new((tri[1], tri[4], tri[5], tri[2])); bm.faces.new((tri[2], tri[5], tri[3], tri[0]))
me = bpy.data.meshes.new("ped"); bm.to_mesh(me); bm.free()
ped = bpy.data.objects.new("ped", me); scene.collection.objects.link(ped)
parts.append(ped)
made.append(normalize(join(parts, "architecture")))


# ---------------------------------------------------------------- schematics: two meshing gears
def gear(teeth, r, loc, phase=0.0, thick=0.28):
    # A continuous toothed ring keeps clean valleys and a visible axle hole.
    n = teeth * 4
    vertices, faces = [], []
    for depth in (-thick / 2, thick / 2):
        for inner in (False, True):
            for k in range(n):
                ang = phase + k * math.tau / n
                radius = r * (0.27 if inner else (1.08 if k % 4 in (1, 2) else 0.87))
                vertices.append((loc[0] + math.cos(ang) * radius, loc[1] + depth, loc[2] + math.sin(ang) * radius))
    for k in range(n):
        j = (k + 1) % n
        faces.extend([(k, j, n + j, n + k), (2*n + k, 3*n + k, 3*n + j, 2*n + j),
                      (k, 2*n + k, 2*n + j, j), (n + k, n + j, 3*n + j, 3*n + k)])
    me = bpy.data.meshes.new("gear")
    me.from_pydata(vertices, [], faces); me.update()
    o = bpy.data.objects.new("gear", me); scene.collection.objects.link(o)
    return [o]


made.append(normalize(join(gear(14, 0.8, (-0.45, 0, 0.15)) + gear(8, 0.44, (0.75, 0, -0.3), phase=0.22), "schematics")))

# ---------------------------------------------------------------- bioengineering: DNA double helix
parts = []
turns, n = 2.2, 44
for i in range(n):
    t = i / (n - 1)
    ang = t * turns * math.tau
    z = -1.6 + t * 3.2
    p1 = Vector((math.cos(ang) * 0.62, math.sin(ang) * 0.62, z))
    p2 = Vector((math.cos(ang + math.pi) * 0.62, math.sin(ang + math.pi) * 0.62, z))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.1, location=p1); parts.append(active())
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.1, location=p2); parts.append(active())
    if i % 2 == 0:
        mid = (p1 + p2) / 2
        d = (p2 - p1)
        o = cyl(0.035, d.length, mid, verts=10)
        o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        parts.append(o)
strand = lambda off: [(math.cos(t * turns * math.tau + off) * 0.62, math.sin(t * turns * math.tau + off) * 0.62, -1.6 + t * 3.2) for t in [k / 160 for k in range(161)]]
parts.append(tube_curve(strand(0), 0.05)); parts.append(tube_curve(strand(math.pi), 0.05))
made.append(normalize(join(parts, "bio")))

# ---------------------------------------------------------------- chemistry: Erlenmeyer flask + liquid line
prof = [(0.0, -1.0), (0.95, -1.0), (1.0, -0.94), (0.28, 0.55), (0.26, 1.05), (0.33, 1.12)]
flask = spin_profile(prof)
liquid = spin_profile([(0.0, -0.55), (0.78, -0.55)])
made.append(normalize(join([flask, liquid], "chemistry")))

# ---------------------------------------------------------------- mathematics: trefoil, viewed across its three lobes
pts = []
for k in range(420):
    t = k / 420 * math.tau
    p, q = 2, 3
    rr = 0.64 + 0.36 * math.cos(q * t)
    pts.append((rr * math.cos(p * t), rr * math.sin(p * t), 0.43 * math.sin(q * t)))
knot = join([tube_curve(pts, 0.09, cyclic=True)], "math")
knot.rotation_euler.x = math.radians(90)
made.append(normalize(join([knot], "math")))

# ---------------------------------------------------------------- philosophy: question mark
hook = []
for k in range(65):
    a = math.radians(165 - k / 64 * 245)
    hook.append((0.48 * math.cos(a), 0, 0.52 + 0.48 * math.sin(a)))
hook.extend([(0.04, 0, -0.12), (0.04, 0, -0.36)])
stem = tube_curve(hook, 0.095)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.12, location=(0.04, 0, -0.68))
made.append(normalize(join([stem, active()], "philosophy")))

# ---------------------------------------------------------------- photography: camera
parts = [cube((1.9, 0.62, 1.12), (0, 0, 0), bevel=0.08), cube((0.62, 0.5, 0.34), (-0.1, 0, 0.7), bevel=0.05),
         cyl(0.46, 0.34, (0, -0.48, -0.02), rot=(math.radians(90), 0, 0), verts=64),
         cyl(0.4, 0.3, (0, -0.78, -0.02), rot=(math.radians(90), 0, 0), verts=64),
         cyl(0.3, 0.06, (0, -0.95, -0.02), rot=(math.radians(90), 0, 0), verts=64),
         cyl(0.1, 0.12, (0.68, 0, 0.6), verts=32), cube((0.3, 0.1, 0.18), (0.62, -0.32, 0.32))]
made.append(normalize(join(parts, "photography")))

# ---------------------------------------------------------------- writing: fountain pen
parts = [cyl(0.16, 2.0, (0, 0, 0.2), verts=48), cyl(0.17, 0.9, (0, 0, 0.95), verts=48),
         cyl(0.16, 0.5, (0, 0, -1.05), verts=48, r2=0.07),
         cube((0.03, 0.2, 0.9), (0.2, 0, 1.0))]
bm = bmesh.new()
nib = [bm.verts.new(v) for v in [(-0.12, 0, -1.3), (0.12, 0, -1.3), (0, 0, -1.78), (-0.1, 0.05, -1.3), (0.1, 0.05, -1.3), (0, 0.02, -1.78)]]
bm.faces.new((nib[0], nib[1], nib[2])); bm.faces.new((nib[5], nib[4], nib[3]))
me = bpy.data.meshes.new("nib"); bm.to_mesh(me); bm.free()
o = bpy.data.objects.new("nib", me); scene.collection.objects.link(o); parts.append(o)
pen = join(parts, "writing")
pen.rotation_euler = (0, math.radians(38), 0)
made.append(normalize(join([pen], "writing")))

# ---------------------------------------------------------------- directing: clapperboard
parts = [cube((1.9, 0.12, 1.3), (0, 0, -0.25), bevel=0.02)]
for k in range(6):
    parts.append(cube((0.16, 0.14, 0.26), (-0.8 + k * 0.32, 0, 0.55), rot=(0, math.radians(-30), 0)))
parts.append(cube((1.9, 0.12, 0.28), (0, 0, 0.55), bevel=0.01))
stick = cube((1.95, 0.12, 0.28), (0, 0, 0), bevel=0.01)
stick.location = (0.1, 0, 1.05)
stick.rotation_euler = (0, math.radians(-16), 0)
parts.append(stick)
for k in range(3):
    parts.append(cube((1.5, 0.14, 0.03), (-0.05, 0, -0.05 - k * 0.3)))
made.append(normalize(join(parts, "directing")))

# ---------------------------------------------------------------- editing: film strip on an S-curve with sprocket holes
bm = bmesh.new()
L, W, seg = 3.6, 1.3, 120
def place(u, v):
    x = -L / 2 + u
    return (x, 0.18 * math.sin(u * 1.4), v + 0.32 * math.sin((u / L - 0.5) * math.tau))
hole_pitch = 0.36
for k in range(seg):
    u0, u1 = k * L / seg, (k + 1) * L / seg
    rows = [(-W / 2, -W / 2 + 0.1), (-W / 2 + 0.1, -W / 2 + 0.32), (-W / 2 + 0.32, W / 2 - 0.32), (W / 2 - 0.32, W / 2 - 0.1), (W / 2 - 0.1, W / 2)]
    for ri, (v0, v1) in enumerate(rows):
        um = (u0 + u1) / 2
        if ri in (1, 3) and (um % hole_pitch) < hole_pitch * 0.5:
            continue  # sprocket hole
        if ri == 2 and (um % 0.9) < 0.075:
            continue  # frame gap
        q = [bm.verts.new(place(u0, v0)), bm.verts.new(place(u1, v0)), bm.verts.new(place(u1, v1)), bm.verts.new(place(u0, v1))]
        bm.faces.new(q)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("film"); bm.to_mesh(me); bm.free()
film = bpy.data.objects.new("editing", me); scene.collection.objects.link(film)
sol = film.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.03
film.rotation_euler.y = math.radians(-12)
made.append(normalize(join([film], "editing")))

# ---------------------------------------------------------------- videography: film reel
reel = cyl(1.0, 0.16, (0, 0, 0), rot=(math.radians(90), 0, 0), verts=96)
for k in range(5):
    ang = k * math.tau / 5
    h = cyl(0.26, 0.5, (math.cos(ang) * 0.55, 0, math.sin(ang) * 0.55), rot=(math.radians(90), 0, 0), verts=40)
    bo = reel.modifiers.new(f"h{k}", "BOOLEAN"); bo.object = h; bo.operation = "DIFFERENCE"
    h.hide_render = True
reel = apply_all(reel)
for o in [o for o in scene.objects if o.hide_render]:
    bpy.data.objects.remove(o)
hub = cyl(0.14, 0.3, (0, 0, 0), rot=(math.radians(90), 0, 0))
rim = cyl(1.04, 0.2, (0, 0, 0), rot=(math.radians(90), 0, 0), verts=96)
bpy.ops.object.select_all(action="DESELECT")
rimo = apply_all(rim)
made.append(normalize(join([reel, hub], "video")))
bpy.data.objects.remove(rimo)

# drop stray helpers
for o in list(scene.objects):
    if o not in made:
        bpy.data.objects.remove(o)

bpy.ops.object.select_all(action="SELECT")
glb = os.path.join(OUT, "fields.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="NONE", export_normals=False, export_texcoords=False, export_meshopt_compression_enable=True)
for o in made:
    print("MESH", o.name, len(o.data.vertices), len(o.data.polygons))
print("EXPORTED", glb, os.path.getsize(glb))

if not RENDER:
    sys.exit(0)

# ---------------------------------------------------------------- specimen plate render (og image / fallback)
def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)

CLAY.use_nodes = True
p = CLAY.node_tree.nodes.get("Principled BSDF")
p.inputs["Base Color"].default_value = srgb("#F2F1EC")
p.inputs["Roughness"].default_value = 0.55
order = ["software", "architecture", "schematics", "bio", "chemistry", "math", "philosophy", "photography", "writing", "directing", "editing", "video"]
byname = {o.name: o for o in made}
for i, name in enumerate(order):
    o = byname[name]
    cx, cz = (i % 6) - 2.5, 0.75 - (i // 6) * 1.5
    o.location = (cx * 1.45, 0, cz * 1.45)
    o.rotation_euler = (math.radians(12), 0, math.radians(-24))
    o.scale = (0.56, 0.56, 0.56)
byname["agent"].hide_render = True

w = bpy.data.worlds.new("W"); scene.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("#2B37F5")
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 1.2, 0), rotation=(math.radians(90), 0, 0))
bg = active(); m = bpy.data.materials.new("bg"); m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("#2B37F5")
m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
bg.data.materials.append(m)

def area(loc, energy, size, color="#FFFFFF"):
    ld = bpy.data.lights.new("a", "AREA"); ld.energy = energy; ld.size = size; ld.color = srgb(color)[:3]
    o = bpy.data.objects.new("a", ld); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area((-4, -6, 5), 1600, 6, "#FFF4E8"); area((6, -3, -2), 500, 5, "#C9D3FF")

cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = 9.6
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
cam.location = (0, -12, 0); cam.rotation_euler = (math.radians(90), 0, 0)
scene.render.engine = "CYCLES"; scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    print("GPU fallback", e)
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x, scene.render.resolution_y = 1200, 630
scene.render.image_settings.file_format = "JPEG"; scene.render.image_settings.quality = 88
scene.render.filepath = os.path.join(OUT, "specimens.jpg")
bpy.ops.render.render(write_still=True)
print("RENDERED specimens.jpg")
