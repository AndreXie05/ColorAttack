"""
ColorAttack - mapa PARQUE DE DIVERSÕES (vários níveis): roda gigante, torres de queda, barracas e tendas. Ideias de altura:
  - TRAMPOLINS que te atiram ao ar (~7,5 m) para o telhado das barracas e para a TORRE DOS BILHETES (6,5 m, com
    esconderijo e escada de mão para desceres). Os saltos de trampolim não contam como queda.
  - CARROSSEL onde te pões em cima e que roda contigo (difícil de acertar).
  - RAMPA EM S de montanha-russa, que sobe às voltas até um posto a 6 m (cair lá de cima é eliminação).
Corre dentro do Blender:  OUTPUT = "/caminho/assets/maps/diversoes.glb"; exec(open(este_ficheiro).read())
Animações (lidas pelo jogo): Anim_Wheel (gira), Anim_Cabin_n (contra-rotação), Anim_Carousel_n (gira), Anim_Drop_n (sobe/desce).
"""
import math
import os
exec(open("/home/andrexie/Documents/ColorAttack/src/tools/blender/map_kit.py").read())
OUTPUT = globals().get("OUTPUT")
PAINT_NAMES = ["Red", "Blue", "Yellow", "Purple", "Orange", "Green"]

MATERIALS.update({
    "FairA": 0xF1E9FF, "FairB": 0xE0D2FF, "Path": 0xFFEDB8, "Rail": 0xF4F4FA, "Star1": 0xFF8FC0, "Roof1": 0xFF6F9F, "Roof2": 0x7B61FF,
    "StripeA": 0xFF5A66, "StripeB": 0xFFFFFF, "Gold": 0xFFC53D, "Horse1": 0xFFFFFF, "Horse2": 0xFFD1E3, "Ticket": 0xFFB347,
    "Balloon1": 0xFF5A66, "Balloon2": 0x4D8CFF, "Balloon3": 0xFFD84A, "Balloon4": 0x47CC63, "Balloon5": 0xA06BFF, "Night": 0x6A4CB5,
    "TrackRed": 0xFF5A66, "Hill": 0xB59CFF, "Fence": 0xFF8FC0,
})
ROUGH.update({"Gold": 0.25, "Path": 1.0, "FairA": 0.95, "FairB": 0.95})
MATERIALS.update({"PlatTop": 0xF7F1FF, "PlatSide": 0xCDB8F5, "Accent": 0xFF8FC0, "RampTop": 0xEFE6FF, "RampGrip": 0xB59CFF})      # chão mate: sem brilhos no centro (o caminho era brilhante com o sol)


def striped_awning(x, z, w, yaw_front):
    """Toldo às riscas (frente virada a yaw_front: +1 -> +z do jogo, -1 -> -z)."""
    F = Frame(x, z, 0.0 if yaw_front > 0 else math.pi)
    n = 7
    for i in range(n):
        P.rbox("StripeA" if i % 2 == 0 else "StripeB", F.pt(-w / 2 + (i + 0.5) * w / n, -0.2, 3.7), (w / n, 3.1, 0.16), rot=(rad(-14), 0, F.yaw) if False else F.rot,
               radius=0.04, segs=1)


def stall(x, z, face, c1, c2):
    F = Frame(x, z, 0.0 if face > 0 else math.pi)
    P.rbox(c1, F.pt(0, 0.1, 0.6), (5.2, 1.4, 1.2), rot=F.rot, radius=0.2, segs=2)               # balcão
    P.rbox(c2, F.pt(0, -0.95, 2.0), (5.2, 0.45, 4.0), rot=F.rot, radius=0.2, segs=2)             # parede de trás
    for sx in (-2.4, 2.4):
        P.rbox("White", F.pt(sx, 0.7, 1.9), (0.2, 0.2, 3.8), rot=F.rot, radius=0.06, segs=1)
    n = 7
    for i in range(n):                                                                           # toldo às riscas, inclinado
        P.rbox("StripeA" if i % 2 == 0 else "StripeB", F.pt(-2.6 + (i + 0.5) * 5.2 / n, 0.0, 4.0), (5.2 / n, 3.0, 0.15), rot=F.rot, radius=0.04, segs=1)
    for k in range(3):                                                                           # prémios no balcão
        P.sphere(["Balloon1", "Balloon3", "Balloon2"][k], F.pt(-1.5 + k * 1.5, 0.1, 1.55), (0.38, 0.38, 0.38), segs=12, rings=8)
    col_box(x, z, 5.2, 2.6, 4.0, paint=True)                                   # telhado (toldo) onde se pode pousar


