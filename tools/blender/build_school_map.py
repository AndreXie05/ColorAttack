"""
ColorAttack - mapa ESCOLA feito no Blender: um campus cartoon com material escolar gigante como cobertura
(lápis, livros empilhados, globo), campo de basquetebol ao centro, cacifos coloridos e pavilhões de aulas.
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/escola.glb"; exec(open(este_ficheiro).read())
"""
import math
import os
exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_kit.py").read())
OUTPUT = globals().get("OUTPUT")
PAINT_NAMES = ["Red", "Blue", "Yellow", "Purple", "Orange", "Green"]

MATERIALS.update({
    "FloorCream": 0xF6EEDF, "Court": 0x59B7EA, "CourtDark": 0x4BA6DB, "Line": 0xFFFFFF, "Pencil": 0xFFD84A, "PencilWood": 0xF2C48B,
    "Graphite": 0x3A3F55, "Eraser": 0xFF8FC0, "Ferrule": 0xB8C0D0, "BookRed": 0xFF5A66, "BookBlue": 0x4D8CFF, "BookGreen": 0x47CC63,
    "BookYellow": 0xFFD84A, "BookPurple": 0xA06BFF, "Pages": 0xFFF7E8, "Board": 0x2E7D6B, "BoardFrame": 0xC98E4A, "Globe": 0x4D8CFF,
    "Land": 0x6CD66A, "RoofRed": 0xFF5A66, "Pastel1": 0xFFD6A5, "Pastel2": 0xCAF0F8, "Pastel3": 0xFFC6D9, "Pastel4": 0xD4F1BE,
    "Road": 0x4A4F5A, "Sidewalk": 0xD9DDE6, "Bus": 0xFFD84A, "Hill": 0x7FDB74, "HillFar": 0x9BE3A0, "SchoolWall": 0xFFD9A8,
})
ROUGH.update({"Court": 0.5})


# ---------- adereços escolares ----------
def pencil(x, z, length, along, color="Pencil", sign=1):
    """Lápis gigante deitado. along = 'x' ou 'z' (direção do comprimento, em eixos do jogo)."""
    rot = (0, rad(90), 0) if along == "x" else (rad(90), 0, 0)          # eixo do cone -> X ou Y(=z do jogo)
    ux, uy = (sign, 0) if along == "x" else (0, -1)                       # direção do eixo em coordenadas do Blender (sign espelha a ponta)
    def at(t):                                                           # ponto a distância t do centro, ao longo do lápis
        return (x + ux * t, -z + uy * t, 1.15)
    P.cone(color, at(0), 1.15, 1.15, length, rot=rot, segs=6)
    P.cone("PencilWood", at(length / 2 + 1.3), 1.15, 0.14, 2.6, rot=rot, segs=6)                 # ponta de madeira
    P.cone("Graphite", at(length / 2 + 2.45), 0.45, 0.03, 0.9, rot=rot, segs=12)                  # grafite
    P.cone("Ferrule", at(-length / 2 - 0.3), 1.2, 1.2, 0.6, rot=rot, segs=16)                    # virola
    P.cone("Eraser", at(-length / 2 - 0.95), 1.05, 1.05, 0.9, rot=rot, segs=16)                  # borracha
    if along == "x":
        col_box(x + 0.5 * sign, z, length + 4.4, 2.4, 2.3)
    else:
        col_box(x, z - 0.5, 2.4, length + 4.4, 2.3)


def books(x, z, colors=("BookRed", "BookBlue", "BookGreen", "BookYellow"), yaw=0.0):
    F = Frame(x, z, yaw)
    z0 = 0.0
    for k, c in enumerate(colors):
        h = 0.75 + (k % 2) * 0.18
        w = 4.3 - (k % 3) * 0.35
        off = ((k * 37) % 5 - 2) * 0.12
        P.rbox(c, F.pt(off, 0, z0 + h / 2), (w, 3.0, h), rot=F.rot, radius=0.14, segs=2)
        P.rbox("Pages", F.pt(off, -0.15, z0 + h / 2), (w + 0.04, 2.9, h * 0.55), rot=F.rot, radius=0.05, segs=2)   # folhas
        z0 += h
    col_box(x, z, 4.4 if abs(math.cos(yaw)) > 0.5 else 3.1, 3.1 if abs(math.cos(yaw)) > 0.5 else 4.4, z0)


