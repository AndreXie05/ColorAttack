"""
ColorAttack - kit partilhado para construir mapas no Blender (corre dentro do Blender, via exec).

Cada mapa (build_school_map.py, ...) faz exec deste ficheiro, desenha o seu layout e chama finish_map().
Convenção: coordenadas do jogo (x, z) -> Blender (x, -z). Arena 100 x 70 m, simétrica em x.

REGRA DA TINTA: tudo o que cobre o chão tem de ficar abaixo de z = 0.04 (a camada de tinta do jogo está a 0.045),
senão a tinta fica escondida por baixo.

Marcadores no .glb:   Col_Box_n (extras w, d, top[, paint]) · Col_Cyl_n (extras r, top) · Col_Ramp_n (extras w, d, axis, y0, y1) · Patrol_n
   paint = 1: topo plano onde se pode pôr os pés e que mostra a tinta (plataformas, caixotes, muretes)

ALTURAS (ver src/movimento/surfaces.js): degraus até 0,45 m sobem-se a andar; até ~2,1 m sobe-se a saltar (agarrando a borda);
mais alto só por rampas/escadas. Níveis usados nos mapas: L1 = 1,0-1,2 m · L2 = 2,0 m · L3 = 3,0 m (por rampa ou a partir do L2).
Muros/coberturas altas (>= 2,6 m) não se sobem.
Animações (objetos à parte, com a origem no pivô; extras lidos pelo jogo):
   anim = "spin"    axis = x|y|z (eixos do jogo; y = vertical)   speed = rad/s
   anim = "bob"     sobe e desce no eixo vertical:  amp, speed
   anim = "loop"    anda num eixo e volta ao início:  axis, span, speed, phase
   anim = "counter" roda ao contrário do pai (cabinas da roda gigante)
"""
import math
import os
LOD = True                                     # os mapas usam menos polígonos nos objetos pequenos
COMMON = "/home/andrexie/Documents/ColorAttack/tools/blender/common.py"
exec(open(COMMON).read())

rad = math.radians

MATERIALS.update({
    # neutros
    "Concrete": 0xE3E7EF, "Joint": 0xCDD2DD, "Plaza": 0xF6F7FB, "PlazaRing": 0xD5DBE8, "Stone": 0xEEF0F6, "StoneDark": 0xB9C0D0,
    "Wall": 0xF4F5FA, "WallCap": 0xC4CBDB, "Foam": 0xFFFFFF, "Sea": 0x3FB4EA, "White": 0xFFFFFF, "Black": 0x20222E, "Steel": 0xC9D1DE,
    "SteelDark": 0x6B7690, "Rubber": 0x2A2D3A,
    # cores vivas partilhadas
    "Red": 0xFF5A66, "Blue": 0x4D8CFF, "Yellow": 0xFFD84A, "Green": 0x47CC63, "Orange": 0xFF9A3C, "Purple": 0xA06BFF, "Pink": 0xFF8FC0,
    "Teal": 0x4FD6C8, "Sky": 0x7FD3F2,
    # natureza
    "Lawn": 0x86E36A, "LawnDark": 0x6CCF55, "Trunk": 0xC08A5E, "PalmTrunk": 0xD2A070, "Leaf1": 0x57D872, "Leaf2": 0x3FC25F,
    "Frond": 0x2FBF6B, "Coconut": 0x7A4A2E, "Hedge": 0x47CC63, "HedgeTop": 0x62DD7B, "Wood": 0xF2B96B, "WoodDark": 0xC98E4A,
    "Metal": 0x5F6C84, "Water": 0x4CC6F5, "LampPole": 0x4A5368, "Glow": 0xFFF3B8, "Mountain": 0x7FA8D8, "MountainFar": 0xA3C2E6,
    "Snow": 0xFFFFFF, "Glass": 0x9BE2FF, "Brick": 0xE58B6B, "Cream": 0xFFF1D6,
})
ROUGH.update({"Water": 0.12, "Sea": 0.18, "Glow": 0.4, "Concrete": 0.7, "Plaza": 0.6, "Lawn": 0.9, "Glass": 0.1, "Steel": 0.3})
EMISSIVE.update({"Glow": (0xFFE9A0, 2.0), "Water": (0x2A9FD8, 0.25)})

P = Part("Visual")
colliders = []                 # ("box", x, z, w, d, top) | ("cyl", x, z, r, top)  (coordenadas do jogo)
anim_defs = []                 # (Part, pivot(blender), props dict, nome, nome_do_pai)


# ---------- atalhos ----------
def B(x, z):
    return (x, -z)


def RB(mat, x, z, w, d, h, r=0.2, z0=0.0, segs=3):
    """Caixa arredondada assente em z0 (x,z do jogo; w ao longo de x, d ao longo de z)."""
    P.rbox(mat, (x, -z, z0 + h / 2), (w, d, h), radius=r, segs=segs)


def CY(mat, x, z, r, h, z0=0.0, r2=None, segs=28):
    """Cilindro/cone assente em z0."""
    P.cone(mat, (x, -z, z0 + h / 2), r, r if r2 is None else r2, h, segs=segs)


