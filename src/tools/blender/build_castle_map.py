"""
ColorAttack - mapa CASTELO (medieval, cores escuras: pedra cinzenta, madeira castanha, ferro).
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/castelo.glb"; exec(open(este_ficheiro).read())

Coordenadas do jogo (x, z) -> Blender (x, -z). Arena 100 x 70 m, simétrica em x (bases em x = ±43).
  - RIO estreito no meio (x = -3..3), de muralha a muralha: cair à água elimina. Margens com murete de pedra.
  - PONTES-LEVADIÇAS no centro: cada margem tem uma casa da guarda cuja ponte desce até ficar no chão (as duas metades
    encontram-se no meio do rio) e volta a subir de tempos a tempos (quem estiver em cima é empurrado).
  - Duas PONTES DE PEDRA fixas (z = ±14).
  - CORREDORES nas laterais: corredor coberto dentro da muralha que liga as duas bases (com portas para o pátio) e, por
    cima, o CAMINHO DE RONDA (4 m) com ameias; escadas junto às bases; TORRES nos cantos (7 m, escada de mão).
  - SALÕES do castelo em cada metade: portas, mesa comprida, armaduras, armeiros, estandartes; telhado com ameias e escada.
  - Canhões, barris, fardos de palha, caixotes e tochas.
"""
import math
import os
exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_kit.py").read())
OUTPUT = globals().get("OUTPUT")

MATERIALS.update({
    "Cobble": 0x6F6A62, "Joint": 0x57534E, "Stone": 0x77726B, "StoneDark": 0x57534E, "StoneLight": 0x8C877F,
    "Wood": 0x7A5634, "WoodDark": 0x4E3522, "Iron": 0x3B3E44, "IronLight": 0x5A5E66, "RoofTile": 0x5B3A2E,
    "Water": 0x2E5560, "RiverBed": 0x2F3A36, "Grass": 0x56603F, "GrassDark": 0x434C31, "Dirt": 0x6E5E48,
    "BannerA": 0x2E4A6E, "BannerB": 0x7A2E2A, "Gold": 0xA8873A, "Hay": 0xA89055, "Fire": 0xFFB24A, "Cloth": 0x8B7D66,
    "Pine": 0x2F3F2C, "PineDark": 0x26331F, "Mountain": 0x5E6670, "MountainFar": 0x737B85, "Snow": 0xD8DCE0,
    # plataformas do kit em pedra
    "PlatTop": 0x8C877F, "PlatSide": 0x5F5A54, "Accent": 0x4E3522, "RampTop": 0x7E7870, "RampGrip": 0x57534E,
    "Rail": 0x3B3E44, "Ladder": 0x6B4A2C, "Crate": 0x7A5634, "CrateDark": 0x4E3522,
})
ROUGH.update({"Water": 0.15, "Cobble": 0.9, "Stone": 0.9, "StoneDark": 0.9, "Iron": 0.4, "IronLight": 0.35, "Gold": 0.3})
EMISSIVE.update({"Fire": (0xFF9A30, 2.2), "Water": (0x16303A, 0.25)})

RIVER = 3.0          # meia largura do rio
RZ = 23.0            # o rio vai de z = -23 a 23 (para lá disso passa por baixo dos corredores)
CZ0, CZ1 = 24.0, 30.0   # corredor coberto (|z|)
TOPW = 4.0           # altura do caminho de ronda


