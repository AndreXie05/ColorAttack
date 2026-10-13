"""
ColorAttack - mapa PARQUE (estilo foto.png): praça de betão à beira-mar com vários níveis.
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/parque.glb"; exec(open(este_ficheiro).read())

Coordenadas do jogo (x, z) -> Blender (x, -z). Arena 100 x 70 m, simétrica em x (bases em x = ±43).
Níveis (ver map_kit.py): praça central a 1,2 m (rampas e escadas), torres a 2,0 m, decks laterais a 1,2 m com
caixotes por cima (2,6 m), muretes de 1,1 m e caixotes para saltar. Toques cartoon: patinho na fonte, arco-íris,
nuvens com cara, bichinhos nos muros.
"""
import math
import os
exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_kit.py").read())
OUTPUT = globals().get("OUTPUT")

MATERIALS.update({
    "BridgeRed": 0xF0605A, "BridgeLight": 0xF7E7E0, "Duck": 0xFFD33A, "Beak": 0xFF8A2A, "Eye": 0xFFFFFF, "Pupil": 0x20222E,
    "Cheek": 0xFF9FB0, "Cloud": 0xFFFFFF, "Sun": 0xFFD84A, "SunRay": 0xFFB938, "Chain": 0x3A4258, "Blossom1": 0xFFA8CC, "Blossom2": 0xFF8DBE,
    "Accent": 0x4FD6C8,
})
ROUGH.update({"Duck": 0.35, "Eye": 0.2, "Pupil": 0.2})
EMISSIVE.update({"Sun": (0xFFD84A, 0.6)})


# ---------- adereços do parque ----------
def duck(x, y, z, s=1.0):
    """Patinho de borracha (coordenadas do Blender; virado para o lado: igual para as duas equipas)."""
    P.sphere("Duck", (x, y, z + 0.75 * s), (1.15 * s, 0.95 * s, 0.75 * s), segs=20, rings=12)
    P.sphere("Duck", (x, y + 0.85 * s, z + 1.15 * s), (0.45 * s, 0.4 * s, 0.35 * s), rot=(rad(-30), 0, 0), segs=12, rings=8)
    P.sphere("Duck", (x, y - 0.55 * s, z + 1.75 * s), (0.62 * s, 0.6 * s, 0.6 * s), segs=18, rings=12)
    P.sphere("Beak", (x, y - 1.15 * s, z + 1.62 * s), (0.36 * s, 0.32 * s, 0.13 * s), segs=12, rings=8)
    for sx in (-1, 1):
        P.sphere("Eye", (x + sx * 0.27 * s, y - 1.0 * s, z + 1.92 * s), (0.17 * s, 0.1 * s, 0.2 * s), segs=10, rings=6)
        P.sphere("Pupil", (x + sx * 0.27 * s, y - 1.08 * s, z + 1.94 * s), (0.09 * s, 0.05 * s, 0.11 * s), segs=8, rings=5)
        P.sphere("Cheek", (x + sx * 0.42 * s, y - 0.95 * s, z + 1.6 * s), (0.12 * s, 0.06 * s, 0.08 * s), segs=8, rings=5)
        P.sphere("Duck", (x + sx * 1.0 * s, y + 0.1 * s, z + 0.9 * s), (0.25 * s, 0.6 * s, 0.35 * s), rot=(rad(15), 0, 0), segs=10, rings=6)
    P.cone("Water", (x, y - 0.55 * s, z + 2.4 * s), 0.08, 0.16, 0.5, segs=8)
    P.sphere("Water", (x, y - 0.55 * s, z + 2.75 * s), (0.32, 0.32, 0.22), segs=12, rings=8)


def fountain(z0, k=0.8):
    """Fonte com patinho, assente na praça (z0 = altura da praça)."""
    P.lathe("Stone", [(4.4 * k, 0.0), (4.46 * k, 0.5), (4.3 * k, 1.05), (3.9 * k, 1.1)], loc=(0, 0, z0), segs=40, per_seg=3)
    P.cone("Water", (0, 0, z0 + 0.98), 4.0 * k, 4.0 * k, 0.06, segs=40)
    P.lathe("Stone", [(1.0, 0.95), (0.7, 1.6), (0.52, 3.0), (0.95, 3.5), (0.0, 3.6)], loc=(0, 0, z0), segs=24, per_seg=3)
    for i in range(24):                                                     # borda de bolinhas coloridas
        a = i * 2 * math.pi / 24
        P.sphere(["Red", "Yellow", "Blue", "Pink", "Green", "Orange", "Purple"][i % 7], (math.cos(a) * 4.18 * k, math.sin(a) * 4.18 * k, z0 + 1.16), (0.28, 0.28, 0.22), segs=10, rings=6)
    for i in range(8):                                                      # esguichos
        a = i * math.pi / 4
        P.tube("Water", [(math.cos(a) * 0.4, math.sin(a) * 0.4, z0 + 3.7), (math.cos(a) * 1.5, math.sin(a) * 1.5, z0 + 3.4), (math.cos(a) * 2.6 * k, math.sin(a) * 2.6 * k, z0 + 1.1)],
               [0.07, 0.06, 0.05], sides=6, per_seg=4)
    duck(0, 0, z0 + 3.55)
    col_cyl(0, 0, 4.5 * k, z0 + 2.2)