def SP(mat, x, z, zc, rx, ry=None, rz=None, segs=24, rings=14, rot=(0, 0, 0)):
    """Esfera/elipsoide com centro em (x, z) e altura zc."""
    P.sphere(mat, (x, -z, zc), (rx, rx if ry is None else ry, rx if rz is None else rz), rot=rot, segs=segs, rings=rings)


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


def col_box(x, z, w, d, top, paint=False, **extra):
    """extra: bottom (ponte), push_x/push_z (tapete), bounce (trampolim) — ver src/movimento/surfaces.js"""
    colliders.append(("box", x, z, w, d, top, paint, extra))


def col_ramp(x, z, w, d, axis, y0, y1):
    """Rampa: altura y0 no lado mínimo do eixo (x ou z do jogo) até y1 no lado máximo."""
    colliders.append(("ramp", x, z, w, d, axis, y0, y1))


def col_cyl(x, z, r, top, **extra):
    """extra: spin (carrossel, rad/s como a animação), bounce, paint"""
    colliders.append(("cyl", x, z, r, top, extra))


waters = []                    # água que elimina: (x, z, w, d, top)
gates = []                     # pontes-levadiças: dict(gid, x, z, w, len, dx, dz, y, period, open, move, phase)
ladders = []                   # escadas de mão: (x, z, w, d, top, nx, nz)  (coordenadas do jogo; nx, nz apontam da parede para fora)


def anim(name, x, z, zc=0.0, kind="spin", axis="z", speed=1.0, amp=0.0, span=0.0, phase=0.0, parent=None):
    """Cria um objeto animado: devolve um Part com a origem no pivô (x, z, zc). Adiciona-lhe formas com coordenadas
    ABSOLUTAS do Blender (como no resto do kit): o pivô só define o ponto de rotação.  axis em eixos do Blender (x,y,z)."""
    part = Part("Anim_" + name)
    tri = {"x": "x", "y": "z", "z": "y"}[axis]            # eixo do Blender -> eixo do glTF/Three
    props = {"anim": kind, "axis": tri, "speed": float(speed), "amp": float(amp), "span": float(span), "phase": float(phase)}
    anim_defs.append((part, (x, -z, zc), props, "Anim_" + name, ("Anim_" + parent) if parent else None))
    return part


# ---------- chão e fundo ----------
def slab(w=103.4, d=73.4, color="Concrete", joints=True, tile=5.0):
    P.rbox(color, (0, 0, -0.8), (w, d, 1.6), radius=0.3)
    P.rbox("Foam", (0, 0, -1.2), (w + 3.1, d + 3.1, 0.3), radius=0.5)
    if joints:
        for i in range(-int(50 / tile) + 1, int(50 / tile)):
            P.box("Joint", (i * tile, 0, 0.006), (0.08, 70, 0.012))
        for j in range(-int(35 / tile) + 1, int(35 / tile)):
            P.box("Joint", (0, j * tile, 0.006), (100, 0.08, 0.012))


def sea(z=-1.55, color="Sea"):
    P.box(color, (0, 0, z), (1400, 1400, 0.2))


def walls(mat="Wall", cap="WallCap", h=2.4):
    hx, hz = 50.0, 35.0
    for (x, y, w, d) in [(0, hz + 0.65, 104.6, 1.3), (0, -hz - 0.65, 104.6, 1.3), (hx + 0.65, 0, 1.3, 72.6), (-hx - 0.65, 0, 1.3, 72.6)]:
        P.rbox(mat, (x, y, h / 2), (w, d, h), radius=0.3)
        P.rbox(cap, (x, y, h + 0.1), (w + 0.4, d + 0.2, 0.28), radius=0.1, segs=2)
    col_box(0, -hz - 0.75, 104.6, 1.5, h)
    col_box(0, hz + 0.75, 104.6, 1.5, h)
    col_box(-hx - 0.75, 0, 1.5, 72.6, h)
    col_box(hx + 0.75, 0, 1.5, 72.6, h)


def flat_rect(mat, x, z, w, d, top=0.02):
    """Retângulo plano no chão (nunca acima de 0.04)."""
    P.box(mat, (x, -z, top / 2), (w, d, top))


def flat_disc(mat, x, z, r, top=0.02, segs=48):
    P.cone(mat, (x, -z, top / 2), r, r, top, segs=segs)


# ---------- árvores e adereços comuns ----------
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
    for k in range(9):
        a = k * 2 * math.pi / 9 + 0.2
        for (tilt, length, wdt) in [(rad(22), 2.2, 0.55), (rad(48), 1.9, 0.5)]:
            ln = length * s
            P.sphere("Frond", (tx + math.cos(a) * ln * math.cos(tilt) * 0.95, ty + math.sin(a) * ln * math.cos(tilt) * 0.95, tz + 0.15 - ln * math.sin(tilt) * 0.95),
                     (ln, wdt * s, 0.09 * s), rot=(0, tilt, a), segs=8, rings=5)
    for k in range(3):
        a = k * 2.1
        P.sphere("Coconut", (tx + math.cos(a) * 0.4, ty + math.sin(a) * 0.4, tz - 0.25), (0.28 * s, 0.28 * s, 0.28 * s), segs=10, rings=8)
    col_cyl(x, z, 0.7 * s, 8)


