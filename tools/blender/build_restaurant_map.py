"""
ColorAttack - mapa RESTAURANTE feito no Blender: cozinha ao centro (forno de pizza gigante, tachos com tinta,
fogões) e salas de jantar dos lados com mesas e chapéus-de-sol, caixas de pizza, latas e pimenteiros gigantes.
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/restaurante.glb"; exec(open(este_ficheiro).read())
"""
import math
import os
exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_kit.py").read())
OUTPUT = globals().get("OUTPUT")

MATERIALS.update({
    "TileCream": 0xFFF3E0, "TileRed": 0xFF8A80, "KTileA": 0xEAFBF8, "KTileB": 0xA8E8E0, "OvenBrick": 0xE4895F, "OvenDark": 0x7C4A38,
    "Fire": 0xFFB020, "Tomato": 0xFF4D4D, "Cheese": 0xFFD866, "Pepperoni": 0xE0463C, "Box": 0xE7C28F, "BoxTop": 0xF4D9AE, "Label": 0xFFF6E0,
    "SteelTop": 0xAEB8C8, "Fridge": 0xDDF1FF, "Cushion": 0xFF6F6F, "BoothBack": 0xC94A4A, "TableTeal": 0x4FD6C8, "TableOrange": 0xFF9A3C,
    "TablePink": 0xFF8FC0, "TableYellow": 0xFFD84A, "TableBlue": 0x6CA8FF, "Parasol1": 0xFF6F6F, "Parasol2": 0xFFD84A, "Parasol3": 0x4FD6C8,
    "Pepper": 0x3A3F55, "Salt": 0xF4F6FA, "Road": 0x4A4F5A, "Sidewalk": 0xD9DDE6, "Pot": 0xB9C2D2, "Steam": 0xFFFFFF, "Awning1": 0xFF6F6F,
    "B1": 0xFFD6A5, "B2": 0xCAF0F8, "B3": 0xFFC6D9, "B4": 0xD4F1BE, "B5": 0xE5D4FF, "B6": 0xFFF1A8, "RoofDark": 0x6B7690, "Car1": 0xFF5A66,
    "Car2": 0x4D8CFF, "Car3": 0xFFD84A, "Car4": 0x47CC63,
})
ROUGH.update({"OvenBrick": 0.8, "Fire": 0.4})
EMISSIVE.update({"Fire": (0xFF9A20, 1.5)})
TABLE_MATS = ["TableTeal", "TableOrange", "TablePink", "TableYellow", "TableBlue"]
PARASOLS = ["Parasol1", "Parasol2", "Parasol3"]


def table(x, z, k):
    px, py = B(x, z)
    P.cone("Steel", (px, py, 0.55), 0.38, 0.5, 1.1, segs=16)
    P.cone("SteelDark", (px, py, 0.08), 1.0, 1.0, 0.16, segs=24)
    P.cone(TABLE_MATS[k % 5], (px, py, 1.18), 1.9, 1.9, 0.18, segs=36)
    P.cone("White", (px + 0.7, py + 0.2, 1.31), 0.42, 0.42, 0.04, segs=20)
    P.cone("White", (px - 0.6, py - 0.5, 1.31), 0.42, 0.42, 0.04, segs=20)
    P.cone("Red", (px, py + 0.9, 1.5), 0.2, 0.2, 0.5, segs=12)
    P.cone("LampPole", (px, py, 3.0), 0.07, 0.07, 3.8, segs=8)                                  # haste do chapéu-de-sol
    P.cone(PARASOLS[k % 3], (px, py, 5.4), 3.5, 0.15, 1.4, segs=10)                              # chapéu-de-sol
    P.sphere("White", (px, py, 6.2), (0.22, 0.22, 0.22), segs=10, rings=8)
    col_cyl(x, z, 1.95, 1.3)


