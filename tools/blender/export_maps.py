"""
Exporta os 5 mapas sem abrir o Blender (modo de linha de comandos):
  ./blender-5.2.2-linux-x64/blender -b --python tools/blender/export_maps.py
"""
import os
BASE = "/home/andrexie/Documents/ColorAttack"
for name, script in [("parque", "build_park_map.py"), ("escola", "build_school_map.py"), ("restaurante", "build_restaurant_map.py"),
                     ("fabrica", "build_factory_map.py"), ("diversoes", "build_funfair_map.py")]:
    g = {"__name__": "__main__", "OUTPUT": f"{BASE}/assets/maps/{name}.glb"}
    try:
        exec(open(f"{BASE}/tools/blender/{script}").read(), g)
        print("MAPA OK", name, os.path.getsize(f"{BASE}/assets/maps/{name}.glb"), "bytes")
    except Exception as e:
        import traceback; traceback.print_exc(); print("MAPA ERRO", name, repr(e))