def lamp(x, z, h=6.4):
    px, py = B(x, z)
    P.cone("LampPole", (px, py, h / 2), 0.2, 0.14, h, segs=12)
    P.sphere("Glow", (px, py, h + 0.3), (0.65, 0.65, 0.65), segs=16, rings=10)
    P.cone("LampPole", (px, py, 0.25), 0.4, 0.4, 0.5, segs=12)


def hedge(x, z, w, d, h=3.2):
    bx, by = B(x, z)
    P.rbox("Hedge", (bx, by, h / 2), (w, d, h), radius=0.7, segs=4)
    P.rbox("HedgeTop", (bx, by, h + 0.1), (w * 0.9, d * 0.8, 0.4), radius=0.18)
    col_box(x, z, w, d, h + 0.3)


def block(x, z, w, d, h=2.6, top="BlockTop", body="Stone", topcolor=0x7FD3F2):
    MATERIALS.setdefault("BlockTop", topcolor)
    bx, by = B(x, z)
    P.rbox(body, (bx, by, h / 2), (w, d, h), radius=0.4, segs=3)
    P.rbox(top, (bx, by, h + 0.05), (w + 0.1, d + 0.1, 0.3), radius=0.12, segs=2)
    col_box(x, z, w, d, h)


def bench(x, z, face, wood="Wood"):
    F = Frame(x, z, 0.0 if face > 0 else math.pi)
    P.rbox(wood, F.pt(0, 0, 0.7), (3.4, 1.1, 0.24), rot=F.rot, radius=0.08, segs=2)
    P.rbox(wood, F.pt(0, 0.5, 1.25), (3.4, 0.22, 0.9), rot=F.rot, radius=0.08, segs=2)
    for sx in (-1.5, 1.5):
        P.rbox("Metal", F.pt(sx, 0, 0.35), (0.24, 1.0, 0.72), rot=F.rot, radius=0.07, segs=2)
    col_box(x, z, 3.4, 1.2, 1.2)


def ball(x, z, r, mat):
    px, py = B(x, z)
    P.sphere(mat, (px, py, r), (r, r, r), segs=28, rings=16)
    for k in range(3):
        a = k * 2.1
        P.sphere("White", (px + math.cos(a) * r * 0.9, py + math.sin(a) * r * 0.9, r + 0.1 * r), (r * 0.32, r * 0.32, r * 0.1), rot=(0, rad(20), a), segs=12, rings=8)
    col_cyl(x, z, r, 2 * r)


def building(x, z, w, d, h, wall, roof, face="+z", rows=None, glass="Glass", z0=0.0, band=None):
    """Edifício decorativo (só visual): paredes, telhado em faixa e janelas na face indicada."""
    bx, by = B(x, z)
    P.rbox(wall, (bx, by, z0 + h / 2), (w, d, h), radius=0.5, segs=2)
    P.rbox(roof, (bx, by, z0 + h + 0.4), (w + 1.2, d + 1.2, 0.9), radius=0.3, segs=2)
    if band:
        P.rbox(band, (bx, by, z0 + h * 0.5), (w + 0.2, d + 0.2, 0.6), radius=0.1, segs=2)
    n_row = rows if rows is not None else max(1, int((h - 2) / 4))
    onz = face[1] == "z"
    length = w if onz else d
    cols = max(1, int(length / 5))
    sgn = 1 if face[0] == "+" else -1
    for i in range(cols):
        u = -length / 2 + (i + 0.5) * length / cols
        for j in range(n_row):
            zz = z0 + 2.2 + j * 4.0
            if onz:
                # +z do jogo = -y do Blender
                P.rbox(glass, (bx + u, by - sgn * (d / 2 + 0.05), zz + 1.1), (2.4, 0.18, 2.4), radius=0.15, segs=1)
            else:
                P.rbox(glass, (bx + sgn * (w / 2 + 0.05), by - u, zz + 1.1), (0.18, 2.4, 2.4), radius=0.15, segs=1)


# ---------- arena com vários níveis (estilo foto.png: cimento claro, plataformas, rampas, caixotes) ----------
MATERIALS.update({
    "PlatTop": 0xF2F4F7, "PlatSide": 0xC3CAD4, "PlatTrim": 0x8C96A6, "RampTop": 0xE6E9EE, "RampGrip": 0xB4BCC8,
    "Crate": 0xD9A066, "CrateDark": 0xA8703F, "Rail": 0x5F6C84, "Accent": 0x4FD6C8,
})
ROUGH.update({"PlatTop": 0.75, "PlatSide": 0.8, "RampTop": 0.8, "Crate": 0.7})
LOOK = {"top": "PlatTop", "side": "PlatSide", "trim": "PlatTrim", "accent": "Accent", "ramp": "RampTop", "grip": "RampGrip"}   # cada mapa pode mudar