def blossom_tree(x, z, s=1.2):
    px, py = B(x, z)
    P.tube("Trunk", [(px, py, 0), (px, py, 1.7 * s), (px, py, 3.4 * s)], [0.62 * s, 0.46 * s, 0.4 * s], sides=12)
    for (ox, oy, oz, r, m) in [(0, 0, 4.7, 2.5, "Blossom1"), (1.5, 0.6, 3.9, 1.7, "Blossom2"), (-1.4, -0.8, 4.1, 1.6, "Blossom1"), (0.3, -1.3, 5.6, 1.3, "Blossom2")]:
        P.sphere(m, (px + ox * s, py + oy * s, oz * s), (r * s, r * s, r * s * 0.92), segs=18, rings=10)
    col_cyl(x, z, 0.85 * s, 9)


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


def lawn(x, z, w, d):
    flat_rect("Stone", x, z, w + 1.2, d + 1.2, 0.02)
    flat_rect("Lawn", x, z, w, d, 0.028)


# ---------- céu e fundo ----------
def _face(Q, x, y, z, s, toward):
    dx, dy = toward[0] - x, toward[1] - y; L = math.hypot(dx, dy); nx, ny = dx / L, dy / L; tx, ty = -ny, nx
    for sg in (-1, 1):
        Q.sphere("Pupil", (x + nx * s * 0.93 + tx * sg * 0.3 * s, y + ny * s * 0.93 + ty * sg * 0.3 * s, z + 0.15 * s), (0.09 * s, 0.09 * s, 0.14 * s), segs=8, rings=5)
        Q.sphere("Cheek", (x + nx * s * 0.9 + tx * sg * 0.5 * s, y + ny * s * 0.9 + ty * sg * 0.5 * s, z - 0.12 * s), (0.13 * s, 0.13 * s, 0.08 * s), segs=8, rings=5)
    pts = [(x + nx * s * 0.95 + tx * u * s * 0.28, y + ny * s * 0.95 + ty * u * s * 0.28, z - 0.18 * s - 0.12 * s * (1 - u * u)) for u in (-1, -0.5, 0, 0.5, 1)]
    Q.tube("Pupil", pts, [0.035 * s] * 5, sides=6, per_seg=2)


def sky_friends():
    """Nuvens fofas com cara e um sol sorridente (objeto "Anim_Sky…": o minimapa esconde-o)."""
    Q = anim("SkyFriends", 0, 0, 0, kind="spin", speed=0.0)
    for (x, y, z, s) in [(-70, 60, 30, 1.0), (60, 75, 34, 1.2), (0, 110, 40, 1.4), (-95, -40, 28, 0.9), (95, -20, 30, 1.0), (30, -90, 32, 1.1), (-40, -100, 36, 1.2)]:
        for (ox, oz, r) in [(0, 0, 4.2), (-4.2, -0.9, 3.0), (4.4, -1.0, 3.1), (-1.8, 2.4, 2.8), (2.2, 2.0, 2.6)]:
            Q.sphere("Cloud", (x + ox * s, y, z + oz * s), (r * s, r * s * 0.85, r * s * 0.9), segs=12, rings=7)
        _face(Q, x, y, z, 4.2 * s, (0, 0))
    sx, sy, sz, R = -50, 150, 68, 12.0
    Q.sphere("Sun", (sx, sy, sz), (R, R, R), segs=28, rings=16)
    for k in range(12):
        a = k * math.pi / 6
        Q.cone("SunRay", (sx + math.cos(a) * R * 1.35, sy + 2, sz + math.sin(a) * R * 1.35), 2.4, 0.0, 6.5, rot=(0, -a + math.pi / 2, 0), segs=8)
    _face(Q, sx, sy, sz, R, (0, 0))


