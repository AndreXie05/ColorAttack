"""
ColorAttack - os 5 bonecos "Titãs" (versões chibi minhas, inspiradas na equipa; só para uso pessoal).
Corre dentro do Blender: exec(open(este_ficheiro).read()).

  LINEUP = True   -> constrói os 5 lado a lado para os ver
  EXPORT_DIR = "/caminho/assets/characters"   -> exporta robin.glb, starfire.glb, cyborg.glb, raven.glb, beastboy.glb

Convenções para o jogo (iguais ao boneco original): objetos Body, LegL, LegR, ArmL, ArmR (origem nas articulações)
e ShinL, ShinR (canelas, filhas das coxas, origem no joelho: para dobrar os joelhos ao andar e agachar);
material "Paint" = cor do jogador (peça grande em cada personagem); "AmmoTank" = cor da munição.
"""
import math
import os
COMMON = "/home/andrexie/Documents/ColorAttack/tools/blender/common.py"
exec(open(COMMON).read())

LINEUP = globals().get("LINEUP", True)
EXPORT_DIR = globals().get("EXPORT_DIR")
rad = math.radians
HEAD_Z = 1.98

MATERIALS.update({
    "Hair_Robin": 0x15151F, "Mask": 0x0F0F18, "Gold": 0xF5C518, "Black": 0x17171F, "Green": 0x2FAE4A,
    "Skin_Robin": 0xEFBE96, "Skin_Star": 0xF2A65A, "Hair_Star": 0xD9341C, "EyeGreen": 0x5CF278,
    "Metal": 0xBAC2D2, "MetalDark": 0x5C657E, "Purple": 0x7B3FB8, "White": 0xF4F4F8,
    "Skin_Cy": 0x6E4733, "EyeRed": 0xFF2A2A, "Skin_Raven": 0xBDB6D8, "Hair_Raven": 0x3A2B5C, "Gem": 0xFF3355,
    "Suit_Raven": 0x20254A, "Skin_BB": 0x86DA58, "Hair_BB": 0x4F9B34, "Fang": 0xFFFFFF, "Suit_BB": 0x24202E,
})


# ---------- peças partilhadas ----------
def head(b, skin, ears="round", eyes="normal", brow_mat="Pupil", eye_fwd=0.0):
    b.lathe(skin, [(0, -0.5), (0.2, -0.47), (0.38, -0.37), (0.49, -0.17), (0.525, 0.04), (0.5, 0.26), (0.4, 0.44), (0.2, 0.51), (0, 0.53)],
            loc=(0, 0, HEAD_Z), scale=(1, 0.96, 1), segs=40)
    for sx in (-1, 1):
        if eyes == "normal":
            b.sphere("EyeWhite", (sx * 0.185, -0.405 - eye_fwd, HEAD_Z + 0.04), (0.145, 0.085, 0.19))
            b.sphere("Pupil", (sx * 0.19, -0.465 - eye_fwd, HEAD_Z + 0.015), (0.09, 0.055, 0.135))
            b.sphere("EyeWhite", (sx * 0.155, -0.515 - eye_fwd, HEAD_Z + 0.06), (0.04, 0.02, 0.04))
        elif eyes == "glow":
            b.sphere("EyeGreen", (sx * 0.185, -0.405, HEAD_Z + 0.04), (0.15, 0.09, 0.2))
            b.sphere("EyeWhite", (sx * 0.15, -0.5, HEAD_Z + 0.09), (0.05, 0.025, 0.05))
        if brow_mat:
            b.tube(brow_mat, [(sx * 0.1, -0.455, HEAD_Z + 0.27), (sx * 0.2, -0.445, HEAD_Z + 0.31), (sx * 0.31, -0.4, HEAD_Z + 0.27)],
                   [0.025, 0.03, 0.02], sides=8, per_seg=6)
        b.sphere("Cheek", (sx * 0.31, -0.385, HEAD_Z - 0.14), (0.085, 0.03, 0.055))
        if ears == "pointy":
            b.cone(skin, (sx * 0.52, -0.01, HEAD_Z + 0.0), 0.1, 0.0, 0.3, rot=(0, sx * rad(80), 0))
        else:
            b.sphere(skin, (sx * 0.515, -0.01, HEAD_Z - 0.02), (0.05, 0.07, 0.11))
    b.sphere(skin, (0, -0.5, HEAD_Z - 0.1), (0.04, 0.035, 0.035))
    b.tube("Mouth", [(-0.09, -0.49, HEAD_Z - 0.22), (0, -0.505, HEAD_Z - 0.255), (0.09, -0.49, HEAD_Z - 0.22)],
           [0.012, 0.017, 0.012], sides=8, per_seg=6)