def tent(x, z, c1, c2):
    px, py = B(x, z)
    P.cone(c1, (px, py, 1.1), 5.0, 5.0, 2.2, segs=36)
    P.cone("White", (px, py, 3.3), 5.05, 5.05, 2.2, segs=36)
    P.cone(c2, (px, py, 6.4), 5.8, 0.2, 4.0, segs=36)
    P.cone("White", (px, py, 8.9), 0.1, 0.1, 1.2, segs=8)
    P.rbox("Yellow", (px + 0.7, py, 9.2), (1.4, 0.06, 0.8), radius=0.02, segs=1)
    P.rbox("Black", (px, py - 5.0, 1.5), (2.4, 0.2, 3.0), radius=0.9, segs=3)                   # entrada (virada a +z)
    col_cyl(x, z, 5.1, 6)


def balloons(x, z):
    px, py = B(x, z)
    P.cone("White", (px, py, 2.0), 0.1, 0.1, 4.0, segs=8)
    for k in range(6):
        a = k * math.pi / 3
        P.sphere("Balloon%d" % (1 + k % 5), (px + math.cos(a) * 0.9, py + math.sin(a) * 0.9, 5.0 + (k % 2) * 0.55), (0.78, 0.78, 0.92), segs=14, rings=10)


def ferris_wheel(x, z):
    hub, R = 13.5, 10.0
    # base (estática): quatro pernas inclinadas + pedestais; as colisões estão nas pernas
    for dz in (-1.8, 1.8):
        for sx in (-1, 1):
            leg = [(x + sx * 6.0, -z + dz, 0.0), (x + sx * 3.0, -z + dz, hub * 0.5), (x, -z + dz, hub)]
            P.tube("Red", leg, [0.5, 0.42, 0.38], sides=10, per_seg=6)
            col_box(x + sx * 5.8, z - dz, 1.4, 1.4, 14)
        P.rbox("Steel", (x, -z + dz, hub), (1.0, 0.7, 1.0), radius=0.2, segs=2)
    P.rbox("Gold", (x, -z, 0.3), (14.6, 5.8, 0.6), radius=0.3)
    # roda (gira em volta do eixo Y do Blender = eixo z do jogo)
    wheel = anim("Wheel", x, z, hub, kind="spin", axis="y", speed=0.25)
    for dz in (-1.8, 1.8):
        ring = [(x + math.cos(t) * R, -z + dz, hub + math.sin(t) * R) for t in [k * math.pi / 18 for k in range(37)]]
        wheel.tube("Blue", ring, [0.38] * len(ring), sides=10, per_seg=2)
        for k in range(8):
            a = k * math.pi / 8
            wheel.tube("Rail", [(x - math.cos(a) * R, -z + dz, hub - math.sin(a) * R), (x + math.cos(a) * R, -z + dz, hub + math.sin(a) * R)], [0.16, 0.16], sides=6, per_seg=2)
    wheel.cone("Gold", (x, -z, hub), 1.0, 1.0, 4.4, rot=(rad(90), 0, 0), segs=20)
    for k in range(8):                                                                           # cabinas penduradas na borda
        a = k * math.pi / 4
        cx, cz_ = x + math.cos(a) * R, hub + math.sin(a) * R
        cab = anim("Cabin%d" % k, cx, z, cz_, kind="counter", axis="y", parent="Wheel")
        cab.cone("Steel", (cx, -z, cz_ - 0.5), 0.07, 0.07, 1.0, segs=6)
        cab.rbox(PAINT_NAMES[k % 6], (cx, -z, cz_ - 1.9), (2.4, 3.6, 1.5), radius=0.45, segs=3)
        cab.rbox("White", (cx, -z, cz_ - 1.05), (2.7, 3.9, 0.3), radius=0.15, segs=2)
        cab.rbox("Glass", (cx, -z + 1.82, cz_ - 1.8), (1.9, 0.08, 0.7), radius=0.1, segs=1)


