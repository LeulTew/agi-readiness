"""
AGI readiness console — Blender 5.x headless build.

  blender -b --factory-startup --python build_console.py -- <out_dir> [--render] [--samples N]

Writes <out_dir>/console.glb (web asset, no legends; legends are live canvas
textures on the web) and optionally renders poster stills with engraved
legends for the no-WebGL fallback and the social card.
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else "out")
RENDER = "--render" in argv
SAMPLES = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 96
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

FIELDS = [
    ["SOFTWARE", "ARCHITECTURE", "SCHEMATICS", "BIOENGINEERING", "CHEMISTRY", "MATHEMATICS"],
    ["PHILOSOPHY", "PHOTOGRAPHY", "WRITING", "DIRECTING", "EDITING", "VIDEOGRAPHY"],
]
GUARDS = ["CURE CANCER", "END WORLD HUNGER", "TOP 0.1% AT EVERYTHING"]
STATE_FILE = os.path.join(HERE, "states.json")
STATES = json.load(open(STATE_FILE)) if os.path.exists(STATE_FILE) else {}

# ---------------------------------------------------------------- helpers
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


def material(name, color, metallic=0.0, roughness=0.5, coat=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = srgb(color)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
    if emit:
        p.inputs["Emission Color"].default_value = srgb(emit)
        p.inputs["Emission Strength"].default_value = strength
    return m


def box(name, size, loc, mat, bevel=0.0, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = segs
        b.limit_method = "ANGLE"
        b.harden_normals = True
    shade(o)
    return o


def shade(o):
    try:
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
    except Exception:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass


def cyl(name, r, depth, loc, mat, verts=32, rot=(math.radians(90), 0, 0), r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    shade(o)
    return o


def plane(name, w, h, loc, mat):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.scale = (w, h, 1)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(mat)
    return o


# ---------------------------------------------------------------- materials
M = {
    "paint": material("console_paint", "#56645F", 0.15, 0.62),
    "inset": material("console_inset", "#26302D", 0.1, 0.7),
    "bezel": material("lamp_bezel", "#0E1110", 0.2, 0.38),
    "lens": material("lamp_lens", "#1A1C19", 0.0, 0.18, coat=1.0),
    "chrome": material("chrome", "#D9DCDA", 1.0, 0.18),
    "guard": material("guard_red", "#B4231B", 0.0, 0.32, coat=0.6),
    "engrave": material("engrave_ivory", "#ECE8DA", 0.0, 0.45),
    "plate": material("placard_black", "#15191A", 0.3, 0.5),
}

# ---------------------------------------------------------------- housing
PW, PH, PD = 2.1, 1.28, 0.09
box("panel", (PW, PD, PH), (0, 0, 0), M["paint"], bevel=0.03)
FRONT = -PD / 2
box("inset_matrix", (1.48, 0.012, 0.47), (-0.235, FRONT - 0.004, 0.2), M["inset"], bevel=0.008)
box("inset_master", (0.46, 0.012, 0.47), (0.72, FRONT - 0.004, 0.2), M["inset"], bevel=0.008)
box("inset_guards", (1.48, 0.012, 0.36), (-0.235, FRONT - 0.004, -0.33), M["inset"], bevel=0.008)
box("nameplate", (1.94, 0.01, 0.1), (0, FRONT - 0.004, 0.53), M["plate"], bevel=0.006)

for i, (x, z) in enumerate([(-1, 1), (1, 1), (-1, -1), (1, -1)]):
    sx, sz = x * (PW / 2 - 0.055), z * (PH / 2 - 0.055)
    cyl(f"screw_{i}", 0.018, 0.012, (sx, FRONT - 0.006, sz), M["chrome"], verts=24)
    box(f"screw_slot_{i}", (0.026, 0.004, 0.004), (sx, FRONT - 0.0125, sz), M["bezel"])

# ---------------------------------------------------------------- lamp matrix
LW, LH, LD = 0.2, 0.15, 0.05
pitch_x, pitch_z = 0.236, 0.2
x0 = -0.235 - pitch_x * 2.5
z_rows = [0.3, 0.1]
lenses = {}
for r, row in enumerate(FIELDS):
    for c, label in enumerate(row):
        x, z = x0 + c * pitch_x, z_rows[r]
        box(f"lamp_body_{r}_{c}", (LW, LD, LH), (x, FRONT - LD / 2 - 0.004, z), M["bezel"], bevel=0.008)
        lenses[(r, c)] = plane(f"lens_{r}_{c}", LW - 0.024, LH - 0.024, (x, FRONT - LD - 0.0052, z), M["lens"])

# master annunciator
box("lamp_body_master", (0.38, 0.06, 0.38), (0.72, FRONT - 0.034, 0.2), M["bezel"], bevel=0.01)
master = plane("lens_master", 0.34, 0.34, (0.72, FRONT - 0.0652, 0.2), M["lens"])

# ---------------------------------------------------------------- guarded switches
gx = [x0 + pitch_x * 0.5, -0.235, -0.235 + pitch_x * 2]
for i, x in enumerate(gx):
    z = -0.31
    box(f"switch_base_{i}", (0.2, 0.012, 0.2), (x, FRONT - 0.01, z), M["chrome"], bevel=0.006)
    cyl(f"switch_nut_{i}", 0.03, 0.02, (x, FRONT - 0.026, z), M["chrome"], verts=6)
    bat = cyl(f"bat_{i}", 0.011, 0.068, (x, FRONT - 0.058, z + 0.008), M["chrome"], verts=20, r2=0.007,
              rot=(math.radians(90 - 18), 0, 0))
    # guard: open-backed shell, hinged on its top-back edge
    gw, gd, gh = 0.12, 0.085, 0.19
    hinge = Vector((x, FRONT - 0.016, z + gh / 2))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    g = bpy.context.active_object
    g.name = f"guard_{i}"
    g.scale = (gw, gd, gh)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(g.data)
    back = [f for f in bm.faces if f.normal.y > 0.9]
    bmesh.ops.delete(bm, geom=back, context="FACES")
    for v in bm.verts:
        v.co += Vector((0, -gd / 2, -gh / 2))  # origin -> hinge line (top-back)
    bm.to_mesh(g.data)
    bm.free()
    g.location = hinge
    g.data.materials.append(M["guard"])
    bv = g.modifiers.new("Bevel", "BEVEL")
    bv.width = 0.028
    bv.segments = 6
    bv.limit_method = "ANGLE"
    so = g.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = 0.007
    so.offset = -1
    shade(g)
    cyl(f"hinge_{i}", 0.01, gw + 0.03, (x, FRONT - 0.016, z + gh / 2), M["chrome"], verts=16, rot=(0, math.radians(90), 0))

box("placard", (0.46, 0.01, 0.2), (0.72, FRONT - 0.006, -0.31), M["plate"], bevel=0.005)

# ---------------------------------------------------------------- export web asset
bpy.ops.object.select_all(action="SELECT")
glb = os.path.join(OUT, "console.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
                          export_yup=True, export_materials="EXPORT")
print("EXPORTED", glb, os.path.getsize(glb))

if not RENDER:
    sys.exit(0)

# ---------------------------------------------------------------- poster render (legends engraved)
FONT = bpy.data.fonts.load(os.path.join(HERE, "Jost-600.woff"))
MONO = bpy.data.fonts.load(os.path.join(HERE, "Martian-500.woff"))
COL = {"go": "#7DFFB0", "amber": "#FFB23F", "off": None}


def text(name, body, loc, size, mat, font=FONT, align="CENTER", extrude=0.0006):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = font
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.extrude = extrude
    o = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (math.radians(90), 0, 0)
    o.data.materials.append(mat)
    return o


ink_dim = material("ink_dim", "#8E8A7C", 0.0, 0.6)
ink_dark = material("ink_dark", "#1A1A16", 0.0, 0.6)
for (r, c), lens in lenses.items():
    st = STATES.get(FIELDS[r][c], "amber")
    if COL[st]:
        lit = material(f"lit_{r}_{c}", COL[st], 0, 0.25, emit={"go": "#3DFF8A", "amber": "#FF8C10"}[st], strength=0.55)
        lens.data.materials[0] = lit
        ink = ink_dark
    else:
        ink = ink_dim
    y = FRONT - LD - 0.0062
    lbl = FIELDS[r][c]
    size = 0.024 if len(lbl) <= 11 else 0.019
    text(f"leg_{r}_{c}", lbl, (x0 + c * pitch_x, y, z_rows[r]), size, ink)

mst = STATES.get("MASTER", "off")
if COL[mst]:
    master.data.materials[0] = material("lit_master", COL[mst], 0, 0.25, emit=COL[mst], strength=4)
text("leg_master", "AGI", (0.72, FRONT - 0.0662, 0.25), 0.11, ink_dark if COL[mst] else ink_dim)
text("leg_master2", "ONE AGENT · NO BABYSITTER", (0.72, FRONT - 0.0662, 0.12), 0.019, ink_dark if COL[mst] else ink_dim, font=MONO)
text("nameplate_t", "AGI READINESS", (-0.93, FRONT - 0.0098, 0.53), 0.05, M["engrave"], align="LEFT")
text("nameplate_t2", "CONSOLE 27  ·  REV 26 SEP 2026", (0.93, FRONT - 0.0098, 0.53), 0.026, M["engrave"], font=MONO, align="RIGHT")
for i, lbl in enumerate(GUARDS):
    text(f"guard_leg_{i}", lbl, (gx[i], FRONT - 0.0098, -0.44), 0.02 if len(lbl) < 16 else 0.016, M["engrave"], font=MONO)
text("placard_t", "NOT REQUIRED", (0.72, FRONT - 0.0118, -0.29), 0.032, M["engrave"])
text("placard_t2", "THAT'S ASI TERRITORY", (0.72, FRONT - 0.0118, -0.35), 0.017, M["engrave"], font=MONO)

# desk & room
box("desk", (3.6, 1.6, 0.06), (0, -0.7, -0.67), material("desk", "#2B302E", 0.1, 0.7))
wall = plane("backwall", 8, 5, (0, 1.0, 0.5), material("wall", "#101614", 0, 0.9))

w = bpy.data.worlds.new("W")
scene.world = w
try:
    w.use_nodes = True
except Exception:
    pass
w.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("#0B100F")
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35


def area(name, loc, target, energy, size, color="#FFFFFF"):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.color = srgb(color)[:3]
    o = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


area("key", (-1.8, -2.4, 2.2), (0, 0, 0), 260, 2.2, "#FFF1DE")
area("rim", (2.4, -0.6, 1.6), (0, 0, 0), 120, 1.0, "#BFE3FF")
area("fill", (0.5, -3, -0.6), (0, 0, 0), 40, 3.0, "#DDE8E3")

cam_d = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
cam_d.lens = 50
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 5.6

scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for t in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
        try:
            prefs.compute_device_type = t
            prefs.get_devices()
            if any(d.type == t for d in prefs.devices):
                for d in prefs.devices:
                    d.use = True
                scene.cycles.device = "GPU"
                print("GPU", t)
                break
        except Exception:
            continue
except Exception as e:
    print("GPU setup failed", e)
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = -0.35


def shot(name, loc, target, res, focus):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam_d.dof.focus_distance = (Vector(focus) - Vector(loc)).length
    scene.render.resolution_x, scene.render.resolution_y = res
    jpg = name.endswith(".jpg")
    scene.render.image_settings.file_format = "JPEG" if jpg else "PNG"
    if jpg:
        scene.render.image_settings.quality = 86
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name)


shot("poster.jpg", (-1.25, -3.1, 0.55), (0.05, 0, 0.02), (1600, 1000), (-0.3, -0.1, 0.2))
shot("og.jpg", (-0.9, -3.4, 0.35), (0.0, 0, 0.05), (1200, 630), (-0.2, -0.1, 0.15))

