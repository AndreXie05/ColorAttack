import * as THREE from "three";
import { loadCharacter } from "./character-model.js";
import { CHARACTERS } from "./characters.js";

/* ============================================================
   RETRATOS DOS PERSONAGENS (para as bolinhas do topo)
   Tira-se uma fotografia da cabeça de cada modelo do Blender, uma vez, com a cor de cada equipa na peça
   "Paint" (turquesa / rosa), e guarda-se como imagem. Assim cada bolinha mostra o personagem real em campo.
   ============================================================ */
const urls = new Map();            // "id|cor" -> dataURL
let started = null;

export function buildPortraits(teamColors) {
  if (started) return started;
  started = (async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(160, 160, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8d0e0, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(2, 5, 6); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(25, 1, 0.5, 40);
    cam.position.set(0, 2.25, 4.8); cam.lookAt(0, 2.1, 0);
    const colors = [...new Set(Object.values(teamColors))];
    for (const c of CHARACTERS) {
      const model = await loadCharacter(c.url);            // instância própria (a do jogador fica intocada)
      if (!model) continue;
      if (model.userData.sym) model.userData.sym.visible = false;   // sem o símbolo de cor por cima da cabeça
      scene.add(model);
      for (const hex of colors) {
        for (const m of model.userData.paint) m.material.color.setHex(hex);
        renderer.render(scene, cam);
        urls.set(`${c.id}|${hex}`, renderer.domElement.toDataURL("image/png"));
      }
      scene.remove(model);
    }
    renderer.dispose();
  })().catch((err) => console.warn("Não foi possível criar os retratos.", err));
  return started;
}

export const portraitUrl = (id, hex) => urls.get(`${id}|${hex}`) || null;