# ---------- chão, rio e muralhas ----------
def ground():
    for (x0, x1) in [(-51.7, -RIVER), (RIVER, 51.7)]:                       # margens (o rio fica de fora)
        P.rbox("Cobble", ((x0 + x1) / 2, 0, -0.8), (x1 - x0, 73.4, 1.6), radius=0.2, segs=1)
    for sz in (-1, 1):                                                       # chão por cima do rio, nos corredores
        P.rbox("Cobble", (0, -sz * (RZ + 36.7) / 2, -0.8), (2 * RIVER + 0.4, 36.7 - RZ, 1.6), radius=0.1, segs=1)
    for i in range(-19, 20):                                                 # juntas das pedras (2,5 m)
        if abs(i * 2.5) > RIVER:
            P.box("Joint", (i * 2.5, 0, 0.006), (0.07, 70, 0.012))
    for j in range(-13, 14):
        for (x0, x1) in [(-50, -RIVER), (RIVER, 50)]:
            P.box("Joint", ((x0 + x1) / 2, j * 2.5, 0.006), (x1 - x0, 0.07, 0.012))
    # rio: leito escuro, água mais abaixo, margens de pedra com murete (0,6 m: é preciso saltar para cair)
    P.box("RiverBed", (0, 0, -1.2), (2 * RIVER, 2 * RZ, 0.2))
    P.box("Water", (0, 0, -0.35), (2 * RIVER, 2 * RZ, 0.06))
    water(0, 0, 2 * RIVER, 2 * RZ, 0.0)
    for sx in (-1, 1):
        for (z0, z1) in [(-RZ, -16.6), (-11.4, -4.2), (4.2, 11.4), (16.6, RZ)]:
            low_wall(sx * (RIVER + 0.3), (z0 + z1) / 2, 0.6, z1 - z0, h=0.8, solid=True)   # murete onde não se sobe
            P.rbox("StoneDark", (sx * (RIVER + 0.05), -(z0 + z1) / 2, -0.6), (0.3, z1 - z0, 1.2), radius=0.03, segs=1)   # paredão até à água
    for sz in (-1, 1):                                                       # grades por onde o rio passa debaixo dos corredores
        for k in range(7):
            CY("Iron", -RIVER + 0.5 + k * 0.85, sz * (RZ + 0.1), 0.06, 3.0, z0=-1.0, segs=6)


def outer_walls():
    """Muralha exterior alta (6 m) com ameias: as colisões impedem os tiros de passar."""
    hx, hz, h = 50.0, 35.0, 6.0
    for (x, z, w, d) in [(0, hz + 1.0, 104, 2.0), (0, -hz - 1.0, 104, 2.0), (hx + 1.0, 0, 2.0, 74), (-hx - 1.0, 0, 2.0, 74)]:
        RB("Stone", x, z, w, d, h, r=0.1, segs=1)
        col_box(x, z, w, d, h)
    for (x, z, w, d, along) in [(0, hz + 1.0, 104, 2.0, "x"), (0, -hz - 1.0, 104, 2.0, "x"), (hx + 1.0, 0, 2.0, 74, "z"), (-hx - 1.0, 0, 2.0, 74, "z")]:
        L = w if along == "x" else d
        n = int(L / 2.4)
        for k in range(n):
            u = -L / 2 + (k + 0.5) * L / n
            if k % 2 == 0:
                RB("StoneDark", x + (u if along == "x" else 0), z + (0 if along == "x" else u), 1.2 if along == "x" else w, d if along == "x" else 1.2, 1.1, r=0.05, z0=h, segs=1)


# ---------- corredores laterais e caminho de ronda ----------
def corridor(sz):
    """Corredor coberto (z de 24 a 30) de base a base, com portas para o pátio; por cima, o caminho de ronda a 4 m."""
    zin, zout = sz * CZ0, sz * CZ1
    zc = sz * (CZ0 + CZ1) / 2
    # parede interior (do lado do pátio) com portas
    doors = [-26.0, -10.0, 10.0, 26.0]
    xs = [-36.0] + [v for d in doors for v in (d - 1.6, d + 1.6)] + [36.0]
    for k in range(0, len(xs), 2):
        x0, x1 = xs[k], xs[k + 1]
        RB("Stone", (x0 + x1) / 2, sz * (CZ0 - 0.4), x1 - x0, 0.8, 3.4, r=0.05, segs=1)
        col_box((x0 + x1) / 2, sz * (CZ0 - 0.4), x1 - x0, 0.8, 3.4)
    for d in doors:                                                          # arco de madeira por cima das portas
        RB("WoodDark", d, sz * (CZ0 - 0.4), 3.6, 1.0, 0.35, r=0.04, z0=2.9, segs=1)
    # parede exterior e enchimento até à muralha (topo = caminho de ronda)
    RB("StoneDark", 0, sz * (CZ1 + 2.5), 100, 5.0, TOPW, r=0.05, segs=1)
    col_box(0, sz * (CZ1 + 2.5), 100, 5.0, TOPW, paint=True)
    # teto do corredor (passa-se por baixo; em cima anda-se)
    RB("StoneLight", 0, zc, 72, CZ1 - CZ0, 0.6, r=0.04, z0=TOPW - 0.6, segs=1)
    col_box(0, zc, 72, CZ1 - CZ0, TOPW, paint=True, bottom=TOPW - 0.6)
    for x in range(-34, 35, 6):                                              # vigas e tochas dentro do corredor
        RB("WoodDark", x, zc, 0.4, CZ1 - CZ0, 0.35, r=0.03, z0=TOPW - 0.95, segs=1)
    for x in (-30, -18, -4, 4, 18, 30):
        torch(x, sz * (CZ1 - 0.15), 2.4, -sz)
    # ameias no lado de dentro do caminho de ronda (dá para disparar pelas aberturas)
    n = 30
    for k in range(n):
        if k % 2:
            continue
        x = -36 + (k + 0.5) * 72 / n
        RB("Stone", x, sz * (CZ0 + 0.3), 72 / n, 0.6, 1.1, r=0.04, z0=TOPW, segs=1)
        col_box(x, sz * (CZ0 + 0.3), 72 / n, 0.6, TOPW + 1.1, paint=True, bottom=TOPW)
    # escadas para o caminho de ronda, junto às bases (sobem para fora, de z = 24 a 30)
    for s in (-1, 1):
        stairs(s * 39, sz * (CZ0 + CZ1) / 2, 4, CZ1 - CZ0, "z", TOPW, up=sz)
        tower(s * 47.0, sz * 32.0, s, sz, r=2.6)


