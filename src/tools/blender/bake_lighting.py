"""
ColorAttack - "coze" a luz ambiente de um mapa (oclusão: cantos, frestas e o chão à volta/por baixo das coisas ficam mais escuros).
Abre o .glb já feito, faz o bake de AO com o Cycles e grava:
  assets/maps/<mapa>.glb     o mesmo mapa, cada vértice com o atributo _OCC (0 = ao ar livre, 1 = todo tapado)
  assets/maps/<mapa>_ao.jpg  sombra do chão vista de cima (2000 x 1400 = 20 píxeis por metro; branco = ao ar livre)
O jogo (src/visual/map-look.js) junta as duas: só escurece a luz ambiente (o sol e as sombras dele continuam em tempo real).
A textura não pesa nada a correr; o atributo dá ~1 MB a mais no .glb.

  ./blender-5.2.2-linux-x64/blender -b --python src/tools/blender/bake_lighting.py -- parque [amostras=64]
Corre sempre sobre o .glb original (se já tiver _OCC, é refeito).
"""
import os
import sys
import time
import bpy

BASE = "/home/andrexie/Documents/ColorAttack"
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MAP = args[0] if args else "parque"
SAMPLES = int(args[1]) if len(args) > 1 else 64
GLB = f"{BASE}/assets/maps/{MAP}.glb"
OUT_GLB = os.environ.get("CA_OUT_GLB", GLB)
OUT_AO = os.environ.get("CA_OUT_AO", f"{BASE}/assets/maps/{MAP}_ao.jpg")
HX, HZ, PX = 50.0, 35.0, 20             # arena 100 x 70 m (ARENA em game-config.js), píxeis por metro
GROUND_Z = 0.042                        # logo acima de tudo o que cobre o chão (< 0.04, ver map_kit.py)
AO_DIST = 2.5                           # até que distância um objeto faz sombra ambiente noutro (metros)
BIG_EDGE = 1.6                          # faces com arestas maiores do que isto ficam sem sombra nos vértices (o chão usa a textura)

t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB, merge_vertices=False, import_scene_extras=True)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.view_settings.view_transform = "Standard"         # (o AgX por defeito tornava o branco em cinzento)
if scene.world is None:
    scene.world = bpy.data.worlds.new("World")
scene.world.light_settings.distance = AO_DIST


def select_only(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# 1) AO por vértice em todas as malhas (as animadas também, na posição inicial)
for o in meshes:
    me = o.data
    for a in [a for a in me.attributes if a.name in ("AOBake", "_OCC")]:
        me.attributes.remove(a)
    ca = me.color_attributes.new("AOBake", "FLOAT_COLOR", "POINT")
    me.color_attributes.active_color = ca
    select_only(o)
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    occ = me.attributes.new("_OCC", "FLOAT", "POINT")      # guardado ao contrário: sem atributo = sem sombra
    vals = [0.0] * (len(me.vertices) * 4)
    me.attributes["AOBake"].data.foreach_get("color", vals)
    occv = [max(0.0, min(1.0, 1.0 - v)) for v in vals[0::4]]
    # faces grandes (topos de plataformas, paredes compridas) têm poucos vértices: a sombra espalhava-se pela face toda
    for poly in me.polygons:
        if max((me.vertices[a].co - me.vertices[b].co).length for a, b in poly.edge_keys) > BIG_EDGE:
            for vi in poly.vertices:
                occv[vi] = 0.0
    occ.data.foreach_set("value", occv)
    me.attributes.remove(me.attributes["AOBake"])
print(f"{MAP}: AO nos vértices de {len(meshes)} malhas ({time.time() - t0:.0f} s)")

# 2) sombra do chão: um plano do tamanho da arena, logo acima do chão, recebe o bake de AO
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, GROUND_Z))
plane = bpy.context.active_object
plane.scale = (HX * 2, HZ * 2, 1)
bpy.ops.object.transform_apply(scale=True)
img = bpy.data.images.new("GroundAO", int(HX * 2 * PX), int(HZ * 2 * PX), alpha=False)
mat = bpy.data.materials.new("GroundAO"); mat.use_nodes = True
tex = mat.node_tree.nodes.new("ShaderNodeTexImage"); tex.image = img
mat.node_tree.nodes.active = tex
plane.data.materials.append(mat)
select_only(plane)
bpy.ops.object.bake(type="AO", margin=2, use_clear=True)
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.color_mode = "BW"
scene.render.image_settings.quality = 90
img.save_render(OUT_AO, scene=scene)
bpy.data.objects.remove(plane, do_unlink=True)
print(f"{MAP}: AO do chão ({time.time() - t0:.0f} s)")

# 3) grava o .glb (os marcadores Col_* / Patrol_* mantêm os extras; _OCC vai como atributo)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", export_extras=True, export_attributes=True,
                          export_normals=True, export_texcoords=False, export_yup=True, export_apply=False,
                          export_animations=False, export_lights=False, export_cameras=False)
print(f"MAPA COZIDO {MAP}: {os.path.getsize(OUT_GLB)} bytes + AO {os.path.getsize(OUT_AO)} bytes ({time.time() - t0:.0f} s)")