def globe(x, z):
    px, py = B(x, z)
    P.rbox("WoodDark", (px, py, 0.35), (3.4, 3.4, 0.7), radius=0.25)
    P.cone("Steel", (px, py, 1.2), 0.5, 0.35, 1.0, segs=16)
    P.sphere("Globe", (px, py, 3.4), (2.4, 2.4, 2.4), segs=32, rings=18)
    for (a, e, sx, sy) in [(0.3, 0.4, 0.9, 0.7), (1.8, -0.1, 1.0, 0.6), (3.3, 0.5, 0.8, 0.8), (4.6, -0.3, 0.9, 0.6), (5.6, 0.7, 0.6, 0.5)]:
        nx, ny, nz = math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)
        P.sphere("Land", (px + nx * 2.35, py + ny * 2.35, 3.4 + nz * 2.35), (sx, sy, 0.16), rot=(0, 0, a), segs=12, rings=8)
    pts = [(px + math.cos(t) * 2.75, py, 3.4 + math.sin(t) * 2.75) for t in [k * math.pi / 8 for k in range(-4, 13)]]
    P.tube("Steel", pts, [0.07] * len(pts), sides=8, per_seg=3)                                 # meridiano
    col_cyl(x, z, 2.7, 5.8)


def hoop(x, z, toward):
    """Cesto de basquetebol; toward = +1 ou -1 (lado do jogo para onde o aro aponta, em z)."""
    px, py = B(x, z)
    P.cone("Steel", (px, py, 2.4), 0.28, 0.22, 4.8, segs=14)
    P.rbox("White", (px, py - toward * 1.0, 4.5), (3.2, 0.2, 2.2), radius=0.1, segs=2)
    ring = [(px + math.cos(t) * 0.55, py - toward * 1.65 + math.sin(t) * 0.55, 3.9) for t in [k * math.pi / 8 for k in range(17)]]
    P.tube("Orange", ring, [0.05] * len(ring), sides=8, per_seg=2)
    col_cyl(x, z, 0.6, 5)


def lockers(x, z0, z1, face):
    """Fila de cacifos coloridos ao longo de z; face = +1 se a frente aponta para +x do jogo."""
    n = max(1, int(round((z1 - z0) / 1.35)))
    step = (z1 - z0) / n
    for i in range(n):
        zc = z0 + (i + 0.5) * step
        c = PAINT_NAMES[i % 6]
        RB(c, x, zc, 1.2, step - 0.06, 3.4, r=0.14)
        P.rbox("Steel", (x + face * 0.62, -zc + step * 0.25, 1.75), (0.1, 0.1, 0.55), radius=0.03, segs=1)       # puxador
        P.box("Black", (x + face * 0.605, -zc, 3.0), (0.04, step * 0.55, 0.14))                                   # ventilação
        P.box("Black", (x + face * 0.605, -zc, 0.35), (0.04, step * 0.55, 0.14))
    col_box(x, (z0 + z1) / 2, 1.2, z1 - z0, 3.4)


def bleacher(x, z, length, s):
    """Bancada de 3 degraus que sobe para longe do campo (s = +1 lado direito, -1 esquerdo)."""
    for k in range(3):
        RB("Stone", x + s * (k * 1.3), z, 1.3, length, 0.8 * (k + 1), r=0.12)
        RB("Blue" if k % 2 == 0 else "Red", x + s * (k * 1.3) - s * 0.0, z, 1.0, length * 0.96, 0.1, r=0.03, z0=0.8 * (k + 1))
    col_box(x + s * 1.3, z, 3.9, length, 2.4)


