"""
ColorAttack - extras cartoon partilhados pelos mapas (só visuais, sem colisões, nada que atrapalhe o jogo):
  spectators()  : bichinhos fofos sentados nos muros a assistir (alguns saltitam)
  bunting()     : fiadas de bandeirinhas coloridas ao longo dos muros compridos
  balloons()    : cachos de balões nos cantos que flutuam
  confetti()    : confettis e estrelas pastel no chão (sempre abaixo de 0.04, para não esconder a tinta)
Uso (depois do kit):  exec(open(".../map_extras.py").read());  decorate(seed=3)  antes de finish_map()
"""
import math
import random

if "flat_disc" not in globals():                      # o parque tem o seu próprio kit
    def flat_disc(mat, x, z, r, top=0.02, segs=48):
        P.cone(mat, (x, -z, top / 2), r, r, top, segs=segs)

MATERIALS.update({
    "Blob1": 0xFF7A8A, "Blob2": 0x6FA8FF, "Blob3": 0xFFDD66, "Blob4": 0x6FE08A, "Blob5": 0xB98BFF, "Blob6": 0xFFAA55, "Blob7": 0xFF9FD0, "Blob8": 0x5FE0D2,
    "Eye": 0xFFFFFF, "Pupil": 0x20222E, "Cheek": 0xFF9FB0,
    "Conf1": 0xFFB3BA, "Conf2": 0xBAE1FF, "Conf3": 0xFFFFBA, "Conf4": 0xBAFFC9, "Conf5": 0xE0BBFF, "Conf6": 0xFFDFBA,
    "BuntingString": 0x4A5368,
})
for _k, _v in {"Red": 0xFF5A66, "Blue": 0x4D8CFF, "Yellow": 0xFFD84A, "Green": 0x47CC63, "Orange": 0xFF9A3C, "Purple": 0xA06BFF,
               "LampPole": 0x4A5368, "Glow": 0xFFF3B8, "Pink": 0xFF8FC0, "Teal": 0x4FD6C8, "White": 0xFFFFFF}.items():
    MATERIALS.setdefault(_k, _v)                                      # (o parque não tem todas)
ROUGH.update({"Eye": 0.2, "Pupil": 0.2})
_PAINTS = ["Red", "Blue", "Yellow", "Green", "Orange", "Purple"]
_WALL_TOP = 2.78


def _blob(x, y, z, nx, ny, mat, s=1.0, part=None):
    """Bichinho leve: corpo redondo, olhos grandes virados para (nx, ny) e dois bracinhos."""
    Q = part or P
    tx, ty = -ny, nx
    Q.sphere(mat, (x, y, z + 0.85 * s), (0.85 * s, 0.85 * s, 0.9 * s), segs=14, rings=9)
    for sgn in (-1, 1):
        ex, ey = x + nx * 0.62 * s + tx * sgn * 0.3 * s, y + ny * 0.62 * s + ty * sgn * 0.3 * s
        Q.sphere("Eye", (ex, ey, z + 1.18 * s), (0.25 * s, 0.25 * s, 0.3 * s), segs=8, rings=5)
        Q.sphere("Pupil", (ex + nx * 0.14 * s, ey + ny * 0.14 * s, z + 1.18 * s), (0.12 * s, 0.12 * s, 0.17 * s), segs=6, rings=4)
        Q.sphere(mat, (x + tx * sgn * 0.86 * s, y + ty * sgn * 0.86 * s, z + 0.7 * s), (0.22 * s, 0.22 * s, 0.4 * s), segs=8, rings=6)


def spectators(seed=1, step=4.6):
    rnd = random.Random(seed)
    mats = ["Blob%d" % i for i in range(1, 9)]
    walls = [((-50 + step / 2, 50, step), (35.65, -1)), ((-50 + step / 2, 50, step), (-35.65, 1)),
             ((-33 + step / 2, 33, step), (50.65, 1)), ((-33 + step / 2, 33, step), (-50.65, -1))]
    n = 0
    for idx, ((a, b, st), (fixed, inward)) in enumerate(walls):
        t = a
        while t < b:
            if rnd.random() < 0.72:
                m = mats[rnd.randrange(len(mats))]
                s = 0.85 + rnd.random() * 0.35
                if idx < 2:   # muros compridos (ao longo de x)
                    x, y, nx, ny = t + rnd.uniform(-0.6, 0.6), fixed, 0.0, float(inward)
                else:
                    x, y, nx, ny = fixed, t + rnd.uniform(-0.6, 0.6), -float(inward) if False else (-1.0 if fixed > 0 else 1.0), 0.0
                if rnd.random() < 0.14 and "anim" in globals():
                    part = anim("Fan%d" % n, x, -y, _WALL_TOP, kind="bob", amp=0.22, speed=2.5 + rnd.random() * 2, phase=rnd.random() * 6)
                    _blob(x, y, _WALL_TOP, nx, ny, m, s, part)
                else:
                    _blob(x, y, _WALL_TOP, nx, ny, m, s)
                n += 1
            t += st
    return n


