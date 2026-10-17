"""
ColorAttack - mapa FÁBRICA DE TINTAS (vários níveis), num cais industrial junto ao mar. Ideias de altura deste mapa:
  - DEPÓSITOS DE TINTA com o topo plano a 6 m e ESCADAS DE MÃO: o sítio mais alto do mapa, mas sem onde te esconderes.
  - PASSADIÇOS DE METAL a 6 m que ligam os 4 depósitos num anel por cima do mapa (passa-se por baixo deles).
    Cair lá de cima (6 m) é eliminação: as grades protegem os lados, mas os topos dos depósitos não têm grades.
  - TAPETES ROLANTES que te empurram (para fugir depressa ou chegar mais depressa ao centro).
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/fabrica.glb"; exec(open(este_ficheiro).read())
Animações (lidas pelo jogo): Anim_Paddle_n (gira), Anim_Can_n (anda ao longo do tapete).
"""
import math
import os
exec(open("/home/andrexie/Documents/ColorAttack/src/tools/blender/map_kit.py").read())
OUTPUT = globals().get("OUTPUT")
PAINT_NAMES = ["Red", "Blue", "Yellow", "Purple", "Orange", "Green"]

MATERIALS.update({
    "FactFloor": 0xDADFE8, "FactJoint": 0xBFC6D3, "Hazard": 0xFFD84A, "TankWhite": 0xF4F6FB, "Vat": 0x7C879E, "VatRim": 0x4A5368,
    "Belt": 0x3A4056, "Rail2": 0xFFD84A, "Crate": 0xD8A769, "CrateDark": 0xB07F45, "Barrel": 0x4D8CFF, "Machine": 0x8A97B2, "Pipe": 0xA4B0C6,
    "Hull": 0x37507A, "HullRed": 0xFF5A66, "Cabin": 0xF4F6FB, "Container1": 0xFF5A66, "Container2": 0x4D8CFF, "Container3": 0xFFD84A,
    "Container4": 0x47CC63, "Container5": 0xA06BFF, "Smoke": 0xE6EAF2, "Crane": 0xFFB020, "Hill": 0x8FB3D9, "Silo": 0xDCE3F0,
})
ROUGH.update({"Vat": 0.35, "Pipe": 0.3})
MATERIALS.update({"PlatTop": 0xD9DEE6, "PlatSide": 0x8C96A6, "Accent": 0xFFD84A, "RampTop": 0xC9D1DE, "RampGrip": 0x6B7690})


def tank(x, z, color):
    px, py = B(x, z)
    P.cone(color, (px, py, 4.0), 3.2, 3.2, 8.0, segs=40)
    P.sphere(color, (px, py, 8.0), (3.2, 3.2, 1.6), segs=32, rings=12)
    for h in (1.8, 5.6):
        P.cone("TankWhite", (px, py, h), 3.3, 3.3, 0.55, segs=40)
    P.cone("Steel", (px + 3.35, py, 4.0), 0.13, 0.13, 8.0, segs=8)                                      # escada
    for k in range(12):
        P.box("Steel", (px + 3.35, py, 0.5 + k * 0.65), (0.1, 1.0, 0.1))
    P.cone("Pipe", (px - 3.5, py, 1.0), 0.45, 0.45, 2.0, segs=14)                                       # tubo de saída
    P.cone("Red", (px - 3.5, py - 1.6, 1.0), 0.5, 0.5, 0.14, rot=(rad(90), 0, 0), segs=14)              # válvula
    P.sphere("Steel", (px, py, 9.6), (0.45, 0.45, 0.4), segs=12, rings=8)
    col_cyl(x, z, 3.35, 8)


def vat(x, z, liquid, k, r=2.7, z0=0.0):
    px, py = B(x, z)
    P.cone("Vat", (px, py, z0 + 1.3), r, r, 2.6, segs=36)
    P.cone("VatRim", (px, py, z0 + 2.7), r + 0.15, r + 0.15, 0.22, segs=36)
    P.cone(liquid, (px, py, z0 + 2.6), r - 0.25, r - 0.25, 0.06, segs=32)
    for sx in (-1, 1):
        P.cone("VatRim", (px + sx * (r + 0.4), py, z0 + 0.9), 0.18, 0.18, 1.8, segs=8)                  # pernas/tubos
    pad = anim("Paddle%d" % k, x, z, z0 + 2.9, kind="spin", axis="z", speed=1.3 if k % 2 == 0 else -1.3)
    pad.cone("Steel", (px, py, z0 + 4.4), 0.17, 0.17, 3.0, segs=10)
    pad.rbox("Steel", (px, py, z0 + 3.0), (r * 1.7, 0.4, 0.2), radius=0.06, segs=1)
    pad.rbox("Steel", (px, py, z0 + 3.0), (0.4, r * 1.7, 0.2), radius=0.06, segs=1)
    pad.sphere("VatRim", (px, py, z0 + 5.9), (0.5, 0.5, 0.4), segs=12, rings=8)
    col_cyl(x, z, r + 0.2, z0 + 2.7)


