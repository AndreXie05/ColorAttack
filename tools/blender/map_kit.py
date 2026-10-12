"""
ColorAttack - kit partilhado para construir mapas no Blender (corre dentro do Blender, via exec).

Cada mapa (build_school_map.py, ...) faz exec deste ficheiro, desenha o seu layout e chama finish_map().
Convenção: coordenadas do jogo (x, z) -> Blender (x, -z). Arena 100 x 70 m, simétrica em x.

REGRA DA TINTA: tudo o que cobre o chão tem de ficar abaixo de z = 0.04 (a camada de tinta do jogo está a 0.045),
senão a tinta fica escondida por baixo.

Marcadores no .glb:   Col_Box_n (extras w, d, top) · Col_Cyl_n (extras r, top) · Patrol_n
Animações (objetos à parte, com a origem no pivô; extras lidos pelo jogo):
   anim = "spin"    axis = x|y|z (eixos do jogo; y = vertical)   speed = rad/s
   anim = "bob"     sobe e desce no eixo vertical:  amp, speed
   anim = "loop"    anda num eixo e volta ao início:  axis, span, speed, phase
   anim = "counter" roda ao contrário do pai (cabinas da roda gigante)
"""
import math
import os
COMMON = "/home/andrexie/Documents/ColorAttack/tools/blender/common.py"
exec(open(COMMON).read())

rad = math.radians

MATERIALS.update({
    # neutros
    "Concrete": 0xE3E7EF, "Joint": 0xCDD2DD, "Plaza": 0xF6F7FB, "PlazaRing": 0xD5DBE8, "Stone": 0xEEF0F6, "StoneDark": 0xB9C0D0,
    "Wall": 0xF4F5FA, "WallCap": 0xC4CBDB, "Foam": 0xFFFFFF, "Sea": 0x3FB4EA, "White": 0xFFFFFF, "Black": 0x20222E, "Steel": 0xC9D1DE,
    "SteelDark": 0x6B7690, "Rubber": 0x2A2D3A,
    # cores vivas partilhadas
    "Red": 0xFF5A66, "Blue": 0x4D8CFF, "Yellow": 0xFFD84A, "Green": 0x47CC63, "Orange": 0xFF9A3C, "Purple": 0xA06BFF, "Pink": 0xFF8FC0,
    "Teal": 0x4FD6C8, "Sky": 0x7FD3F2,
    # natureza
    "Lawn": 0x86E36A, "LawnDark": 0x6CCF55, "Trunk": 0xC08A5E, "PalmTrunk": 0xD2A070, "Leaf1": 0x57D872, "Leaf2": 0x3FC25F,
    "Frond": 0x2FBF6B, "Coconut": 0x7A4A2E, "Hedge": 0x47CC63, "HedgeTop": 0x62DD7B, "Wood": 0xF2B96B, "WoodDark": 0xC98E4A,
    "Metal": 0x5F6C84, "Water": 0x4CC6F5, "LampPole": 0x4A5368, "Glow": 0xFFF3B8, "Mountain": 0x7FA8D8, "MountainFar": 0xA3C2E6,
    "Snow": 0xFFFFFF, "Glass": 0x9BE2FF, "Brick": 0xE58B6B, "Cream": 0xFFF1D6,
})
ROUGH.update({"Water": 0.12, "Sea": 0.18, "Glow": 0.4, "Concrete": 0.7, "Plaza": 0.6, "Lawn": 0.9, "Glass": 0.1, "Steel": 0.3})
EMISSIVE.update({"Glow": (0xFFE9A0, 2.0), "Water": (0x2A9FD8, 0.25)})

P = Part("Visual")
colliders = []                 # ("box", x, z, w, d, top) | ("cyl", x, z, r, top)  (coordenadas do jogo)
anim_defs = []                 # (Part, pivot(blender), props dict, nome, nome_do_pai)


# ---------- atalhos ----------
def B(x, z):
    return (x, -z)


def RB(mat, x, z, w, d, h, r=0.2, z0=0.0, segs=3):
    """Caixa arredondada assente em z0 (x,z do jogo; w ao longo de x, d ao longo de z)."""
    P.rbox(mat, (x, -z, z0 + h / 2), (w, d, h), radius=r, segs=segs)


def CY(mat, x, z, r, h, z0=0.0, r2=None, segs=28):
    """Cilindro/cone assente em z0."""
    P.cone(mat, (x, -z, z0 + h / 2), r, r if r2 is None else r2, h, segs=segs)