def platform(x, z, w, d, h, z0=0.0, accent=True, look=None):
    """Plataforma de betão (topo claro, lados mais escuros, faixa colorida) onde se pode subir. h = altura acima de z0."""
    L = dict(LOOK, **(look or {}))
    RB(L["side"], x, z, w, d, h - 0.14, r=0.1, z0=z0, segs=1)
    RB(L["top"], x, z, w + 0.08, d + 0.08, 0.16, r=0.05, z0=z0 + h - 0.16, segs=1)
    if accent and h >= 0.8:
        RB(L["accent"], x, z, w + 0.05, d + 0.05, 0.16, r=0.03, z0=z0 + h - 0.42, segs=1)
    col_box(x, z, w, d, z0 + h, paint=True)


def _wedge(mat, cx, cy, w, d, z0, h0, h1, axis):
    """Cunha (coordenadas do Blender): altura h0 no lado -axis e h1 no lado +axis (axis = 'x' ou 'y')."""
    tmp = bmesh.new(); bot = []; top = []
    for (ux, uy) in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        t = (ux + 1) / 2 if axis == "x" else (uy + 1) / 2
        h = max(h0 + (h1 - h0) * t, 0.02)
        bot.append(tmp.verts.new((cx + ux * w / 2, cy + uy * d / 2, z0)))
        top.append(tmp.verts.new((cx + ux * w / 2, cy + uy * d / 2, z0 + h)))
    tmp.faces.new(bot[::-1]); tmp.faces.new(top)
    for i in range(4):
        j = (i + 1) % 4
        tmp.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces[:])
    P._add(tmp, mat, smooth=False)


def ramp(x, z, w, d, axis, y0, y1, look=None):
    """Rampa (x, z do jogo): sobe de y0 (lado mínimo do eixo do jogo) até y1 (lado máximo). Riscas antiderrapantes."""
    L = dict(LOOK, **(look or {}))
    if axis == "x":
        _wedge(L["ramp"], x, -z, w, d, 0.0, y0, y1, "x")
        n = int(w / 0.9)
        for k in range(1, n):                                               # riscas
            t = k / n; px = x - w / 2 + t * w; h = y0 + (y1 - y0) * t
            P.box(L["grip"], (px, -z, h + 0.01), (0.12, d * 0.86, 0.05))
    else:                                                                   # z do jogo = -y do Blender
        _wedge(L["ramp"], x, -z, w, d, 0.0, y1, y0, "y")
        n = int(d / 0.9)
        for k in range(1, n):
            t = k / n; pz = z - d / 2 + t * d; h = y0 + (y1 - y0) * t
            P.box(L["grip"], (x, -pz, h + 0.01), (w * 0.86, 0.12, 0.05))
    col_ramp(x, z, w, d, axis, y0, y1)


def stairs(x, z, w, d, axis, h, up=1, z0=0.0, look=None):
    """Escada de altura h (degraus de <= 0,4 m, sobem-se a andar) ao longo do eixo do jogo; up = +1 sobe para +eixo, -1 para -eixo."""
    L = dict(LOOK, **(look or {}))
    n = max(1, int(math.ceil(h / 0.4)))
    length = w if axis == "x" else d
    for k in range(n):
        hk = z0 + h * (k + 1) / n
        u = (-length / 2 + (k + 0.5) * length / n) * up
        sx, sz = (x + u, z) if axis == "x" else (x, z + u)
        sw, sd = (length / n, d) if axis == "x" else (w, length / n)
        RB(L["side"], sx, sz, sw, sd, hk - 0.08, r=0.04, segs=1)
        RB(L["top"], sx, sz, sw + 0.02, sd + 0.02, 0.1, r=0.03, z0=hk - 0.1, segs=1)
        col_box(sx, sz, sw, sd, hk, paint=True)


def crate(x, z, s=1.6, h=None, z0=0.0, yaw=0.0):
    """Caixote de madeira (como na foto) onde se pode subir."""
    h = h or s
    F = Frame(x, z, yaw)
    P.rbox("Crate", F.pt(0, 0, z0 + h / 2), (s, s, h), rot=F.rot, radius=0.06, segs=1)
    for (lx, ly) in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:                   # cantoneiras
        P.box("CrateDark", F.pt(lx * (s / 2 - 0.06), ly * (s / 2 - 0.06), z0 + h / 2), (0.16, 0.16, h + 0.02), rot=F.rot)
    for ly in (-1, 1):                                                       # tábuas em X nas faces
        for lz in (0.18, h - 0.18):
            P.box("CrateDark", F.pt(0, ly * (s / 2 + 0.01), z0 + lz), (s - 0.1, 0.05, 0.14), rot=F.rot)
    col_box(x, z, s, s, z0 + h, paint=True)


def low_wall(x, z, w, d, h=1.1, z0=0.0, look=None, solid=False, bottom=None):
    """Murete de cobertura (protege as pernas e o corpo dos tiros rasteiros; dá para saltar para cima).
    solid=True: não se pode pôr os pés em cima (margens do rio, parapeitos de pontes)."""
    L = dict(LOOK, **(look or {}))
    RB(L["side"], x, z, w, d, h - 0.1, r=0.08, z0=z0, segs=1)
    RB(L["top"], x, z, w + 0.1, d + 0.1, 0.12, r=0.04, z0=z0 + h - 0.12, segs=1)
    extra = {"solid": 1} if solid else {}
    if bottom is not None:
        extra["bottom"] = bottom
    col_box(x, z, w, d, z0 + h, paint=not solid, **extra)


