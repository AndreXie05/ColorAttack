import * as THREE from "three";
import { cloneCharacter, disposeCharacter, setCharacterPaint } from "../personagens/character-model.js";
import { animateCharacter } from "../personagens/character-animator.js";
import { MOTION } from "../movimento/player-motion.js";
import { applyCosmetics } from "../loja/cosmetics.js";
import * as Emotes from "../personagens/emotes.js";

/* ============================================================
   PÓDIO DO FIM DO JOGO: a equipa que ganhou sobe ao pódio (1.º ao meio, 2.º à esquerda, 3.º à direita, 4.º e 5.º nas pontas,
   pela ordem das eliminações) e cada um faz as suas celebrações sem parar (tu fazes a que tens equipada).
   Holofotes, confettis a cair e a câmara a balançar devagar. É um palco à parte (cena própria), desenhado no lugar do mapa
   enquanto o ecrã final está aberto, a 30 fps. Tudo o que é criado aqui é libertado em hide().
   entries = [{ tpl, paint, equip, emote, name, kills, isPlayer }] já ordenados (o melhor primeiro).
   ============================================================ */
const SLOTS = [{ x: 0, h: 1.1 }, { x: -2.35, h: 0.75 }, { x: 2.35, h: 0.5 }, { x: -4.6, h: 0.25 }, { x: 4.6, h: 0.25 }];
const CONFETTI = 160, CONF_COLORS = [0xff3b4a, 0xffd21f, 0x2f7bff, 0x47e06a, 0xa447ff, 0xff8a1f, 0xffffff];
const IDLE = { speed: 0, maxSpeed: MOTION.run, onGround: true, vy: 0, landed: false, impact: 0, climbing: false, crouching: false };

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const css = (hex) => "#" + hex.toString(16).padStart(6, "0");