def SP(mat, x, z, zc, rx, ry=None, rz=None, segs=24, rings=14, rot=(0, 0, 0)):
    """Esfera/elipsoide com centro em (x, z) e altura zc."""
    P.sphere(mat, (x, -z, zc), (rx, rx if ry is None else ry, rx if rz is None else rz), rot=rot, segs=segs, rings=rings)


class Frame:
    """Referencial local de um adereço: posição (x,z) do jogo e rotação yaw (em volta de Z)."""

    def __init__(self, x, z, yaw=0.0):
        self.x, self.y, self.yaw = x, -z, yaw
        self.c, self.s = math.cos(yaw), math.sin(yaw)

    def pt(self, lx, ly, lz=0.0):
        return (self.x + lx * self.c - ly * self.s, self.y + lx * self.s + ly * self.c, lz)

    @property
    def rot(self):
        return (0, 0, self.yaw)


def col_box(x, z, w, d, top):
    colliders.append(("box", x, z, w, d, top))


def col_cyl(x, z, r, top):
    colliders.append(("cyl", x, z, r, top))


def anim(name, x, z, zc=0.0, kind="spin", axis="z", speed=1.0, amp=0.0, span=0.0, phase=0.0, parent=None):
    """Cria um objeto animado: devolve um Part com a origem no pivô (x, z, zc). Adiciona-lhe formas com coordenadas
    ABSOLUTAS do Blender (como no resto do kit): o pivô só define o ponto de rotação.  axis em eixos do Blender (x,y,z)."""
    part = Part("Anim_" + name)
    tri = {"x": "x", "y": "z", "z": "y"}[axis]            # eixo do Blender -> eixo do glTF/Three
    props = {"anim": kind, "axis": tri, "speed": float(speed), "amp": float(amp), "span": float(span), "phase": float(phase)}
    anim_defs.append((part, (x, -z, zc), props, "Anim_" + name, ("Anim_" + parent) if parent else None))
    return part


# ---------- chão e fundo ----------
def slab(w=103.4, d=73.4, color="Concrete", joints=True, tile=5.0):
    P.rbox(color, (0, 0, -0.8), (w, d, 1.6), radius=0.3)
    P.rbox("Foam", (0, 0, -1.2), (w + 3.1, d + 3.1, 0.3), radius=0.5)
    if joints:
        for i in range(-int(50 / tile) + 1, int(50 / tile)):
            P.box("Joint", (i * tile, 0, 0.006), (0.08, 70, 0.012))
        for j in range(-int(35 / tile) + 1, int(35 / tile)):
            P.box("Joint", (0, j * tile, 0.006), (100, 0.08, 0.012))


def sea(z=-1.55, color="Sea"):
    P.box(color, (0, 0, z), (1400, 1400, 0.2))


def walls(mat="Wall", cap="WallCap", h=2.4):
    hx, hz = 50.0, 35.0
    for (x, y, w, d) in [(0, hz + 0.65, 104.6, 1.3), (0, -hz - 0.65, 104.6, 1.3), (hx + 0.65, 0, 1.3, 72.6), (-hx - 0.65, 0, 1.3, 72.6)]:
        P.rbox(mat, (x, y, h / 2), (w, d, h), radius=0.3)
        P.rbox(cap, (x, y, h + 0.1), (w + 0.4, d + 0.2, 0.28), radius=0.1, segs=2)
    col_box(0, -hz - 0.75, 104.6, 1.5, h)
    col_box(0, hz + 0.75, 104.6, 1.5, h)
    col_box(-hx - 0.75, 0, 1.5, 72.6, h)
    col_box(hx + 0.75, 0, 1.5, 72.6, h)


def flat_rect(mat, x, z, w, d, top=0.02):
    """Retângulo plano no chão (nunca acima de 0.04)."""
    P.box(mat, (x, -z, top / 2), (w, d, top))


def flat_disc(mat, x, z, r, top=0.02, segs=48):
    P.cone(mat, (x, -z, top / 2), r, r, top, segs=segs)


