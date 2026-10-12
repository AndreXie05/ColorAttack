"""
ColorAttack - mapa PARQUE feito no Blender, estilo cartoon limpo (referência: foto.png).
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/parque.glb"; exec(open(este_ficheiro).read())

Convenção do jogo: coordenadas do jogo (x, z)  ->  Blender (x, -z). Arena 100 x 70 m, simétrica em x.
O ficheiro exportado tem:
  - ParkVisual            : toda a geometria visível (uma só malha, um material por cor)
  - Col_Box_n / Col_Cyl_n : marcadores (empties) das colisões, com extras w, d, top (caixa) ou r, top (cilindro)
  - Patrol_n              : pontos de patrulha dos bots
(As bases/pontos de reaparecimento e os baús são criados pelo jogo.)
"""
import math
import os
COMMON = "/home/andrexie/Documents/ColorAttack/tools/blender/common.py"
exec(open(COMMON).read())

OUTPUT = globals().get("OUTPUT")
rad = math.radians
COLLECTION_NAME = "ParkMap"

MATERIALS.update({
    "Concrete": 0xE3E7EF, "Joint": 0xCDD2DD, "Plaza": 0xF6F7FB, "PlazaRing": 0xD5DBE8, "Stone": 0xEEF0F6, "StoneDark": 0xB9C0D0,
    "Lawn": 0x86E36A, "LawnDark": 0x6CCF55, "Trunk": 0xC08A5E, "PalmTrunk": 0xD2A070, "Leaf1": 0x57D872, "Leaf2": 0x3FC25F,
    "Frond": 0x2FBF6B, "Coconut": 0x7A4A2E, "Hedge": 0x47CC63, "HedgeTop": 0x62DD7B,
    "Wood": 0xF2B96B, "WoodDark": 0xC98E4A, "Metal": 0x5F6C84, "Red": 0xFF5A66, "Blue": 0x4D8CFF, "Yellow": 0xFFD84A, "Chain": 0x3A4258,
    "Water": 0x4CC6F5, "Wall": 0xF4F5FA, "WallCap": 0xC4CBDB, "Foam": 0xFFFFFF, "Sea": 0x3FB4EA,
    "LampPole": 0x4A5368, "Glow": 0xFFF3B8, "BallRed": 0xFF5A66, "BallBlue": 0x4D8CFF, "BallYellow": 0xFFD84A, "White": 0xFFFFFF,
    "BridgeRed": 0xF0605A, "BridgeLight": 0xF7E7E0, "Mountain": 0x7FA8D8, "MountainFar": 0xA3C2E6, "Snow": 0xFFFFFF,
    "BlockTop": 0x7FD3F2, "Rock": 0xB9C0D0,
})
ROUGH.update({"Water": 0.12, "Sea": 0.18, "Glow": 0.4, "Concrete": 0.7, "Plaza": 0.6, "Lawn": 0.9})
EMISSIVE.update({"Glow": (0xFFE9A0, 2.0), "Water": (0x2A9FD8, 0.25)})

P = Part("ParkVisual")
colliders = []       # ("box", x, z, w, d, top) | ("cyl", x, z, r, top)   (coordenadas do jogo)


def B(x, z):
    return (x, -z)


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


