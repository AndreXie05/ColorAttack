"""
ColorAttack - mapa CIDADE NEON (à noite): ruas escuras, letreiros de néon, arranha-céus iluminados à volta. Ideias de altura:
  - PLATAFORMAS DO METRO elevadas (5 m: acima da câmara, para não taparem a vista) de cada lado, com muretes de vidro (cobertura) e escadas nas pontas;
    passa-se por baixo delas (as ruas atravessam-nas).
  - TELHADOS dos edifícios (3,2 m: ARCADE, KARAOKE, RAMEN, CINEMA) com o letreiro a servir de cobertura:
    sobe-se pela escada de mão (lado da base) ou pelo PAD DE SALTO de néon ao lado.
  - Ao centro, um PEDESTAL (1 m) com um holograma de uma gota de tinta a rodar por cima.
  - Táxis e carros (1,45 m, sobe-se a saltar), carrinhas de comida e barreiras de betão como cobertura.
O néon brilha no jogo: as peças com material "Tube…" ganham um halo e os marcadores Glow_n (glow_pool) dão manchas de luz
no chão (src/visual/neon-glow.js). Materiais "Lit…"/"Win…" brilham sem halo (letras, ecrãs, janelas).
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/neon.glb"; exec(open(este_ficheiro).read())
  ou:  blender -b --python-expr 'OUTPUT="/home/andrexie/Documents/ColorAttack/assets/maps/neon.glb"; exec(open("/home/andrexie/Documents/ColorAttack/src/tools/blender/build_neon_map.py").read())'
Animações (lidas pelo jogo): Anim_SkyHolo (gira), Anim_Train_n (anda), Anim_Blimp (flutua), Anim_Blink_n (pisca), Anim_SkySpin_n (gira).
"""
import math
import os
import random
exec(open("/home/andrexie/Documents/ColorAttack/src/tools/blender/map_kit.py").read())
OUTPUT = globals().get("OUTPUT")

DARK = 0x1A1826                                       # cor de base dos materiais que brilham (a cor vem da emissão)
NEON = {"Pink": 0xFF3FD8, "Cyan": 0x2BF0FF, "Purple": 0xB45CFF, "Yellow": 0xFFE14D, "Green": 0x4DFF8A, "Orange": 0xFF8A2A, "Red": 0xFF3355, "Blue": 0x4D7BFF}
for _n, _c in NEON.items():
    MATERIALS["Tube" + _n] = DARK; EMISSIVE["Tube" + _n] = (_c, 1.0)          # tubos de néon (com halo no jogo)
    MATERIALS["Lit" + _n] = DARK; EMISSIVE["Lit" + _n] = (_c, 1.0)            # letras e ecrãs (sem halo)
MATERIALS.update({"LitWhite": DARK, "WinWarm": DARK, "WinCool": DARK, "WinPink": DARK, "RedLight": DARK})
EMISSIVE.update({"LitWhite": (0xEAF2FF, 1.0), "WinWarm": (0xFFC977, 0.85), "WinCool": (0x8ED8FF, 0.75), "WinPink": (0xFF9BE0, 0.75), "RedLight": (0xFF2A3A, 1.0)})
MATERIALS.update({
    "Sidewalk": 0x585273, "Asphalt": 0x302D42, "Zebra": 0xC9CADB, "CurbStone": 0x6E6990, "NWall": 0x3E3958, "NWallCap": 0x2A2640,
    "Plinth": 0x2E2847, "PlinthTop": 0x4A4370, "Bldg1": 0x2E3150, "Bldg2": 0x3B3058, "Bldg3": 0x26354F, "Bldg4": 0x45395E, "Roof": 0x1F1D30,
    "ShopWall": 0x4B4470, "ShopTrim": 0x2A2640, "Board": 0x15131F, "Glass2": 0x6F8FE8, "Deck": 0x4E5274, "DeckTop": 0x666B92,
    "Taxi": 0xFFC83A, "CarPurple": 0x8A4DFF, "CarTeal": 0x2FC8C0, "CarDark": 0x1E1E2A, "Truck1": 0xFF6FA8, "Truck2": 0x5AD2FF,
    "Track": 0x5C6185, "TrainBody": 0xDDE2F2, "Blimp": 0xC9CEE6, "CityGround": 0x1C1A2A, "CityRoad": 0x252336, "Dumpster": 0x2F8F6A,
    "Pole": 0x2A2838, "Joint": 0x4D4869,
})
ROUGH.update({"Asphalt": 0.75, "Sidewalk": 0.85, "Glass2": 0.1, "Taxi": 0.35, "CarPurple": 0.35, "CarTeal": 0.35, "TrainBody": 0.3, "Blimp": 0.5, "Board": 0.6})
# aspeto das plataformas/rampas/muretes deste mapa (ver map_kit.LOOK)
MATERIALS.update({"PlatTop": 0x6A6694, "PlatSide": 0x403B5E, "PlatTrim": 0x2A2640, "Accent": 0xFF3FD8, "RampTop": 0x5E5A85, "RampGrip": 0x2BF0FF})
NLOOK = {"top": "DeckTop", "side": "Deck", "accent": "Glass2"}


