import * as THREE from "three";
import { state, $, renderer, scene, camera } from "../jogo/game-state.js";

/* ============================================================
   QUALIDADE GRÁFICA (Alta, Média, Baixa, Silenciosa) e tamanho do ecrã
   Cada qualidade muda a resolução, as sombras, os fps máximos, a chuva e a frequência da tinta (menos = PC mais fresco).
   applyQuality muda tudo de uma vez e guarda a escolha; buildQualityChips desenha os botões no ecrã "Prepara a partida".
   ============================================================ */

// Qualidade gráfica: resolução, sombras, chuva e imagens por segundo (fps). Q muda; se os FPS ficarem baixos, desce sozinha.
// shadowEvery: as sombras recalculam-se de X em X frames (o sol não se mexe; só as sombras dos bonecos atrasam um pouco)
// paintMs: de quanto em quanto tempo a textura da tinta no chão é enviada para a placa gráfica (é grande: menos vezes = menos esforço)
// Silenciosa: 30 fps, sem sombras e pouca chuva — o mínimo de esforço para a placa gráfica (menos calor e ventoinha)
export const QUALITY = {
  alta:       { label: "Alta",       icon: "✨", pixelRatio: 2,    shadows: true,  shadowMap: 2048, rain: 1,    fps: 60, shadowEvery: 1, paintMs: 160 },
  media:      { label: "Média",      icon: "⚖️", pixelRatio: 1.25, shadows: true,  shadowMap: 1024, rain: 0.6,  fps: 60, shadowEvery: 3, paintMs: 220 },
  baixa:      { label: "Baixa",      icon: "🔋", pixelRatio: 1,    shadows: false, shadowMap: 512,  rain: 0.3,  fps: 60, shadowEvery: 2, paintMs: 300 },
  silenciosa: { label: "Silenciosa", icon: "🔇", pixelRatio: 1,    shadows: false, shadowMap: 512,  rain: 0.15, fps: 30, shadowEvery: 2, paintMs: 400 },
};
export const QUALITY_IDS = Object.keys(QUALITY);
export function applyQuality(id) {
  const q = QUALITY[id];
  state.quality = id;
  try { localStorage.setItem("colorattack.quality", id); } catch { /* ignora */ }   // fica guardada
  document.querySelectorAll("#qualityPick .chip").forEach((c) => c.classList.toggle("on", c.dataset.q === id));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const shadowsChanged = renderer.shadowMap.enabled !== q.shadows;
  renderer.shadowMap.enabled = q.shadows;
  const soft = id === "alta" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;    // sombras suaves só na Alta (são mais caras)
  if (renderer.shadowMap.type !== soft) { renderer.shadowMap.type = soft; renderer.shadowMap.needsUpdate = true; if (!shadowsChanged) scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  if (state.map) {
    for (const l of state.map.lights) {
      if (!l.isDirectionalLight) continue;
      l.castShadow = q.shadows;
      if (l.shadow.mapSize.x !== q.shadowMap) { l.shadow.mapSize.set(q.shadowMap, q.shadowMap); l.shadow.map?.dispose(); l.shadow.map = null; }
    }
    if (shadowsChanged) scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    if (state.weather) state.weather.rainScale = q.rain;
    if (state.paint) state.paint.uploadMs = q.paintMs;
  }
}
export function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
export const QUALITY_TIPS = { alta: "O mais bonito (pesa mais)", media: "Equilíbrio entre bonito e leve", baixa: "Sem sombras, 60 fps", silenciosa: "30 fps, sem sombras: o mínimo de esforço para o PC (menos ventoinha)" };
export function buildQualityChips() {                                                      // gráficos (fica guardado): a Silenciosa poupa a placa gráfica e a ventoinha
  const box = $("qualityPick"), tips = QUALITY_TIPS;
  for (const id of QUALITY_IDS) {
    const b = document.createElement("button");
    b.className = "chip" + (id === state.quality ? " on" : ""); b.dataset.q = id; b.title = tips[id];
    b.textContent = `${QUALITY[id].icon} ${QUALITY[id].label}`;
    b.addEventListener("click", () => applyQuality(id));
    box.appendChild(b);
  }
}