def booth(x, z, face):
    F = Frame(x, z, 0.0 if face > 0 else math.pi)
    P.rbox("BoothBack", F.pt(0, 0.7, 1.15), (12, 0.35, 2.3), rot=F.rot, radius=0.15, segs=2)
    P.rbox("Cushion", F.pt(0, 0, 0.7), (12, 1.5, 1.4), rot=F.rot, radius=0.35, segs=3)
    P.rbox("WoodDark", F.pt(0, 0, 0.12), (12.2, 1.6, 0.25), rot=F.rot, radius=0.06, segs=1)
    col_box(x, z, 12, 1.9, 1.5)


def pizza_oven(x, z):
    px, py = B(x, z)
    P.rbox("OvenDark", (px, py, 0.9), (6.4, 6.4, 1.8), radius=0.5)
    P.sphere("OvenBrick", (px, py, 1.8), (3.0, 3.0, 2.6), segs=32, rings=16)
    P.sphere("Black", (px, py - 2.6, 2.0), (1.35, 0.9, 1.25), segs=20, rings=12)              # boca do forno (virada a +z)
    P.sphere("Fire", (px, py - 2.8, 1.35), (0.7, 0.35, 0.5), segs=14, rings=8)
    P.cone("OvenDark", (px, py + 0.4, 5.2), 0.9, 0.7, 2.6, segs=18)                              # chaminé
    P.cone("OvenDark", (px, py + 0.4, 6.6), 1.05, 1.05, 0.35, segs=18)
    for k in range(3):
        P.sphere("Steam", (px + 0.3 * k, py + 0.4, 7.5 + k * 0.9), (0.55 + 0.1 * k, 0.55 + 0.1 * k, 0.45), segs=12, rings=8)
    col_cyl(x, z, 3.7, 5.0)


def pot(x, z, liquid):
    px, py = B(x, z)
    P.cone("Pot", (px, py, 1.0), 1.55, 1.5, 2.0, segs=32)
    P.cone("SteelDark", (px, py, 2.05), 1.7, 1.7, 0.18, segs=32)
    P.cone(liquid, (px, py, 2.0), 1.35, 1.35, 0.06, segs=28)
    for sx in (-1, 1):
        P.rbox("SteelDark", (px + sx * 1.8, py, 1.5), (0.55, 0.3, 0.2), radius=0.06, segs=1)
    P.sphere("Steam", (px, py, 2.9), (0.5, 0.5, 0.4), segs=10, rings=8)
    col_cyl(x, z, 1.85, 2.1)