def neck(b, skin):
    b.lathe(skin, [(0.1, 0.0), (0.1, 0.16)], loc=(0, 0, 1.62), segs=20, per_seg=2)


def torso(b, mat, w=1.0, d=0.82, z=0.98):
    b.lathe(mat, [(0, 0.0), (0.2 * w, 0.0), (0.265 * w, 0.1), (0.26 * w, 0.35), (0.285 * w, 0.58), (0.25 * w, 0.72), (0.14 * w, 0.76), (0, 0.77)],
            loc=(0, 0, z), scale=(1, d, 1), segs=36)


def pants_short(b, mat, w=1.0):
    b.lathe(mat, [(0.31 * w, 0.0), (0.3 * w, 0.06), (0.275 * w, 0.2), (0.28 * w, 0.3), (0.27 * w, 0.34)], loc=(0, 0, 0.7), scale=(1, 0.85, 1), segs=36, per_seg=4)


def belt(b, mat="Belt", buckle="Belt", w=1.0):
    b.tube(mat, [(-0.27 * w, -0.225, 1.015), (0, -0.28, 1.015), (0.27 * w, -0.225, 1.015)], [0.032, 0.032, 0.032], sides=10, per_seg=8)
    b.sphere(buckle, (0, -0.283, 1.015), (0.06, 0.02, 0.05))


def back_tank(b):
    b.lathe("AmmoTank", [(0, -0.3), (0.14, -0.28), (0.2, -0.15), (0.215, 0.05), (0.19, 0.22), (0.1, 0.3), (0, 0.32)],
            loc=(0, 0.31, 1.36), scale=(1, 0.72, 1.0), segs=32)
    b.lathe("Belt", [(0.07, 0.0), (0.07, 0.07), (0.05, 0.09)], loc=(0, 0.31, 1.68), scale=(1, 0.72, 1), segs=16, per_seg=2)
    for sx in (-1, 1):
        b.tube("Black", [(sx * 0.13, 0.2, 1.62), (sx * 0.2, 0.28, 1.45), (sx * 0.19, 0.3, 1.22)], [0.03, 0.03, 0.03], sides=8, per_seg=6)


KNEE = 0.36                     # distância da anca ao joelho (a canela vai do joelho até à sola: 0,42)


def legs(col, prefix, x0, leg_mat, foot_mat, sole="Sole", accent=None, boot=False, cuff=None, thick=1.0):
    """Pernas com joelho: LegL/LegR (coxa, origem na anca) e ShinL/ShinR (canela + pé, origem no joelho, filha da coxa).
    Devolve [coxaL, coxaR, canelaL, canelaR]."""
    out, shins = [], []
    for name, sx in (("LegL", -1), ("LegR", 1)):
        t = thick
        th = Part(prefix + name)                                                           # coxa
        th.tube(leg_mat, [(0, 0, 0.0), (0, 0, -0.18), (0, 0, -KNEE - 0.02)], [0.1 * t, 0.092 * t, 0.084 * t], sides=18, per_seg=6)
        th.sphere(leg_mat, (0, 0, -KNEE), (0.084 * t, 0.084 * t, 0.084 * t), segs=16, rings=10)   # joelho (tapa a junta ao dobrar)
        sh = Part(prefix + name.replace("Leg", "Shin"))                                   # canela e pé (coordenadas a partir do joelho)
        k = KNEE
        sh.tube(leg_mat, [(0, 0, 0.0), (0, 0, -0.04), (0, 0, -0.56 + k)], [0.082 * t, 0.078 * t, 0.072 * t], sides=18, per_seg=6)
        if boot:
            sh.tube(foot_mat, [(0, 0, -0.3 + k), (0, 0, -0.5 + k), (0, 0, -0.66 + k)], [0.098 * t, 0.092 * t, 0.088 * t], sides=18, per_seg=5)
            if cuff:
                sh.lathe(cuff, [(0.1 * t, 0.0), (0.108 * t, 0.04), (0.1 * t, 0.08)], loc=(0, 0, -0.34 + k), segs=18, per_seg=3)
        else:
            sh.lathe("Sock", [(0.08 * t, 0.0), (0.085 * t, 0.06), (0.078 * t, 0.11)], loc=(0, 0, -0.62 + k), segs=18, per_seg=3)
        sh.sphere(foot_mat, (0, -0.06, -0.675 + k), (0.148 * t, 0.27, 0.125))
        sh.sphere(foot_mat, (0, 0.07, -0.65 + k), (0.128 * t, 0.14, 0.14))
        if accent:
            sh.sphere(accent, (0, -0.2, -0.66 + k), (0.1 * t, 0.1, 0.075))
        sh.sphere(sole, (0, -0.06, -0.755 + k), (0.158 * t, 0.285, 0.045))
        leg = th.build(col, (x0 + sx * 0.13, 0, 0.78))
        shin = sh.build(col, (0, 0, 0))
        shin.parent = leg
        shin.location = (0, 0, -KNEE)                                                      # (relativo à coxa)
        out.append(leg); shins.append(shin)
    return out + shins