def scenery():
    sea()
    by = 170.0                                                               # ponte ao fundo (como na foto)
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
    for (x, y, sx, sy, sz, m) in [(-230, 330, 170, 110, 90, "Mountain"), (0, 360, 220, 120, 120, "MountainFar"), (240, 320, 180, 110, 100, "Mountain"),
                                  (-400, 150, 120, 120, 70, "MountainFar"), (410, 120, 120, 100, 80, "Mountain")]:
        P.sphere(m, (x, y, -10), (sx, sy, sz), segs=24, rings=12)
        P.sphere("Snow", (x, y, sz * 0.55 - 10), (sx * 0.33, sy * 0.33, sz * 0.5), segs=16, rings=8)
    for (x, y) in [(-120, -130), (140, -120), (-170, 90)]:                   # ilhotas com palmeiras
        P.rbox("Foam", (x, y, -1.0), (34, 24, 1.0), radius=1.5)
        P.rbox("Lawn", (x, y, -0.4), (30, 20, 1.0), radius=1.5)
        P.tube("PalmTrunk", [(x, y, 0), (x + 1, y, 4), (x + 2.2, y, 8)], [0.8, 0.6, 0.45], sides=10, per_seg=5)
        for k in range(8):
            a = k * math.pi / 4
            P.sphere("Frond", (x + 2.2 + math.cos(a) * 3.0, y + math.sin(a) * 3.0, 7.6), (3.4, 0.8, 0.12), rot=(0, rad(25), a), segs=8, rings=5)
    fx, fy = -175, -60                                                       # farol
    P.rbox("Foam", (fx, fy, -1.0), (30, 30, 1.0), radius=3)
    for k in range(5):
        P.cone("BridgeRed" if k % 2 == 0 else "White", (fx, fy, 3 + k * 6), 4.5 - k * 0.4, 4.1 - k * 0.4, 6, segs=24)
    P.cone("Glow", (fx, fy, 34), 3.0, 3.0, 4, segs=20)
    P.cone("BridgeRed", (fx, fy, 38), 3.8, 0.2, 4, segs=20)
    sky_friends()


# ---------- layout com vários níveis ----------
def build():
    slab(); walls(); scenery()
    # praça central elevada (1,2 m) com a fonte; rampas para as duas equipas e escadas dos lados
    platform(0, 0, 18, 14, 1.2)
    fountain(1.2)
    for s in (1, -1):
        ramp(s * 11.5, 0, 5, 6, "x", *((1.2, 0.0) if s > 0 else (0.0, 1.2)))
        stairs(0, s * 8.4, 6, 2.8, "z", 1.2, up=-s)
        railing(s * 9, -7, s * 9, -3, 1.2); railing(s * 9, 3, s * 9, 7, 1.2)
    for s in (1, -1):
        # torre com rampa às voltas no corredor do meio (4,2 m), com esconderijo virado para o centro
        spiral_tower(s * 23, 0, s)
        for sz in (1, -1):
            # decks laterais (1,2 m) com escada para o centro e caixotes por cima (2,6 m)
            platform(s * 25, sz * 20, 12, 8, 1.2)
            stairs(s * 17.25, sz * 20, 3.5, 4, "x", 1.2, up=s)
            crate(s * 28.5, sz * 21.5, 1.6, z0=1.2)
            crate(s * 30.1, sz * 21.5, 1.4, z0=1.2)
            railing(s * 19, sz * 24, s * 31, sz * 24, 1.2)
            # muretes de cobertura e caixotes para saltar
            low_wall(s * 8, sz * 14, 1.0, 6.0)
            low_wall(s * 33, sz * 13, 5.0, 1.0)
            sniper_ledge(7, 19, sz * 31, s, h=3.2)                                     # rampa comprida junto ao muro até um posto alto
            crate(s * 12, sz * 24.5, 1.6); crate(s * 13.7, sz * 24.5, 1.6)
            crate(s * 12.85, sz * 24.5, 1.4, z0=1.6, yaw=0.3)                 # em cima dos outros: 3,0 m
            crate(s * 35.5, sz * 18, 1.4)
            tall_wall(s * 40, sz * 20, 1.4, 7, h=3.2)
            # natureza, luz e brinquedos
            lawn(s * 44, sz * 28, 9, 9)
            palm(s * 44, sz * 28, 1.0, 0.9, 0.5 if s > 0 else math.pi - 0.5)
            palm(s * 3, sz * 27.5, 1.0, 0.9, 1.4 * sz)
            lamp(s * 14, sz * 10)
            blossom_tree(s * 34, sz * 26, 1.1)
            swing(s * 4, sz * 22)
    patrol = [(8, 0), (0, -12), (0, 12), (17, 0), (17, -20), (17, 20), (25, -20), (25, 20), (34, -14), (34, 14), (10, -27), (10, 27), (30, 0), (8, 31)]
    exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/map_extras.py").read(), globals())
    decorate(seed=5, wall_h=2.4, patrol=patrol)
    return finish_map("parque", patrol, OUTPUT)


objs = build()
