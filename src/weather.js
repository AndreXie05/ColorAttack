import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { G } from "./materials-and-geometry.js";

/* ============================================================
   CLIMA: sol, chuva, trovoada e nevoeiro
   Para acrescentar um clima novo basta uma entrada em WEATHERS.
   O clima muda a luz, o céu, o nevoeiro, as nuvens, a chuva e (na trovoada) os relâmpagos.
   `play` = efeito no jogo: paintLife (duração da tinta e das poças), range (alcance dos tiros), sight (até onde os bots veem).
   ============================================================ */
export const WEATHERS = {
  sol:      { id: "sol",      icon: "☀️",  name: "Sol",      sky: 0x8fd3ff, top: null, skyMix: 0,    fogNear: 150, fogFar: 420, hemi: 1,    sun: 1,    rain: 0,    wind: 0, cloud: 0xffffff, lightning: false,
              play: { paintLife: 1, range: 1, sight: 1, desc: "" } },
  chuva:    { id: "chuva",    icon: "🌧️", name: "Chuva",    sky: 0x7d8ea3, top: 0x55657a, skyMix: 0.7,  fogNear: 70,  fogFar: 280, hemi: 0.62, sun: 0.25, rain: 2800, wind: 2, cloud: 0x8f99a8, lightning: false,
              play: { paintLife: 0.6, range: 1, sight: 1, desc: "a chuva lava a tinta: as poças duram menos" } },
  trovoada: { id: "trovoada", icon: "⛈️", name: "Trovoada", sky: 0x2b3340, top: 0x1c222c, skyMix: 0.85, fogNear: 50,  fogFar: 220, hemi: 0.4,  sun: 0.1,  rain: 6000, wind: 7, cloud: 0x4a5261, lightning: true,
              play: { paintLife: 0.45, range: 1, sight: 0.85, desc: "chuva forte: as poças duram muito pouco" } },
  nevoeiro: { id: "nevoeiro", icon: "🌫️", name: "Nevoeiro", sky: 0xc9d2da, top: 0xaab4bf, skyMix: 0.9,  fogNear: 8,   fogFar: 62,  hemi: 0.75, sun: 0.3,  rain: 0,    wind: 0.5, cloud: 0xd8dde2, lightning: false,
              play: { paintLife: 1, range: 0.75, sight: 0.55, desc: "os tiros chegam menos longe e ninguém vê ao longe" } },
};
export const WEATHER_IDS = Object.keys(WEATHERS);

const MAX_DROPS = 6000;
const VOL = { x: 70, z: 52, top: 46 };                 // volume de chuva sobre a arena
let audioCtx = null;

// Trovão sintetizado (ruído com filtro grave); só toca depois de o utilizador ter interagido
function playThunder(strength = 1) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const dur = 2.6, n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 170 + strength * 60;
    const gain = audioCtx.createGain(); gain.gain.value = 0.5 * strength;
    src.connect(lp); lp.connect(gain); gain.connect(audioCtx.destination);
    src.start();
  } catch (e) { /* sem áudio: ignora */ }
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _bg = new THREE.Color(), _flashC = new THREE.Color(0xdfe8ff);   // reutilizadas em cada frame (sem lixo para o coletor de memória)

