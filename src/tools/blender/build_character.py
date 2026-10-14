"""
ColorAttack - constrói o boneco original no Blender (corre dentro do Blender: exec(open(este_ficheiro).read())).
Utilitários (formas suaves, materiais) em common.py. Convenções para o jogo: ver common.py.
"""
import os
DECIMATE = 0.35                                    # fração de triângulos que fica ao exportar (o jogo fica mais leve)
OUTPUT = globals().get("OUTPUT")   # defina antes de executar para exportar o .glb, ex.: OUTPUT = "/caminho/assets/character.glb"
COLLECTION = "Character"
exec(open("/home/andrexie/Documents/ColorAttack/tools/blender/common.py").read())


# ---------- construção ----------
def build():
    old = bpy.data.collections.get(COLLECTION)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    for o in list(bpy.data.objects):                      # tira o cubo da cena por defeito
        if o.name in ("Cube",):
            bpy.data.objects.remove(o, do_unlink=True)
    col = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(col)
    rad = math.radians

    # ===== CORPO =====
    b = Part("Body")
    HEAD_Z = 1.98
    # cabeça em forma de ovo, com bochechas largas (queixo pequeno)
    b.lathe("Skin", [(0, -0.5), (0.2, -0.47), (0.38, -0.37), (0.49, -0.17), (0.525, 0.04), (0.5, 0.26), (0.4, 0.44), (0.2, 0.51), (0, 0.53)],
            loc=(0, 0, HEAD_Z), scale=(1, 0.96, 1), segs=40)
    for sx in (-1, 1):
        # olhos grandes e brilhantes
        b.sphere("EyeWhite", (sx * 0.185, -0.405, HEAD_Z + 0.04), (0.145, 0.085, 0.19))
        b.sphere("Pupil", (sx * 0.19, -0.465, HEAD_Z + 0.015), (0.09, 0.055, 0.135))
        b.sphere("EyeWhite", (sx * 0.155, -0.515, HEAD_Z + 0.06), (0.04, 0.02, 0.04))
        b.sphere("EyeWhite", (sx * 0.225, -0.5, HEAD_Z - 0.03), (0.02, 0.015, 0.02))
        # sobrancelhas curvas
        b.tube("Pupil", [(sx * 0.1, -0.455, HEAD_Z + 0.27), (sx * 0.2, -0.445, HEAD_Z + 0.31), (sx * 0.31, -0.4, HEAD_Z + 0.27)],
               [0.025, 0.03, 0.02], sides=8, per_seg=6)
        b.sphere("Cheek", (sx * 0.31, -0.385, HEAD_Z - 0.14), (0.085, 0.03, 0.055))            # bochechas rosadas
        b.sphere("Skin", (sx * 0.515, -0.01, HEAD_Z - 0.02), (0.05, 0.07, 0.11))               # orelhas
    # nariz pequeno e sorriso
    b.sphere("Skin", (0, -0.5, HEAD_Z - 0.1), (0.04, 0.035, 0.035))
    b.tube("Mouth", [(-0.09, -0.49, HEAD_Z - 0.22), (0, -0.505, HEAD_Z - 0.255), (0.09, -0.49, HEAD_Z - 0.22)],
           [0.012, 0.017, 0.012], sides=8, per_seg=6)
    # boné justo na cor do jogador: calote, pala curva, costura e botão
    CAP_Z = HEAD_Z + 0.1
    b.lathe("Paint", [(0.56, -0.12), (0.565, -0.02), (0.55, 0.12), (0.47, 0.3), (0.33, 0.42), (0.15, 0.48), (0, 0.5)],
            loc=(0, 0.04, CAP_Z), scale=(1, 1.02, 1), segs=40)
    b.sphere("Paint", (0, -0.42, CAP_Z - 0.06), (0.4, 0.34, 0.06), rot=(rad(-14), 0, 0))             # pala
    b.sphere("Paint", (0, 0.04, CAP_Z + 0.5), (0.07, 0.07, 0.05))                                    # botão
    b.tube("Belt", [(0, -0.4, CAP_Z + 0.06), (0, -0.3, CAP_Z + 0.34), (0, -0.05, CAP_Z + 0.5)], [0.012, 0.012, 0.012], sides=6, per_seg=6)   # costura central
    # pescoço
    b.lathe("Skin", [(0.1, 0.0), (0.1, 0.16)], loc=(0, 0, 1.62), segs=20, per_seg=2)
    # camisola com cintura (cor do jogador) e colete cinzento por cima, com bolsos
    b.lathe("Paint", [(0, 0.0), (0.2, 0.0), (0.265, 0.1), (0.26, 0.35), (0.285, 0.58), (0.25, 0.72), (0.14, 0.76), (0, 0.77)],
            loc=(0, 0, 0.98), scale=(1, 0.82, 1), segs=36)
    b.lathe("Vest", [(0.262, 0.0), (0.27, 0.12), (0.295, 0.34), (0.255, 0.43), (0.165, 0.46)],
            loc=(0, 0, 1.2), scale=(1, 0.87, 1), segs=36, per_seg=4)
    for sx in (-1, 1):
        b.sphere("Vest", (sx * 0.15, -0.205, 1.36), (0.085, 0.03, 0.065))                      # bolsos do colete
        b.tube("Vest", [(sx * 0.12, -0.2, 1.62), (sx * 0.145, -0.22, 1.5), (sx * 0.155, -0.2, 1.4)], [0.035, 0.04, 0.035], sides=8, per_seg=6)   # alças
    b.tube("Belt", [(-0.27, -0.225, 1.015), (0, -0.28, 1.015), (0.27, -0.225, 1.015)], [0.03, 0.03, 0.03], sides=10, per_seg=8)   # cinto
    b.sphere("Belt", (0, -0.283, 1.015), (0.06, 0.02, 0.05))                                        # fivela
    # calções com bainha larga e riscas laterais na cor do jogador
    b.lathe("Shorts", [(0.31, 0.0), (0.3, 0.06), (0.275, 0.2), (0.28, 0.3), (0.27, 0.34)], loc=(0, 0, 0.7), scale=(1, 0.85, 1), segs=36, per_seg=4)
    for sx in (-1, 1):
        b.tube("Paint", [(sx * 0.292, 0.0, 1.0), (sx * 0.3, 0.0, 0.85), (sx * 0.31, 0.0, 0.72)], [0.02, 0.02, 0.02], sides=8, per_seg=6)
    # depósito de tinta às costas (mostra a cor da munição), com tampa e correias
    b.lathe("AmmoTank", [(0, -0.3), (0.14, -0.28), (0.2, -0.15), (0.215, 0.05), (0.19, 0.22), (0.1, 0.3), (0, 0.32)],
            loc=(0, 0.31, 1.36), scale=(1, 0.72, 1.0), segs=32)
    b.lathe("Belt", [(0.07, 0.0), (0.07, 0.07), (0.05, 0.09)], loc=(0, 0.31, 1.68), scale=(1, 0.72, 1), segs=16, per_seg=2)   # tampa
    for sx in (-1, 1):
        b.tube("Vest", [(sx * 0.13, 0.2, 1.62), (sx * 0.2, 0.28, 1.45), (sx * 0.19, 0.3, 1.22)], [0.03, 0.03, 0.03], sides=8, per_seg=6)
    body = b.build(col)

    # ===== PERNAS: coxa (LegL/LegR, origem na anca) e canela com ténis (ShinL/ShinR, origem no joelho, filha da coxa) =====
    legs, shins = [], []
    KNEE = 0.36
    for name, sx in (("LegL", -1), ("LegR", 1)):
        th = Part(name)
        th.tube("Skin", [(0, 0, 0.0), (0, 0, -0.18), (0, 0, -KNEE - 0.02)], [0.1, 0.092, 0.08], sides=18, per_seg=6)
        th.sphere("Skin", (0, 0, -KNEE), (0.08, 0.08, 0.08))                                    # joelho
        sh = Part(name.replace("Leg", "Shin")); k = KNEE
        sh.tube("Skin", [(0, 0, 0.0), (0, 0, -0.04), (0, 0, -0.56 + k)], [0.078, 0.075, 0.07], sides=18, per_seg=6)
        sh.lathe("Sock", [(0.08, 0.0), (0.085, 0.06), (0.078, 0.11)], loc=(0, 0, -0.62 + k), segs=18, per_seg=3)
        sh.sphere("Shoe", (0, -0.06, -0.675 + k), (0.145, 0.27, 0.125))                          # corpo do ténis
        sh.sphere("Shoe", (0, 0.07, -0.65 + k), (0.125, 0.14, 0.14))                             # calcanhar
        sh.sphere("Paint", (0, -0.2, -0.66 + k), (0.1, 0.1, 0.075))                              # biqueira colorida
        sh.sphere("Sole", (0, -0.06, -0.755 + k), (0.155, 0.285, 0.045))                         # sola branca
        for i in range(3):
            sh.sphere("Lace", (0, -0.07 - i * 0.055, -0.575 - i * 0.012 + k), (0.075, 0.018, 0.012), rot=(rad(-25), 0, 0))
        leg = th.build(col, (sx * 0.13, 0, 0.78))
        shin = sh.build(col, (0, 0, 0)); shin.parent = leg; shin.location = (0, 0, -KNEE)
        legs.append(leg); shins.append(shin)
    legs += shins

    # ===== BRAÇOS (origem no ombro): manga comprida na cor, punho, mão; o direito leva a arma =====
    arms = []
    for name, sx in (("ArmL", -1), ("ArmR", 1)):
        p = Part(name)
        p.tube("Paint", [(0, 0, 0.0), (0, 0, -0.15), (0, 0, -0.32), (0, 0, -0.5)], [0.105, 0.095, 0.083, 0.08], sides=18, per_seg=6)
        p.lathe("Shorts", [(0.085, 0.0), (0.09, 0.03), (0.082, 0.07)], loc=(0, 0, -0.55), segs=16, per_seg=3)   # punho
        p.sphere("Skin", (0, 0, -0.67), (0.085, 0.075, 0.095))                                  # mão
        p.sphere("Skin", (sx * -0.05, -0.05, -0.68), (0.035, 0.05, 0.035))                      # polegar
        if sx == 1:                                                                              # arma de tinta
            p.lathe("GunBody", [(0, -0.3), (0.06, -0.28), (0.075, -0.1), (0.07, 0.3), (0.05, 0.36), (0, 0.38)],
                    loc=(0, -0.28, -0.69), rot=(rad(90), 0, 0), segs=20)                         # cano
            p.sphere("GunBody", (0, 0.0, -0.8), (0.055, 0.075, 0.12))                            # punho
            p.sphere("AmmoTank", (0, -0.2, -0.56), (0.085, 0.085, 0.085))                         # depósito junto ao cano
            p.tube("Belt", [(0, -0.56, -0.69), (0, -0.62, -0.69)], [0.045, 0.03], sides=10, per_seg=4)   # boca do cano
        arms.append(p.build(col, (sx * 0.39, 0, 1.58)))

    bpy.context.view_layer.update()
    return [body] + legs + arms


objs = build()
print("Boneco criado:", [o.name for o in objs])

if OUTPUT:
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:                                   # mais leve no jogo: ~1/3 dos triângulos (aplicado ao exportar)
        dm = o.modifiers.new("Leve", "DECIMATE"); dm.ratio = DECIMATE
    bpy.ops.export_scene.gltf(filepath=OUTPUT, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True, export_materials="EXPORT")
    print("Exportado para", OUTPUT)
