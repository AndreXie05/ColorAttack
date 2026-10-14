import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CONFIG } from "./game-config.js";
import { symbolMaterial } from "./symbol-sprites.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/* ============================================================
   BONECO FEITO NO BLENDER (assets/character.glb)
   Procura as partes pelo nome: Body, LegL, LegR, ArmL, ArmR (a origem de cada perna/braço é a articulação)
   e, se existirem, ShinL, ShinR (canelas com origem no joelho: dobrar os joelhos ao andar e agachar).
   Materiais com nome: "Paint" muda com a cor do jogador e "AmmoTank" com a cor da munição.
   Devolve um grupo com o mesmo `userData` do boneco simples (test-dummy.js), por isso o resto do jogo
   não precisa de saber qual dos dois está a usar. Se o ficheiro faltar ou falhar, devolve null.
   ============================================================ */
const MODEL_HEIGHT = 2.7;                                  // altura de todos os bonecos no modelo (antes de CONFIG.player.scale)
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
  // todos os personagens com a mesma altura total (do pé ao topo do cabelo): os corpos são iguais, só o cabelo/capuz muda
  const h = new THREE.Box3().setFromObject(gltf.scene).max.y;
  const k = h > 0.5 ? MODEL_HEIGHT / h : 1;
  gltf.scene.scale.setScalar(k);

  const paintMat = new THREE.MeshStandardMaterial({ color: 0xff3b4a, roughness: 0.5, metalness: 0 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0xff3b4a, roughness: 0.35, emissive: 0x222222 });
  paintMat.name = "Paint"; gunMat.name = "AmmoTank";                      // (os clones procuram os materiais por estes nomes)
  const paint = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = false;
    const name = o.material && o.material.name;
    if (name === "Paint") { o.material = paintMat; paint.push(o); }
    else if (name === "AmmoTank" || name === "GunBody") o.material = gunMat;            // a pistola toda tem a cor da munição
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

  const body = gltf.scene.getObjectByName("Body");
  root.userData = { legL, legR, armL, armR, shinL: gltf.scene.getObjectByName("ShinL"), shinR: gltf.scene.getObjectByName("ShinR"), body,
    rest: restPose(body, armL, armR), sym, paint, gunMat, paintMat, fromModel: true, k };
  collectTint(root, false);
  return root;
}

// Posição de repouso do tronco e dos braços (o tronco inclina-se a partir da anca ao agachar e os braços vão com ele)
function restPose(body, armL, armR) {
  const p = (o) => (o ? o.position.clone() : null);
  return { body: p(body), armL: p(armL), armR: p(armR) };
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
    legL: find("LegL"), legR: find("LegR"), armL: find("ArmL"), armR: find("ArmR"), shinL: find("ShinL"), shinR: find("ShinR"), body: find("Body"),
    rest: template.userData.rest || restPose(find("Body"), find("ArmL"), find("ArmR")),   // (a do modelo original: o clone pode ter sido feito a meio de uma pose)
    sym: root.children.find((c) => c.isSprite), paint, gunMat, paintMat, fromModel: true, k: template.userData.k || 1,
  };
  collectTint(root, true);
  return root;
}

// Cor do boneco (a cor que os adversários têm de acertar para o eliminar)
// fade (0..1): vai-se tornando branco (animação de quando é eliminado)
export function setCharacterPaint(model, hex, fade = 0) {
  model.userData.hex = hex;
  if (model.userData.paintMat) { model.userData.paintMat.color.setHex(hex); if (fade > 0) model.userData.paintMat.color.lerp(_white, fade); }
  if (model.userData.glow && model.userData.paintMat) model.userData.paintMat.emissive.copy(model.userData.paintMat.color).multiplyScalar(model.userData.glow);   // skins que brilham (Néon, Perolado): com a cor atual
  const k = CONFIG.ui.bodyTint;
  if (k > 0 && model.userData.tint) for (const t of model.userData.tint) {
    _tc.setHex(hex); if (t.dark) _tc.multiplyScalar(0.5); t.m.color.copy(t.base).lerp(_tc, k);
    if (fade > 0) t.m.color.lerp(_white, fade);
  }
}
const _white = new THREE.Color(1, 1, 1);

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


// ---------- itens na mão do boneco: granada (cor ou duas cores meio a meio) e kit de primeiros socorros ----------
export function addHeldItems(model) {
  const arm = model.userData.armR;
  if (!arm || model.userData.held) return;
  const gren = new THREE.Group(); gren.position.set(0, -0.7, 0.14); gren.visible = false; gren.rotation.y = Math.PI / 2;
  const half = (phi) => new THREE.Mesh(new THREE.SphereGeometry(0.16, 22, 14, phi, Math.PI), new THREE.MeshStandardMaterial({ roughness: 0.35, emissive: 0x111111 }));
  const a = half(0), b = half(Math.PI);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0xf4f4f8 }));
  pin.position.y = 0.17;
  gren.add(a, b, pin); arm.add(gren);
  const kit = new THREE.Group(); kit.position.set(0, -0.72, 0.15); kit.visible = false;
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }), red = new THREE.MeshStandardMaterial({ color: 0xff3b4a, roughness: 0.4 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.26, 0.17, 3, 0.05), white);
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.19), red), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.19), red);
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.05, 0.05, 2, 0.02), white); handle.position.y = 0.16;
  kit.add(body, c1, c2, handle); arm.add(kit);
  const gunMeshes = [];
  arm.traverse((o) => { if (o.isMesh && (o.material === model.userData.gunMat || (o.material.name === "Belt"))) gunMeshes.push(o); });
  model.userData.held = { gren, a, b, kit, gunMeshes, key: "" };
}

// mode: "gun" | "grenade" | "medkit"; c1/c2 = cores (hex) da granada (c2 opcional: meia granada de cada cor)
export function setHeld(model, mode, c1 = 0xffffff, c2 = null) {
  const h = model.userData.held;
  if (!h) return;
  const key = mode + c1 + "|" + c2;
  if (key === h.key) return;
  h.key = key;
  h.gren.visible = mode === "grenade"; h.kit.visible = mode === "medkit";
  for (const m of h.gunMeshes) m.visible = mode === "gun";
  if (mode === "grenade") { h.a.material.color.setHex(c1); h.b.material.color.setHex(c2 ?? c1); }
}