def tall_wall(x, z, w, d, h=3.2, z0=0.0, look=None):
    """Parede alta de cobertura (não se sobe)."""
    L = dict(LOOK, **(look or {}))
    RB(L["side"], x, z, w, d, h, r=0.12, z0=z0, segs=1)
    RB(L["accent"], x, z, w + 0.06, d + 0.06, 0.25, r=0.04, z0=z0 + h - 0.6, segs=1)
    RB(L["top"], x, z, w + 0.12, d + 0.12, 0.14, r=0.04, z0=z0 + h, segs=1)
    col_box(x, z, w, d, z0 + h + 0.14)


def ramp_up(x, z, w, d, axis, h0, h1, up=1, look=None):
    """Rampa que sobe de h0 a h1 no sentido +eixo (up = +1) ou -eixo (up = -1)."""
    ramp(x, z, w, d, axis, *((h0, h1) if up > 0 else (h1, h0)), look=look)


def spiral_tower(cx, cz, s=1, c=2.0, w=2.6, rise=1.4, hide=True, look=None):
    """Torre com rampa às voltas (3 lados, cada um sobe `rise`) até ao topo a 3*rise m (~4,2 m), espelhada por s.
    Em cima: esconderijo com parede alta virada para o centro do mapa e uma fresta para disparar.
    Coordenadas locais: +lx = para a base da equipa (s), -lx = para o centro (de onde vem o inimigo)."""
    X = lambda lx: cx + s * lx
    o = c + w / 2
    top = 3 * rise
    platform(cx, cz, 2 * c, 2 * c, top, look=look)                                      # núcleo (parede alta até lá acima)
    ramp_up(X(0), cz - o, 2 * c, w, "x", 0.0, rise, up=s, look=look)                    # 1.º lance (lado -z), sobe para a base
    platform(X(o), cz - o, w, w, rise, accent=False, look=look)                         # patamar
    ramp_up(X(o), cz, w, 2 * c, "z", rise, 2 * rise, up=1, look=look)                  # 2.º lance (lado da base), sobe para +z
    platform(X(o), cz + o, w, w, 2 * rise, accent=False, look=look)                     # patamar
    ramp_up(X(0), cz + o, 2 * c, w, "x", 2 * rise, top, up=-s, look=look)              # 3.º lance (lado +z), sobe para o centro
    platform(X(-o), cz + o, w, w, top, accent=False, look=look)                         # varanda no fim (passa-se para o núcleo)
    if hide:                                                                             # esconderijo: parede com fresta virada para o centro
        piece = (2 * c - 1.0) / 2
        for sz in (-1, 1):
            tall_wall(X(-c + 0.3), cz + sz * (0.5 + piece / 2), 0.6, piece, h=2.2, z0=top, look=look)
        low_wall(X(-c + 0.3), cz, 0.6, 1.0, h=0.9, z0=top, look=look, solid=True)        # fresta: murete baixo, dispara-se por cima (não se sobe)
    return top


def sniper_ledge(x0, x1, z, s=1, h=3.2, w=3.0, ledge=7.0, look=None):
    """Rampa comprida ao longo de um muro (de x0 a x1, do centro para a base) até um posto alto com murete e paredes laterais."""
    L = abs(x1 - x0)
    ramp_up(s * (x0 + x1) / 2, z, L, w, "x", 0.0, h, up=s, look=look)
    lx = s * (x1 + ledge / 2)
    sg = 1 if z > 0 else -1                                                             # lado do muro
    platform(lx, z, ledge, w + 1.0, h, look=look)
    low_wall(lx, z - sg * ((w + 1.0) / 2 - 0.3), ledge - 0.4, 0.6, h=1.0, z0=h, look=look, solid=True)   # murete virado para a arena: dispara-se por cima
    tall_wall(s * (x1 + ledge - 0.3), z, 0.6, w + 1.0, h=2.2, z0=h, look=look)          # parede ao fundo: esconderijo
    return h


def railing(x0, z0, x1, z1, y, mat="Rail", h=0.9):
    """Grade só visual na borda de uma plataforma (sem colisão: não atrapalha)."""
    L = math.hypot(x1 - x0, z1 - z0); n = max(1, int(L / 1.6))
    for k in range(n + 1):
        t = k / n
        CY(mat, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.05, h, z0=y, segs=6)
    P.tube(mat, [(x0, -z0, y + h), (x1, -z1, y + h)], [0.06, 0.06], sides=6, per_seg=1)


# ---------- mecânicas novas: escadas de mão, pontes/passadiços, tapetes rolantes, trampolins ----------
for _k, _v in {"Hazard": 0xFFD84A, "Tomato": 0xFF4D4D, "Cheese": 0xFFD866, "Label": 0xFFF6E0}.items():
    MATERIALS.setdefault(_k, _v)