# ---------- utilitários ----------
def tube(mat, pts, r=0.07, sides=8, per_seg=1):
    """Tubo de néon pelos pontos (x, z, y) do jogo."""
    P.tube(mat, [(x, -z, y) for (x, z, y) in pts], [r] * len(pts), sides=sides, per_seg=per_seg)


def text3d(mat, s, x, z, y, size, face, depth=0.1, part=None):
    """Letras 3D (x, z do jogo; y = altura do centro); face = para onde as letras olham ('+x', '-x', '+z', '-z')."""
    cu = bpy.data.curves.new("_txt", "FONT")
    cu.body = s; cu.size = size; cu.extrude = depth / 2; cu.align_x = "CENTER"; cu.align_y = "CENTER"; cu.resolution_u = 2
    ob = bpy.data.objects.new("_txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    tmp = bmesh.new(); tmp.from_mesh(ev.to_mesh()); ev.to_mesh_clear()
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    yaw = {"+z": 0.0, "-z": math.pi, "+x": rad(90), "-x": -rad(90)}[face]
    bmesh.ops.transform(tmp, matrix=xform((x, -z, y), (rad(90), 0, yaw)), verts=tmp.verts)
    (part or P)._add(tmp, mat, smooth=False)


def face_off(face, w, d, gap=0.08):
    """Deslocamento (x, z do jogo) do centro de uma caixa w x d até à sua face."""
    return {"+z": (0, d / 2 + gap), "-z": (0, -d / 2 - gap), "+x": (w / 2 + gap, 0), "-x": (-w / 2 - gap, 0)}[face]


def sign(text, x, z, y, face, length, height, tube_mat, lit_mat, size=None, solid=None):
    """Letreiro: placa escura, moldura de tubo de néon e letras acesas. solid = (bottom, top) torna a placa uma cobertura."""
    along_x = face[1] == "z"
    w, d = (length, 0.3) if along_x else (0.3, length)
    RB("Board", x, z, w, d, height, r=0.06, z0=y - height / 2, segs=1)
    ox, oz = face_off(face, w, d, 0.02)
    hl, hh = length / 2 - 0.12, height / 2 - 0.12
    if along_x:
        corners = [(x - hl, z + oz, y - hh), (x + hl, z + oz, y - hh), (x + hl, z + oz, y + hh), (x - hl, z + oz, y + hh), (x - hl, z + oz, y - hh)]
    else:
        corners = [(x + ox, z - hl, y - hh), (x + ox, z + hl, y - hh), (x + ox, z + hl, y + hh), (x + ox, z - hl, y + hh), (x + ox, z - hl, y - hh)]
    for a, b in zip(corners[:-1], corners[1:]):
        tube(tube_mat, [a, b], r=0.07)
    text3d(lit_mat, text, x + ox * 1.6, z + oz * 1.6, y - 0.02, size or height * 0.62, face)
    if solid:
        col_box(x, z, w, d, solid[1], bottom=solid[0])


# ---------- chão ----------
def floors():
    slab(color="Sidewalk", joints=True, tile=5.0)
    for sz in (-1, 1):                                                         # duas avenidas ao longo de x
        zc = sz * 16.0
        flat_rect("Asphalt", 0, zc, 100, 9.0, 0.014)
        for e in (-1, 1):
            flat_rect("CurbStone", 0, zc + e * 4.6, 100, 0.25, 0.016)
        for i in range(-12, 13):                                               # traço amarelo no meio (aceso)
            if abs(i * 4.0) < 11 or abs(i * 4.0) > 47:
                continue
            flat_rect("LitYellow", i * 4.0, zc, 2.0, 0.18, 0.024)
        for sx in (-1, 1):                                                     # passadeiras perto da praça
            for k in range(7):
                flat_rect("Zebra", sx * 9.0, zc - 3.6 + k * 1.2, 2.6, 0.6, 0.02)
    for sx in (-1, 1):                                                         # rua ao longo de z junto às bases
        flat_rect("Asphalt", sx * 27.0, 0, 7.0, 23.0, 0.014)
        for k in range(-2, 3):
            flat_rect("LitYellow", sx * 27.0, k * 4.0, 0.18, 2.0, 0.024)
    # praça central: lajes, anéis de luz no chão e raios
    flat_disc("Plinth", 0, 0, 10.0, top=0.014, segs=64)
    for r, m in ((9.6, "LitCyan"), (6.2, "LitPink")):
        n = 48 if r > 8 else 32
        for k in range(n):
            a = k * 2 * math.pi / n
            P.box(m, (math.cos(a) * r, math.sin(a) * r, 0.026), (0.22, 2 * math.pi * r / n * 0.82, 0.02), rot=(0, 0, a))
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        P.box("LitPurple", (math.cos(a) * 7.9, math.sin(a) * 7.9, 0.027), (2.6, 0.16, 0.02), rot=(0, 0, a))


def outer_walls():
    walls(mat="NWall", cap="NWallCap", h=2.6)
    hx, hz = 50.0, 35.0
    for (a, b, m) in [((-hx, hz - 0.05), (hx, hz - 0.05), "TubePurple"), ((-hx, -hz + 0.05), (hx, -hz + 0.05), "TubePurple"),
                      ((hx - 0.05, -hz), (hx - 0.05, hz), "TubeCyan"), ((-hx + 0.05, -hz), (-hx + 0.05, hz), "TubeCyan")]:
        tube(m, [(a[0], a[1], 2.2), (b[0], b[1], 2.2)], r=0.07)               # faixa de néon no lado de dentro dos muros


# ---------- centro: pedestal e holograma ----------
def drop_curve(cx, cy, w, h, n=28, plane="x"):
    pts = []
    for i in range(n + 1):
        t = 2 * math.pi * i / n
        u = math.sin(t) * abs(math.sin(t / 2)) ** 1.4 * w
        v = cy + math.cos(t) * h
        pts.append((cx + u, 0.0, v) if plane == "x" else (cx, u, v))
    return pts


def center():
    CY("Plinth", 0, 0, 3.0, 0.85, segs=40)
    CY("PlinthTop", 0, 0, 3.08, 0.15, z0=0.85, segs=40)
    tube("TubeCyan", [(math.cos(a) * 3.1, math.sin(a) * 3.1, 0.6) for a in [k * 2 * math.pi / 24 for k in range(25)]], r=0.07)
    col_cyl(0, 0, 3.05, 1.0, paint=1)
    holo = anim("SkyHolo", 0, 0, 5.0, kind="spin", axis="z", speed=0.7)
    for plane, m in (("x", "TubePink"), ("y", "TubeCyan")):
        pts = drop_curve(0, 4.9, 1.7, 2.3, plane=plane)
        holo.tube(m, [Vector(p) for p in pts], [0.09] * len(pts), sides=8, per_seg=2)
        pts = drop_curve(0, 4.75, 1.05, 1.45, plane=plane)
        holo.tube("TubeYellow" if plane == "x" else "TubePurple", [Vector(p) for p in pts], [0.06] * len(pts), sides=6, per_seg=2)
    for k in range(3):                                                        # anéis à volta
        r = 2.6 + k * 0.4
        pts = [Vector((math.cos(a) * r, math.sin(a) * r, 3.0 + k * 0.9 + 0.35 * math.sin(a * 2 + k))) for a in [j * 2 * math.pi / 24 for j in range(25)]]
        holo.tube(["TubeCyan", "TubePink", "TubePurple"][k], pts, [0.045] * len(pts), sides=6, per_seg=1)
    glow_pool(0, 0, 7.0, 0xB45CFF)


# ---------- metro elevado ----------
DECK = 5.0                                                                     # altura do passeio do metro
def metro(s):
    x = s * 18.0
    bridge(x, 0, 4.0, 44.0, DECK, look=NLOOK)
    for sz in (-1, 1):
        stairs(x, sz * 26.5, 4.0, 9.0, "z", DECK, up=-sz, look=NLOOK)
        for zz in (8.0, 19.0):                                                  # pilares
            CY("Pole", x, sz * zz, 0.45, DECK - 0.6, segs=14)
            CY("TubeCyan", x, sz * zz, 0.5, 0.12, z0=2.2, segs=14)
            col_cyl(x, sz * zz, 0.5, DECK - 0.6)
        for e in (-1, 1):                                                      # tubo de néon por cima dos muretes de vidro
            tube("TubePink" if s > 0 else "TubeCyan", [(x + e * 1.85, sz * 22.0, DECK + 0.85), (x + e * 1.85, 0, DECK + 0.85)], r=0.06)
        for e in (-1, 1):                                                      # placa por cima do topo da escada
            CY("Pole", x + e * 1.9, sz * 22.6, 0.08, 3.5, z0=DECK, segs=6)
        sign("METRO", x, sz * 22.6, DECK + 3.4, "+z" if sz > 0 else "-z", 3.6, 1.1, "TubeYellow", "LitYellow")
        glow_pool(x, sz * 24.0, 3.2, 0xFFE14D)
    glow_pool(x, 0, 4.5, 0xFF3FD8 if s > 0 else 0x2BF0FF)


# ---------- edifícios com letreiro no telhado ----------
SHOPS = {(1, 1): ("ARCADE", "Pink"), (1, -1): ("KARAOKE", "Cyan"), (-1, 1): ("RAMEN", "Orange"), (-1, -1): ("CINEMA", "Purple")}


def shop(s, sz):
    name, col = SHOPS[(s, sz)]
    x, z, w, d, h = s * 31.0, sz * 27.0, 10.0, 7.0, 3.2
    RB("ShopWall", x, z, w, d, h - 0.2, r=0.15, segs=1)
    RB("ShopTrim", x, z, w + 0.2, d + 0.2, 0.25, r=0.05, z0=h - 0.25, segs=1)
    col_box(x, z, w, d, h, paint=True)
    front = "-z" if sz > 0 else "+z"                                           # fachada virada para a avenida
    fz = z - sz * (d / 2 + 0.06)
    RB("Lit" + col, x, fz, 2.2, 0.1, 2.3, r=0.04, segs=1)                       # porta acesa
    for u in (-3.3, 3.3):                                                      # montras
        RB("Glass2", x + u, fz, 2.6, 0.1, 1.6, r=0.04, z0=0.7, segs=1)
        RB("Lit" + col, x + u, fz - sz * 0.02, 2.6, 0.06, 0.1, r=0.01, z0=0.6, segs=1)
    tube("Tube" + col, [(x - w / 2, fz - sz * 0.05, 2.75), (x + w / 2, fz - sz * 0.05, 2.75)], r=0.07)
    # letreiro em cima do telhado, na borda da fachada: cobertura de quem está no telhado
    sign(name, x, z - sz * (d / 2 - 0.3), h + 1.05, front, 8.6, 1.5, "Tube" + col, "Lit" + col, solid=(h, h + 1.8))
    ladder(s * (31.0 + w / 2), z, h, s, 0)                                     # escada de mão do lado da base
    glow_pool(x, z - sz * 6.0, 5.5, NEON[col])


def jump_pad(x, z, col):
    trampoline(x, z, bounce=15.0, r=1.3)
    tube("Tube" + col, [(x + math.cos(a) * 1.35, z + math.sin(a) * 1.35, 0.42) for a in [k * 2 * math.pi / 16 for k in range(17)]], r=0.06)
    glow_pool(x, z, 2.6, NEON[col])


# ---------- carros, carrinhas, barreiras, paragens ----------
def car(x, z, body, yaw=0.0, under=0x2BF0FF, taxi=False):
    F = Frame(x, z, yaw)
    P.rbox(body, F.pt(0, 0, 0.7), (4.4, 2.0, 0.75), rot=F.rot, radius=0.3, segs=2)
    P.rbox(body, F.pt(-0.2, 0, 1.2), (2.4, 1.8, 0.6), rot=F.rot, radius=0.28, segs=2)
    P.rbox("Glass2", F.pt(-0.2, 0, 1.22), (2.2, 1.84, 0.42), rot=F.rot, radius=0.18, segs=1)
    for lx in (-1.4, 1.4):
        for ly in (-1.0, 1.0):
            P.cone("Rubber", F.pt(lx, ly, 0.38), 0.38, 0.38, 0.3, rot=(rad(90), 0, F.yaw), segs=12)
    for ly in (-0.65, 0.65):
        P.rbox("LitWhite", F.pt(2.2, ly, 0.75), (0.08, 0.4, 0.16), rot=F.rot, radius=0.02, segs=1)    # faróis
        P.rbox("LitRed", F.pt(-2.2, ly, 0.75), (0.08, 0.4, 0.14), rot=F.rot, radius=0.02, segs=1)
    if taxi:
        P.rbox("LitYellow", F.pt(-0.2, 0, 1.6), (0.8, 0.4, 0.22), rot=F.rot, radius=0.05, segs=1)
    long_x = abs(math.cos(yaw)) > 0.7
    col_box(x, z, 4.4 if long_x else 2.1, 2.1 if long_x else 4.4, 1.45, paint=True)
    glow_pool(x, z, 2.8, under)                                                # luz por baixo do carro


def food_truck(x, z, body, label, col, face):
    RB(body, x, z, 6.4, 2.8, 2.2, r=0.3, z0=0.4, segs=2)
    RB("CarDark", x, z, 6.0, 2.6, 0.4, r=0.1, segs=1)
    for lx in (-2.2, 2.2):
        for e in (-1, 1):
            P.cone("Rubber", (x + lx, -(z + e * 1.3), 0.4), 0.4, 0.4, 0.3, rot=(rad(90), 0, 0), segs=12)
    oz = face * 1.45
    RB("Board", x - 0.4, z + oz, 3.6, 0.06, 1.0, r=0.03, z0=1.3, segs=1)     # janela de servir
    RB("Lit" + col, x - 0.4, z + oz * 1.01, 3.6, 0.04, 0.1, r=0.01, z0=1.25, segs=1)
    text3d("Lit" + col, label, x - 0.4, z + face * 1.5, 1.8, 0.55, "+z" if face > 0 else "-z")
    tube("Tube" + col, [(x - 3.2, z + oz, 2.62), (x + 3.2, z + oz, 2.62)], r=0.06)
    col_box(x, z, 6.4, 2.8, 2.6)
    glow_pool(x, z + face * 3.0, 3.4, NEON[col])


def barrier(x, z, w, d, col):
    low_wall(x, z, w, d, h=1.1, look={"side": "CurbStone", "top": "PlinthTop"})
    if w > d:
        tube("Tube" + col, [(x - w / 2 + 0.2, z, 0.75), (x + w / 2 - 0.2, z, 0.75)], r=0.05)
    else:
        tube("Tube" + col, [(x, z - d / 2 + 0.2, 0.75), (x, z + d / 2 - 0.2, 0.75)], r=0.05)


def bus_stop(x, z, face, col):
    """Paragem: painel publicitário aceso (cobertura), banco e telhado (só visual, alto)."""
    RB("Board", x, z, 4.2, 0.3, 2.3, r=0.05, segs=1)
    RB("Lit" + col, x, z + face * 0.17, 3.6, 0.04, 1.7, r=0.03, z0=0.35, segs=1)
    RB("Glass2", x, z + face * 1.0, 4.4, 2.2, 0.08, r=0.03, z0=2.7, segs=1)
    for u in (-2.0, 2.0):
        CY("Pole", x + u, z + face * 1.9, 0.07, 2.7, segs=6)
    RB("Pole", x, z + face * 0.6, 3.0, 0.6, 0.5, r=0.05, segs=1)
    col_box(x, z, 4.2, 0.4, 2.3)
    glow_pool(x, z + face * 1.4, 2.6, NEON[col])


def street_lamp(x, z, col="Cyan"):
    CY("Pole", x, z, 0.14, 5.6, segs=8)
    P.tube("Pole", [(x, -z, 5.5), (x + 0.3, -z, 6.0), (x + 1.2, -z, 6.1)], [0.08, 0.08, 0.08], sides=6, per_seg=2)
    RB("LitWhite", x + 1.3, z, 0.9, 0.4, 0.12, r=0.04, z0=5.95, segs=1)
    CY("Tube" + col, x, z, 0.16, 0.5, z0=2.0, segs=8)
    col_cyl(x, z, 0.25, 6.0)
    glow_pool(x + 1.3, z, 3.4, 0xBFD8FF)


def neon_palm(x, z, col):
    palm(x, z, s=0.9, lean=0.7, yaw=rad(30))
    for k in range(3):
        CY("Tube" + col, x + 0.05 * k, z, 0.5 - k * 0.05, 0.1, z0=1.0 + k * 1.6, segs=10)
    glow_pool(x, z, 2.4, NEON[col])


def street_arch(x, col_a, col_b):
    for sz in (-1, 1):
        zc = sz * 16.0
        for e in (-1, 1):
            CY("Pole", x, zc + e * 4.9, 0.22, 3.4, segs=10)
            col_cyl(x, zc + e * 4.9, 0.3, 4.0)
        for k, (m, r) in enumerate(((col_a, 4.9), (col_b, 4.4))):
            pts = [(x, zc + r * math.cos(t), 3.3 + 2.9 * (r / 4.9) * math.sin(t)) for t in [j * math.pi / 14 for j in range(15)]]
            tube(m, pts, r=0.08 if k == 0 else 0.06)
        glow_pool(x, zc, 4.0, NEON[col_a[4:]])


def dumpster(x, z, yaw=0.0):
    F = Frame(x, z, yaw)
    P.rbox("Dumpster", F.pt(0, 0, 0.65), (2.6, 1.5, 1.3), rot=F.rot, radius=0.08, segs=1)
    P.rbox("CarDark", F.pt(0, 0, 1.35), (2.7, 1.6, 0.12), rot=F.rot, radius=0.04, segs=1)
    long_x = abs(math.cos(yaw)) > 0.7
    col_box(x, z, 2.7 if long_x else 1.6, 1.6 if long_x else 2.7, 1.4, paint=True)


def string_lights():
    """Fios de luzes por cima dos muros compridos (como as bandeirinhas dos outros mapas)."""
    cols = ["LitPink", "LitCyan", "LitYellow", "LitPurple"]
    n = 0
    for y in (35.65, -35.65):
        xs = [-50, -25, 0, 25, 50]
        for x in xs:
            P.cone("Pole", (x, y, 2.86 + 1.8), 0.12, 0.09, 3.6, segs=8)
        for (x0, x1) in zip(xs[:-1], xs[1:]):
            pts = [(x0 + (x1 - x0) * i / 10, y, 6.3 - 4 * 1.1 * (i / 10) * (1 - i / 10)) for i in range(11)]
            P.tube("Pole", pts, [0.035] * len(pts), sides=5, per_seg=1)
            for i in range(1, 16):
                u = i / 16
                P.sphere(cols[(n + i) % 4], (x0 + (x1 - x0) * u, y, 6.3 - 4 * 1.1 * u * (1 - u) - 0.2), (0.16, 0.16, 0.2), segs=8, rings=5)
            n += 1


# ---------- a cidade lá fora ----------
def quad(mat, face, cx, cz, y, length, height):
    """Painel plano (2 triângulos) virado para `face`, centrado em (cx, cz, y) do jogo. Para janelas: muito mais leve do que caixas."""
    tmp = bmesh.new()
    hl, hh = length / 2, height / 2
    if face[1] == "z":
        pts = [(cx - hl, cz, y - hh), (cx + hl, cz, y - hh), (cx + hl, cz, y + hh), (cx - hl, cz, y + hh)]
    else:
        pts = [(cx, cz - hl, y - hh), (cx, cz + hl, y - hh), (cx, cz + hl, y + hh), (cx, cz - hl, y + hh)]
    vs = [tmp.verts.new((x, -z, yy)) for (x, z, yy) in pts]
    f = tmp.faces.new(vs)
    f.normal_update()
    want = {"+z": (0, -1, 0), "-z": (0, 1, 0), "+x": (1, 0, 0), "-x": (-1, 0, 0)}[face]
    if f.normal.dot(Vector(want)) < 0:
        f.normal_flip()
    P._add(tmp, mat, smooth=False)


def tower(rnd, x, z, w, d, h, faces):
    body = "Bldg%d" % (1 + rnd.randrange(4))
    RB(body, x, z, w, d, h, r=0.4, segs=1)
    P.box("Roof", (x, -z, h + 0.3), (w + 0.6, d + 0.6, 0.6))
    far = math.hypot(x, z) > 190
    step = 7.2 if far else 3.6
    win = ["WinWarm", "WinCool", "WinPink"][rnd.randrange(3)] if rnd.random() < 0.85 else "WinWarm"
    for face in faces:
        along_x = face[1] == "z"
        L = w if along_x else d
        ox, oz = face_off(face, w, d, 0.03)
        y = 3.5
        while y < h - 2.0:
            if rnd.random() < 0.85:
                segs = 3 if L > 14 else 2
                for k in range(segs):
                    if rnd.random() < 0.72:
                        u = -L / 2 + (k + 0.5) * L / segs
                        quad(win, face, x + (u if along_x else ox), z + (oz if along_x else u), y, L / segs - 1.0, 1.2)
            y += step
    return body


def billboard(x, z, face, y, w, h, kind, col1, col2):
    """Ecrã gigante na fachada de um prédio, com um desenho simples aceso."""
    along_x = face[1] == "z"
    ox, oz = face_off(face, 0, 0, 0.0)
    sgn_x, sgn_z = (0, 1 if face == "+z" else -1) if along_x else (1 if face == "+x" else -1, 0)
    bw, bd = (w, 0.4) if along_x else (0.4, w)
    RB("Board", x, z, bw, bd, h, r=0.1, z0=y - h / 2, segs=1)
    fx, fz = x + sgn_x * 0.25, z + sgn_z * 0.25
    hl, hh = w / 2 - 0.3, h / 2 - 0.3
    pts = [(-hl, -hh), (hl, -hh), (hl, hh), (-hl, hh), (-hl, -hh)]
    tube("Tube" + col1, [((fx + u) if along_x else fx, fz if along_x else (fz + u), y + v) for (u, v) in pts], r=0.18, sides=8)
    if kind == "text":
        text3d("Lit" + col2, "COLOR ATTACK", fx + sgn_x * 0.1, fz + sgn_z * 0.1, y, h * 0.2, face)
    elif kind == "drop":
        for k, (sc, m) in enumerate(((1.0, col2), (0.6, col1))):
            pts = drop_curve(0, 0, h * 0.28 * sc, h * 0.38 * sc)
            tube(("Lit" if k else "Lit") + m, [((fx + p[0]) if along_x else fx, fz if along_x else (fz + p[0]), y + p[2]) for p in pts], r=0.25 * sc, sides=6)
    elif kind == "star":
        pts = []
        for k in range(11):
            a = math.pi / 2 + k * math.pi / 5
            r = h * (0.4 if k % 2 == 0 else 0.17)
            pts.append((math.cos(a) * r, math.sin(a) * r))
        tube("Lit" + col2, [((fx + u) if along_x else fx, fz if along_x else (fz + u), y + v) for (u, v) in pts], r=0.3, sides=6)
    elif kind == "heart":
        pts = []
        for k in range(25):
            t = k * 2 * math.pi / 24
            u = 16 * math.sin(t) ** 3 / 17 * h * 0.36
            v = (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) / 17 * h * 0.36
            pts.append((u, v))
        tube("Lit" + col2, [((fx + u) if along_x else fx, fz if along_x else (fz + u), y + v) for (u, v) in pts], r=0.3, sides=6)


def city():
    rnd = random.Random(11)
    P.box("CityGround", (0, 0, -0.45), (1400, 1400, 0.2))
    for (x, y, w, d) in [(0, 49, 600, 14), (0, -49, 600, 14), (63, 0, 14, 600), (-63, 0, 14, 600)]:
        P.box("CityRoad", (x, y, -0.33), (w, d, 0.04))
    # prédios de destaque à volta da arena (com ecrãs virados para dentro)
    marquee = [(-30, 72, 26, 14, 46, "-z", "text", "Cyan", "Pink"), (32, 74, 22, 14, 58, "-z", "heart", "Pink", "Red"),
               (-34, -72, 24, 14, 52, "+z", "drop", "Purple", "Cyan"), (30, -74, 24, 14, 40, "+z", "star", "Yellow", "Orange"),
               (88, 0, 16, 30, 50, "-x", "drop", "Cyan", "Pink"), (-88, 4, 16, 28, 44, "+x", "heart", "Purple", "Pink")]
    taken = []
    for (x, z, w, d, h, face, kind, c1, c2) in marquee:
        tower(rnd, x, z, w, d, h, [face])
        ox, oz = face_off(face, w, d, 0.2)
        bw = (w if face[1] == "z" else d) * 0.8
        billboard(x + ox, z + oz, face, h * 0.62, bw, bw * 0.55, kind, c1, c2)
        taken.append((x, z, max(w, d) / 2 + 6))
    # resto da cidade: grelha de prédios (mais altos ao longe)
    tops = []
    for gx in range(-300, 301, 30):
        for gz in range(-300, 301, 30):
            x, z = gx + rnd.uniform(-5, 5), gz + rnd.uniform(-5, 5)
            if abs(x) < 80 and abs(z) < 62:
                continue
            dist = math.hypot(x, z)
            if dist > 320 or any(math.hypot(x - tx, z - tz) < tr + 10 for (tx, tz, tr) in taken):
                continue
            w, d = rnd.uniform(12, 20), rnd.uniform(12, 20)
            h = rnd.uniform(18, 40) + min(dist, 260) * rnd.uniform(0.08, 0.25)
            faces = []
            if z > 30: faces.append("-z")
            if z < -30: faces.append("+z")
            if x > 50: faces.append("-x")
            if x < -50: faces.append("+x")
            tower(rnd, x, z, w, d, h, faces[:2])
            if rnd.random() < 0.28:                                            # arestas de néon
                m = "Tube" + rnd.choice(["Pink", "Cyan", "Purple", "Blue"])
                for (cx, cz) in [(x - w / 2, z - d / 2), (x + w / 2, z - d / 2), (x - w / 2, z + d / 2), (x + w / 2, z + d / 2)]:
                    if math.hypot(cx, cz) < math.hypot(x, z):                  # só as arestas viradas para a arena
                        tube(m, [(cx, cz, 0.0), (cx, cz, h + 0.6)], r=0.22, sides=6)
                tube(m, [(x - w / 2, z - d / 2, h + 0.62), (x + w / 2, z - d / 2, h + 0.62), (x + w / 2, z + d / 2, h + 0.62), (x - w / 2, z + d / 2, h + 0.62), (x - w / 2, z - d / 2, h + 0.62)], r=0.22, sides=6)
            if h > 55:
                tops.append((x, z, h))
    # antenas com luz vermelha a piscar (2 grupos desencontrados)
    tops.sort(key=lambda t: -t[2])
    for g in range(2):
        b = anim("Blink%d" % g, 0, 0, 0, kind="blink", speed=0.7, amp=0.45, phase=g * 0.5)
        for (x, z, h) in tops[g:16:2]:
            CY("Pole", x, z, 0.25, 8.0, z0=h + 0.6, segs=6)
            b.sphere("RedLight", (x, -z, h + 8.9), (0.7, 0.7, 0.7), segs=8, rings=6)
    # monocarril com comboios (um em cada sentido)
    for k, zz in enumerate((54.0, -54.0)):
        P.box("Track", (0, -zz, 9.6), (900, 2.4, 0.8))
        for x in range(-300, 301, 25):
            CY("Track", x, zz, 0.7, 9.2, segs=10)
        tube("TubeCyan" if k == 0 else "TubePink", [(-450, zz - 1.25, 9.4), (450, zz - 1.25, 9.4)], r=0.08)
        sp = 15.0 if k == 0 else -15.0
        tr = anim("Train%d" % k, 0, zz, 11.5, kind="loop", axis="x", speed=sp, span=760.0, phase=k * 300.0)
        for c in range(3):
            cx = (c - 1) * 11.0
            tr.rbox("TrainBody", (cx, -zz, 11.6), (10.4, 2.6, 2.8), radius=0.9, segs=2)
            for e in (-1, 1):
                tr.rbox("WinCool", (cx, -zz + e * 1.31, 12.1), (8.6, 0.06, 0.9), radius=0.04, segs=1)
                tr.rbox("LitPink" if k == 0 else "LitCyan", (cx, -zz + e * 1.31, 10.75), (10.0, 0.06, 0.14), radius=0.02, segs=1)
    # dirigível com um ecrã
    bl = anim("Blimp", -40, -110, 48, kind="bob", amp=2.0, speed=0.35)
    bl.sphere("Blimp", (-40, 110, 48), (18, 6.5, 6.5), segs=20, rings=12)
    for e in (-1, 1):
        bl.rbox("Blimp", (-56, 110 + e * 3.5, 48), (4.5, 0.3, 3.0), radius=0.1, segs=1)
    bl.rbox("Blimp", (-56, 110, 51.2), (4.5, 0.3, 3.4), radius=0.1, segs=1)
    bl.rbox("LitCyan", (-38, 103.6, 48), (14, 0.2, 3.6), radius=0.3, segs=1)
    bl.rbox("Board", (-38, 103.75, 48), (14.6, 0.2, 4.2), radius=0.3, segs=1)
    bl.rbox("CarDark", (-40, 110, 41.2), (5, 2.2, 1.4), radius=0.4, segs=2)
    # letreiros a rodar em cima de dois prédios
    for k, (x, z, h, m) in enumerate([(-30, 72, 46, "TubePink"), (30, -74, 40, "TubeCyan")]):
        sp = anim("SkySpin%d" % k, x, z, h + 6, kind="spin", axis="z", speed=0.5 if k else -0.5)
        pts = drop_curve(0, 0, 2.4, 3.2)
        sp.tube(m, [Vector((x + p[0], -z, h + 6 + p[2])) for p in pts], [0.2] * len(pts), sides=6, per_seg=2)
        CY("Pole", x, z, 0.3, 3.0, z0=h + 0.6, segs=6)


def build():
    floors(); outer_walls(); city(); center(); string_lights()
    for s in (1, -1):
        metro(s)
        street_arch(s * 11.5, "TubePink" if s > 0 else "TubeCyan", "TubePurple")
        for sz in (1, -1):
            shop(s, sz)
            jump_pad(s * 23.5, sz * 27.5, SHOPS[(s, sz)][1])
            car(s * 7.0, sz * 13.6, "Taxi" if sz > 0 else "CarPurple", 0.0, under=0xFFE14D if sz > 0 else 0xB45CFF, taxi=sz > 0)
            car(s * 31.5, sz * 15.0, "CarTeal" if s > 0 else "CarPurple", 0.0, under=0x2BF0FF if s > 0 else 0xFF3FD8)
            food_truck(s * 9.0, sz * 25.5, "Truck1" if sz > 0 else "Truck2", "TACOS" if sz > 0 else "PIZZA", "Yellow" if sz > 0 else "Green", -sz)
            barrier(s * 5.5, sz * 6.5, 0.8, 4.0, "Pink" if s > 0 else "Cyan")
            barrier(s * 36.0, sz * 13.5, 3.2, 0.8, "Yellow")
            bus_stop(s * 40.0, sz * 32.6, -sz, "Pink" if sz > 0 else "Cyan")
            dumpster(s * 45.5, sz * 21.0, rad(90))
            street_lamp(s * 22.0, sz * 9.5, "Cyan" if s > 0 else "Pink")
            street_lamp(s * 3.5, sz * 21.5, "Purple")
            neon_palm(s * 13.5, sz * 5.5, "Pink" if sz > 0 else "Cyan")
        barrier(s * 26.5, 0, 0.8, 5.0, "Purple")
    patrol = [(0, 8.5), (0, -8.5), (8, 0), (10, 18), (10, -18), (18, 0), (18, 13), (18, -13), (24, 8), (24, -8), (24, 20), (24, -20),
              (40, 21), (40, -21), (13, 30), (13, -30), (22.5, 31), (22.5, -31), (32, 6), (32, -6), (4, 30), (4, -30),
              (18, 27.5), (18, -27.5)]                                         # nas escadas do metro: daí os bots seguem pelo passeio lá em cima
    exec(open("/home/andrexie/Documents/ColorAttack/src/tools/blender/map_extras.py").read(), globals())
    decorate(seed=6, wall_h=2.6, patrol=patrol, flags=False, balloon=False, conf=False)
    return finish_map("neon", patrol, OUTPUT)


objs = build()