def blaster(p):
    """Pistola de tinta cartoon (toda da cor da munição: GunBody e AmmoTank mudam no jogo; Belt = detalhes brancos)."""
    p.rbox("GunBody", (0, -0.22, -0.69), (0.19, 0.5, 0.2), radius=0.07, segs=3)                       # corpo arredondado
    p.cone("GunBody", (0, -0.58, -0.69), 0.055, 0.055, 0.34, rot=(rad(90), 0, 0), segs=16)              # cano
    p.cone("Belt", (0, -0.76, -0.69), 0.085, 0.085, 0.035, rot=(rad(90), 0, 0), segs=16)                # anel
    p.cone("Belt", (0, -0.83, -0.69), 0.07, 0.05, 0.11, rot=(rad(90), 0, 0), segs=16)                   # boca
    p.sphere("AmmoTank", (0, -0.2, -0.5), (0.135, 0.135, 0.135), segs=20, rings=12)                     # depósito em cima
    p.cone("Belt", (0, -0.2, -0.375), 0.05, 0.05, 0.04, segs=12)                                        # tampa do depósito
    p.rbox("GunBody", (0, -0.03, -0.82), (0.1, 0.13, 0.22), rot=(rad(-16), 0, 0), radius=0.04, segs=2)   # punho
    for sxx in (-1, 1):
        p.rbox("Belt", (sxx * 0.101, -0.24, -0.69), (0.012, 0.34, 0.05), radius=0.005, segs=1)         # faixa lateral
    p.rbox("Belt", (0, -0.44, -0.57), (0.04, 0.14, 0.05), radius=0.02, segs=2)                          # mira


def arms(col, prefix, x0, sleeve, cuff, hand, thick=1.0, bare_skin=None, gun=True, long_sleeve=True):
    out = []
    for name, sx in (("ArmL", -1), ("ArmR", 1)):
        p = Part(prefix + name)
        t = thick
        mat = sleeve if long_sleeve else bare_skin
        p.tube(mat, [(0, 0, 0.0), (0, 0, -0.15), (0, 0, -0.32), (0, 0, -0.5)], [0.105 * t, 0.095 * t, 0.083 * t, 0.08 * t], sides=18, per_seg=6)
        if bare_skin and long_sleeve is False:
            p.tube(sleeve, [(0, 0, 0.0), (0, 0, -0.1)], [0.108 * t, 0.1 * t], sides=18, per_seg=4)   # manga curta
        p.lathe(cuff, [(0.085 * t, 0.0), (0.092 * t, 0.03), (0.084 * t, 0.07)], loc=(0, 0, -0.55), segs=16, per_seg=3)
        p.sphere(hand, (0, 0, -0.67), (0.085 * t, 0.075 * t, 0.095 * t))
        p.sphere(hand, (sx * -0.05 * t, -0.05, -0.68), (0.035 * t, 0.05, 0.035 * t))
        if gun and sx == 1:
            blaster(p)
        out.append(p.build(col, (x0 + sx * 0.39 * (1.05 if thick > 1 else 1), 0, 1.58)))
    return out