MATERIALS.update({"Ladder": 0xFFD84A, "Grate": 0x8C96A6, "BeltTop": 0x2E3345, "BeltArrow": 0xFFD84A, "Tramp": 0x2E3345, "TrampRim": 0xFF5A66})


def ladder(x, z, top, nx, nz, z0=0.0, mat="Ladder"):
    """Escada de mão encostada a uma parede (x, z = pé da escada, junto à parede; nx, nz = para fora da parede).
    Sobe-se a andar contra ela; no topo passa-se para cima. Zona de 1,2 m x 1,1 m à frente da parede."""
    tx, tz = -nz, nx                                                     # direção ao longo da parede
    for sg in (-1, 1):
        px, pz = x + tx * sg * 0.45 + nx * 0.25, z + tz * sg * 0.45 + nz * 0.25
        CY(mat, px, pz, 0.07, top - z0 + 0.9, z0=z0, segs=6)
    k = 0
    h = z0 + 0.35
    while h < top + 0.6:
        cx, cz = x + nx * 0.25, z + nz * 0.25
        P.cone(mat, (cx, -cz, h), 0.05, 0.05, 0.9, rot=(0, rad(90), 0) if abs(tx) > 0.5 else (rad(90), 0, 0), segs=6)
        h += 0.42
    ladders.append((x + nx * 0.55, z + nz * 0.55, 1.1 if abs(nx) > 0.5 else 1.2, 1.2 if abs(nx) > 0.5 else 1.1, top, nx, nz))


