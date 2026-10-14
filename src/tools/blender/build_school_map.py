"""
ColorAttack - mapa ESCOLA (estilo foto.png, com vários níveis): campo de basquetebol com um palco ao centro (globo),
bancadas que são escadas, pilhas de livros que formam uma "escada de saltos" (1,7 / 2,4 / 3,4 m), lápis gigantes
deitados por onde se anda (1,8 m), pavilhões com o telhado acessível por escadas (3,0 m), cacifos e quadros como cobertura.
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
MATERIALS.update({"PlatTop": 0xFFF6E6, "PlatSide": 0xEFCFA2, "Accent": 0xFFD84A, "RampTop": 0xF7EBD6, "RampGrip": 0xD9BE95,
                  "Desk": 0xF2B96B, "DeskLeg": 0x6B7690, "Chalk": 0x2E7D6B})


# ---------- adereços escolares ----------
def pencil(x, z, length, along, color="Pencil", sign=1, R=0.9):
    """Lápis gigante deitado (R = raio: o topo fica a 2R, dá para saltar para cima e andar ao longo dele)."""
    rot = (0, rad(90), 0) if along == "x" else (rad(90), 0, 0)          # eixo do cone -> X ou Y(=z do jogo)
    ux, uy = (sign, 0) if along == "x" else (0, -1)                       # direção do eixo em coordenadas do Blender (sign espelha a ponta)
    def at(t):                                                           # ponto a distância t do centro, ao longo do lápis
        return (x + ux * t, -z + uy * t, R)
    k = R / 1.15
    P.cone(color, at(0), R, R, length, rot=rot, segs=6)
    P.cone("PencilWood", at(length / 2 + 1.3 * k), R, 0.14, 2.6 * k, rot=rot, segs=6)             # ponta de madeira
    P.cone("Graphite", at(length / 2 + 2.45 * k), 0.45 * k, 0.03, 0.9 * k, rot=rot, segs=12)      # grafite
    P.cone("Ferrule", at(-length / 2 - 0.3), R + 0.05, R + 0.05, 0.6, rot=rot, segs=16)          # virola
    P.cone("Eraser", at(-length / 2 - 0.95), R - 0.1, R - 0.1, 0.9, rot=rot, segs=16)            # borracha
    if along == "x":                                                                     # só o corpo é plano por cima (a ponta é baixa)
        col_box(x, z, length + 1.2, 1.6, 2 * R, paint=True)
        col_box(x + sign * (length / 2 + 1.3 * k), z, 2.6 * k, 1.2, R)
    else:
        col_box(x, z, 1.6, length + 1.2, 2 * R, paint=True)


def books(x, z, colors=("BookRed", "BookBlue", "BookGreen", "BookYellow"), yaw=0.0):
    """Pilha de livros: cada livro tem 0,75 ou 0,93 m (2 livros = 1,7 m, 3 = 2,4 m, 4 = 3,4 m). Dá para subir de pilha em pilha."""
    F = Frame(x, z, yaw)
    z0 = 0.0
    for k, c in enumerate(colors):
        h = 0.75 + (k % 2) * 0.18
        w = 4.3 - (k % 3) * 0.35
        off = ((k * 37) % 5 - 2) * 0.12
        P.rbox(c, F.pt(off, 0, z0 + h / 2), (w, 3.0, h), rot=F.rot, radius=0.14, segs=2)
        P.rbox("Pages", F.pt(off, -0.15, z0 + h / 2), (w + 0.04, 2.9, h * 0.55), rot=F.rot, radius=0.05, segs=2)   # folhas
        z0 += h
    col_box(x, z, 4.4 if abs(math.cos(yaw)) > 0.5 else 3.1, 3.1 if abs(math.cos(yaw)) > 0.5 else 4.4, z0, paint=True)


def globe(x, z, z0=0.0):
    px, py = B(x, z)
    P.rbox("WoodDark", (px, py, z0 + 0.35), (3.4, 3.4, 0.7), radius=0.25)
    P.cone("Steel", (px, py, z0 + 1.2), 0.5, 0.35, 1.0, segs=16)
    P.sphere("Globe", (px, py, z0 + 3.4), (2.4, 2.4, 2.4), segs=32, rings=18)
    for (a, e, sx, sy) in [(0.3, 0.4, 0.9, 0.7), (1.8, -0.1, 1.0, 0.6), (3.3, 0.5, 0.8, 0.8), (4.6, -0.3, 0.9, 0.6), (5.6, 0.7, 0.6, 0.5)]:
        nx, ny, nz = math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)
        P.sphere("Land", (px + nx * 2.35, py + ny * 2.35, z0 + 3.4 + nz * 2.35), (sx, sy, 0.16), rot=(0, 0, a), segs=12, rings=8)
    pts = [(px + math.cos(t) * 2.75, py, z0 + 3.4 + math.sin(t) * 2.75) for t in [k * math.pi / 8 for k in range(-4, 13)]]
    P.tube("Steel", pts, [0.07] * len(pts), sides=8, per_seg=3)                                 # meridiano
    col_cyl(x, z, 2.7, z0 + 5.8)


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


def bleacher(x, z, length, s, h=1.6):
    """Bancada = escada de degraus de 0,4 m que sobe para longe do campo (s = +1 lado direito, -1 esquerdo)."""
    stairs(x, z, 4.0, length, "x", h, up=s)
    for k in range(4):                                                         # assentos coloridos
        RB("Blue" if k % 2 == 0 else "Red", x + s * (-1.5 + k), z, 0.7, length * 0.9, 0.06, r=0.02, z0=h * (k + 1) / 4, segs=1)


def classroom(x, z, w, d, h, wall, face):
    """Pavilhão de aulas baixo com o telhado plano acessível (por uma escada encostada)."""
    RB(wall, x, z, w, d, h - 0.2, r=0.3, segs=2)
    RB("PlatTop", x, z, w + 0.4, d + 0.4, 0.2, r=0.08, z0=h - 0.2, segs=1)
    RB("Accent", x, z, w + 0.3, d + 0.3, 0.3, r=0.06, z0=h - 0.6, segs=1)
    sgn = 1 if face[0] == "+" else -1
    bx, by = B(x, z)
    for i in range(int(d // 3)):                                                # janelas e porta viradas para o campo
        u = -d / 2 + (i + 0.5) * d / int(d // 3)
        P.rbox("Glass", (bx + sgn * (w / 2 + 0.05), by - u, 1.7), (0.15, 1.8, 1.4), radius=0.1, segs=1)
    col_box(x, z, w, d, h, paint=True)


def desk(x, z, yaw=0.0):
    """Carteira gigante (1,1 m): cobertura baixa para saltar por cima."""
    F = Frame(x, z, yaw)
    P.rbox("Desk", F.pt(0, 0, 1.0), (3.2, 1.8, 0.2), rot=F.rot, radius=0.06, segs=1)
    for (lx, ly) in [(-1.4, -0.7), (1.4, -0.7), (-1.4, 0.7), (1.4, 0.7)]:
        P.rbox("DeskLeg", F.pt(lx, ly, 0.45), (0.14, 0.14, 0.9), rot=F.rot, radius=0.03, segs=1)
    P.rbox("DeskLeg", F.pt(0, 0, 0.5), (3.0, 0.08, 0.7), rot=F.rot, radius=0.02, segs=1)       # painel (tapa os tiros por baixo)
    col_box(x, z, 3.2 if abs(math.cos(yaw)) > 0.7 else 1.8, 1.8 if abs(math.cos(yaw)) > 0.7 else 3.2, 1.1, paint=True)


def chalkboard(x, z, d=6.0):
    """Quadro de ardósia de pé (3,2 m): cobertura alta."""
    RB("BoardFrame", x, z, 0.5, d, 3.4, r=0.1, segs=1)
    for sgn in (-1, 1):
        RB("Chalk", x + sgn * 0.26, z, 0.05, d - 0.5, 2.4, r=0.02, z0=0.6, segs=1)
    col_box(x, z, 0.5, d, 3.4)


def planter_tree(x, z):
    px, py = B(x, z)
    P.cone("WoodDark", (px, py, 0.45), 2.3, 2.1, 0.9, segs=24)
    P.cone("Lawn", (px, py, 0.92), 2.0, 2.0, 0.06, segs=24)
    round_tree(x, z, 1.1)
    col_cyl(x, z, 2.3, 1.0)                                                       # (a borda do vaso dá para subir)


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
    # palco ao centro do campo (1,2 m) com o globo; rampas para as duas equipas
    platform(0, 0, 10, 10, 1.2)
    globe(0, 0, 1.2)
    hoop(0, -24.6, +1); hoop(0, 24.6, -1)
    for s in (1, -1):
        ramp(s * 7.5, 0, 5, 5, "x", *((1.2, 0.0) if s > 0 else (0.0, 1.2)))
        for sz in (1, -1):
            pencil(s * 28, sz * 11, 10, "x", "Pencil" if sz > 0 else "Blue", s)          # anda-se por cima (1,8 m)
            bleacher(s * 15, sz * 18.5, 6, s)                                        # bancada-escada até 1,6 m
            platform(s * 19.5, sz * 18.5, 5, 6, 1.6)                                 # topo da bancada
            books(s * 24, sz * 19, ("BookRed", "BookBlue", "BookGreen"))           # 2,4 m (a partir da bancada)
            books(s * 28.4, sz * 19, ("BookPurple", "BookYellow", "BookBlue", "BookGreen"))   # 3,4 m
            books(s * 33, sz * 18, ("BookGreen", "BookRed"), yaw=rad(90))          # 1,7 m
            classroom(s * 30, sz * 29, 14, 8, 3.0, "Pastel2" if sz > 0 else "Pastel3", "-x" if s > 0 else "+x")
            stairs(s * 21.5, sz * 29, 3, 5, "x", 3.0, up=s)                           # escada para o telhado
            desk(s * 11, sz * 7); desk(s * 6, sz * 15, rad(90))
            desk(s * 34, sz * 13.5)
            chalkboard(s * 38.5, sz * 20)
            lockers(s * 46.4, sz * 12 if sz > 0 else -27, 27 if sz > 0 else -12, -s)
            planter_tree(s * 10, sz * 31)
            lamp(s * 13, sz * 13); lamp(s * 18, sz * 25)
    patrol = [(8, 0), (12, -11), (12, 11), (0, -16), (0, 16), (19.5, -18.5), (19.5, 18.5), (28, -11), (28, 11), (26, 0),
              (33, -22), (33, 22), (19, -29), (19, 29), (40, -15), (40, 15)]
    exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_extras.py").read(), globals()); decorate(seed=1, wall_h=2.4, patrol=patrol)
    return finish_map("escola", patrol, OUTPUT)


objs = build()