def cap_dome(b, mat, z=HEAD_Z + 0.1, ydisp=0.04, tilt=0.0):
    b.lathe(mat, [(0.56, -0.12), (0.565, -0.02), (0.55, 0.12), (0.47, 0.3), (0.33, 0.42), (0.15, 0.48), (0, 0.5)],
            loc=(0, ydisp, z), scale=(1, 1.02, 1), rot=(tilt, 0, 0), segs=40)


# ---------- as cinco personagens ----------
def robin(col, x0, prefix):
    b = Part(prefix + "Body")
    head(b, "Skin_Robin", eyes=None or "none", brow_mat=None)
    b.sphere("Mask", (0, -0.35, HEAD_Z + 0.03), (0.51, 0.14, 0.15))                       # máscara
    for sx in (-1, 1):
        b.sphere("EyeWhite", (sx * 0.18, -0.475, HEAD_Z + 0.02), (0.105, 0.04, 0.07), rot=(0, rad(8) * sx, sx * rad(-22)))   # olhos em fenda
    cap_dome(b, "Hair_Robin", tilt=rad(-8))                                                # cabelo preto
    for k, (x, y, z, rx, rz) in enumerate([(0, -0.28, 2.58, -25, 0), (0.22, -0.1, 2.6, -10, -22), (-0.22, -0.1, 2.6, -10, 22),
                                           (0.12, 0.2, 2.58, 20, -12), (-0.12, 0.2, 2.58, 20, 12)]):
        b.cone("Hair_Robin", (x, y, z), 0.12, 0.0, 0.34, rot=(rad(rx), 0, rad(rz)))      # picos do cabelo
    neck(b, "Skin_Robin")
    torso(b, "Black"); torso(b, "Paint", w=1.01, d=0.83, z=1.27)                           # fato preto + peitoral na cor
    b.lathe("Paint", [(0.268, 0.0), (0.285, 0.18), (0.25, 0.28), (0.16, 0.31)], loc=(0, 0, 1.43), scale=(1, 0.84, 1), segs=36, per_seg=4)
    b.sphere("Gold", (0, -0.225, 1.5), (0.09, 0.03, 0.09))                                 # emblema
    belt(b, "Gold", "Gold")
    pants_short(b, "Black")
    # capa preta atrás
    b.tube("Black", [(0, 0.28, 1.66), (0, 0.46, 1.3), (0, 0.55, 0.92), (0, 0.52, 0.58)], [0.34, 0.34, 0.36, 0.38], sides=20, per_seg=8, scale_xy=(1, 0.09))
    b.tube("Gold", [(0, 0.285, 1.66), (0, 0.285, 1.64)], [0.31, 0.31], sides=20, per_seg=2, scale_xy=(1, 0.2))
    body = b.build(col, (x0, 0, 0))
    return [body] + legs(col, prefix, x0, "Black", "Green", boot=True, cuff="Gold") + \
        arms(col, prefix, x0, "Black", "Green", "Green", thick=1.0)


def starfire(col, x0, prefix):
    b = Part(prefix + "Body")
    head(b, "Skin_Star", eyes="glow", brow_mat="Hair_Star")
    cap_dome(b, "Hair_Star", ydisp=0.08, tilt=rad(-6))
    b.tube("Hair_Star", [(0, 0.3, 2.5), (0, 0.66, 2.34), (0, 0.84, 1.85), (0, 0.78, 1.2), (0, 0.62, 0.7), (0, 0.5, 0.3)],
           [0.3, 0.38, 0.36, 0.3, 0.2, 0.05], sides=20, per_seg=8, scale_xy=(1.3, 0.8))                      # cabelo comprido
    for sx in (-1, 1):
        b.tube("Hair_Star", [(sx * 0.45, -0.05, 2.35), (sx * 0.6, 0.15, 2.0), (sx * 0.58, 0.3, 1.5)], [0.1, 0.09, 0.0], sides=10, per_seg=6)   # madeixas laterais
    b.tube("Metal", [(-0.2, -0.43, HEAD_Z + 0.4), (0, -0.46, HEAD_Z + 0.43), (0.2, -0.43, HEAD_Z + 0.4)], [0.03, 0.035, 0.03], sides=10, per_seg=6)   # tiara
    b.sphere("Gem", (0, -0.47, HEAD_Z + 0.43), (0.04, 0.03, 0.04))
    neck(b, "Skin_Star")
    torso(b, "Skin_Star")                                                                                    # barriga à mostra
    b.lathe("Paint", [(0.268, 0.0), (0.285, 0.18), (0.25, 0.3), (0.16, 0.34)], loc=(0, 0, 1.4), scale=(1, 0.84, 1), segs=36, per_seg=4)   # top curto
    b.lathe("Metal", [(0.12, 0.0), (0.16, 0.05), (0.14, 0.1)], loc=(0, 0, 1.6), scale=(1, 0.9, 1), segs=24, per_seg=3)                      # gola
    belt(b, "Metal", "Gem")
    b.lathe("Paint", [(0.33, 0.0), (0.4, 0.08), (0.36, 0.22), (0.28, 0.34)], loc=(0, 0, 0.7), scale=(1, 0.9, 1), segs=36, per_seg=4)        # saia
    body = b.build(col, (x0, 0, 0))
    return [body] + legs(col, prefix, x0, "Skin_Star", "Purple", boot=True, cuff="Metal") + \
        arms(col, prefix, x0, "Paint", "Metal", "Skin_Star", bare_skin="Skin_Star", long_sleeve=False)