def classroom(x, z, w, d, h, wall, roof, face):
    building(x, z, w, d, h, wall, roof, face=face, rows=1, glass="Glass")
    bx, by = B(x, z)
    sgn = 1 if face[0] == "+" else -1
    if face[1] == "x":                                                          # porta virada para o campo
        P.rbox("WoodDark", (bx + sgn * (w / 2 + 0.07), by, 1.6), (0.2, 2.0, 3.2), radius=0.1, segs=2)
    col_box(x, z, w, d, h)


def planter_tree(x, z):
    px, py = B(x, z)
    P.cone("WoodDark", (px, py, 0.45), 2.3, 2.1, 0.9, segs=24)
    P.cone("Lawn", (px, py, 0.92), 2.0, 2.0, 0.06, segs=24)
    round_tree(x, z, 1.1)
    col_cyl(x, z, 2.3, 1.0)


# ---------- construção ----------
def floor():
    slab(color="FloorCream")
    flat_rect("Court", 0, 0, 30, 50, 0.014)                                      # campo
    for (cx, cz, w, d) in [(0, -24.8, 30, 0.35), (0, 24.8, 30, 0.35), (-14.8, 0, 0.35, 50), (14.8, 0, 0.35, 50), (0, 0, 30, 0.35)]:
        flat_rect("Line", cx, cz, w, d, 0.02)
    flat_disc("Line", 0, 0, 5.6, 0.022); flat_disc("Court", 0, 0, 5.25, 0.026)                    # círculo central
    for sz in (-1, 1):
        flat_disc("Line", 0, sz * 24.8, 5.2, 0.022); flat_disc("Court", 0, sz * 24.8, 4.85, 0.026)   # garrafões
    for s in (1, -1):                                                              # amarelinha no chão
        for k, (dx, dz) in enumerate([(0, 0), (0, 1.8), (0, 3.6), (-1, 5.4), (1, 5.4), (0, 7.2), (0, 9.0)]):
            flat_rect(["Yellow", "Pink", "Teal"][k % 3], s * 25 + dx * 0.95, -16 + dz, 1.7, 1.7, 0.022)


def scenery():
    P.box("Hill", (0, 0, -0.7), (1400, 1400, 1.0))                                # relvado à volta
    # edifício principal da escola com torre do relógio, ao fundo (norte do jogo = +y no Blender)
    building(0, -62, 100, 18, 14, "SchoolWall", "RoofRed", face="+z", rows=3, band="Pastel3")
    RB("White", 0, -52, 16, 5, 6.5, r=0.4)
    for sx in (-5, 5):
        CY("White", sx, -49.2, 0.7, 6.4)
    RB("SchoolWall", 0, -62, 12, 12, 14, r=0.5, z0=14)                              # torre
    P.cone("RoofRed", (0, 62, 31.5), 8.6, 0.1, 7.5, rot=(0, 0, rad(45)), segs=4)
    P.cone("White", (0, 55.9, 25.5), 3.0, 3.0, 0.5, rot=(rad(90), 0, 0), segs=32)    # relógio
    P.box("Black", (0, 55.55, 25.6), (0.3, 0.2, 2.2)); P.box("Black", (0.5, 55.55, 26.0), (1.2, 0.2, 0.3))
    for (x, z, w, d, h, wall, face) in [(80, -30, 30, 40, 12, "Pastel2", "-x"), (-80, -30, 30, 40, 12, "Pastel3", "+x"),
                                          (-110, 20, 24, 30, 10, "Pastel4", "+x"), (110, 20, 24, 30, 10, "Pastel1", "-x")]:
        building(x, z, w, d, h, wall, "RoofRed" if x > 0 else "Purple", face=face, rows=2)
    # rua ao sul com autocarro escolar e casas
    P.box("Road", (0, -49, -0.04), (400, 9, 0.12))
    for i in range(-10, 11):
        P.box("White", (i * 16.0, -49, 0.03), (5, 0.35, 0.05))
    P.box("Sidewalk", (0, -42.5, -0.04), (400, 3.2, 0.12))
    for (x, flip) in [(-40, 1), (55, -1)]:                                          # autocarros escolares
        P.rbox("Bus", (x, -50 - flip * 0.0, 2.1), (12, 3.4, 3.4), radius=0.9, segs=3)
        P.rbox("Glass", (x, -50 + 1.72, 2.8), (10.5, 0.1, 1.1), radius=0.1, segs=2)
        P.rbox("Glass", (x, -50 - 1.72, 2.8), (10.5, 0.1, 1.1), radius=0.1, segs=2)
        for wx in (-3.6, 3.6):
            for wy in (-1.5, 1.5):
                P.cone("Black", (x + wx, -50 + wy, 0.7), 0.75, 0.75, 0.5, rot=(rad(90), 0, 0), segs=16)
    for i in range(11):                                                              # casinhas atrás da rua
        x = -120 + i * 24
        building(x, 66, 11, 10, 8, ["Pastel1", "Pastel2", "Pastel3", "Pastel4"][i % 4], "RoofRed" if i % 2 else "Purple", face="-z", rows=1)
    for (x, z) in [(-70, -70), (70, -70), (-30, -76), (30, -76), (-95, -48), (95, -48), (-62, 62), (62, 62), (0, 80), (-100, 60), (100, 60)]:
        px, py = B(x, z)
        P.tube("Trunk", [(px, py, 0), (px, py, 3.2)], [0.55, 0.4], sides=10)
        P.sphere("Leaf1", (px, py, 4.5), (2.3, 2.3, 2.1), segs=16, rings=10)
        P.sphere("Leaf2", (px + 1.2, py, 3.8), (1.5, 1.5, 1.4), segs=14, rings=8)
    for (x, y, sx, sy, sz, m) in [(-230, 330, 170, 110, 70, "Hill"), (0, 360, 220, 120, 80, "HillFar"), (240, 320, 180, 110, 75, "Hill"),
                                  (-400, 150, 120, 120, 55, "HillFar"), (410, 120, 120, 100, 60, "Hill")]:
        P.sphere(m, (x, y, -10), (sx, sy, sz), segs=24, rings=12)