def bunting(h=6.4, sag=1.0):
    n = 0
    for y in (35.65, -35.65):
        xs = [-50, -25, 0, 25, 50]
        for x in xs:
            P.cone("LampPole", (x, y, _WALL_TOP + (h - _WALL_TOP) / 2), 0.14, 0.1, h - _WALL_TOP, segs=10)
            P.sphere("Glow", (x, y, h + 0.1), (0.2, 0.2, 0.2), segs=10, rings=6)
        for (x0, x1) in zip(xs[:-1], xs[1:]):
            pts = []
            for i in range(11):
                u = i / 10
                pts.append((x0 + (x1 - x0) * u, y, h - 4 * sag * u * (1 - u)))
            P.tube("BuntingString", pts, [0.04] * len(pts), sides=6, per_seg=1)
            for i in range(1, 20):
                u = i / 20
                z = h - 4 * sag * u * (1 - u)
                P.rbox(_PAINTS[(n + i) % 6], (x0 + (x1 - x0) * u, y, z - 0.38), (0.55, 0.05, 0.55), rot=(0, rad(45), 0), radius=0.03, segs=1)
            n += 1


def balloons(seed=2):
    rnd = random.Random(seed)
    k = 0
    for (cx, cy) in [(-50.2, 35.2), (50.2, 35.2), (-50.2, -35.2), (50.2, -35.2)]:
        part = anim("Balloons%d" % k, cx, -cy, _WALL_TOP, kind="bob", amp=0.35, speed=1.4, phase=k * 1.3) if "anim" in globals() else P
        for j in range(5):
            bx, by = cx + rnd.uniform(-1.0, 1.0), cy + rnd.uniform(-1.0, 1.0)
            bz = _WALL_TOP + 4.2 + rnd.uniform(0.0, 2.4)
            part.sphere(_PAINTS[(j + k) % 6], (bx, by, bz), (0.78, 0.78, 0.95), segs=16, rings=10)
            part.cone(_PAINTS[(j + k) % 6], (bx, by, bz - 1.0), 0.14, 0.02, 0.28, segs=6)
            part.tube("BuntingString", [(bx, by, bz - 1.1), (cx + (bx - cx) * 0.3, cy + (by - cy) * 0.3, (bz + _WALL_TOP) / 2), (cx, cy, _WALL_TOP)], [0.025, 0.025, 0.025], sides=5, per_seg=2)
        k += 1


def confetti(seed=4, n=90):
    rnd = random.Random(seed)
    for i in range(n):
        x, z = rnd.uniform(3, 48), rnd.uniform(-33, 33)
        if x > 33 and abs(z) < 10:
            continue                                                  # perto das bases não
        mat = "Conf%d" % (1 + rnd.randrange(6))
        r = rnd.uniform(0.14, 0.34)
        top = 0.016 + (i % 8) * 0.0022                                # alturas diferentes: sem z-fighting
        segs = 5 if rnd.random() < 0.4 else 20
        for sx in (1, -1):
            flat_disc(mat, sx * x, z, r, top=top, segs=segs)


def _free(x, z, r):
    """True se (x, z) está a mais de r metros de todos os colisores."""
    for c in colliders:
        if c[0] in ("box", "ramp"):
            dx = max(abs(x - c[1]) - c[3] / 2, 0); dz = max(abs(z - c[2]) - c[4] / 2, 0)
            if math.hypot(dx, dz) < r:
                return False
        elif math.hypot(x - c[1], z - c[2]) < c[3] + r:
            return False
    return True


