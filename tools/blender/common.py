"""
ColorAttack - utilitários partilhados (formas suaves, materiais, Part). Usado por build_character.py e build_titans.py.

(Originalmente:) constrói o boneco no Blender (corre dentro do Blender: exec(open(este_ficheiro).read())).

Convenções para o jogo (o Three.js procura estas partes pelo nome):
  Objetos:   Body, LegL, LegR, ArmL, ArmR   (a origem de cada perna/braço é a articulação, para rodarem no jogo)
  Materiais: Paint      -> muda com a cor do jogador (boné, camisola, mangas, detalhes)
             AmmoTank   -> muda com a cor da munição (depósito às costas e na arma)
             os restantes mantêm a cor (Skin, Shorts, Vest, Shoe, Sole, ...)
  O boneco olha para -Y no Blender (a frente da vista Front); o exportador do glTF converte para +Z.
Unidades: 1 unidade = 1 metro; altura total cerca de 2,5 (cabeça grande, estilo cartoon).

Formas: tudo é feito por "revolução" de perfis suaves (lathe) e tubos que afinam, para dar curvas orgânicas
em vez de cilindros e esferas.
"""
import math
import bpy
import bmesh
from mathutils import Matrix, Vector, Euler



# ---------- utilitários ----------
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_color(h):
    return tuple(srgb_to_linear(((h >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)


MATERIALS = {
    "Paint": 0xFF3B4A, "AmmoTank": 0xFF3B4A, "Skin": 0xD9966B, "Shorts": 0x2A2D45, "Belt": 0xF4F4F8,
    "EyeWhite": 0xFFFFFF, "Pupil": 0x1A1033, "Cheek": 0xFF8A8A, "Shoe": 0x2A2D45, "Sole": 0xFFFFFF,
    "Sock": 0xFFFFFF, "GunBody": 0xF2F2F6, "Vest": 0x5E7188, "Lace": 0xFFFFFF, "Mouth": 0x7A2A3A,
}


ROUGH = {}        # rugosidade por material (por defeito 0.55)
EMISSIVE = {}     # material -> (cor hex, força): luzes, água, etc.


def get_material(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = hex_color(MATERIALS[name])
    bsdf.inputs["Roughness"].default_value = ROUGH.get(name, 0.3 if name in ("AmmoTank", "EyeWhite", "Pupil") else 0.55)
    if name in EMISSIVE:
        hx, strength = EMISSIVE[name]
        bsdf.inputs["Emission Color"].default_value = hex_color(hx)
        bsdf.inputs["Emission Strength"].default_value = strength
    mat.diffuse_color = hex_color(MATERIALS[name])
    return mat


def xform(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return (Matrix.Translation(Vector(loc)) @ Euler(rot, "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal(Vector((*scale, 1.0))))


def catmull(p0, p1, p2, p3, t):
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)


def smooth_path(points, per_seg=8):
    """Interpola uma lista de pontos (Vector) com uma curva suave."""
    P = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(len(points) - 1):
        for k in range(per_seg):
            out.append(catmull(P[i], P[i + 1], P[i + 2], P[i + 3], k / per_seg))
    out.append(points[-1])
    return out


class Part:
    """Junta várias formas numa só malha com vários materiais."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.slots = []

    def _slot(self, mat):
        if mat not in self.slots:
            self.slots.append(mat)
        return self.slots.index(mat)

    def _add(self, tmp, mat, smooth=True):
        mesh = bpy.data.meshes.new("_tmp")
        tmp.to_mesh(mesh); tmp.free()
        before = len(self.bm.faces)
        self.bm.from_mesh(mesh)
        bpy.data.meshes.remove(mesh)
        self.bm.faces.ensure_lookup_table()
        idx = self._slot(mat)
        for f in self.bm.faces[before:]:
            f.material_index = idx
            # "bevel": só as faces inclinadas (os chanfros) ficam suaves; as faces grandes e planas ficam planas
            f.smooth = True if smooth is True else (max(abs(f.normal.x), abs(f.normal.y), abs(f.normal.z)) < 0.999)

    # esfera/elipsoide
    def sphere(self, mat, loc, scale, rot=(0, 0, 0), segs=24, rings=14):
        tmp = bmesh.new()
        try:
            bmesh.ops.create_uvsphere(tmp, u_segments=segs, v_segments=rings, radius=1.0, matrix=xform(loc, rot, scale))
        except TypeError:
            bmesh.ops.create_uvsphere(tmp, u_segments=segs, v_segments=rings, diameter=1.0, matrix=xform(loc, rot, scale))
        self._add(tmp, mat)

    # caixa simples
    def box(self, mat, loc, size, rot=(0, 0, 0)):
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0, matrix=xform(loc, rot, size))
        self._add(tmp, mat, smooth=False)

    # caixa com cantos arredondados (chanfro suave)
    def rbox(self, mat, loc, size, rot=(0, 0, 0), radius=0.15, segs=3):
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.transform(tmp, matrix=Matrix.Diagonal(Vector((*size, 1.0))), verts=tmp.verts)
        r = min(radius, min(size) / 2 - 1e-3)
        if r > 0.004:
            bmesh.ops.bevel(tmp, geom=list(tmp.verts) + list(tmp.edges) + list(tmp.faces), offset=r, segments=segs,
                            profile=0.5, affect="EDGES")
        bmesh.ops.transform(tmp, matrix=xform(loc, rot), verts=tmp.verts)
        self._add(tmp, mat, smooth="bevel")

    # cone / cilindro (radius1 em baixo, radius2 em cima)
    def cone(self, mat, loc, r_bottom, r_top, depth, rot=(0, 0, 0), segs=20):
        tmp = bmesh.new()
        m = xform(loc, rot)
        try:
            bmesh.ops.create_cone(tmp, cap_ends=True, cap_tris=False, segments=segs, radius1=r_bottom, radius2=r_top, depth=depth, matrix=m)
        except TypeError:
            bmesh.ops.create_cone(tmp, cap_ends=True, cap_tris=False, segments=segs, diameter1=r_bottom * 2, diameter2=r_top * 2, depth=depth, matrix=m)
        self._add(tmp, mat)

    # superfície de revolução a partir de um perfil [(raio, z), ...] de baixo para cima (suavizado)
    def lathe(self, mat, profile, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), segs=36, per_seg=5):
        pts = smooth_path([Vector((r, 0, z)) for r, z in profile], per_seg)
        tmp = bmesh.new()
        rings = []
        for p in pts:
            r = max(p.x, 0.0)
            if r < 1e-4:
                rings.append([tmp.verts.new((0, 0, p.z))])
            else:
                rings.append([tmp.verts.new((math.cos(a) * r, math.sin(a) * r, p.z))
                              for a in (2 * math.pi * j / segs for j in range(segs))])
        for i in range(len(rings) - 1):
            A, B = rings[i], rings[i + 1]
            if len(A) == 1 and len(B) == 1:
                continue
            if len(A) == 1:
                for j in range(segs):
                    tmp.faces.new((A[0], B[(j + 1) % segs], B[j]))
            elif len(B) == 1:
                for j in range(segs):
                    tmp.faces.new((A[j], A[(j + 1) % segs], B[0]))
            else:
                for j in range(segs):
                    tmp.faces.new((A[j], A[(j + 1) % segs], B[(j + 1) % segs], B[j]))
        for ring in (rings[0], rings[-1]):                       # tampas
            if len(ring) > 2:
                tmp.faces.new(ring if ring is rings[-1] else ring[::-1])
        bmesh.ops.transform(tmp, matrix=xform(loc, rot, scale), verts=tmp.verts)
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces[:])
        self._add(tmp, mat)

    # tubo que afina ao longo de uma curva suave: pts = [(x,y,z)], radii = raio em cada ponto
    def tube(self, mat, pts, radii, sides=16, per_seg=8, scale_xy=(1, 1)):
        path = smooth_path([Vector(p) for p in pts], per_seg)
        rad = smooth_path([Vector((r, 0, 0)) for r in radii], per_seg)
        tmp = bmesh.new()
        rings = []
        for i, (p, r) in enumerate(zip(path, rad)):
            nxt = path[min(i + 1, len(path) - 1)]; prv = path[max(i - 1, 0)]
            tan = (nxt - prv).normalized()
            ref = Vector((0, 1, 0)) if abs(tan.y) < 0.9 else Vector((1, 0, 0))
            nrm = tan.cross(ref).normalized(); bnm = tan.cross(nrm).normalized()
            rr = max(r.x, 0.003)
            rings.append([tmp.verts.new(p + (nrm * math.cos(a) * scale_xy[0] + bnm * math.sin(a) * scale_xy[1]) * rr)
                          for a in (2 * math.pi * j / sides for j in range(sides))])
        for i in range(len(rings) - 1):
            for j in range(sides):
                tmp.faces.new((rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j]))
        tmp.faces.new(rings[0][::-1]); tmp.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces[:])
        self._add(tmp, mat)

    def build(self, collection, location=(0, 0, 0)):
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh); self.bm.free()
        for name in self.slots:
            mesh.materials.append(get_material(name))
        obj = bpy.data.objects.new(self.name, mesh)
        obj.location = location
        collection.objects.link(obj)
        return obj