def tower(x, z, s, sz, r=3.0, h=7.2):
    """Torre redonda no caminho de ronda: escada de mão a partir do caminho (4 m) até ao topo (7,2 m), com ameias."""
    CY("Stone", x, z, r, h, segs=28)
    CY("StoneDark", x, z, r + 0.2, 0.5, z0=h - 0.5, segs=28)
    for k in range(12):
        if k % 2 == 0:
            a = k * math.pi / 6
            P.rbox("Stone", (x + math.cos(a) * (r - 0.2), -(z + math.sin(a) * (r - 0.2)), h + 0.5), (1.0, 1.0, 1.0), rot=(0, 0, -a), radius=0.04, segs=1)
    P.cone("RoofTile", (x, -z, h + 2.6), r * 0.75, 0.05, 3.0, segs=16)        # telhadinho cónico ao centro (cobertura)
    CY("WoodDark", x, z, 0.35, 0.8, z0=h, segs=8)
    col_cyl(x, z, r, h, paint=1)
    col_cyl(x, z, 0.5, h + 3.0)
    ladder(x - s * r, z, h, -s, 0, z0=TOPW)                                  # do lado de dentro (virada para o centro)
    banner(x, z - sz * (r + 0.05), h - 1.0, "BannerA" if s < 0 else "BannerB", face=-sz)


# ---------- adereços medievais ----------
def torch(x, z, y, face=1):
    P.rbox("Iron", (x, -z, y - 0.2), (0.12, 0.3, 0.12), radius=0.02, segs=1)
    P.cone("WoodDark", (x, -(z + face * 0.15), y), 0.07, 0.1, 0.5, segs=6)
    P.sphere("Fire", (x, -(z + face * 0.15), y + 0.35), (0.14, 0.14, 0.22), segs=8, rings=6)


def banner(x, z, y, mat, face=1, w=1.6, h=3.0):
    """Estandarte pendurado numa parede (face = +1 virado para +z do jogo)."""
    P.rbox("Iron", (x, -(z + face * 0.1), y + 0.1), (w + 0.3, 0.1, 0.1), radius=0.02, segs=1)
    P.rbox(mat, (x, -(z + face * 0.12), y - h / 2), (w, 0.06, h), radius=0.02, segs=1)
    P.cone(mat, (x, -(z + face * 0.12), y - h - 0.25), 0.55, 0.0, 0.5, rot=(math.pi, 0, 0), segs=3)
    P.cone("Gold", (x, -(z + face * 0.17), y - h * 0.45), 0.35, 0.35, 0.04, rot=(math.radians(90), 0, 0), segs=12)   # brasão