def carousel(x, z, k, speed=0.6):
    """Carrossel onde se pode subir (base a 0,6 m): quem está em cima roda com ele. Os cavalinhos não têm colisão."""
    px, py = B(x, z)
    P.cone("Ticket", (px, py, 0.27), 5.2, 5.2, 0.54, segs=40)                                    # base
    car = anim("Carousel%d" % k, x, z, 0.0, kind="spin", axis="z", speed=speed)
    car.cone("Gold", (px, py, 0.58), 5.3, 5.3, 0.06, segs=40)
    for i in range(12):                                                                          # gomos coloridos: vê-se a base a rodar
        a = i * math.pi / 6
        car.cone(PAINT_NAMES[i % 6], (px + math.cos(a) * 4.3, py + math.sin(a) * 4.3, 0.615), 0.6, 0.6, 0.02, segs=10)
    car.cone("Gold", (px, py, 2.6), 0.5, 0.5, 4.0, segs=16)                                      # poste central
    car.cone("Gold", (px, py, 4.6), 6.1, 6.1, 0.35, segs=40)                                     # aro do teto
    car.cone("Roof1" if k % 2 else "Roof2", (px, py, 6.0), 5.9, 0.15, 2.6, segs=36)             # teto
    car.sphere("Yellow", (px, py, 7.4), (0.5, 0.5, 0.5), segs=12, rings=8)
    for i in range(6):
        a = i * math.pi / 3
        hx, hy = px + math.cos(a) * 3.4, py + math.sin(a) * 3.4
        car.cone("Gold", (hx, hy, 2.6), 0.1, 0.1, 4.0, segs=8)
        car.rbox(["Horse1", "Horse2"][i % 2], (hx, hy, 1.9), (0.9, 1.7, 1.0), rot=(0, 0, a + math.pi / 2), radius=0.3, segs=2)   # corpo do cavalinho
        car.sphere(["Horse1", "Horse2"][i % 2], (hx - math.sin(a) * 0.0 + math.cos(a + math.pi / 2) * 0.9, hy + math.sin(a + math.pi / 2) * 0.9, 2.6), (0.38, 0.38, 0.45), segs=12, rings=8)
        car.sphere("Pink", (hx, hy, 1.1), (0.3, 0.3, 0.2), segs=8, rings=6)
    col_cyl(x, z, 5.25, 0.6, spin=speed)                                                       # base que roda
    col_cyl(x, z, 0.6, 5.0)                                                                    # poste central


def drop_tower(x, z, k):
    px, py = B(x, z)
    P.cone("Blue", (px, py, 8.5), 1.4, 1.4, 17.0, segs=24)
    P.cone("Yellow", (px, py, 0.5), 2.4, 2.4, 1.0, segs=24)
    for h in (4, 8, 12):
        P.cone("White", (px, py, h), 1.5, 1.5, 0.4, segs=24)
    P.sphere("Red", (px, py, 17.4), (1.3, 1.3, 1.3), segs=20, rings=12)
    ring = anim("Drop%d" % k, x, z, 9.0, kind="bob", axis="z", speed=0.7, amp=6.0, phase=k * 1.7)
    ring.cone("Orange", (px, py, 9.0), 2.6, 2.6, 0.7, segs=24)
    for i in range(4):
        a = i * math.pi / 2
        ring.rbox("Purple", (px + math.cos(a) * 2.5, py + math.sin(a) * 2.5, 8.4), (1.0, 1.0, 0.7), radius=0.25, segs=2)
        ring.cone("Steel", (px + math.cos(a) * 2.5, py + math.sin(a) * 2.5, 8.9), 0.05, 0.05, 1.1, segs=6)
    col_cyl(x, z, 1.8, 17)


