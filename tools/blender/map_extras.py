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
    """Bichinho: corpo redondo, olhos grandes virados para (nx, ny), bochechas e braços."""
    Q = part or P
    tx, ty = -ny, nx
    Q.sphere(mat, (x, y, z + 0.85 * s), (0.85 * s, 0.85 * s, 0.9 * s), segs=18, rings=12)
    for sgn in (-1, 1):
        ex, ey = x + nx * 0.62 * s + tx * sgn * 0.3 * s, y + ny * 0.62 * s + ty * sgn * 0.3 * s
        Q.sphere("Eye", (ex, ey, z + 1.18 * s), (0.25 * s, 0.25 * s, 0.3 * s), segs=12, rings=8)
        Q.sphere("Pupil", (ex + nx * 0.14 * s, ey + ny * 0.14 * s, z + 1.18 * s), (0.12 * s, 0.12 * s, 0.17 * s), segs=10, rings=6)
        Q.sphere("Cheek", (x + nx * 0.66 * s + tx * sgn * 0.5 * s, y + ny * 0.66 * s + ty * sgn * 0.5 * s, z + 0.82 * s), (0.14 * s, 0.14 * s, 0.1 * s), segs=8, rings=6)
        Q.sphere(mat, (x + tx * sgn * 0.86 * s, y + ty * sgn * 0.86 * s, z + 0.7 * s), (0.22 * s, 0.22 * s, 0.4 * s), segs=10, rings=8)


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
                if rnd.random() < 0.4 and "anim" in globals():
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
        if c[0] == "box":
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
                    colliders.append(("box", X, z, 2.3, 2.3, h))
                else:                                                   # pódio de dois degraus (0,8 m e 1,35 m)
                    P.rbox(m, (X, -z, 0.4), (4.4, 2.8, 0.8), radius=0.18, segs=3)
                    P.rbox("White", (X, -z, 0.82), (4.1, 2.5, 0.05), radius=0.05, segs=1)
                    P.rbox("Yellow", (X + sx * 0.6, -z, 1.075), (2.0, 2.0, 0.55), radius=0.14, segs=3)
                    colliders.append(("box", X, z, 4.4, 2.8, 0.8)); colliders.append(("box", X + sx * 0.6, z, 2.0, 2.0, 1.35))
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
    return out
