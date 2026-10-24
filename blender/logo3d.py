"""Blender (headless): 3D extruded title or logo with studio light and a camera move,
rendered as a transparent PNG sequence to drop into a HyperFrames scene or an ffmpeg edit.

run (Windows):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P blender/logo3d.py -- \
      --text "PROJECT ALPHA" --out D:/Projects/<p>/assets/3d/title --frames 90 --fps 30 --res 1080x1080
  --svg logo.svg      extrude an SVG logo instead of text (flat colours, closed paths)
  --color #1f7bff     material colour     --metal 0.6 --rough 0.25
  --move orbit|push|spin   camera/object move (default orbit)
  --samples 32        EEVEE samples (more = smoother, slower)
then make an alpha video:
  ffmpeg -framerate 30 -i <out>/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 4M <out>.webm
"""
import argparse, math, os, sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--text", default="PROJECT ALPHA")
ap.add_argument("--svg", default=None)
ap.add_argument("--font", default=None, help="path to a .ttf/.otf (Arabic needs a font with Arabic glyphs)")
ap.add_argument("--out", required=True)
ap.add_argument("--frames", type=int, default=90)
ap.add_argument("--fps", type=int, default=30)
ap.add_argument("--res", default="1080x1080")
ap.add_argument("--color", default="#1f7bff")
ap.add_argument("--metal", type=float, default=0.6)
ap.add_argument("--rough", type=float, default=0.25)
ap.add_argument("--move", choices=["orbit", "push", "spin"], default="orbit")
ap.add_argument("--samples", type=int, default=32)
a = ap.parse_args(argv)

sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# --- subject -------------------------------------------------------------
if a.svg:
    bpy.ops.import_curve.svg(filepath=os.path.abspath(a.svg))
    curves = [o for o in sc.objects if o.type == "CURVE"]
    for c in curves:
        c.data.extrude = 0.0006
        c.data.bevel_depth = 0.00008
    bpy.ops.object.select_all(action="DESELECT")
    for c in curves:
        c.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.join()
    subj = bpy.context.view_layer.objects.active
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    subj.location = (0, 0, 0)
    s = 4.0 / max(subj.dimensions.x, subj.dimensions.y)
    subj.scale = (s, s, s)
    subj.rotation_euler = (math.radians(90), 0, 0)
else:
    bpy.ops.object.text_add()
    subj = bpy.context.object
    subj.data.body = a.text
    if a.font:
        subj.data.font = bpy.data.fonts.load(os.path.abspath(a.font))
    subj.data.align_x, subj.data.align_y = "CENTER", "CENTER"
    subj.data.extrude, subj.data.bevel_depth, subj.data.bevel_resolution = 0.12, 0.02, 3
    subj.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    subj.location = (0, 0, 0)
    s = 4.6 / max(subj.dimensions.x, 0.01)
    subj.scale = (s, s, s)

h = a.color.lstrip("#")
rgb = [(int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)]
mat = bpy.data.materials.new("brand")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (*rgb, 1)
bsdf.inputs["Metallic"].default_value = a.metal
bsdf.inputs["Roughness"].default_value = a.rough
subj.data.materials.clear()
subj.data.materials.append(mat)

# --- light: key, rim, fill + soft world ---------------------------------
def area(name, loc, energy, size, color=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    L = bpy.context.object
    L.name, L.data.energy, L.data.size, L.data.color = name, energy, size, color
    L.rotation_euler = (0, 0, 0)
    c = L.constraints.new("TRACK_TO")
    c.target, c.track_axis, c.up_axis = subj, "TRACK_NEGATIVE_Z", "UP_Y"

area("key", (-4, -5, 4), 900, 4)
area("rim", (5, 4, 3), 1200, 2, (0.6, 0.85, 1))
area("fill", (4, -6, -1), 250, 6)
world = bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4

# --- camera move ------------------------------------------------------------
bpy.ops.object.empty_add(location=(0, 0, 0))
pivot = bpy.context.object
bpy.ops.object.camera_add(location=(0, -9, 0.6))
cam = bpy.context.object
cam.parent = pivot
cam.data.lens = 55
tc = cam.constraints.new("TRACK_TO")
tc.target, tc.track_axis, tc.up_axis = subj, "TRACK_NEGATIVE_Z", "UP_Y"
sc.camera = cam
F = a.frames
sc.frame_start, sc.frame_end = 1, F
if a.move == "orbit":
    pivot.rotation_euler = (0, 0, math.radians(-25)); pivot.keyframe_insert("rotation_euler", frame=1)
    pivot.rotation_euler = (0, 0, math.radians(25)); pivot.keyframe_insert("rotation_euler", frame=F)
elif a.move == "push":
    cam.location = (0, -12, 0.6); cam.keyframe_insert("location", frame=1)
    cam.location = (0, -8, 0.4); cam.keyframe_insert("location", frame=F)
else:
    subj.rotation_euler[2] = math.radians(-180); subj.keyframe_insert("rotation_euler", frame=1)
    subj.rotation_euler[2] = 0; subj.keyframe_insert("rotation_euler", frame=int(F * 0.7))

# --- render: EEVEE, transparent film, PNG RGBA -------------------------------
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
try:
    sc.eevee.taa_render_samples = a.samples
except AttributeError:
    pass
w, hgt = (int(x) for x in a.res.lower().split("x"))
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, hgt, 100
sc.render.fps = a.fps
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
os.makedirs(a.out, exist_ok=True)
sc.render.filepath = os.path.join(os.path.abspath(a.out), "")
bpy.ops.render.render(animation=True)
print(f"[logo3d] {F} frames -> {a.out}")