def cannon(x, z, yaw, z0=0.0):
    """Canhão de ferro em carreta de madeira (1 m: cobertura baixa)."""
    F = Frame(x, z, yaw)
    P.rbox("WoodDark", F.pt(0, 0, z0 + 0.45), (1.2, 2.2, 0.5), rot=F.rot, radius=0.06, segs=1)
    for lx in (-0.7, 0.7):
        for ly in (-0.7, 0.6):
            P.cone("Wood", F.pt(lx, ly, z0 + 0.45), 0.45, 0.45, 0.15, rot=(0, math.radians(90), yaw), segs=12)
            P.cone("Iron", F.pt(lx * 1.05, ly, z0 + 0.45), 0.12, 0.12, 0.17, rot=(0, math.radians(90), yaw), segs=8)
    a = math.radians(-12)
    P.cone("Iron", F.pt(0, -0.5, z0 + 1.05), 0.36, 0.26, 2.6, rot=(math.radians(90) + a, 0, yaw), segs=16)
    P.sphere("Iron", F.pt(0, 0.8, z0 + 0.95), (0.36, 0.36, 0.36), segs=12, rings=8)
    for k in range(3):                                                       # pilha de balas
        P.sphere("Iron", F.pt(0.3 * (k - 1), 1.5, z0 + 0.18), (0.18, 0.18, 0.18), segs=8, rings=6)
    col_box(x, z, 1.4 if abs(math.cos(yaw)) > 0.7 else 2.4, 2.4 if abs(math.cos(yaw)) > 0.7 else 1.4, z0 + 1.1, paint=True)


def armor_stand(x, z, face):
    """Armadura completa num suporte (elmo, peitoral, ombreiras, saiote de malha)."""
    F = Frame(x, z, 0.0 if face > 0 else math.pi)
    P.rbox("WoodDark", F.pt(0, 0, 0.1), (0.8, 0.8, 0.2), rot=F.rot, radius=0.04, segs=1)
    CY("WoodDark", x, z, 0.06, 1.0, z0=0.2, segs=6)
    P.cone("IronLight", F.pt(0, 0, 1.0), 0.32, 0.38, 0.45, segs=12)        # saiote
    P.cone("IronLight", F.pt(0, 0, 1.5), 0.36, 0.3, 0.6, segs=14)          # peitoral
    for sx in (-1, 1):
        P.sphere("IronLight", F.pt(sx * 0.42, 0, 1.75), (0.2, 0.2, 0.16), segs=10, rings=6)    # ombreiras
        P.cone("Iron", F.pt(sx * 0.46, 0, 1.35), 0.09, 0.08, 0.6, segs=8)  # braços
    P.sphere("IronLight", F.pt(0, 0, 2.08), (0.22, 0.24, 0.26), segs=14, rings=10)    # elmo
    P.rbox("Iron", F.pt(0, -0.2, 2.08), (0.3, 0.05, 0.05), rot=F.rot, radius=0.01, segs=1)   # viseira
    P.cone("BannerB" if face > 0 else "BannerA", F.pt(0, 0, 2.35), 0.05, 0.0, 0.3, segs=6)   # pluma
    col_cyl(x, z, 0.45, 2.3)


def weapon_rack(x, z, face):
    """Armeiro de parede: lanças, espadas e um escudo."""
    F = Frame(x, z, 0.0 if face > 0 else math.pi)
    P.rbox("WoodDark", F.pt(0, 0, 1.0), (2.2, 0.3, 0.12), rot=F.rot, radius=0.02, segs=1)
    P.rbox("WoodDark", F.pt(0, 0, 0.3), (2.2, 0.3, 0.12), rot=F.rot, radius=0.02, segs=1)
    for k in range(4):
        lx = -0.8 + k * 0.55
        CY("Wood", F.pt(lx, 0, 0)[0], -F.pt(lx, 0, 0)[1], 0.035, 2.4, segs=6)
        P.cone("IronLight", F.pt(lx, 0, 2.55), 0.08, 0.0, 0.3, segs=4)     # ponta da lança
    P.cone("BannerA" if face > 0 else "BannerB", F.pt(0.0, -0.25, 1.3), 0.45, 0.45, 0.08, rot=(math.radians(90), 0, F.yaw), segs=16)   # escudo
    P.cone("Gold", F.pt(0.0, -0.3, 1.3), 0.15, 0.15, 0.08, rot=(math.radians(90), 0, F.yaw), segs=10)
    col_box(x, z, 2.2 if abs(F.c) > 0.7 else 0.5, 0.5 if abs(F.c) > 0.7 else 2.2, 2.6)


def barrel(x, z, z0=0.0):
    CY("Wood", x, z, 0.5, 1.1, z0=z0, segs=14)
    for hh in (0.2, 0.9):
        CY("Iron", x, z, 0.52, 0.08, z0=z0 + hh, segs=14)
    col_cyl(x, z, 0.52, z0 + 1.1, paint=1)