export function createPodium(renderer) {
  let scene = null, camera = null, people = [], junk = [], confetti = null, conf = [], last = 0, t0 = 0;

  function build(entries, teamColor) {
    scene = new THREE.Scene();
    const team = css(teamColor);
    const bg = canvasTexture(4, 256, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, "#0d0b1f"); grd.addColorStop(0.55, "#241a52"); grd.addColorStop(1, team);
      g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    });
    scene.background = bg; junk.push(bg);
    camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);                    // (campo largo: as bolhas das celebrações ficam abaixo do título)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a6a, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(3, 9, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -2, near: 1, far: 30 });
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); junk.push(geo, mat); return m; };
    const floor = add(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ color: 0x1d1640, roughness: 0.9 }), 0, 0, 0);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const ring = add(new THREE.RingGeometry(6.2, 6.5, 64), new THREE.MeshBasicMaterial({ color: teamColor }), 0, 0.01, 0);
    ring.rotation.x = -Math.PI / 2;

    // degraus do pódio: número grande e o nome na frente
    entries.forEach((e, i) => {
      const s = SLOTS[i];
      const side = new THREE.MeshStandardMaterial({ color: i === 0 ? 0xffd21f : i === 1 ? 0xdfe6f0 : i === 2 ? 0xe0995a : 0x7a6ab8, roughness: 0.55 });
      const block = add(new THREE.BoxGeometry(2.1, s.h, 1.9), side, s.x, s.h / 2, 0);
      block.castShadow = true; block.receiveShadow = true;
      add(new THREE.BoxGeometry(2.16, 0.08, 1.96), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), s.x, s.h, 0).receiveShadow = true;
      const label = canvasTexture(256, 160, (g, w, h) => {
        g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
        g.font = "96px 'Titan One', sans-serif"; g.lineWidth = 10; g.strokeStyle = "#1a1033";
        g.strokeText(`${i + 1}º`, w / 2, 58); g.fillStyle = "#fff"; g.fillText(`${i + 1}º`, w / 2, 58);
        g.font = "30px 'Titan One', sans-serif"; g.lineWidth = 6;
        const txt = `${e.name} · 💥 ${e.kills}`;
        g.strokeText(txt, w / 2, 132, w - 12); g.fillStyle = e.isPlayer ? "#ffd21f" : "#fff"; g.fillText(txt, w / 2, 132, w - 12);
      });
      const plate = add(new THREE.PlaneGeometry(1.9, 1.19), new THREE.MeshBasicMaterial({ map: label, transparent: true, depthWrite: false }), s.x, 0.33, 1.75);
      plate.rotation.x = -1.05;                                                     // placa no chão à frente do degrau, inclinada para a câmara
      junk.push(label);
      if (i < 3) {                                                               // holofote por cima dos três primeiros
        const cone = add(new THREE.CylinderGeometry(0.25, 1.35, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: i === 0 ? 0.13 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), s.x, s.h + 3.5, 0);
        cone.renderOrder = 5;
      }
      // o boneco
      const model = cloneCharacter(e.tpl);
      setCharacterPaint(model, e.paint);
      applyCosmetics(model, e.equip || {});
      model.position.set(s.x, s.h, 0);
      model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(model);
      people.push({ model, e, who: { emote: null }, next: 0.4 + i * 0.35 });
    });

    // confettis: uma só malha com 160 cópias
    const geo = new THREE.PlaneGeometry(0.14, 0.09), mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    confetti = new THREE.InstancedMesh(geo, mat, CONFETTI);
    const c = new THREE.Color();
    conf = [];
    for (let i = 0; i < CONFETTI; i++) {
      conf.push({ x: (Math.random() - 0.5) * 14, y: Math.random() * 9, z: (Math.random() - 0.5) * 6 - 0.5, vy: 0.8 + Math.random() * 0.9, rx: Math.random() * 6, ry: Math.random() * 6, w: 1 + Math.random() * 3 });
      confetti.setColorAt(i, c.setHex(CONF_COLORS[i % CONF_COLORS.length]));
    }
    scene.add(confetti); junk.push(geo, mat);
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  return {
    get active() { return !!scene; },
    show(entries, { teamColor }) {
      this.hide();
      if (!entries.length) return;
      build(entries.slice(0, SLOTS.length), teamColor);
      t0 = performance.now(); last = 0;
    },
    hide() {
      if (!scene) return;
      for (const p of people) disposeCharacter(p.model);
      for (const j of junk) j.dispose();
      confetti?.dispose();
      scene = null; camera = null; people = []; junk = []; confetti = null; conf = [];
    },
    render(now) {
      if (!scene || now - last < 33) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016), t = (now - t0) / 1000; last = now;
      const w = window.innerWidth, h = window.innerHeight;
      if (camera.aspect !== w / h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
      for (const p of people) {
        if (!Emotes.playing(p.who, now) && t > p.next) {                           // celebra outra vez (a tua é sempre a que tens equipada)
          const ids = p.e.emote ? [p.e.emote] : Object.keys(Emotes.EMOTES);
          Emotes.play(p.who, ids[Math.floor(Math.random() * ids.length)], now);
          p.next = t + Emotes.EMOTES[p.who.emote.id].dur + 0.5 + Math.random() * 0.8;
        }
        p.model.position.y = SLOTS[people.indexOf(p)].h; p.model.rotation.y = 0;
        animateCharacter(p.model, IDLE, dt, t);
        Emotes.apply(p.model, p.who, now);
      }
      for (let i = 0; i < conf.length; i++) {
        const k = conf[i];
        k.y -= k.vy * dt; k.rx += k.w * dt; k.ry += k.w * 0.7 * dt;
        if (k.y < 0.02) { k.y = 8 + Math.random() * 2; k.x = (Math.random() - 0.5) * 14; }
        _m.compose(_p.set(k.x + Math.sin(t * 1.3 + i) * 0.25, k.y, k.z), _q.setFromEuler(_e.set(k.rx, k.ry, 0)), _s);
        confetti.setMatrixAt(i, _m);
      }
      confetti.instanceMatrix.needsUpdate = true;
      camera.position.set(Math.sin(t * 0.25) * 1.3, 3.1, 11.5);
      camera.lookAt(0, 2.45, 0);
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
    },
  };
}