export class WeatherSystem {
  constructor(map, scene) {
    this.scene = scene; this.map = map;
    this.hemi = map.lights.find((l) => l.isHemisphereLight);
    this.sun = map.lights.find((l) => l.isDirectionalLight);
    this.base = { bg: new THREE.Color(map.background), hemi: this.hemi.intensity, sun: this.sun.intensity };
    this.group = new THREE.Group();
    map.group.add(this.group);

    // chuva: um único LineSegments com até 6000 gotas
    this.drops = new Float32Array(MAX_DROPS * 3);
    for (let i = 0; i < MAX_DROPS; i++) this._respawn(i, true);
    this.rainPos = new Float32Array(MAX_DROPS * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    rg.setDrawRange(0, 0);
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.55, fog: false });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    // céu em gradiente (cúpula): topo azul intenso -> horizonte claro; as cores são atualizadas com o clima
    this.skyTopBase = new THREE.Color(map.skyTop ?? 0x2f8cff);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: this.skyTopBase.clone() }, bottom: { value: this.base.bg.clone() } },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "uniform vec3 top; uniform vec3 bottom; varying vec3 vP;",
        "void main(){",
        "  float h = clamp(normalize(vP).y, 0.0, 1.0);",
        "  gl_FragColor = vec4(mix(bottom, top, pow(h, 0.5)), 1.0);",
        "  #include <colorspace_fragment>",
        "}",
      ].join("\n"),
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.group.add(this.sky);

    // nuvens cartoon fofas: aglomerados de esferas achatadas (perto e ao longe, para dar profundidade)
    this.cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xb8b8b8, roughness: 1 });
    this.clouds = [];
    // cada nuvem é uma malha só (as bolas juntas): ~170 chamadas de desenho passam a 28
    this.cloudGeos = [];
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const makeCloud = (x, y, z, k) => {
      const parts = 5 + Math.floor(Math.random() * 3), geos = [];
      for (let i = 0; i < parts; i++) {
        const r = Math.round((6 + Math.random() * 5) * k * 2) / 2;
        ps.set((i - parts / 2) * 6.5 * k, Math.sin(i * 1.7) * 2.5 * k, (Math.random() - 0.5) * 5 * k); sc.set(1, 0.62, 1);
        geos.push(G.sphere(r).clone().applyMatrix4(mx.compose(ps, q, sc)));
      }
      const geo = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
      const c = new THREE.Mesh(geo, this.cloudMat);
      c.position.set(x, y, z);
      this.group.add(c); this.clouds.push(c); this.cloudGeos.push(geo);
    };
    for (let i = 0; i < 12; i++) makeCloud((Math.random() * 2 - 1) * 130, 55 + Math.random() * 14, (Math.random() * 2 - 1) * 100, 1);
    for (let i = 0; i < 16; i++) {                                       // nuvens grandes no horizonte
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3, d = 190 + Math.random() * 90;
      makeCloud(Math.cos(a) * d, 38 + Math.random() * 30, Math.sin(a) * d, 2.2);
    }

    // relâmpago (linha em ziguezague)
    this.boltGeo = new THREE.BufferGeometry();
    this.boltGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
    this.boltMat = new THREE.LineBasicMaterial({ color: 0xffffff, fog: false });
    this.bolt = new THREE.Line(this.boltGeo, this.boltMat);
    this.bolt.frustumCulled = false; this.bolt.visible = false;
    this.group.add(this.bolt);

    this.cloudsVisible = true;
    this.rainScale = 1;                                // a qualidade gráfica reduz a chuva
    this.cur = null; this.target = WEATHERS.sol;
    this.skyColor = new THREE.Color(); this.cloudColor = new THREE.Color();
    this.flash = 0; this.boltTimer = 0; this.nextBolt = 3; this.secondFlash = -1; this.thunderIn = -1;
  }

  _respawn(i, anywhere = false) {
    this.drops[i * 3] = (Math.random() * 2 - 1) * VOL.x;
    this.drops[i * 3 + 1] = anywhere ? Math.random() * VOL.top : VOL.top + Math.random() * 6;
    this.drops[i * 3 + 2] = (Math.random() * 2 - 1) * VOL.z;
  }

  setMode(id, instant = false) {
    this.target = WEATHERS[id] || WEATHERS.sol;
    if (instant || !this.cur) {
      const t = this.target;
      this.cur = { hemi: t.hemi, sun: t.sun, skyMix: t.skyMix, fogNear: t.fogNear, fogFar: t.fogFar, rain: t.rain, wind: t.wind };
      this.cloudColor.set(t.cloud);
    }
    this.skyColor.set(this.target.sky);
    this.nextBolt = 2 + Math.random() * 3;
  }

  _bolt() {
    const pos = this.boltGeo.attributes.position.array;
    let x = (Math.random() * 2 - 1) * 75, z = (Math.random() * 2 - 1) * 55;
    for (let i = 0; i < 14; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = 70 - i * 5.4; pos[i * 3 + 2] = z;
      x += (Math.random() - 0.5) * 9; z += (Math.random() - 0.5) * 9;
    }
    this.boltGeo.attributes.position.needsUpdate = true;
    this.bolt.visible = true; this.boltTimer = 0.2;
    this.flash = 1; this.secondFlash = 0.14;
    this.thunderIn = 0.3 + Math.random() * 1.4;
  }

  update(dt, t) {
    const T = this.target, C = this.cur, k = 1 - Math.exp(-dt * 1.6);
    for (const key of ["hemi", "sun", "skyMix", "fogNear", "fogFar", "rain", "wind"]) C[key] += (T[key] - C[key]) * k;
    this.cloudColor.lerp(_c1.set(T.cloud), k);
    this.cloudMat.color.copy(this.cloudColor);

    // relâmpagos e trovões
    if (T.lightning) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this._bolt(); this.nextBolt = 4 + Math.random() * 8; }
    }
    if (this.secondFlash > 0) { this.secondFlash -= dt; if (this.secondFlash <= 0) this.flash = 0.8; }
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.boltTimer > 0) { this.boltTimer -= dt; if (this.boltTimer <= 0) this.bolt.visible = false; }
    if (this.thunderIn > 0) { this.thunderIn -= dt; if (this.thunderIn <= 0) playThunder(0.8 + Math.random() * 0.5); }

    // luz, céu e nevoeiro
    this.hemi.intensity = this.base.hemi * C.hemi + this.flash * 1.8;
    this.sun.intensity = this.base.sun * C.sun + this.flash * 0.8;
    const bg = _bg.copy(this.base.bg).lerp(this.skyColor, C.skyMix).lerp(_flashC, this.flash * 0.6);
    if (this.scene.background && this.scene.background.isColor) this.scene.background.copy(bg);
    const wTop = T.top === null || T.top === undefined ? this.skyTopBase : _c2.set(T.top);
    this.skyMat.uniforms.top.value.copy(this.skyTopBase).lerp(wTop, C.skyMix);
    this.skyMat.uniforms.bottom.value.copy(bg);
    if (this.scene.fog) { this.scene.fog.color.copy(bg); this.scene.fog.near = C.fogNear; this.scene.fog.far = C.fogFar; }

    // chuva
    const count = Math.round(C.rain * this.rainScale), wind = C.wind, d = this.drops, p = this.rainPos;
    for (let i = 0; i < count; i++) {
      d[i * 3 + 1] -= 38 * dt; d[i * 3] += wind * dt;
      if (d[i * 3 + 1] < 0 || d[i * 3] > VOL.x) this._respawn(i);
      const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2], o = i * 6;
      p[o] = x; p[o + 1] = y; p[o + 2] = z;
      p[o + 3] = x - wind * 0.035; p[o + 4] = y + 1.4; p[o + 5] = z;
    }
    this.rain.geometry.setDrawRange(0, count * 2);
    this.rain.geometry.attributes.position.needsUpdate = true;

    // nuvens à deriva (escondidas na vista aérea, senão tapam o mapa)
    for (const c of this.clouds) {
      if (c.visible !== this.cloudsVisible) c.visible = this.cloudsVisible;
      c.position.x += dt * (1.5 + wind * 0.6);
      if (c.position.x > 320) c.position.x = -320;
    }
  }

  dispose() {
    this.map.group.remove(this.group);
    this.rain.geometry.dispose(); this.rainMat.dispose();
    this.boltGeo.dispose(); this.boltMat.dispose(); this.cloudMat.dispose();
    this.sky.geometry.dispose(); this.skyMat.dispose();
    for (const g of this.cloudGeos) g.dispose();
  }
}