def hay(x, z, yaw=0.0):
    F = Frame(x, z, yaw)
    P.rbox("Hay", F.pt(0, 0, 0.5), (2.0, 1.2, 1.0), rot=F.rot, radius=0.25, segs=2)
    for lx in (-0.5, 0.5):
        P.rbox("WoodDark", F.pt(lx, 0, 0.5), (0.06, 1.24, 1.04), rot=F.rot, radius=0.02, segs=1)
    col_box(x, z, 2.0 if abs(math.cos(yaw)) > 0.7 else 1.2, 1.2 if abs(math.cos(yaw)) > 0.7 else 2.0, 1.0, paint=True)


def pine(x, z, s=1.0):
    CY("WoodDark", x, z, 0.35 * s, 2.0 * s, segs=8)
    for k, (r, hh) in enumerate([(2.6, 1.6), (2.1, 3.4), (1.5, 5.0), (0.9, 6.4)]):
        P.cone("Pine" if k % 2 == 0 else "PineDark", (x, -z, hh * s + 1.0 * s), r * s, 0.1, 2.4 * s, segs=10)


# ---------- casa da guarda com ponte-levadiça ----------
def gatehouse(s):
    """Casa da guarda na margem (lado s): duas torres, arco por cima (a 4,4 m, anda-se) e a ponte-levadiça para o rio."""
    gx = s * (RIVER + 3.4)                                                   # centro da casa da guarda
    for sz in (-1, 1):
        RB("Stone", gx, sz * 3.4, 3.0, 2.4, 6.0, r=0.06, segs=1)
        col_box(gx, sz * 3.4, 3.0, 2.4, 6.0, paint=True)
        for k in range(2):
            RB("StoneDark", gx + (k - 0.5) * 1.6, sz * 3.4, 0.9, 2.4, 0.9, r=0.03, z0=6.0, segs=1)
        torch(gx - s * 1.55, sz * 2.0, 2.6, 1)
    RB("StoneLight", gx, 0, 3.0, 4.4, 1.2, r=0.05, z0=3.2, segs=1)          # arco por cima da passagem
    col_box(gx, 0, 3.0, 4.4, 4.4, paint=True, bottom=3.2)
    RB("Cobble", gx, 0, 3.0, 4.4, 0.4, r=0.03, segs=1)                       # soleira (0,4 m: sobe-se a andar)
    col_box(gx, 0, 3.0, 4.4, 0.4, paint=True)
    RB("Cobble", s * (RIVER + 0.95), 0, 1.9, 4.4, 0.4, r=0.03, segs=1)       # beira da margem (até à dobradiça)
    col_box(s * (RIVER + 0.95), 0, 1.9, 4.4, 0.4, paint=True)
    for k in range(5):                                                       # grade levadiça (sempre aberta, só decoração)
        CY("Iron", gx - s * 1.45, -1.6 + k * 0.8, 0.05, 1.2, z0=3.2, segs=6)
    for sz in (-1, 1):                                                       # correntes da ponte
        P.tube("Iron", [(gx - s * 1.4, -sz * 1.9, 4.2), (s * RIVER * 0.5, -sz * 1.9, 0.6)], [0.04, 0.04], sides=6, per_seg=1)
    drawbridge(0 if s < 0 else 1, s * RIVER, 0, 3.8, RIVER, -s, 0, 0.4, period=26.0, open_s=15.0, move=2.5, phase=0.0)


# ---------- pontes de pedra ----------
def stone_bridge(z):
    """Ponte de pedra em arco por cima do rio (1 m), com rampas e parapeitos."""
    w = 5.0
    for s in (-1, 1):
        ramp_up(s * (RIVER + 2.0), z, 4.0, w, "x", 0.0, 1.0, up=-s)
        P.rbox("StoneDark", (s * (RIVER + 0.3), -z, -0.5), (0.8, w + 0.6, 1.0), radius=0.03, segs=1)   # pilar
    RB("Stone", 0, z, 2 * RIVER, w, 0.7, r=0.04, z0=0.3, segs=1)
    RB("StoneLight", 0, z, 2 * RIVER + 0.1, w + 0.1, 0.12, r=0.03, z0=0.95, segs=1)
    col_box(0, z, 2 * RIVER, w, 1.0, paint=True)
    for sg in (-1, 1):
        RB("Stone", 0, z + sg * (w / 2 - 0.25), 2 * RIVER, 0.5, 0.9, r=0.04, z0=1.0, segs=1)
        col_box(0, z + sg * (w / 2 - 0.25), 2 * RIVER, 0.5, 1.9, bottom=1.0, solid=1)