def cyborg(col, x0, prefix):
    b = Part(prefix + "Body")
    head(b, "Skin_Cy", brow_mat="Black")
    # metade do rosto metálica com olho vermelho
    b.sphere("Metal", (-0.27, -0.06, HEAD_Z + 0.04), (0.26, 0.42, 0.46))
    b.sphere("EyeRed", (-0.185, -0.45, HEAD_Z + 0.04), (0.13, 0.07, 0.17))
    b.sphere("EyeWhite", (-0.155, -0.51, HEAD_Z + 0.09), (0.035, 0.02, 0.035))
    b.sphere("MetalDark", (-0.4, -0.08, HEAD_Z + 0.05), (0.1, 0.16, 0.2))
    b.lathe("Metal", [(0.5, -0.05), (0.53, 0.08), (0.46, 0.3), (0.28, 0.46), (0, 0.5)], loc=(0, 0.0, HEAD_Z + 0.07), scale=(1, 1, 0.55), segs=32)   # calote metálica
    neck(b, "Skin_Cy")
    torso(b, "Metal", w=1.28, d=0.9)                                                                          # tronco largo
    b.lathe("Paint", [(0.3, 0.0), (0.33, 0.12), (0.3, 0.26), (0.2, 0.3)], loc=(0, 0, 1.42), scale=(1.4, 1.0, 1), segs=36, per_seg=4)           # peitoral
    b.sphere("White", (0, -0.31, 1.52), (0.12, 0.04, 0.1))
    for sx in (-1, 1):
        b.sphere("Paint", (sx * 0.4, 0, 1.62), (0.14, 0.14, 0.13))                                           # ombreiras
    belt(b, "MetalDark", "Paint", w=1.25)
    pants_short(b, "MetalDark", w=1.2)
    body = b.build(col, (x0, 0, 0))
    return [body] + legs(col, prefix, x0, "Metal", "MetalDark", sole="White", accent="Paint", thick=1.3) + \
        arms(col, prefix, x0, "Metal", "MetalDark", "Metal", thick=1.4)


def raven(col, x0, prefix):
    b = Part(prefix + "Body")
    head(b, "Skin_Raven", brow_mat="Hair_Raven")
    cap_dome(b, "Hair_Raven", ydisp=0.07, tilt=rad(-6))                                                      # cabelo no topo
    b.sphere("Hair_Raven", (0, 0.13, HEAD_Z - 0.12), (0.58, 0.5, 0.5))                                       # chanel (volume atrás e aos lados)
    for sx in (-1, 1):
        b.sphere("Hair_Raven", (sx * 0.5, -0.02, HEAD_Z - 0.2), (0.1, 0.2, 0.3))                             # madeixas junto às orelhas
    b.sphere("Hair_Raven", (0, -0.36, HEAD_Z + 0.33), (0.42, 0.13, 0.11), rot=(rad(-10), 0, 0))              # franja
    b.sphere("Gem", (0, -0.5, HEAD_Z + 0.22), (0.04, 0.025, 0.05))                                           # jóia na testa
    b.sphere("Paint", (0, 0.2, HEAD_Z + 0.02), (0.64, 0.46, 0.58))                                           # capuz em baixo (atrás da cabeça)
    neck(b, "Skin_Raven")
    torso(b, "Suit_Raven")
    b.lathe("Paint", [(0.55, 0.0), (0.48, 0.22), (0.38, 0.6), (0.31, 0.9), (0.22, 1.06), (0.13, 1.12)], loc=(0, 0, 0.55), scale=(1, 0.86, 1), segs=40)   # capa comprida
    b.sphere("Gem", (0, -0.27, 1.55), (0.05, 0.03, 0.05))
    belt(b, "Gem", "Gem")
    body = b.build(col, (x0, 0, 0))
    return [body] + legs(col, prefix, x0, "Suit_Raven", "Black", boot=True, cuff="Paint") + \
        arms(col, prefix, x0, "Paint", "Suit_Raven", "Skin_Raven", thick=1.08, gun=True)