def build():
    floor(); walls(mat="SchoolWall", cap="RoofRed"); scenery()
    globe(0, 0)
    for s in (1, -1):
        for z in (-24.6, 24.6):
            hoop(0, z, +1 if z < 0 else -1) if s == 1 else None
        pencil(s * 28, -11, 10, "x", "Pencil", s)
        pencil(s * 28, 11, 10, "x", "Pencil", s)
        pencil(s * 21, 0, 8, "z", "Blue")
        books(s * 35, -15, ("BookRed", "BookBlue", "BookGreen", "BookYellow"))
        books(s * 35, 15, ("BookPurple", "BookYellow", "BookBlue", "BookGreen"), yaw=rad(90))
        books(s * 22, -17, ("BookGreen", "BookRed", "BookYellow"), yaw=rad(20) * s)
        books(s * 22, 17, ("BookBlue", "BookPurple", "BookRed"), yaw=-rad(20) * s)
        lockers(s * 46.4, -27, -12, -s)
        lockers(s * 46.4, 12, 27, -s)
        bleacher(s * 17.2, -9, 8, s); bleacher(s * 17.2, 9, 8, s)
        classroom(s * 29, -28.5, 16, 9, 4.6, "Pastel2" if s > 0 else "Pastel3", "RoofRed", "-x" if s > 0 else "+x")
        classroom(s * 29, 28.5, 16, 9, 4.6, "Pastel4" if s > 0 else "Pastel1", "Purple", "-x" if s > 0 else "+x")
        planter_tree(s * 10, -31); planter_tree(s * 10, 31)
        for (x, z) in [(12, -14), (12, 14), (24, -23), (24, 23)]:
            lamp(s * x, z)
    patrol = [(10, -12), (10, 12), (24, 0), (26, -20), (26, 20), (0, -16), (0, 16), (41, -15), (41, 15), (5, 0)]
    exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_extras.py").read(), globals()); decorate(seed=1, wall_h=2.4, patrol=patrol)
    return finish_map("escola", patrol, OUTPUT)


objs = build()
