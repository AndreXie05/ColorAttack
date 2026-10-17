import * as THREE from "three";
import { CONFIG } from "../base/game-config.js";
import { createMotionState } from "../movimento/player-motion.js";
import { COLORS } from "../base/colors.js";

/* ============================================================
   ESTADO PARTILHADO DO JOGO
   O que várias partes do jogo (map-viewer.js, hud.js, minimap.js, round-summary.js, net-match.js, ...) usam ao mesmo tempo:
   o estado da partida (state), as teclas carregadas, o desenhador (renderer), a cena e a câmara, e pequenas ajudas
   (cores em texto, nomes dos jogadores). Não tem lógica de jogo: só guarda.
   ============================================================ */
export const state = {
  screen: "title", map: null, def: null,
  player: { pos: new THREE.Vector3(), motion: createMotionState(), facing: 0 },
  cam: { yaw: 0, pitch: 0.35, dist: 9, aerial: false, prev: null, focus: new THREE.Vector3(), curDist: 9, fov: 60, ready: false },
  quality: (() => { try { const q = localStorage.getItem("colorattack.quality"); return ["alta", "media", "baixa", "silenciosa"].includes(q) ? q : "media"; } catch { return "media"; } })(), fpsAcc: 0, fpsFrames: 0, fpsTime: 0, lowFpsTime: 0, grace: 0,
  roundTime: CONFIG.roundSeconds, opened: 0, empty: 0, lastUiTimer: "",
  invisible: 0, round: null, upg: {}, botUpg: {}, feedQueue: [], tutorial: null, tutorialMode: false, startTutorial: false, upgradeChoices: null, intermission: 0, over: false, bots: [], world: null, me: null, ammo: { vermelho: 0, azul: 0, amarelo: 0 }, playerColor: "vermelho", dead: false, deathInfo: null, firing: false, fireCd: 0, noAmmoMsg: 0, aimingGrenade: false, grenadeColor: "vermelho", grenadeColor2: null, grenadeSlot: 0, intenseT: 5, radarT: 0, ads: false, healingT: 0, tracked: [], aimRing: null, gameTime: 0, targetT: 0, targetKey: "", hpShown: -1, hurtT: 0, starting: false, shownCrossColor: "", characterId: "iniciante", rosters: null, pickups: null, pips: { A: [], B: [] }, loot: {}, paused: false, weather: null, paint: null, colors: null, shownColor: "", weatherId: "sol", weatherChoice: "random",
  countdown: 0, goT: 0, online: false, net: null, myIndex: 0, netFlip: false, netPlayers: [], netWait: false, mixHintT: 0, mixHintKey: "", gameStats: {}, goldenDone: false, mode: "normal", secret: false, clues: {}, cannon: null,
};
export const keys = new Set();

// ---------- desenho: o canvas do jogo, a cena e a câmara ----------
export const $ = (id) => document.getElementById(id);
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = "gameCanvas";
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);

// ---------- ajudas ----------
export const hex6 = (c) => "#" + c.toString(16).padStart(6, "0");
export const lighten = (c, t) => { const m = (v) => Math.round(v + (255 - v) * t); return hex6((m((c >> 16) & 255) << 16) | (m((c >> 8) & 255) << 8) | m(c & 255)); };
// Nome de cada jogador: nomes de pessoas sorteados em cada partida (o 1.º da equipa A és tu: "Tu")
export function personName(team, i) { return state.rosters?.names?.[team]?.[i] || "?"; }
export const hexOf = (id) => COLORS[id].hex;
export const nameOf = (c) => personName(c.team, c.index);