# ---------- chão, relvados, praça ----------
def floor():
    P.rbox("Concrete", (0, 0, -0.8), (103.4, 73.4, 1.6), radius=0.3)                       # laje
    P.rbox("Foam", (0, 0, -1.2), (106.5, 76.5, 0.3), radius=0.5)                            # espuma à volta
    for i in range(-9, 10):
        P.box("Joint", (i * 5.0, 0, 0.006), (0.08, 70, 0.012))
    for j in range(-6, 7):
        P.box("Joint", (0, j * 5.0, 0.006), (100, 0.08, 0.012))
    # NOTA: tudo o que cobre o chão tem de ficar abaixo de z=0.04 (a camada de tinta do jogo está a 0.045),
    # senão a tinta fica escondida por baixo (relvados, praça, etc.).
    P.cone("PlazaRing", (0, 0, 0.009), 13.5, 13.5, 0.018, segs=64)                          # praça central
    P.cone("Plaza", (0, 0, 0.015), 12.2, 12.2, 0.014, segs=64)
    P.cone("PlazaRing", (0, 0, 0.021), 9.8, 9.8, 0.014, segs=64)
    P.cone("Plaza", (0, 0, 0.027), 9.4, 9.4, 0.014, segs=64)
    for s in (1, -1):                                                                        # relvados com bordo de pedra
        for (x, z, w, d) in [(28, 22, 24, 16), (28, -22, 24, 16), (12, 27, 15, 10), (12, -27, 15, 10)]:
            bx, by = B(s * x, z)
            P.box("Stone", (bx, by, 0.012), (w + 1.4, d + 1.4, 0.024))                       # bordo de pedra (ao nível do chão)
            P.box("Lawn", (bx, by, 0.019), (w, d, 0.02))
            for k in range(3):                                                               # riscas no relvado
                P.box("LawnDark", (bx, by + (k - 1) * d * 0.3, 0.0255), (w * 0.94, d * 0.12, 0.003))


def fountain():
    P.lathe("Stone", [(4.4, 0.0), (4.46, 0.5), (4.3, 1.05), (3.9, 1.1)], loc=(0, 0, 0), segs=48, per_seg=4)
    P.cone("Water", (0, 0, 0.98), 4.0, 4.0, 0.06, segs=48)
    P.lathe("Stone", [(1.0, 0.95), (0.7, 1.6), (0.52, 3.0), (0.95, 3.5), (0.0, 3.6)], segs=32, per_seg=4)
    P.sphere("Water", (0, 0, 4.1), (0.85, 0.85, 0.85), segs=24, rings=14)
    for k in range(8):                                                                       # esguichos (decoração)
        a = k * math.pi / 4
        P.tube("Water", [(math.cos(a) * 0.4, math.sin(a) * 0.4, 3.7), (math.cos(a) * 1.6, math.sin(a) * 1.6, 3.4), (math.cos(a) * 2.7, math.sin(a) * 2.7, 1.1)],
               [0.07, 0.06, 0.05], sides=6, per_seg=5)
    col_cyl(0, 0, 4.5, 2.2)


# ---------- árvores ----------
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
    for k in range(9):                                                                       # folhas
        a = k * 2 * math.pi / 9 + 0.2
        for layer, (tilt, length, wdt) in enumerate([(rad(22), 2.2, 0.55), (rad(48), 1.9, 0.5)]):
            ln = length * s
            cx = tx + math.cos(a) * ln * math.cos(tilt) * 0.95
            cy = ty + math.sin(a) * ln * math.cos(tilt) * 0.95
            cz = tz + 0.15 - ln * math.sin(tilt) * 0.95
            P.sphere("Frond", (cx, cy, cz), (ln, wdt * s, 0.09 * s), rot=(0, tilt, a), segs=14, rings=8)
    for k in range(3):
        a = k * 2.1
        P.sphere("Coconut", (tx + math.cos(a) * 0.4, ty + math.sin(a) * 0.4, tz - 0.25), (0.28 * s, 0.28 * s, 0.28 * s), segs=10, rings=8)
    col_cyl(x, z, 0.7 * s, 8)


# ---------- adereços ----------
def hedge(x, z, w, d):
    bx, by = B(x, z)
    P.rbox("Hedge", (bx, by, 1.6), (w, d, 3.2), radius=0.7, segs=4)
    P.rbox("HedgeTop", (bx, by, 3.3), (w * 0.9, d * 0.8, 0.4), radius=0.18)
    col_box(x, z, w, d, 3.5)


def bench(x, z, face):    # face = +1 vira para +z do jogo; -1 vira para -z
    F = Frame(x, z, 0.0 if face > 0 else math.pi)
    P.rbox("Wood", F.pt(0, 0, 0.7), (3.4, 1.1, 0.24), rot=F.rot, radius=0.08, segs=2)
    P.rbox("Wood", F.pt(0, 0.5, 1.25), (3.4, 0.22, 0.9), rot=F.rot, radius=0.08, segs=2)
    for sx in (-1.5, 1.5):
        P.rbox("Metal", F.pt(sx, 0, 0.35), (0.24, 1.0, 0.72), rot=F.rot, radius=0.07, segs=2)
    col_box(x, z, 3.4, 1.2, 1.2)