def flat_tank(x, z, color, s, h=6.0, r=3.35):
    """Depósito de tinta com o topo plano a h m (pintável) e escada de mão do lado da base (s)."""
    px, py = B(x, z)
    P.cone(color, (px, py, h / 2), r - 0.1, r - 0.1, h, segs=40)
    for hh in (1.4, h * 0.62):
        P.cone("TankWhite", (px, py, hh), r, r, 0.5, segs=40)
    P.cone("Steel", (px, py, h + 0.05), r + 0.05, r + 0.05, 0.12, segs=40)                            # tampa
    P.cone(color, (px, py, h + 0.12), 1.0, 1.0, 0.1, segs=20)                                         # boca do depósito
    for k in range(16):                                                                                # grade à volta do topo (só visual)
        a = k * math.pi / 8
        CY("Rail2", x + math.cos(a) * (r - 0.15), z + math.sin(a) * (r - 0.15), 0.04, 0.9, z0=h, segs=6)
    P.cone("Pipe", (px - s * (r + 0.2), py, 1.0), 0.45, 0.45, 2.0, segs=14)
    col_cyl(x, z, r, h, paint=1)
    ladder(x + s * r, z, h, s, 0)


def conveyor(x, z, length, k):
    RB("Belt", x, z, 3.0, length, 0.9, r=0.2)
    RB("Black", x, z, 2.4, length - 0.4, 0.14, r=0.04, z0=0.9)
    for sx in (-1.45, 1.45):
        RB("Rail2", x + sx, z, 0.2, length, 1.1, r=0.05)
    for j in range(int(length // 2)):
        P.cone("Steel", (x, -z - length / 2 + 1.0 + j * 2.0, 0.95), 0.2, 0.2, 2.4, rot=(0, rad(90), 0), segs=8)   # rolos
    col_box(x, z, 3.0, length, 1.1)
    for i in range(3):                                                                              # latas que andam ao longo do tapete
        can = anim("Can%d_%d" % (k, i), x, z, 1.4, kind="loop", axis="y", speed=1.4, span=length - 1.4, phase=i * (length - 1.4) / 3 + (k % 2) * 2.0)
        can.cone(PAINT_NAMES[(k + i * 2) % 6], (x, -z, 1.35), 0.5, 0.5, 0.85, segs=16)
        can.cone("White", (x, -z, 1.35), 0.52, 0.52, 0.3, segs=16)
        can.cone("Steel", (x, -z, 1.82), 0.5, 0.5, 0.08, segs=16)


def can_pile(x, z, yaw=0.0):
    F = Frame(x, z, yaw)
    P.rbox("Crate", F.pt(0, 0, 1.0), (4.0, 3.4, 1.6), rot=F.rot, radius=0.2, segs=2)
    P.rbox("CrateDark", F.pt(0, 0, 1.0), (4.1, 0.25, 1.62), rot=F.rot, radius=0.05, segs=1)
    for k in range(6):
        cx, cy = (k % 3 - 1) * 1.15, (k // 3 - 0.5) * 1.3
        P.cone(PAINT_NAMES[k % 6], F.pt(cx, cy, 2.1), 0.5, 0.5, 1.0, segs=18)
        P.cone("White", F.pt(cx, cy, 2.1), 0.52, 0.52, 0.35, segs=18)
    P.cone(PAINT_NAMES[(int(x) + 2) % 6], F.pt(0, 0, 3.2), 0.5, 0.5, 1.0, segs=18)
    col_box(x, z, 4.1 if abs(math.cos(yaw)) > 0.7 else 3.5, 3.5 if abs(math.cos(yaw)) > 0.7 else 4.1, 3.4)


def barrels(x, z):
    for k, (dx, dz) in enumerate([(-1.0, -0.6), (1.0, -0.6), (0.0, 1.1)]):
        px, py = B(x + dx, z + dz)
        c = PAINT_NAMES[(k + int(abs(x))) % 6]
        P.cone(c, (px, py, 0.9), 0.95, 0.95, 1.8, segs=22)
        for h in (0.35, 1.45):
            P.cone("Steel", (px, py, h), 1.0, 1.0, 0.14, segs=22)
        P.cone("Steel", (px, py, 1.83), 0.7, 0.7, 0.05, segs=16)
    col_box(x, z + 0.2, 3.4, 3.4, 1.9)


def forklift(x, z, yaw=0.0):
    F = Frame(x, z, yaw)
    P.rbox("Yellow", F.pt(0, 0.4, 0.95), (2.0, 3.0, 1.2), rot=F.rot, radius=0.35, segs=3)
    P.rbox("Black", F.pt(0, 1.0, 1.9), (1.7, 1.0, 0.1), rot=F.rot, radius=0.03, segs=1)
    for sx in (-0.85, 0.85):
        P.rbox("SteelDark", F.pt(sx, 1.0, 2.4), (0.12, 0.12, 1.8), rot=F.rot, radius=0.03, segs=1)      # arco de proteção
        P.rbox("Black", F.pt(sx, 1.7, 0.45), (0.5, 0.6, 0.9), rot=F.rot, radius=0.2, segs=2)             # rodas
        P.rbox("Black", F.pt(sx, -0.8, 0.45), (0.5, 0.6, 0.9), rot=F.rot, radius=0.2, segs=2)
    P.rbox("SteelDark", F.pt(0, -1.35, 1.7), (1.6, 0.25, 3.0), rot=F.rot, radius=0.06, segs=1)           # mastro
    for sx in (-0.5, 0.5):
        P.rbox("Steel", F.pt(sx, -2.4, 0.3), (0.2, 2.0, 0.12), rot=F.rot, radius=0.03, segs=1)           # garfos
    P.rbox("Crate", F.pt(0, -2.2, 0.85), (1.5, 1.5, 1.0), rot=F.rot, radius=0.12, segs=2)
    col_box(x, z, 2.2 if abs(math.cos(yaw)) > 0.7 else 5.0, 5.0 if abs(math.cos(yaw)) > 0.7 else 2.2, 2.0)


def machine(x, z):
    RB("Machine", x, z, 4.0, 3.0, 3.2, r=0.35)
    for k, c in enumerate(["Red", "Yellow", "Blue"]):
        P.rbox(c, (x - 1.2 + k * 1.2, -z + 1.55, 1.9), (0.55, 0.12, 0.55), radius=0.15, segs=2)
    P.rbox("Black", (x, -z + 1.52, 2.7), (3.0, 0.1, 0.45), radius=0.08, segs=1)
    CY("SteelDark", x + 1.2, z - 0.8, 0.5, 2.6, z0=3.2)
    P.sphere("Smoke", (x + 1.2, -(z - 0.8), 6.4), (0.9, 0.9, 0.7), segs=12, rings=8)
    col_box(x, z, 4.0, 3.0, 3.2)


def pipes():
    for z, c in [(-11, "Red"), (11, "Blue"), (0, "Yellow")]:                                         # canos aéreos decorativos
        P.cone(c, (0, -z, 7.8 + (0.7 if z == 0 else 0)), 0.5, 0.5, 100, rot=(0, rad(90), 0), segs=14)
        for x in range(-45, 46, 15):
            P.cone("Steel", (x, -z, 4.0), 0.22, 0.22, 7.8, segs=8)
            P.cone("SteelDark", (x, -z, 7.8), 0.62, 0.62, 0.18, rot=(0, rad(90), 0), segs=14)


def floors():
    slab(color="FactFloor", joints=True)
    for z in (-11, 11):
        flat_rect("Hazard", 0, z, 70, 0.7, 0.02)
        for i in range(-17, 18):
            flat_rect("Black", i * 2.0, z, 0.8, 0.7, 0.024)


def scenery():
    sea()
    # contentores empilhados no cais, guindastes, navio e chaminés
    for sy in (-1, 1):
        for i in range(-8, 9):
            for lvl in range(2 if abs(i) % 3 else 1):
                c = "Container%d" % (1 + (i * 3 + lvl + (1 if sy > 0 else 0)) % 5)
                RB(c, i * 14.0, -sy * 60 + 0, 12.5, 3.2, 3.0, r=0.25, z0=lvl * 3.0)
    for sx in (-1, 1):
        for k, x in enumerate([45, 105]):                                                          # guindastes de pórtico
            cx = sx * x
            for dx in (-12, 12):
                P.rbox("Crane", (cx + dx, 78, 20), (1.8, 1.8, 40), radius=0.4, segs=2)
                P.rbox("Crane", (cx + dx, 96, 20), (1.8, 1.8, 40), radius=0.4, segs=2)
            P.rbox("Crane", (cx, 87, 40), (28, 24, 2.2), radius=0.4, segs=2)
            P.rbox("Crane", (cx, 87, 36), (3.5, 26, 1.5), radius=0.3, segs=2)
            P.box("Black", (cx + 5, 87, 30), (0.2, 0.2, 10))
            P.rbox("Red", (cx + 5, 87, 25), (3.0, 3.0, 3.0), radius=0.3, segs=2)
    # navio
    P.rbox("Hull", (0, 150, 3.2), (170, 26, 9), radius=3.5, segs=4)
    P.rbox("HullRed", (0, 150, 1.0), (170.5, 26.5, 2.6), radius=1.2, segs=3)
    P.rbox("Cabin", (50, 150, 12), (24, 18, 8), radius=1.4, segs=3)
    P.rbox("Cabin", (50, 150, 18.5), (16, 14, 6), radius=1.2, segs=3)
    P.rbox("Glass", (50, 143, 19), (12, 0.2, 2.2), radius=0.2, segs=1)
    for k, x in enumerate(range(-70, 36, 22)):
        for j in range(3):
            P.rbox("Container%d" % (1 + (k + j) % 5), (x, 150 + (j - 1) * 5.0, 10.5), (18, 4.5, 3.4), radius=0.3, segs=2)
    # chaminés listradas e fumo, silos, armazéns
    for (x, y) in [(-110, -75), (110, -75), (-150, 20), (150, 20), (-60, 110), (70, 120)]:
        for k in range(6):
            P.cone("Red" if k % 2 == 0 else "White", (x, y, 3 + k * 6), 3.2 - k * 0.12, 3.1 - k * 0.12, 6, segs=24)
        for k in range(3):
            P.sphere("Smoke", (x + k * 3, y, 40 + k * 3.5), (3.4 + k, 3.4 + k, 2.6 + k * 0.5), segs=14, rings=10)
    for (x, y) in [(-75, -75), (-90, -75), (75, -75), (90, -75)]:
        P.cone("Silo", (x, y, 9), 5.5, 5.5, 18, segs=28)
        P.sphere("Steel", (x, y, 18), (5.5, 5.5, 3.0), segs=20, rings=10)
    for (x, y, sx, sy, sz, m) in [(-230, 330, 170, 110, 60, "Hill"), (240, 320, 180, 110, 65, "Hill"), (0, 360, 220, 120, 70, "Hill")]:
        P.sphere(m, (x, y, -10), (sx, sy, sz), segs=24, rings=12)


def build():
    floors(); walls(mat="Steel", cap="Hazard", h=2.6); scenery()
    # plataforma de controlo ao centro (1,2 m) com a cuba grande; rampas para as duas equipas
    platform(0, 0, 12, 10, 1.2)
    vat(0, 0, "Orange", 1, r=3.0, z0=1.2)
    vat(0, -14, "Green", 0); vat(0, 14, "Purple", 2)
    # passadiços a 6 m entre os depósitos (anel): ao longo de z em x = ±16 e ao longo de x em z = ±20
    for sz in (1, -1):
        catwalk(0, sz * 20, 25.3, 2.4, 6.0)
    for s in (1, -1):
        ramp(s * 8.5, 0, 5, 5, "x", *((1.2, 0.0) if s > 0 else (0.0, 1.2)))
        catwalk(s * 16, 0, 2.4, 33.3, 6.0)
        flat_tank(s * 16, -20, "Red", s); flat_tank(s * 16, 20, "Yellow" if s > 0 else "Blue", s)
        # tapetes rolantes: dois lado a lado em sentidos contrários e um junto a cada muro a levar para o centro
        conveyor_floor(s * 27, 0, 3, 22, push_z=4.0, k=0 if s > 0 else 4)
        conveyor_floor(s * 31.5, 0, 3, 22, push_z=-4.0, k=1 if s > 0 else 5)
        for sz in (1, -1):
            conveyor_floor(s * 14, sz * 30.5, 16, 3, push_x=-s * 4.0, k=(2 if sz > 0 else 3) + (0 if s > 0 else 4))
            barrels(s * 22, sz * 8)
            machine(s * 40, sz * 16)
            can_pile(s * 40, sz * 28, rad(8) * s * sz)
            forklift(s * 9, sz * 24, rad(90) if s > 0 else -rad(90))
            low_wall(s * 22, sz * 27, 5.0, 1.0)
            crate(s * 36, sz * 22, 1.6)
            lamp(s * 6, sz * 17, 5.4)
    patrol = [(8, 0), (0, -9), (0, 9), (16, -13), (16, 13), (26, -14), (26, 14), (20, -26), (20, 26), (34, -12), (34, 12), (44, -12), (44, 12), (12, -26), (12, 26)]
    exec(open("/home/andrexie/Documents/ColorAttack/src/tools/blender/map_extras.py").read(), globals()); decorate(seed=3, wall_h=2.6, patrol=patrol)
    return finish_map("fabrica", patrol, OUTPUT)


objs = build()
