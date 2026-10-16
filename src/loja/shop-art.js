import * as THREE from "three";
import { loadCharacter, setCharacterPaint } from "../personagens/character-model.js";
import { animateCharacter } from "../personagens/character-animator.js";
import { MOTION } from "../movimento/player-motion.js";
import { ITEMS, buildWeapon } from "./cosmetics.js";
import * as Emotes from "../personagens/emotes.js";
import { TRAILS } from "./trails.js";

/* ============================================================
   IMAGENS DA LOJA (armas, celebrações e rastos)
   Fotografias tiradas uma só vez, quando a loja abre pela primeira vez (não atrasam o arranque do jogo):
   - armas: a arma em 3D, de lado;  - celebrações: o boneco a meio da celebração;
   - rastos: um desenho com o rasto a sair de quem corre.
   get(id) devolve a imagem (dataURL) ou null enquanto não está pronta.
   ============================================================ */
const urls = new Map();
let started = null;
const W = 150, H = 190, PAINT = 0x2fd3c4;

// momento de cada celebração que fica na fotografia (fração da duração)
const EMOTE_AT = { emote_aceno: 0.4, emote_danca: 0.32, emote_heroi: 0.5, emote_mortal: 0.5, emote_piao: 0.3, emote_palmas: 0.42, emote_venia: 0.5, emote_saltos: 0.27,
  emote_robo: 0.2, emote_guitarra: 0.4, emote_floss: 0.33, emote_dab: 0.3, emote_karate: 0.45, emote_meditar: 0.5, emote_cavalinho: 0.3, emote_flexoes: 0.5, emote_coracao: 0.5, emote_sono: 0.55 };

// algumas ficam melhor de lado (o ângulo da fotografia, em radianos)
const EMOTE_YAW = { emote_flexoes: 1.35, emote_mortal: 1.35, emote_meditar: 0.75, emote_venia: 1.0, emote_karate: 0.9 };
export const get = (id) => urls.get(id) || null;

export function build() {
  if (started) return started;
  started = (async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8d0e0, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(3, 5, 6); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(26, W / H, 0.05, 60);
    const shot = () => { renderer.render(scene, cam); return renderer.domElement.toDataURL("image/png"); };

    // ---- armas ----
    const paint = new THREE.MeshStandardMaterial({ color: PAINT, roughness: 0.35, emissive: 0x0a2a28 });
    const tpl = await loadCharacter("light:iniciante");
    const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
    for (const it of ITEMS.filter((i) => i.cat === "arma")) {
      let g;
      if (it.id === "arma_pistola") {                                              // a pistola original é a do próprio boneco
        const gun = tpl?.getObjectByName("Gun"); if (!gun) continue;
        g = new THREE.Group(); const m = gun.clone(); m.material = paint; g.add(m);
      } else g = buildWeapon(it.id, paint);
      const holder = new THREE.Group(); holder.add(g); scene.add(holder);
      holder.rotation.set(0.25, -1.15, 0);                                          // de lado, um pouco de cima, o cano para a direita
      box.setFromObject(holder); box.getSize(size); box.getCenter(mid);
      holder.position.sub(mid);
      const r = Math.max(size.x, size.y * 1.25, size.z) * 0.62;
      cam.position.set(0, 0, r / Math.tan(THREE.MathUtils.degToRad(13)) + 0.2); cam.lookAt(0, 0, 0);
      urls.set(it.id, shot());
      scene.remove(holder);
    }

    // ---- celebrações: o boneco Iniciante a meio de cada uma ----
    if (tpl) {
      const model = tpl; scene.add(model);
      setCharacterPaint(model, PAINT);
      if (model.userData.sym) model.userData.sym.visible = false;
      const now = performance.now(), idle = { speed: 0, maxSpeed: MOTION.run, onGround: true, vy: 0, landed: false, impact: 0, climbing: false, crouching: false };
      for (const it of ITEMS.filter((i) => i.cat === "emote")) {
        const def = Emotes.EMOTES[it.id]; if (!def) continue;
        const e = { emote: { id: it.id, start: now - (EMOTE_AT[it.id] ?? 0.4) * def.dur * 1000, end: now + 60000 } };
        model.position.set(0, 0, 0); model.rotation.set(0, EMOTE_YAW[it.id] ?? 0.35, 0); model.scale.setScalar(1);
        model.userData.anim = null;
        animateCharacter(model, idle, 0.016, 1);
        Emotes.apply(model, e, now);
        if (model.userData.bubble) model.userData.bubble.visible = false;
        cam.position.set(0, 1.7, it.id === "emote_mortal" || it.id === "emote_flexoes" ? 8.2 : 7.2); cam.lookAt(0, 1.5, 0);
        urls.set(it.id, shot());
        Emotes.stop(e); Emotes.apply(model, e, now);
      }
      scene.remove(model);
    }
    renderer.dispose();

    // ---- rastos: desenho em 2D ----
    const COLORS = ["#ff3b4a", "#ffd21f", "#2f7bff", "#47e06a", "#a447ff", "#ff8a1f"];
    for (const it of ITEMS.filter((i) => i.cat === "rasto")) {
      const def = TRAILS[it.id]; if (!def) continue;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d");
      g.textAlign = "center"; g.textBaseline = "middle";
      for (let i = 0; i < 7; i++) {                                                 // em onda, dos pés de quem corre para trás e para cima, a crescer e a desvanecer
        const k = i / 6, x = 88 - k * 72, y = 156 - k * 62 + Math.sin(k * Math.PI * 2.2) * 12, s = 18 + k * 20;
        g.globalAlpha = 1 - k * 0.45;
        g.save(); g.translate(x, y); g.rotate((i % 3 - 1) * 0.3);
        if (def === "rainbow") { g.fillStyle = COLORS[i % 6]; g.beginPath(); g.arc(0, 0, s * 0.42, 0, Math.PI * 2); g.fill(); }
        else if (def === "confetti") { g.fillStyle = COLORS[i % 6]; g.fillRect(-s * 0.35, -s * 0.22, s * 0.7, s * 0.44); }
        else { g.font = `${s}px serif`; g.fillText(def[i % def.length], 0, 0); }
        g.restore();
      }
      g.globalAlpha = 1; g.font = "58px serif"; g.save(); g.translate(118, 146); g.scale(-1, 1); g.fillText("🏃", 0, 0); g.restore();   // quem corre (virado para a direita)
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 3; g.lineCap = "round";                // linhas de velocidade
      for (const [y, l] of [[128, 22], [142, 30], [156, 18]]) { g.beginPath(); g.moveTo(84 - l, y); g.lineTo(84, y); g.stroke(); }
      urls.set(it.id, c.toDataURL("image/png"));
    }
  })().catch((err) => console.warn("Não foi possível criar as imagens da loja.", err));
  return started;
}