def swing(x, z):
    F = Frame(x, z)
    for sx in (-3, 3):
        for sy in (-0.8, 0.8):
            P.rbox("Red", F.pt(sx, sy, 2.1), (0.42, 0.42, 4.3), radius=0.12, segs=2)
        P.rbox("Red", F.pt(sx, 0, 4.2), (0.46, 2.2, 0.4), radius=0.1, segs=2)
        col_box(x + sx, z, 0.6, 2.0, 4.3)
    P.cone("Blue", F.pt(0, 0, 4.15), 0.26, 0.26, 6.9, rot=(0, rad(90), 0), segs=16)
    for sx in (-1.2, 1.2):
        for dx in (-0.45, 0.45):
            P.box("Chain", F.pt(sx + dx, 0, 2.5), (0.05, 0.05, 3.2))
        P.rbox("Yellow", F.pt(sx, 0, 0.95), (1.1, 0.5, 0.13), radius=0.05, segs=2)


def slide(x, z):
    F = Frame(x, z)
    P.rbox("Blue", F.pt(0, 0, 2.4), (2.5, 2.5, 0.22), radius=0.07, segs=2)
    for sx in (-1.05, 1.05):
        for sy in (-1.05, 1.05):
            P.rbox("Yellow", F.pt(sx, sy, 1.3), (0.26, 0.26, 2.6), radius=0.08, segs=2)
    for k in range(5):
        P.rbox("White", F.pt(0, -1.45, 0.45 + k * 0.45), (1.3, 0.1, 0.1), radius=0.03, segs=2)
    P.rbox("Red", (F.x, F.y - 3.8, 1.3), (1.6, 5.67, 0.16), rot=(rad(24.3), 0, 0), radius=0.05, segs=2)
    for sx in (-0.85, 0.85):
        P.rbox("Yellow", (F.x + sx, F.y - 3.8, 1.55), (0.14, 5.67, 0.4), rot=(rad(24.3), 0, 0), radius=0.05, segs=2)
    col_box(x, z, 2.6, 2.6, 3.0)
    col_box(x, z + 3.8, 1.9, 5.2, 1.0)


def picnic(x, z):
    F = Frame(x, z)
    P.rbox("Wood", F.pt(0, 0, 1.0), (4.0, 1.8, 0.2), radius=0.07, segs=2)
    for sy in (-1.5, 1.5):
        P.rbox("WoodDark", F.pt(0, sy, 0.5), (4.0, 0.6, 0.15), radius=0.05, segs=2)
    for sx in (-1.6, 1.6):
        P.rbox("Metal", F.pt(sx, 0, 0.5), (0.25, 3.4, 0.95), radius=0.07, segs=2)
    col_box(x, z, 4.1, 3.6, 1.2)


def ball(x, z, r, mat):
    px, py = B(x, z)
    P.sphere(mat, (px, py, r), (r, r, r), segs=28, rings=16)
    for k in range(3):
        a = k * 2.1
        P.sphere("White", (px + math.cos(a) * r * 0.9, py + math.sin(a) * r * 0.9, r + 0.1 * r), (r * 0.32, r * 0.32, r * 0.1), rot=(0, rad(20), a), segs=12, rings=8)
    col_cyl(x, z, r, 2 * r)


def block(x, z, w, d, h=2.6):
    bx, by = B(x, z)
    P.rbox("Stone", (bx, by, h / 2), (w, d, h), radius=0.4, segs=3)
    P.rbox("BlockTop", (bx, by, h + 0.05), (w + 0.1, d + 0.1, 0.3), radius=0.12, segs=2)
    col_box(x, z, w, d, h)