# ---------- árvores e adereços comuns ----------
def round_tree(x, z, s=1.35, lean=0.0):
    px, py = B(x, z)
    P.tube("Trunk", [(px, py, 0), (px + lean, py, 1.7 * s), (px, py, 3.4 * s)], [0.62 * s, 0.46 * s, 0.4 * s], sides=14)
    P.sphere("Leaf1", (px, py, 4.7 * s), (2.5 * s, 2.5 * s, 2.3 * s), segs=22, rings=12)
    P.sphere("Leaf2", (px + 1.5 * s, py + 0.6 * s, 3.9 * s), (1.7 * s, 1.7 * s, 1.55 * s), segs=18, rings=10)
    P.sphere("Leaf1", (px - 1.4 * s, py - 0.8 * s, 4.1 * s), (1.6 * s, 1.6 * s, 1.5 * s), segs=18, rings=10)
    P.sphere("Leaf2", (px + 0.3 * s, py - 1.3 * s, 5.6 * s), (1.3 * s, 1.3 * s, 1.1 * s), segs=16, rings=10)
    col_cyl(x, z, 0.85 * s, 9)


def palm(x, z, s=1.0, lean=0.9, yaw=0.0):
    px, py = B(x, z)
    dx, dy = math.cos(yaw) * lean, math.sin(yaw) * lean
    P.tube("PalmTrunk", [(px, py, 0), (px + dx * 0.3, py + dy * 0.3, 2.2 * s), (px + dx * 0.8, py + dy * 0.8, 4.6 * s), (px + dx * 1.3, py + dy * 1.3, 6.8 * s)],
           [0.58 * s, 0.44 * s, 0.36 * s, 0.3 * s], sides=14, per_seg=6)
    tx, ty, tz = px + dx * 1.3, py + dy * 1.3, 6.8 * s
    for k in range(9):
        a = k * 2 * math.pi / 9 + 0.2
        for (tilt, length, wdt) in [(rad(22), 2.2, 0.55), (rad(48), 1.9, 0.5)]:
            ln = length * s
            P.sphere("Frond", (tx + math.cos(a) * ln * math.cos(tilt) * 0.95, ty + math.sin(a) * ln * math.cos(tilt) * 0.95, tz + 0.15 - ln * math.sin(tilt) * 0.95),
                     (ln, wdt * s, 0.09 * s), rot=(0, tilt, a), segs=14, rings=8)
    for k in range(3):
        a = k * 2.1
        P.sphere("Coconut", (tx + math.cos(a) * 0.4, ty + math.sin(a) * 0.4, tz - 0.25), (0.28 * s, 0.28 * s, 0.28 * s), segs=10, rings=8)
    col_cyl(x, z, 0.7 * s, 8)


def lamp(x, z, h=6.4):
    px, py = B(x, z)
    P.cone("LampPole", (px, py, h / 2), 0.2, 0.14, h, segs=12)
    P.sphere("Glow", (px, py, h + 0.3), (0.65, 0.65, 0.65), segs=16, rings=10)
    P.cone("LampPole", (px, py, 0.25), 0.4, 0.4, 0.5, segs=12)


def hedge(x, z, w, d, h=3.2):
    bx, by = B(x, z)
    P.rbox("Hedge", (bx, by, h / 2), (w, d, h), radius=0.7, segs=4)
    P.rbox("HedgeTop", (bx, by, h + 0.1), (w * 0.9, d * 0.8, 0.4), radius=0.18)
    col_box(x, z, w, d, h + 0.3)


def block(x, z, w, d, h=2.6, top="BlockTop", body="Stone", topcolor=0x7FD3F2):
    MATERIALS.setdefault("BlockTop", topcolor)
    bx, by = B(x, z)
    P.rbox(body, (bx, by, h / 2), (w, d, h), radius=0.4, segs=3)
    P.rbox(top, (bx, by, h + 0.05), (w + 0.1, d + 0.1, 0.3), radius=0.12, segs=2)
    col_box(x, z, w, d, h)


def bench(x, z, face, wood="Wood"):
    F = Frame(x, z, 0.0 if face > 0 else math.pi)
    P.rbox(wood, F.pt(0, 0, 0.7), (3.4, 1.1, 0.24), rot=F.rot, radius=0.08, segs=2)
    P.rbox(wood, F.pt(0, 0.5, 1.25), (3.4, 0.22, 0.9), rot=F.rot, radius=0.08, segs=2)
    for sx in (-1.5, 1.5):
        P.rbox("Metal", F.pt(sx, 0, 0.35), (0.24, 1.0, 0.72), rot=F.rot, radius=0.07, segs=2)
    col_box(x, z, 3.4, 1.2, 1.2)