# ---------- salão do castelo ----------
def hall(s):
    """Salão (x de 12 a 24): portas nos 4 lados, telhado plano com ameias a 4,6 m e escada exterior para lá subir."""
    x0, x1, z0, z1, h = 12.0, 24.0, -7.0, 7.0, 4.0
    X = lambda v: s * v
    xc = X((x0 + x1) / 2)
    def wall_x(x, za, zb):
        RB("Stone", X(x), (za + zb) / 2, 0.8, zb - za, h, r=0.04, segs=1); col_box(X(x), (za + zb) / 2, 0.8, zb - za, h)
    def wall_z(z, xa, xb):
        RB("Stone", X((xa + xb) / 2), z, xb - xa, 0.8, h, r=0.04, segs=1); col_box(X((xa + xb) / 2), z, xb - xa, 0.8, h)
    for x in (x0, x1):                                                       # paredes do lado do rio e do lado da base (porta a meio)
        wall_x(x, z0, -1.6); wall_x(x, 1.6, z1)
    wall_z(z1, x0, 16.4); wall_z(z1, 19.6, x1)                               # parede norte (porta em x = 18)
    wall_z(z0, x0 + 0.4, 13.0); wall_z(z0, 16.0, x1)                         # parede sul (porta em x = 14,5)
    for (x, z) in [(x0, 0), (x1, 0), (18, z1), (14.5, z0)]:                  # vergas de madeira por cima das portas
        if z == 0:
            RB("WoodDark", X(x), 0, 1.0, 3.6, 0.4, r=0.03, z0=2.9, segs=1)
        else:
            RB("WoodDark", X(x), z, 3.6, 1.0, 0.4, r=0.03, z0=2.9, segs=1)
    # telhado plano (anda-se por cima) e ameias
    RB("StoneLight", xc, 0, x1 - x0 + 0.8, z1 - z0 + 0.8, 0.6, r=0.04, z0=h, segs=1)
    col_box(xc, 0, x1 - x0 + 0.8, z1 - z0 + 0.8, h + 0.6, paint=True, bottom=h)
    for k in range(7):                                                       # ameias (lados norte e do rio)
        if k % 2 == 0:
            zz = z0 + (k + 0.5) * (z1 - z0) / 7
            RB("Stone", X(x0 - 0.1), zz, 0.6, 2.0, 1.0, r=0.03, z0=h + 0.6, segs=1); col_box(X(x0 - 0.1), zz, 0.6, 2.0, h + 1.6, paint=True, bottom=h + 0.6)
            xx = x0 + (k + 0.5) * (x1 - x0) / 7
            RB("Stone", X(xx), z1 + 0.1, 1.7, 0.6, 1.0, r=0.03, z0=h + 0.6, segs=1); col_box(X(xx), z1 + 0.1, 1.7, 0.6, h + 1.6, paint=True, bottom=h + 0.6)
    stairs(X(20.2), z0 - 1.3, 7.6, 2.2, "x", h + 0.6, up=s)                  # escada exterior (lado sul) até ao telhado
    # dentro: mesa comprida com bancos, armaduras, armeiros, lareira e candelabro
    RB("Wood", xc, 0, 6.0, 1.6, 0.15, r=0.03, z0=0.85, segs=1)
    for lx in (-2.6, 2.6):
        for lz in (-0.6, 0.6):
            CY("WoodDark", xc + s * lx, lz, 0.08, 0.85, segs=6)
    col_box(xc, 0, 6.0, 1.6, 1.0, paint=True)
    for sz in (-1, 1):
        RB("WoodDark", xc, sz * 1.5, 5.6, 0.45, 0.5, r=0.03, segs=1); col_box(xc, sz * 1.5, 5.6, 0.45, 0.5, paint=True)
        armor_stand(X(13.2), sz * 4.5, 1 if sz < 0 else -1)
        armor_stand(X(22.8), sz * 4.5, 1 if sz < 0 else -1)
    weapon_rack(X(18), z1 - 0.6, -1)
    for k in range(4):                                                       # candelabro de ferro com velas
        a = k * math.pi / 2
        CY("Iron", xc + math.cos(a) * 0.8, math.sin(a) * 0.8, 0.04, 0.2, z0=3.0, segs=6)
        P.sphere("Fire", (xc + math.cos(a) * 0.8, -math.sin(a) * 0.8, 3.27), (0.06, 0.06, 0.1), segs=6, rings=4)
    P.cone("Iron", (xc, 0, 3.0), 1.0, 1.0, 0.06, segs=16)
    CY("Iron", xc, 0, 0.03, 0.9, z0=3.05, segs=6)
    for sz in (-1, 1):
        torch(X(x1 + 0.45), sz * 3.0, 2.6, 0)
    banner(xc, z1 + 0.45, h - 0.2, "BannerA" if s < 0 else "BannerB", face=1)
    banner(xc, z0 - 0.45, h - 0.2, "BannerA" if s < 0 else "BannerB", face=-1)