def lamp(x, z):
    px, py = B(x, z)
    P.cone("LampPole", (px, py, 3.2), 0.2, 0.14, 6.4, segs=12)
    P.sphere("Glow", (px, py, 6.7), (0.65, 0.65, 0.65), segs=16, rings=10)
    P.cone("LampPole", (px, py, 0.25), 0.4, 0.4, 0.5, segs=12)


# ---------- paredes e cenário ----------
def walls():
    hx, hz = 50.0, 35.0
    P.rbox("Wall", (0, hz + 0.65, 1.2), (104.6, 1.3, 2.4), radius=0.3)
    P.rbox("Wall", (0, -hz - 0.65, 1.2), (104.6, 1.3, 2.4), radius=0.3)
    P.rbox("Wall", (hx + 0.65, 0, 1.2), (1.3, 72.6, 2.4), radius=0.3)
    P.rbox("Wall", (-hx - 0.65, 0, 1.2), (1.3, 72.6, 2.4), radius=0.3)
    for (x, y, w, d) in [(0, hz + 0.65, 105, 1.5), (0, -hz - 0.65, 105, 1.5), (hx + 0.65, 0, 1.5, 73), (-hx - 0.65, 0, 1.5, 73)]:
        P.rbox("WallCap", (x, y, 2.5), (w, d, 0.28), radius=0.1, segs=2)
    col_box(0, -hz - 0.75, 104.6, 1.5, 2.4)
    col_box(0, hz + 0.75, 104.6, 1.5, 2.4)
    col_box(-hx - 0.75, 0, 1.5, 72.6, 2.4)
    col_box(hx + 0.75, 0, 1.5, 72.6, 2.4)


def scenery():
    P.box("Sea", (0, 0, -1.55), (1400, 1400, 0.2))
    # ponte ao fundo (norte do jogo = +y no Blender)
    by = 170.0
    P.rbox("BridgeLight", (0, by, 17), (520, 11, 2.4), radius=0.6)
    for sx in (-1, 1):
        P.rbox("BridgeRed", (sx * 85, by, 30), (5, 5, 62), radius=0.8)
        P.rbox("BridgeRed", (sx * 85, by, 62), (7, 8, 3), radius=0.5)
        P.rbox("BridgeRed", (sx * 85, by, 38), (5.4, 11.6, 2.2), radius=0.5)
        P.rbox("BridgeRed", (sx * 85, by, 8), (7, 7, 18), radius=0.8)
    for side in (-5.0, 5.0):
        pts = [(-250, by + side, 18), (-170, by + side, 38), (-85, by + side, 60), (-40, by + side, 40), (0, by + side, 26),
               (40, by + side, 40), (85, by + side, 60), (170, by + side, 38), (250, by + side, 18)]
        P.tube("BridgeRed", pts, [0.5] * len(pts), sides=8, per_seg=6)
    # montanhas e ilhas
    for (x, y, sx, sy, sz, m) in [(-230, 330, 170, 110, 90, "Mountain"), (0, 360, 220, 120, 120, "MountainFar"), (240, 320, 180, 110, 100, "Mountain"),
                                  (-400, 150, 120, 120, 70, "MountainFar"), (410, 120, 120, 100, 80, "Mountain")]:
        P.sphere(m, (x, y, -10), (sx, sy, sz), segs=24, rings=12)
        P.sphere("Snow", (x, y, sz * 0.55 - 10), (sx * 0.33, sy * 0.33, sz * 0.5), segs=16, rings=8)
    # ilhotas com palmeiras (decoração distante)
    for (x, y) in [(-120, -130), (140, -120), (-170, 90)]:
        P.rbox("Foam", (x, y, -1.0), (34, 24, 1.0), radius=1.5)
        P.rbox("Lawn", (x, y, -0.4), (30, 20, 1.0), radius=1.5)
        px, py = x, y
        P.tube("PalmTrunk", [(px, py, 0), (px + 1, py, 4), (px + 2.2, py, 8)], [0.8, 0.6, 0.45], sides=10, per_seg=5)
        for k in range(8):
            a = k * math.pi / 4
            P.sphere("Frond", (px + 2.2 + math.cos(a) * 3.0, py + math.sin(a) * 3.0, 7.6), (3.4, 0.8, 0.12), rot=(0, rad(25), a), segs=12, rings=8)
    # farol
    fx, fy = -175, -60
    P.rbox("Foam", (fx, fy, -1.0), (30, 30, 1.0), radius=3)
    for k in range(5):
        P.cone("BridgeRed" if k % 2 == 0 else "White", (fx, fy, 3 + k * 6), 4.5 - k * 0.4, 4.1 - k * 0.4, 6, segs=24)
    P.cone("Glow", (fx, fy, 34), 3.0, 3.0, 4, segs=20)
    P.cone("BridgeRed", (fx, fy, 38), 3.8, 0.2, 4, segs=20)