def fence():
    walls(mat="Fence", cap="White", h=2.4)
    for sx in range(-48, 49, 4):                                                                # postes às riscas na muralha
        for sy in (35.65, -35.65):
            P.rbox("Red" if (sx // 4) % 2 else "Yellow", (sx, sy, 3.0), (0.5, 0.5, 1.3), radius=0.2, segs=2)


def floors():
    slab(color="FairA", joints=False)
    for i in range(-10, 10):
        for j in range(-7, 7):
            if (i + j) % 2 == 0:
                flat_rect("FairB", i * 5 + 2.5, j * 5 + 2.5, 5.0, 5.0, 0.012)
    flat_rect("Path", 0, 0, 100, 5.5, 0.018); flat_rect("Path", 0, 0, 5.5, 70, 0.02)
    flat_disc("Path", 0, 0, 14, 0.026)
    for i in range(8):
        a = i * math.pi / 4
        flat_disc(PAINT_NAMES[i % 6], math.cos(a) * 11.8, math.sin(a) * 11.8, 1.0, 0.03)       # bolinhas coloridas à volta da roda


def scenery():
    P.box("Hill", (0, 0, -0.7), (1400, 1400, 1.0))
    # montanha-russa gigante atrás (norte e sul)
    for sy in (-1, 1):
        x = -135
        k = 0
        while x < 135:
            R = 8 + (k * 5) % 9
            cx, y = x + R, sy * 66
            for dz in (-1.3, 1.3):
                ring = [(cx + math.cos(t) * R, y + dz, math.sin(t) * R) for t in [m * math.pi / 14 for m in range(15)]]
                P.tube("TrackRed", ring, [0.5] * len(ring), sides=8, per_seg=3)
            P.rbox("Yellow", (cx, y, R - 0.2), (0.5, 3.0, 0.5), radius=0.15, segs=1)
            P.rbox("Rail", (cx, y, R * 0.4), (0.6, 0.6, R * 0.8), radius=0.2, segs=2)
            x += R * 2 - 1.0
            k += 1
    for sx in range(-120, 121, 14):                                                             # postes de luzes coloridas
        for sy in (-43, 43):
            P.cone("Rail", (sx, sy, 4.5), 0.2, 0.2, 9.0, segs=8)
            P.sphere("Balloon%d" % (1 + (sx // 14) % 5), (sx, sy, 9.4), (0.9, 0.9, 0.9), segs=12, rings=8)
    for (x, y, c) in [(80, 0, "Roof1"), (-80, 0, "Roof2"), (92, 28, "Roof2"), (-92, 28, "Roof1"), (92, -28, "Roof1"), (-92, -28, "Roof2")]:
        P.cone("StripeA", (x, y, 1.1), 6, 6, 2.2, segs=24); P.cone("White", (x, y, 3.3), 6, 6, 2.2, segs=24)
        P.cone(c, (x, y, 6.4), 6.8, 0.2, 4.0, segs=24)
    for (x, y, sx, sy, sz, m) in [(-230, 330, 170, 110, 60, "Hill"), (240, 320, 180, 110, 65, "Hill"), (0, 360, 220, 120, 70, "Hill")]:
        P.sphere(m, (x, y, -10), (sx, sy, sz), segs=24, rings=12)


def ticket_tower(x, z, s, h=6.5):
    """Torre dos bilhetes (6,5 m): só se chega lá acima com o trampolim; desce-se pela escada de mão do lado da base.
    Em cima: parede alta com fresta virada para o centro (esconderijo) e murete do lado de dentro."""
    platform(x, z, 6, 6, h)
    RB("StripeA", x, z, 6.3, 6.3, 0.5, r=0.08, z0=h - 1.4, segs=1)
    for i in range(4):
        RB("Ticket", x - s * 3.05, z - 1.5 + i, 0.1, 0.6, 0.8, r=0.05, z0=1.2, segs=1)          # guichés
    piece = 2.4
    for sz in (-1, 1):
        tall_wall(x - s * 2.7, z + sz * (0.6 + piece / 2), 0.6, piece, h=2.2, z0=h)
    low_wall(x - s * 2.7, z, 0.6, 1.2, h=0.9, z0=h, solid=True)                                   # fresta (não se sobe)
    ladder(x + s * 3.0, z + 1.5, h, s, 0)
    P.cone("Gold", (x, -z, h + 2.6), 0.08, 0.08, 1.8, segs=6)                                    # bandeirola
    P.rbox("Roof1", (x + 0.5, -z, h + 3.2), (1.0, 0.05, 0.6), radius=0.02, segs=1)


def coaster_s(s):
    """Rampa em S (montanha-russa) do lado -z: 0 -> 2 m (ao longo de x), 2 -> 4 m (ao longo de z), 4 -> 6 m (de volta), posto a 6 m."""
    X = lambda lx: s * lx
    ramp_up(X(12), -14, 8, 3, "x", 0.0, 2.0, up=s)
    platform(X(17.5), -14, 3, 3, 2.0, accent=False)
    ramp_up(X(17.5), -19, 3, 7, "z", 2.0, 4.0, up=-1)
    platform(X(17.5), -24, 3, 3, 4.0, accent=False)
    ramp_up(X(12), -24, 8, 3, "x", 4.0, 6.0, up=-s)
    platform(X(5), -24, 6, 4, 6.0)                                                               # posto lá em cima
    tall_wall(X(2.3), -24.8, 0.6, 2.4, h=2.2, z0=6.0); low_wall(X(2.3), -22.9, 0.6, 1.4, h=0.9, z0=6.0, solid=True)   # esconderijo com fresta
    low_wall(X(5), -21.7, 5.4, 0.5, h=0.9, z0=6.0, solid=True)
    # carris vermelhos e pilares (só visuais): um em cada borda da rampa, sem se cruzarem
    outer = [(8, -12.4, 0.0), (16, -12.4, 2.0), (19.1, -12.4, 2.0), (19.1, -15.5, 2.0), (19.1, -22.5, 4.0), (19.1, -25.6, 4.0), (16, -25.6, 4.0), (8, -25.6, 6.0)]
    inner = [(8, -15.6, 0.0), (15.9, -15.6, 2.0), (15.9, -22.4, 4.0), (8, -22.4, 6.0)]
    for pts in (outer, inner):
        for (a, b) in zip(pts[:-1], pts[1:]):                                                   # troços retos (sem curvas a mais nas esquinas)
            P.tube("TrackRed", [(X(px), -pz, h + 0.8) for (px, pz, h) in (a, b)], [0.12, 0.12], sides=8, per_seg=1)
        for (px, pz, h) in pts:
            CY("Rail", X(px), pz, 0.08, 0.8, z0=h, segs=8)                                      # postes do corrimão
    # carrinho da montanha-russa no topo
    P.rbox("TrackRed", (X(6.5), 24, 6.5), (2.2, 1.4, 1.0), radius=0.35, segs=2)
    P.rbox("Gold", (X(6.5), 24, 7.05), (2.3, 1.5, 0.15), radius=0.05, segs=1)


def build():
    floors(); fence(); scenery()
    ferris_wheel(0, 0)
    drop_tower(0, -28, 0); drop_tower(0, 27, 1)
    for s in (1, -1):
        carousel(s * 21, 0, 0 if s > 0 else 1)
        coaster_s(s)
        ticket_tower(s * 30, 22, s)
        trampoline(s * 24, 22)                                                    # para a torre dos bilhetes
        trampoline(s * 16, 17.5)                                                  # para o telhado da barraca
        stall(s * 16, 22, -1, "Purple", "Pink")
        stall(s * 30, -20, +1, "Green", "Yellow"); stall(s * 28, -30, +1, "Blue", "Sky"); stall(s * 34, 12.2, +1, "Orange", "Teal")
        tent(s * 42, -26, "Red", "Roof1"); tent(s * 42, 26, "Blue", "Roof2")
        balloons(s * 10, -9); balloons(s * 10, 9); balloons(s * 32, -9); balloons(s * 32, 9)
        bench(s * 12, 4, -1); bench(s * 12, -4, +1)
        low_wall(s * 8, 14, 1.0, 5.0); crate(s * 26, 10, 1.6); crate(s * 27.7, 10, 1.4)
        for (x, z) in [(14, 10), (28, 0), (6, 26)]:
            lamp(s * x, z, 5.4)
    patrol = [(10, 12), (24, 12), (24, -10), (22, -30), (38, 16), (38, -14), (0, -14), (0, 14), (24, 22), (12, -14), (30, 30), (16, -2)]
    exec(open("/home/andrexie/Documents/ColorAttack/src/tools/blender/map_extras.py").read(), globals()); decorate(seed=4, wall_h=2.4, patrol=patrol)
    return finish_map("diversoes", patrol, OUTPUT)


objs = build()