def beastboy(col, x0, prefix):
    b = Part(prefix + "Body")
    head(b, "Skin_BB", ears="pointy", brow_mat="Hair_BB")
    cap_dome(b, "Hair_BB", ydisp=0.07, tilt=rad(-8))
    for x, y, z, rx, rz in [(0, -0.25, 2.55, -30, 0), (0.25, -0.1, 2.58, -10, -28), (-0.25, -0.1, 2.58, -10, 28), (0.15, 0.2, 2.55, 25, -15), (-0.15, 0.2, 2.55, 25, 15), (0.0, 0.0, 2.62, 0, 0)]:
        b.cone("Hair_BB", (x, y, z), 0.13, 0.0, 0.36, rot=(rad(rx), 0, rad(rz)))                           # cabelo desgrenhado
    b.cone("Fang", (0.05, -0.47, HEAD_Z - 0.235), 0.022, 0.0, 0.07, rot=(rad(180), 0, 0))                    # dentinho
    neck(b, "Skin_BB")
    torso(b, "Paint")                                                                                         # camisola na cor
    b.lathe("Suit_BB", [(0.27, 0.0), (0.275, 0.1), (0.255, 0.2)], loc=(0, 0, 1.45), scale=(1, 0.84, 1), segs=36, per_seg=3)                 # ombros pretos
    belt(b, "Suit_BB", "Gold")
    pants_short(b, "Suit_BB")
    for sx in (-1, 1):
        b.tube("Paint", [(sx * 0.292, 0.0, 1.0), (sx * 0.3, 0.0, 0.85), (sx * 0.31, 0.0, 0.72)], [0.02, 0.02, 0.02], sides=8, per_seg=6)
    back_tank(b)
    body = b.build(col, (x0, 0, 0))
    return [body] + legs(col, prefix, x0, "Skin_BB", "Black", accent="Paint") + \
        arms(col, prefix, x0, "Suit_BB", "White", "White", bare_skin=None)


TITANS = {"robin": robin, "starfire": starfire, "cyborg": cyborg, "raven": raven, "beastboy": beastboy}


def build_one(key, name=None, x0=0.0, prefix=""):
    cname = name or ("Titans_" + key)
    old = bpy.data.collections.get(cname)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    col = bpy.data.collections.new(cname)
    bpy.context.scene.collection.children.link(col)
    objs = TITANS[key](col, x0, prefix)
    bpy.context.view_layer.update()
    return col, objs


# esconde o boneco original, se existir
orig = bpy.data.collections.get("Character")
if orig:
    for o in orig.objects:
        o.hide_viewport = True; o.hide_render = True
        if not o.name.startswith("orig_"):
            o.name = "orig_" + o.name.split(".")[0]          # liberta os nomes Body/LegL/... para as exportações

if LINEUP:
    for k, key in enumerate(TITANS):
        build_one(key, x0=(k - 2) * 1.5, prefix=key + ".")
    print("Lineup criado:", list(TITANS))

if EXPORT_DIR:
    os.makedirs(EXPORT_DIR, exist_ok=True)
    for key in TITANS:
        col, objs = build_one(key, name="Export_" + key)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        names = sorted(o.name for o in objs)
        assert names == ["ArmL", "ArmR", "Body", "LegL", "LegR", "ShinL", "ShinR"], "Nomes inesperados: %s" % names
        path = os.path.join(EXPORT_DIR, key + ".glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT")
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(col)
        print("Exportado", path, os.path.getsize(path), "bytes")