def climbables(seed=7, patrol=(), crates=4, podiums=1):
    """Caixotes e pódios baixos (<= 1,35 m) onde o jogador pode saltar para cima e ficar de pé (os bots contornam-nos)."""
    rnd = random.Random(seed)
    placed = []
    cols = ["Orange", "Yellow", "Blue", "Pink", "Teal", "Purple"]
    kinds = ["crate"] * crates + ["podium"] * podiums
    n = 0
    for kind in kinds:
        for _ in range(600):
            x, z = round(rnd.uniform(6, 45) * 2) / 2, round(rnd.uniform(-30, 30) * 2) / 2
            if x > 32 and abs(z) < 10:
                continue
            if any(math.hypot(x - px, z - pz) < 5 or math.hypot(-x - px, z - pz) < 5 for (px, pz) in patrol):
                continue
            if any(math.hypot(x - qx, z - qz) < 11 for (qx, qz) in placed):
                continue
            if not (_free(x, z, 3.2) and _free(-x, z, 3.2)):
                continue
            placed.append((x, z))
            for sx in (1, -1):
                X = sx * x
                m = cols[n % len(cols)]
                if kind == "crate":
                    h = 0.9 if n % 2 == 0 else 1.2
                    P.rbox(m, (X, -z, h / 2), (2.3, 2.3, h), radius=0.16, segs=3)
                    P.rbox("White", (X, -z, h + 0.02), (2.0, 0.22, 0.05), radius=0.02, segs=1)
                    P.rbox("White", (X, -z, h + 0.02), (0.22, 2.0, 0.05), radius=0.02, segs=1)
                    colliders.append(("box", X, z, 2.3, 2.3, h, True))
                else:                                                   # pódio de dois degraus (0,8 m e 1,35 m)
                    P.rbox(m, (X, -z, 0.4), (4.4, 2.8, 0.8), radius=0.18, segs=3)
                    P.rbox("White", (X, -z, 0.82), (4.1, 2.5, 0.05), radius=0.05, segs=1)
                    P.rbox("Yellow", (X + sx * 0.6, -z, 1.075), (2.0, 2.0, 0.55), radius=0.14, segs=3)
                    colliders.append(("box", X, z, 4.4, 2.8, 0.8, True)); colliders.append(("box", X + sx * 0.6, z, 2.0, 2.0, 1.35, True))
            n += 1
            break
    return placed


def decorate(seed=1, wall_h=2.4, patrol=(), crowd=True, flags=True, balloon=True, conf=True):
    global _WALL_TOP
    _WALL_TOP = wall_h + 0.26
    out = {}
    if crowd:
        out["spectators"] = spectators(seed)
    if flags:
        bunting()
    if balloon:
        balloons(seed)
    if conf:
        confetti(seed + 3)
    climbables(seed + 5, patrol)
    landmarks({5: "parque", 1: "escola", 2: "restaurante", 3: "fabrica", 4: "diversoes"}.get(seed))
    return out


# ===================== marcos criativos por mapa (leves, no ar ou nos muros: sem colisões) =====================
_RAINBOW = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple"]
MATERIALS.setdefault("Cloud", 0xFFFFFF)
SKY_PARTS = globals().get("SKY_PARTS", [])                       # objetos no ar à parte (o minimapa esconde os "Anim_Sky…")


def _anim_ok():
    return "anim" in globals()


def rainbow_arch(x, z_half=34.0, top=13.0, r=0.38):
    """Arco-íris por cima da arena (de um muro ao outro, ao longo de z) em x. Objeto à parte ("Anim_Sky…", parado) para o minimapa o esconder."""
    if _anim_ok():
        Q = anim("SkyRainbow%d" % int(x), x, 0, 0, kind="spin", speed=0.0)
    else:                                                        # mapa sem anim(): o script do mapa constrói SKY_PARTS à parte
        Q = Part("Anim_SkyRainbow%d" % int(x)); SKY_PARTS.append(Q)
    for k, m in enumerate(_RAINBOW):
        pts = []
        for i in range(13):
            t = math.pi * i / 12
            pts.append((x, z_half * math.cos(t) * (1 - 0.02 * k), _WALL_TOP + (top - k * 0.55) * math.sin(t)))
        Q.tube(m, pts, [r] * len(pts), sides=6, per_seg=1)


def kite(i, x, z, h, mat):
    if not _anim_ok():
        return
    part = anim("SkyKite%d" % i, x, z, h, kind="bob", amp=0.9, speed=0.8 + 0.1 * (i % 4), phase=i * 1.7)
    part.rbox(mat, (x, -z, h), (1.5, 0.06, 1.9), rot=(0, rad(45), 0), radius=0.02, segs=1)
    part.rbox("White", (x, -z, h), (0.12, 0.08, 1.9), rot=(0, 0, 0), radius=0.01, segs=1)
    for k in range(4):
        part.rbox(_PAINTS[(i + k) % 6], (x, -z, h - 1.4 - k * 0.55), (0.35, 0.05, 0.25), rot=(0, rad(45), 0), radius=0.01, segs=1)


def paper_plane(i, z, h, speed=6.0, span=76.0):
    if not _anim_ok():
        return
    part = anim("SkyPlane%d" % i, 0, z, h, kind="loop", axis="x", speed=speed, span=span, phase=i * 17.0)
    part.cone("White", (-span / 2, -z, h), 0.7, 0.0, 2.4, rot=(0, rad(90), 0), segs=3)
    part.rbox("Blue", (-span / 2 + 0.2, -z, h - 0.1), (1.2, 0.05, 0.5), radius=0.01, segs=1)