# ---------- construção ----------
def build():
    floor(); walls(); fountain(); scenery()
    for s in (1, -1):
        for (x, z) in [(26, -30), (26, 30), (22, -14), (22, 14)]:
            round_tree(s * x, z, 1.35)
        for (x, z, yw) in [(12, -27, 0.5), (12, 27, 2.6), (34, -22, -0.4), (34, 22, 0.4)]:
            palm(s * x, z, 1.15, 0.9, yw if s > 0 else math.pi - yw)
        bench(s * 15, -5, +1); bench(s * 15, 5, -1)
        swing(s * 28, -22); slide(s * 28, 22)
        picnic(s * 32, 9); picnic(s * 32, -9)
        hedge(s * 18, -12, 2.4, 9); hedge(s * 18, 12, 2.4, 9); hedge(s * 30, 0, 9, 2.4)
        ball(s * 8, -15, 2.0, "BallRed"); ball(s * 8, 15, 2.0, "BallBlue")
        block(s * 10, -21, 5, 3); block(s * 10, 21, 5, 3)
        block(s * 38, -17, 3, 5); block(s * 38, 17, 3, 5)
        for (x, z) in [(14, -14), (14, 14), (6, -26), (6, 26), (40, 0)]:
            lamp(s * x, z)
    round_tree(0, -28, 1.5); round_tree(0, 28, 1.5)
    ball(0, -16, 2.0, "BallYellow"); ball(0, 16, 2.0, "BallYellow")

    exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_extras.py").read(), globals()); decorate(seed=5, wall_h=2.4, patrol=[(16, -20), (16, 20), (26, -8), (26, 8), (0, -24), (0, 24), (18, 0), (36, -12.5), (36, 12.5)])
    old = bpy.data.collections.get(COLLECTION_NAME)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    col = bpy.data.collections.new(COLLECTION_NAME)
    bpy.context.scene.collection.children.link(col)
    visual = P.build(col)
    visual.name = "ParkVisual"
    objs = [visual]

    for i, c in enumerate(colliders):                                  # marcadores de colisão (empties com extras)
        if c[0] == "box":
            e = bpy.data.objects.new("Col_Box_%d" % i, None); e["w"], e["d"], e["top"] = float(c[3]), float(c[4]), float(c[5])
        else:
            e = bpy.data.objects.new("Col_Cyl_%d" % i, None); e["r"], e["top"] = float(c[3]), float(c[4])
        e.empty_display_type = "CUBE"; e.empty_display_size = 0.3
        e.location = (c[1], -c[2], 0)
        col.objects.link(e); objs.append(e)
    patrol = [(16, -20), (16, 20), (26, -8), (26, 8), (0, -24), (0, 24), (18, 0), (36, -12.5), (36, 12.5)]
    n = 0
    for (x, z) in patrol:
        for sx in ((1, -1) if x != 0 else (1,)):
            e = bpy.data.objects.new("Patrol_%d" % n, None); e.empty_display_type = "SPHERE"; e.empty_display_size = 0.3
            e.location = (sx * x, -z, 0); col.objects.link(e); objs.append(e); n += 1
    bpy.context.view_layer.update()
    return objs


objs = build()
print("Parque criado:", len(objs), "objetos;", len(colliders), "colisões")

if OUTPUT:
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=OUTPUT, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_materials="EXPORT", export_extras=True)
    print("Exportado", OUTPUT, os.path.getsize(OUTPUT), "bytes")
