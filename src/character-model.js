import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CONFIG } from "./game-config.js";
import { symbolMaterial } from "./symbol-sprites.js";

/* ============================================================
   BONECO FEITO NO BLENDER (assets/character.glb)
   Procura as partes pelo nome: Body, LegL, LegR, ArmL, ArmR (a origem de cada perna/braço é a articulação).
   Materiais com nome: "Paint" muda com a cor do jogador e "AmmoTank" com a cor da munição.
   Devolve um grupo com o mesmo `userData` do boneco simples (test-dummy.js), por isso o resto do jogo
   não precisa de saber qual dos dois está a usar. Se o ficheiro faltar ou falhar, devolve null.
   ============================================================ */
export async function loadCharacter(url = "assets/character.glb") {
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(url);
  } catch (err) {
    console.warn("Não foi possível carregar " + url + "; fica o boneco simples.", err);
    return null;
  }
  const root = new THREE.Group();
  root.add(gltf.scene);

  const paintMat = new THREE.MeshStandardMaterial({ color: 0xff3b4a, roughness: 0.5, metalness: 0 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0xff3b4a, roughness: 0.35, emissive: 0x222222 });
  paintMat.name = "Paint"; gunMat.name = "AmmoTank";                      // (os clones procuram os materiais por estes nomes)
  const paint = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = false;
    const name = o.material && o.material.name;
    if (name === "Paint") { o.material = paintMat; paint.push(o); }
    else if (name === "AmmoTank") o.material = gunMat;
  });

  const need = (n) => {
    const o = gltf.scene.getObjectByName(n);
    if (!o) throw new Error("Falta a parte '" + n + "' no modelo");
    return o;
  };
  const legL = need("LegL"), legR = need("LegR"), armL = need("ArmL"), armR = need("ArmR");

  const sym = new THREE.Sprite(symbolMaterial("vermelho") || undefined);
  sym.position.set(0, 3.25, 0); sym.scale.set(1.5, 1.5, 1); sym.renderOrder = 5;
  sym.visible = CONFIG.ui.symbolAboveHead;
  root.add(sym);

  root.userData = { legL, legR, armL, armR, sym, paint, gunMat, paintMat, fromModel: true };
  collectTint(root, false);
  return root;
}

// Cria outro boneco igual (para os bots) com materiais próprios, para cada um poder ter a sua cor
export function cloneCharacter(template) {
  const root = template.clone(true);
  const paintMat = template.userData.paintMat.clone(), gunMat = template.userData.gunMat.clone();
  const paint = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (o.material.name === "Paint") { o.material = paintMat; paint.push(o); }
    else if (o.material.name === "AmmoTank") o.material = gunMat;
  });
  const find = (n) => root.getObjectByName(n);
  root.userData = {
    legL: find("LegL"), legR: find("LegR"), armL: find("ArmL"), armR: find("ArmR"),
    sym: root.children.find((c) => c.isSprite), paint, gunMat, paintMat, fromModel: true,
  };
  collectTint(root, true);
  return root;
}

// Cor do boneco (a cor que os adversários têm de acertar para o eliminar)
export function setCharacterPaint(model, hex) {
  if (model.userData.paintMat) model.userData.paintMat.color.setHex(hex);
  const k = CONFIG.ui.bodyTint;
  if (k > 0 && model.userData.tint) for (const t of model.userData.tint) { _tc.setHex(hex); if (t.dark) _tc.multiplyScalar(0.5); t.m.color.copy(t.base).lerp(_tc, k); }
}

// Guarda as restantes cores do boneco para o poder tingir por inteiro com a cor atual
const _tc = new THREE.Color();
function collectTint(root, own) {
  const seen = new Map(), tint = [];
  root.traverse((o) => {
    if (!o.isMesh || o.material.name === "Paint" || o.material.name === "AmmoTank") return;
    let m = seen.get(o.material);
    if (!m) {
      m = own ? o.material.clone() : o.material; seen.set(o.material, m);
      const c = m.color, l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      if (l > 0.85) return;                                // o branco (olhos) fica como está
      tint.push({ m, base: c.clone(), dark: l < 0.12 });
    }
    o.material = m;
  });
  root.userData.tint = tint;
}