def abc_cube(i, x, z, h, mat):
    if not _anim_ok():
        return
    part = anim("SkyBlock%d" % i, x, z, h, kind="spin", axis="z", speed=0.5 if i % 2 else -0.5)
    part.rbox(mat, (x, -z, h), (2.4, 2.4, 2.4), radius=0.25, segs=2)
    for sgn in (-1, 1):
        part.cone("White", (x, -z + sgn * 1.21, h), 0.7, 0.7, 0.05, rot=(rad(90), 0, 0), segs=8)
        part.cone("White", (x + sgn * 1.21, -z, h), 0.7, 0.7, 0.05, rot=(0, rad(90), 0), segs=8)


def donut(i, x, z, h, frosting):
    if not _anim_ok():
        return
    part = anim("SkyDonut%d" % i, x, z, h, kind="spin", axis="z", speed=0.6)
    prof = [(1.5 + 0.6 * math.cos(a), 0.6 * math.sin(a)) for a in [k * math.pi / 6 - math.pi / 2 for k in range(13)]]
    part.lathe("Cream", prof, loc=(x, -z, h), rot=(rad(28), 0, 0), segs=14, per_seg=1)
    top = [(1.5 + 0.63 * math.cos(a), 0.63 * math.sin(a) + 0.04) for a in [k * math.pi / 8 for k in range(5)]]
    part.lathe(frosting, top, loc=(x, -z, h), rot=(rad(28), 0, 0), segs=14, per_seg=1)


def gear(i, x, z, h, r=2.6, mat="Steel"):
    if not _anim_ok():
        return
    part = anim("SkyGear%d" % i, x, z, h, kind="spin", axis="y", speed=0.6 if i % 2 else -0.6)
    part.cone(mat, (x, -z, h), r, r, 0.6, rot=(rad(90), 0, 0), segs=14)
    part.cone("Yellow", (x, -z, h), r * 0.35, r * 0.35, 0.8, rot=(rad(90), 0, 0), segs=10)
    for k in range(10):
        a = k * 2 * math.pi / 10
        part.rbox(mat, (x + math.cos(a) * (r + 0.25), -z, h + math.sin(a) * (r + 0.25)), (0.7, 0.6, 0.7), rot=(0, -a, 0), radius=0.1, segs=1)


def hot_air_balloon(i, x, z, h, mat):
    if not _anim_ok():
        return
    part = anim("SkyHotAir%d" % i, x, z, h, kind="bob", amp=1.2, speed=0.5, phase=i * 2.3)
    part.sphere(mat, (x, -z, h + 3.4), (3.0, 3.0, 3.6), segs=14, rings=9)
    part.cone("White", (x, -z, h + 3.4), 3.02, 3.02, 0.8, segs=14)
    part.rbox("Wood", (x, -z, h), (1.4, 1.4, 0.9), radius=0.1, segs=1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            part.tube("BuntingString", [(x + sx * 0.6, -z + sy * 0.6, h + 0.45), (x + sx * 1.8, -z + sy * 1.8, h + 2.7)], [0.04, 0.04], sides=4, per_seg=1)


def landmarks(theme):
    if theme == "parque":
        for sx in (-1, 1):
            rainbow_arch(sx * 27.0, top=13.0)
        for i, (x, z) in enumerate([(-34, -20), (-20, 24), (-8, -26), (8, 26), (20, -24), (34, 20), (0, 12), (-14, 6)]):
            kite(i, x, z, 11 + (i % 3) * 2.5, _PAINTS[i % 6])
    elif theme == "escola":
        for i, z in enumerate([-24, -9, 9, 24]):
            paper_plane(i, z, 9 + (i % 2) * 3.5)
        for i, (x, z) in enumerate([(-44, -30), (44, -30), (-44, 30), (44, 30)]):
            abc_cube(i, x, z, 10, ["Red", "Blue", "Yellow", "Green"][i])
    elif theme == "restaurante":
        for i, (x, z) in enumerate([(-30, -26), (30, -26), (-30, 26), (30, 26), (0, 0)]):
            donut(i, x, z, 14 + (i == 4) * 3, ["Pink", "Teal", "Yellow", "Purple", "Orange"][i])
    elif theme == "fabrica":
        for i, (x, z) in enumerate([(-44, -28), (44, -28), (-44, 28), (44, 28), (-22, 0), (22, 0)]):
            gear(i, x, z, 11 + (i > 3) * 4, r=2.6 + (i > 3) * 1.2)
    elif theme == "diversoes":
        for i, (x, z) in enumerate([(-36, -26), (36, 26), (-10, 30), (10, -30)]):
            hot_air_balloon(i, x, z, 18 + (i % 2) * 4, ["Red", "Blue", "Green", "Orange"][i])