def scenery():
    P.box("GrassDark", (0, 0, -1.7), (1400, 1400, 0.2))
    for (x, z, s) in [(-62, 46, 1.2), (-48, 52, 1.0), (60, 48, 1.1), (74, 40, 1.3), (-70, -44, 1.2), (66, -50, 1.0), (-56, -56, 1.1),
                      (80, -20, 1.2), (-82, 10, 1.3), (82, 18, 1.0), (-80, -18, 1.1), (40, 60, 1.2), (-30, 62, 1.0), (10, -62, 1.2), (-12, 64, 1.1)]:
        pine(x, z, s)
    # torres de menagem ao longe e montanhas
    for (x, y, w, h) in [(-120, 150, 18, 40), (110, 160, 22, 46), (0, -170, 26, 50)]:
        P.rbox("StoneDark", (x, y, h / 2), (w, w, h), radius=0.3, segs=1)
        P.cone("RoofTile", (x, y, h + 6), w * 0.75, 0.2, 12, segs=4, rot=(0, 0, math.radians(45)))
    for (x, y, sx, sy, sz, m) in [(-230, 330, 170, 110, 110, "Mountain"), (0, 360, 220, 120, 140, "MountainFar"), (240, 320, 180, 110, 120, "Mountain"),
                                  (-380, -150, 160, 120, 100, "MountainFar"), (380, -120, 140, 100, 110, "Mountain")]:
        P.sphere(m, (x, y, -10), (sx, sy, sz), segs=24, rings=12)
        P.sphere("Snow", (x, y, sz * 0.62 - 10), (sx * 0.28, sy * 0.28, sz * 0.4), segs=16, rings=8)


# ---------- construção ----------
def build():
    ground(); outer_walls(); scenery()
    for sz in (-1, 1):
        corridor(sz)
        stone_bridge(sz * 14.0)
    for s in (-1, 1):
        gatehouse(s)
        hall(s)
        for sz in (-1, 1):
            # pátio entre o salão e o corredor: canhões virados para o rio, fardos, barris e caixotes
            cannon(s * 8.5, sz * 19.0, math.pi / 2 if s > 0 else -math.pi / 2)
            hay(s * 28.5, sz * 13.5, 0.2 * sz); barrel(s * 31.0, sz * 18.0); barrel(s * 31.9, sz * 18.8)
            crate(s * 22.0, sz * 17.0, 1.6); crate(s * 23.6, sz * 17.0, 1.6); crate(s * 22.8, sz * 17.0, 1.4, z0=1.6, yaw=0.4)
            hay(s * 9.0, sz * 9.0, 1.57)
            cannon(s * 20.0, sz * 32.0, math.pi if sz > 0 else 0.0, z0=TOPW)   # canhões no caminho de ronda
            cannon(s * 8.0, sz * 32.0, math.pi if sz > 0 else 0.0, z0=TOPW)
            barrel(s * 37.5, sz * 14.0); hay(s * 34.0, sz * 21.5, 0.0)
        for sz in (-1, 1):
            banner(s * 44.0, sz * (CZ0 - 0.1), 3.2, "BannerA" if s < 0 else "BannerB", face=-sz)
    patrol = [(6.5, 0), (8, 14), (8, -14), (0, 14), (0, -14), (18, 0), (18, 11), (18, -11), (28, 4), (28, -4), (30, 17),
              (30, -17), (20, 27), (20, -27), (40, 16), (40, -16), (44, 27), (44, -27), (10, 27), (10, -27)]
    return finish_map("castelo", patrol, OUTPUT)


objs = build()