def ball(x, z, r, mat):
    px, py = B(x, z)
    P.sphere(mat, (px, py, r), (r, r, r), segs=28, rings=16)
    for k in range(3):
        a = k * 2.1
        P.sphere("White", (px + math.cos(a) * r * 0.9, py + math.sin(a) * r * 0.9, r + 0.1 * r), (r * 0.32, r * 0.32, r * 0.1), rot=(0, rad(20), a), segs=12, rings=8)
    col_cyl(x, z, r, 2 * r)


def building(x, z, w, d, h, wall, roof, face="+z", rows=None, glass="Glass", z0=0.0, band=None):
    """Edifício decorativo (só visual): paredes, telhado em faixa e janelas na face indicada."""
    bx, by = B(x, z)
    P.rbox(wall, (bx, by, z0 + h / 2), (w, d, h), radius=0.5, segs=2)
    P.rbox(roof, (bx, by, z0 + h + 0.4), (w + 1.2, d + 1.2, 0.9), radius=0.3, segs=2)
    if band:
        P.rbox(band, (bx, by, z0 + h * 0.5), (w + 0.2, d + 0.2, 0.6), radius=0.1, segs=2)
    n_row = rows if rows is not None else max(1, int((h - 2) / 4))
    onz = face[1] == "z"
    length = w if onz else d
    cols = max(1, int(length / 5))
    sgn = 1 if face[0] == "+" else -1
    for i in range(cols):
        u = -length / 2 + (i + 0.5) * length / cols
        for j in range(n_row):
            zz = z0 + 2.2 + j * 4.0
            if onz:
                # +z do jogo = -y do Blender
                P.rbox(glass, (bx + u, by - sgn * (d / 2 + 0.05), zz + 1.1), (2.4, 0.18, 2.4), radius=0.15, segs=2)
            else:
                P.rbox(glass, (bx + sgn * (w / 2 + 0.05), by - u, zz + 1.1), (0.18, 2.4, 2.4), radius=0.15, segs=2)


# ---------- finalização ----------
def finish_map(map_id, patrol, output, collection=None):
    """Cria a coleção, os objetos, os marcadores e exporta o .glb."""
    cname = collection or ("Map_" + map_id)
    old = bpy.data.collections.get(cname)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    col = bpy.data.collections.new(cname)
    bpy.context.scene.collection.children.link(col)

    visual = P.build(col)
    visual.name = "Visual"
    objs = [visual]
    built = {}
    for (part, pivot, props, name, parent) in anim_defs:           # objetos animados (origem no pivô)
        # as formas foram criadas em coordenadas absolutas: compensa para que a origem fique no pivô
        for v in part.bm.verts:
            v.co -= Vector(pivot)
        o = part.build(col, pivot)
        o.name = name
        for k, v in props.items():
            o[k] = v
        built[name] = o
        objs.append(o)
    for (part, pivot, props, name, parent) in anim_defs:
        if parent:
            child, par = built[name], built[parent]
            child.parent = par
            child.matrix_parent_inverse = par.matrix_world.inverted()
    bpy.context.view_layer.update()

    for i, c in enumerate(colliders):
        if c[0] == "box":
            e = bpy.data.objects.new("Col_Box_%d" % i, None)
            e["w"], e["d"], e["top"] = float(c[3]), float(c[4]), float(c[5])
        else:
            e = bpy.data.objects.new("Col_Cyl_%d" % i, None)
            e["r"], e["top"] = float(c[3]), float(c[4])
        e.empty_display_type = "CUBE"; e.empty_display_size = 0.3
        e.location = (c[1], -c[2], 0)
        col.objects.link(e); objs.append(e)
    n = 0
    for (x, z) in patrol:
        for sx in ((1, -1) if x != 0 else (1,)):
            e = bpy.data.objects.new("Patrol_%d" % n, None)
            e.empty_display_type = "SPHERE"; e.empty_display_size = 0.3
            e.location = (sx * x, -z, 0); col.objects.link(e); objs.append(e); n += 1
    bpy.context.view_layer.update()

    # esconde as outras coleções para ver só este mapa
    for c in bpy.data.collections:
        if c.name != cname:
            c.hide_viewport = True
    print("Mapa", map_id, "criado:", len(objs), "objetos;", len(colliders), "colisões;", len(anim_defs), "animados")

    if output:
        os.makedirs(os.path.dirname(output), exist_ok=True)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.export_scene.gltf(filepath=output, export_format="GLB", use_selection=True, export_apply=True,
                                  export_yup=True, export_materials="EXPORT", export_extras=True)
        print("Exportado", output, os.path.getsize(output), "bytes")
    return objs