def counter(x, z, w, d):
    RB("Steel", x, z, w, d, 1.75, r=0.1)
    RB("SteelTop", x, z, w + 0.25, d + 0.25, 0.16, r=0.05, z0=1.75)
    for k in range(int(d // 2.5)):
        P.rbox("SteelDark", (x + w / 2 + 0.02, -z - d / 2 + 1.25 + k * 2.5, 1.0), (0.06, 1.8, 1.0), radius=0.03, segs=1)
    col_box(x, z, w + 0.25, d + 0.25, 1.9)


def stove(x, z):
    RB("Steel", x, z, 2.2, 5.0, 1.8, r=0.15)
    for sz in (-1.2, 1.2):
        P.cone("Black", (x, -(z + sz), 1.83), 0.55, 0.55, 0.06, segs=20)
        P.cone("Fire", (x, -(z + sz), 1.9), 0.3, 0.3, 0.06, segs=12)
    RB("SteelTop", x, z, 2.5, 5.3, 0.55, r=0.1, z0=4.5)
    P.cone("SteelDark", (x, -z, 5.9), 0.55, 0.55, 2.0, segs=14)
    col_box(x, z, 2.2, 5.0, 1.9)


def fridge(x, z, color="Fridge"):
    RB(color, x, z, 2.4, 2.4, 4.3, r=0.3)
    P.rbox("Steel", (x - 1.25, -z - 0.5, 2.9), (0.1, 0.12, 1.0), radius=0.03, segs=1)
    P.rbox("Steel", (x - 1.25, -z - 0.5, 1.2), (0.1, 0.12, 0.8), radius=0.03, segs=1)
    P.box("SteelDark", (x, -z, 2.2), (2.45, 2.45, 0.05))
    col_box(x, z, 2.4, 2.4, 4.3)


def pizza_boxes(x, z, yaw=0.0):
    F = Frame(x, z, yaw)
    for k in range(4):
        off = ((k * 53) % 7 - 3) * 0.08
        P.rbox("Box", F.pt(off, 0, 0.3 + k * 0.6), (4.6, 4.6, 0.55), rot=(0, 0, yaw + off), radius=0.1, segs=2)
        P.rbox("BoxTop", F.pt(off, 0, 0.55 + k * 0.6), (4.4, 4.4, 0.06), rot=(0, 0, yaw + off), radius=0.02, segs=1)
    P.cone("Pepperoni", F.pt(0, 0, 2.43), 1.1, 1.1, 0.08, segs=20)                                # pizza desenhada na tampa
    col_box(x, z, 4.8 if abs(math.cos(yaw)) > 0.7 else 5.2, 4.8 if abs(math.cos(yaw)) > 0.7 else 5.2, 2.4)


def tomato_can(x, z):
    px, py = B(x, z)
    P.cone("Steel", (px, py, 1.6), 1.6, 1.6, 3.2, segs=32)
    P.cone("Tomato", (px, py, 1.6), 1.64, 1.64, 1.9, segs=32)
    P.cone("Label", (px, py, 1.6), 1.66, 1.66, 0.7, segs=32)
    P.sphere("Tomato", (px, py - 1.45, 1.6), (0.5, 0.06, 0.5), segs=14, rings=8)
    col_cyl(x, z, 1.65, 3.2)


def shaker(x, z, mat):
    px, py = B(x, z)
    P.lathe(mat, [(1.25, 0.0), (1.35, 0.6), (1.2, 3.0), (1.05, 4.6), (0.9, 5.0)], loc=(px, py, 0.0), segs=28, per_seg=4)
    P.sphere("Steel", (px, py, 5.2), (1.0, 1.0, 0.7), segs=20, rings=10)
    for k in range(5):
        P.sphere("Black", (px + (k - 2) * 0.28, py, 5.55), (0.07, 0.07, 0.07), segs=6, rings=4)
    col_cyl(x, z, 1.35, 5.8)


def floors():
    slab(color="TileCream", joints=False)
    for i in range(-10, 10):                                                              # xadrez da sala de jantar
        for j in range(-7, 7):
            if (i + j) % 2 == 0:
                cx, cz = i * 5 + 2.5, j * 5 + 2.5
                if abs(cx) > 14.5:
                    flat_rect("TileRed", cx, cz, 5.0, 5.0, 0.012)
    flat_rect("KTileA", 0, 0, 28.0, 70, 0.014)                                            # cozinha
    for i in range(8):
        for j in range(20):
            if (i + j) % 2 == 0:
                flat_rect("KTileB", -14 + 1.75 + i * 3.5, -35 + 1.75 + j * 3.5, 3.5, 3.5, 0.02)


def divider_walls():
    segs = [(-35, -28), (-20, -4), (4, 20), (28, 35)]
    for s in (1, -1):
        for (z0, z1) in segs:
            d, zc = z1 - z0, (z0 + z1) / 2
            RB("Cream", s * 14, zc, 1.2, d, 4.4, r=0.3)
            RB("Red", s * 14, zc, 1.5, d + 0.1, 0.35, r=0.1, z0=4.4)
            P.box("Joint", (s * 14 - s * 0.62, -zc, 1.0), (0.04, d * 0.9, 0.12))
            col_box(s * 14, zc, 1.2, d, 4.4)


def scenery():
    P.box("Sidewalk", (0, 0, -0.7), (1400, 1400, 1.0))
    for sz in (-1, 1):                                                                   # ruas ao norte e ao sul, com prédios
        P.box("Road", (0, sz * 52, -0.04), (500, 9, 0.12))
        for i in range(-12, 13):
            P.box("White", (i * 14.0, sz * 52, 0.03), (5, 0.35, 0.05))
        x = -150
        k = 0
        while x < 150:
            w = 14 + (k * 7) % 9
            h = 12 + (k * 11) % 20
            building(x + w / 2, -sz * 68, w, 16, h, "B%d" % (1 + k % 6), "RoofDark", face="+z" if sz > 0 else "-z", band=None)
            RB("Awning1" if k % 2 else "Orange", x + w / 2, -sz * 59.2, w * 0.8, 2.8, 0.5, r=0.15, z0=3.2)
            x += w + 1.5
            k += 1
        for i in range(-6, 7):
            px = i * 20.0
            P.cone("LampPole", (px, sz * 46, 3.5), 0.2, 0.14, 7.0, segs=10)
            P.sphere("Glow", (px, sz * 46, 7.3), (0.65, 0.65, 0.65), segs=14, rings=8)
    for k, (x, y) in enumerate([(-90, 52), (-40, 52), (10, 52), (60, 52), (100, 52), (-20, -52), (35, -52), (80, -52), (-80, -52)]):   # carros
        c = ["Car1", "Car2", "Car3", "Car4"][k % 4]
        P.rbox(c, (x, y, 0.9), (4.4, 2.1, 1.4), radius=0.5, segs=3)
        P.rbox("Glass", (x - 0.2, y, 1.9), (2.4, 1.9, 0.9), radius=0.3, segs=2)
        for wx in (-1.4, 1.4):
            for wy in (-1.0, 1.0):
                P.cone("Black", (x + wx, y + wy, 0.45), 0.45, 0.45, 0.3, rot=(rad(90), 0, 0), segs=14)
    for sx in (-1, 1):                                                                   # pizza gigante em cima de um poste
        px = sx * 70.0
        P.cone("LampPole", (px, 18, 8), 0.5, 0.5, 16, segs=12)
        P.cone("Cheese", (px, 18, 17.5), 6.5, 6.5, 0.8, rot=(rad(90), 0, 0), segs=40)
        P.cone("OvenBrick", (px, 18 - 0.3, 17.5), 7.0, 7.0, 0.5, rot=(rad(90), 0, 0), segs=40)
        for (dx, dz) in [(-2.5, 1.5), (2.0, 2.5), (0.5, -2.2), (-2.0, -2.0), (3.0, -0.8)]:
            P.cone("Pepperoni", (px + dx, 18 - 0.55, 17.5 + dz), 1.1, 1.1, 0.3, rot=(rad(90), 0, 0), segs=16)


def build():
    floors(); walls(mat="Cream", cap="Red", h=2.6); divider_walls(); scenery()
    pizza_oven(0, 0)
    pot(0, -13, "Red"); pot(0, 13, "Blue")
    for s in (1, -1):
        pot(s * 8, -6, "Yellow"); pot(s * 8, 6, "Green")
        counter(s * 5.5, -19, 2.4, 9); counter(s * 5.5, 19, 2.4, 9)
        stove(s * 12.2, -8); stove(s * 12.2, 8)
        fridge(s * 12.2, -31); fridge(s * 12.2, 31, "Sky")
        for k, (x, z) in enumerate([(24, -12), (24, 12), (24, -28), (24, 28), (32, -20), (32, 20), (32, 0)]):
            table(s * x, z, k + (0 if s > 0 else 2))
        booth(s * 22, -33.3, +1); booth(s * 22, 33.3, -1)
        pizza_boxes(s * 19, -22 + 8, rad(15) * s); pizza_boxes(s * 19, 22 - 8, -rad(15) * s)
        tomato_can(s * 8, -28); tomato_can(s * 8, 28)
        shaker(s * 40, -22, "Pepper"); shaker(s * 40, 22, "Salt")
        for (x, z) in [(16, -4), (16, 4), (38, -30), (38, 30)]:
            lamp(s * x, z, 5.4)
    patrol = [(8, -22), (8, 22), (20, -4), (20, 4), (28, -8), (28, 8), (40, -14), (40, 14), (0, -24), (0, 24)]
    exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_extras.py").read(), globals()); decorate(seed=2, wall_h=2.6, patrol=patrol)
    return finish_map("restaurante", patrol, OUTPUT)


objs = build()