def catwalk(x, z, w, d, y, rails=True, open_ends=(), look=None):
    """Passadiço de grelha a y m de altura (passa-se por baixo: fundo a y - 0,35). Muretes de proteção nos lados compridos,
    com bottom, para não se cair sem querer. open_ends: lados sem murete ('-x', '+x', '-z', '+z')."""
    P.rbox("Grate", (x, -z, y - 0.17), (w, d, 0.34), radius=0.04, segs=1)
    P.rbox("PlatTop", (x, -z, y - 0.02), (w - 0.1, d - 0.1, 0.04), radius=0.01, segs=1)
    col_box(x, z, w, d, y, paint=True, bottom=y - 0.35)
    L = max(w, d); n = int(L // 11)                                       # pilares de suporte (finos)
    for k in range(1, n + 1):
        u = -L / 2 + k * L / (n + 1)
        px, pz = (x + u, z) if w >= d else (x, z + u)
        CY("SteelDark", px, pz, 0.22, y - 0.34, segs=10)
        CY("Hazard", px, pz, 0.24, 0.6, segs=10)
        col_cyl(px, pz, 0.25, y - 0.35)
    if not rails:
        return
    for side in ("-x", "+x", "-z", "+z"):
        if side in open_ends:
            continue
        along_x = side[1] == "z"
        if (along_x and w < d * 0.5) or (not along_x and d < w * 0.5):
            continue                                                     # só nos lados compridos (as pontas ficam abertas)
        sg = 1 if side[0] == "+" else -1
        if along_x:
            cx, cz, rw, rd = x, z + sg * (d / 2 - 0.08), w, 0.16
        else:
            cx, cz, rw, rd = x + sg * (w / 2 - 0.08), z, 0.16, d
        n = max(1, int((rw if along_x else rd) / 1.5))
        for k in range(n + 1):
            u = -0.5 + k / n
            px, pz = (cx + u * rw, cz) if along_x else (cx, cz + u * rd)
            CY("Rail", px, pz, 0.05, 1.0, z0=y, segs=6)
        P.rbox("Ladder", (cx, -cz, y + 1.0), (rw, rd, 0.1), radius=0.03, segs=1)
        col_box(cx, cz, rw, rd, y + 1.05, bottom=y)                      # grade (com fundo: não tapa o chão por baixo)


def bridge(x, z, w, d, y, look=None, mat=None):
    """Ponte maciça a y m (passa-se por baixo: fundo a y - 0,6) com muretes baixos nos lados compridos."""
    L = dict(LOOK, **(look or {}))
    RB(mat or L["side"], x, z, w, d, 0.6, r=0.08, z0=y - 0.6, segs=1)
    RB(L["top"], x, z, w + 0.06, d + 0.06, 0.1, r=0.03, z0=y - 0.1, segs=1)
    col_box(x, z, w, d, y, paint=True, bottom=y - 0.6)
    along_x = w >= d
    for sg in (-1, 1):
        if along_x:
            cx, cz, rw, rd = x, z + sg * (d / 2 - 0.15), w, 0.3
        else:
            cx, cz, rw, rd = x + sg * (w / 2 - 0.15), z, 0.3, d
        RB(L["accent"], cx, cz, rw, rd, 0.8, r=0.05, z0=y, segs=1)
        col_box(cx, cz, rw, rd, y + 0.8, bottom=y)


def conveyor_floor(x, z, w, d, push_x=0.0, push_z=0.0, k=0):
    """Tapete rolante no chão (0,25 m: sobe-se a andar) que empurra quem está em cima; caixas animadas mostram o sentido."""
    RB("SteelDark", x, z, w, d, 0.2, r=0.05, segs=1)
    RB("BeltTop", x, z, w - 0.3, d - 0.2, 0.06, r=0.02, z0=0.2, segs=1)
    for sg in (-1, 1):                                                   # bordas amarelas
        if abs(push_z) > 0:
            RB("Hazard", x + sg * (w / 2 - 0.1), z, 0.2, d, 0.3, r=0.03, segs=1)
        else:
            RB("Hazard", x, z + sg * (d / 2 - 0.1), w, 0.2, 0.3, r=0.03, segs=1)
    col_box(x, z, w, d, 0.25, push_x=push_x, push_z=push_z)
    span = d if abs(push_z) > 0 else w
    speed = abs(push_z or push_x)
    sgn = 1 if (push_z or push_x) > 0 else -1
    axis = "y" if abs(push_z) > 0 else "x"                               # eixo do Blender (z do jogo = -y)
    for i in range(int(span // 4)):                                      # setas que andam no sentido do tapete
        a = anim("Belt%d_%d" % (k, i), x, z, 0.3, kind="loop", axis=axis, speed=speed * sgn,           # (o eixo y do Blender passa a z do jogo)
                 span=span - 1.0, phase=i * 4.0)
        if axis == "y":
            a.cone("BeltArrow", (x, -z, 0.3), 0.6, 0.6, 0.05, rot=(0, 0, -rad(90) if sgn > 0 else rad(90)), segs=3)
        else:
            a.cone("BeltArrow", (x, -z, 0.3), 0.6, 0.6, 0.05, rot=(0, 0, 0 if sgn > 0 else rad(180)), segs=3)


def trampoline(x, z, bounce=19.0, r=1.4):
    """Trampolim: atira quem pousa nele ao ar (bounce m/s; 19 -> ~7,5 m). Os saltos de trampolim não contam como queda."""
    px, py = B(x, z)
    for k in range(6):
        a = k * math.pi / 3
        CY("SteelDark", x + math.cos(a) * r * 0.9, z + math.sin(a) * r * 0.9, 0.07, 0.3, segs=6)
    P.cone("TrampRim", (px, py, 0.33), r, r, 0.12, segs=24)
    P.cone("Tramp", (px, py, 0.36), r * 0.82, r * 0.82, 0.04, segs=24)
    P.cone("Yellow", (px, py, 0.385), r * 0.3, r * 0.3, 0.01, segs=16)
    col_cyl(x, z, r, 0.38, bounce=bounce)


def shelves(x, z, w, d, levels, z0=0.0, goods=("Tomato", "Cheese", "Label"), face=1):
    """Estante da despensa: bloco maciço com prateleiras e latas à frente (face = +1 frente para +x do jogo). Topo pintável."""
    top = z0 + levels * 1.2
    RB("WoodDark", x, z, w, d, top - z0, r=0.06, z0=z0, segs=1)
    for k in range(levels):
        h = z0 + (k + 1) * 1.2
        RB("Wood", x, z, w + 0.12, d + 0.12, 0.12, r=0.03, z0=h - 0.12, segs=1)
        n = max(1, int(d / 0.8))
        for i in range(n):                                               # latas na frente de cada prateleira
            u = -d / 2 + (i + 0.5) * d / n
            CY(goods[(i + k) % len(goods)], x + face * (w / 2 + 0.2), z + u, 0.3, 0.75, z0=h - 1.1, segs=10)
    col_box(x, z, w + 0.5, d, top, paint=True)
    return top


def drawbridge(gid, x, z, w, length, dx, dz, y, period=26.0, open_s=15.0, move=2.0, phase=0.0, mat="WoodDark", plank="Wood", iron="Iron"):
    """Ponte-levadiça (x, z = dobradiça; desce no sentido (dx, dz) do jogo). Construída deitada (em baixo); o jogo roda-a
    para cima e para baixo (anim "gate") e troca a colisão (ponte em baixo / parede levantada). Correntes só visuais."""
    ex, ez = x + dx * length / 2, z + dz * length / 2
    if dx:
        axis, gw, gd = "y", length, w                                       # roda em volta do eixo z do jogo (= y do Blender)
    else:
        axis, gw, gd = "x", w, length
    a = anim("Gate%d" % gid, x, z, y, kind="gate", axis=axis, speed=0.0)
    a.rbox(mat, (ex, -ez, y - 0.15), (gw, gd, 0.3), radius=0.04, segs=1)
    n = int(length / 0.55)
    for k in range(n):                                                       # tábuas
        u = (k + 0.5) / n * length
        px, pz = x + dx * u, z + dz * u
        a.rbox(plank, (px, -pz, y + 0.02), (0.48 if dx else w - 0.2, w - 0.2 if dx else 0.48, 0.06), radius=0.01, segs=1)
    for sg in (-1, 1):                                                       # cintas de ferro
        off = (w / 2 - 0.35) * sg
        a.rbox(iron, (ex + (0 if dx else off), -(ez + (off if dx else 0)), y + 0.05), (gw if dx else 0.18, 0.18 if dx else gd, 0.06), radius=0.01, segs=1)
    # sinal do ângulo para a ponte levantar para o lado da dobradiça (para cima), no sistema de eixos do Three
    gsign = (1 if dx > 0 else -1) if dx else (-1 if dz > 0 else 1)
    props = anim_defs[-1][2]
    props.update({"period": float(period), "open": float(open_s), "move": float(move), "phase": float(phase), "gsign": float(gsign)})
    gates.append(dict(gid=gid, x=x, z=z, w=w, len=length, dx=dx, dz=dz, y=y, period=period, open=open_s, move=move, phase=phase))


def water(x, z, w, d, top=0.0):
    """Zona de água que elimina quem lá pousa os pés (o desenho da água é feito à parte)."""
    waters.append((x, z, w, d, top))


# ---------- finalização ----------
def finish_map(map_id, patrol, output, collection=None):
    """Cria a coleção, os objetos, os marcadores e exporta o .glb."""
    cname = collection or ("Map_" + map_id)
    old = bpy.data.collections.get(cname)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    col = bpy.data.collections.new(cname)
    bpy.context.scene.collection.children.link(col)

    visual = P.build(col)
    visual.name = "Visual"
    objs = [visual]
    built = {}
    for (part, pivot, props, name, parent) in anim_defs:           # objetos animados (origem no pivô)
        # as formas foram criadas em coordenadas absolutas: compensa para que a origem fique no pivô
        for v in part.bm.verts:
            v.co -= Vector(pivot)
        o = part.build(col, pivot)
        o.name = name
        for k, v in props.items():
            o[k] = v
        built[name] = o
        objs.append(o)
    for (part, pivot, props, name, parent) in anim_defs:
        if parent:
            child, par = built[name], built[parent]
            child.parent = par
            child.matrix_parent_inverse = par.matrix_world.inverted()
    bpy.context.view_layer.update()

    for i, c in enumerate(colliders):
        if c[0] == "box":
            e = bpy.data.objects.new("Col_Box_%d" % i, None)
            e["w"], e["d"], e["top"] = float(c[3]), float(c[4]), float(c[5])
            if len(c) > 6 and c[6]:
                e["paint"] = 1
            for k, v in (c[7] if len(c) > 7 else {}).items():
                e[k] = float(v)
        elif c[0] == "ramp":
            e = bpy.data.objects.new("Col_Ramp_%d" % i, None)
            e["w"], e["d"], e["axis"], e["y0"], e["y1"] = float(c[3]), float(c[4]), c[5], float(c[6]), float(c[7])
        else:
            e = bpy.data.objects.new("Col_Cyl_%d" % i, None)
            e["r"], e["top"] = float(c[3]), float(c[4])
            for k, v in (c[5] if len(c) > 5 else {}).items():
                e[k] = float(v)
        e.empty_display_type = "CUBE"; e.empty_display_size = 0.3
        e.location = (c[1], -c[2], 0)
        col.objects.link(e); objs.append(e)
    for i, (x, z, w, d, top) in enumerate(waters):
        e = bpy.data.objects.new("Col_Water_%d" % i, None)
        e["w"], e["d"], e["top"] = float(w), float(d), float(top)
        e.location = (x, -z, 0); col.objects.link(e); objs.append(e)
    for i, g in enumerate(gates):
        e = bpy.data.objects.new("Col_Gate_%d" % i, None)
        for k in ("gid", "w", "len", "dx", "dz", "y", "period", "open", "move", "phase"):
            e[k] = float(g[k])
        e.location = (g["x"], -g["z"], 0); col.objects.link(e); objs.append(e)
    for i, (x, z, w, d, top, nx, nz) in enumerate(ladders):
        e = bpy.data.objects.new("Col_Ladder_%d" % i, None)
        e["w"], e["d"], e["top"], e["nx"], e["nz"] = float(w), float(d), float(top), float(nx), float(nz)
        e.empty_display_type = "ARROWS"; e.empty_display_size = 0.5
        e.location = (x, -z, 0); col.objects.link(e); objs.append(e)
    n = 0
    for (x, z) in patrol:
        for sx in ((1, -1) if x != 0 else (1,)):
            e = bpy.data.objects.new("Patrol_%d" % n, None)
            e.empty_display_type = "SPHERE"; e.empty_display_size = 0.3
            e.location = (sx * x, -z, 0); col.objects.link(e); objs.append(e); n += 1
    bpy.context.view_layer.update()

    # esconde as outras coleções para ver só este mapa
    for c in bpy.data.collections:
        if c.name != cname:
            c.hide_viewport = True
    print("Mapa", map_id, "criado:", len(objs), "objetos;", len(colliders), "colisões;", len(anim_defs), "animados")

    if output:
        os.makedirs(os.path.dirname(output), exist_ok=True)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.export_scene.gltf(filepath=output, export_format="GLB", use_selection=True, export_apply=True,
                                  export_yup=True, export_materials="EXPORT", export_extras=True)
        print("Exportado", output, os.path.getsize(output), "bytes")
    return objs
