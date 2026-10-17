/* ============================================================
   CONFIGURAÇÕES (botão ⚙️ no lobby): som por grupos, gráficos e rato.
   Tudo fica guardado no navegador e vale logo (também a meio de uma partida).
   - Som: volumes de sfx.js (geral, efeitos, relógio, clima) + silêncio com o jogo noutra janela
   - Gráficos: a qualidade do jogo (hooks.qualities / getQuality / setQuality, de map-viewer.js)
   - Rato: sensibilidade (multiplica a do jogo; 0,4× a 2,5×)
   ============================================================ */
import { Sfx } from "../som/sfx.js";

const SENS_KEY = "colorattack.sens";
let sens = (() => { try { const v = parseFloat(localStorage.getItem(SENS_KEY)); return v >= 0.4 && v <= 2.5 ? v : 1; } catch { return 1; } })();
export const mouseSens = () => sens;                                                 // usado pelo jogo ao mexer a câmara

const SOUND_ROWS = [
  ["geral", "🔊", "Geral", "Todos os sons do jogo"],
  ["efeitos", "💥", "Tiros e efeitos", "Tiros, eliminações, granadas, baús, canhões, pontes…"],
  ["relogio", "⏱️", "Relógio", "Contagem 3-2-1 e tique-taque dos últimos 10 s"],
  ["clima", "🌧️", "Clima", "Chuva, vento e trovões"],
];

// hooks: { qualities: [{ id, label, icon, tip }], getQuality(), setQuality(id), toggleFullscreen() }
export function createSettings(hooks) {
  const box = document.createElement("div");
  box.id = "setBox";
  box.innerHTML = `<div class="cfgCard">
    <div class="cfgHead"><h3>⚙️ Configurações</h3><button class="fbX" title="Fechar">&#10005;</button></div>
    <div class="cfgBody"></div></div>`;
  document.body.appendChild(box);
  const body = box.querySelector(".cfgBody");
  const close = () => box.classList.remove("open");
  box.querySelector(".fbX").addEventListener("click", close);
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && box.classList.contains("open")) { e.stopImmediatePropagation(); close(); } }, true);

  const pct = (v) => (v > 0 ? Math.round(v * 100) + "%" : "mudo");
  function render() {
    const o = Sfx.options, q = hooks.getQuality();
    body.innerHTML = `
      <section><h4>Som</h4>
        ${SOUND_ROWS.map(([k, ic, name, tip]) => `<label class="cfgRow" title="${tip}"><span class="cfgName">${ic} ${name}<small>${tip}</small></span>
          <input type="range" min="0" max="100" step="5" value="${Math.round(o[k] * 100)}" data-vol="${k}"><b class="cfgVal">${pct(o[k])}</b></label>`).join("")}
        <label class="cfgCheck"><input type="checkbox" data-bg ${o.bgMute ? "checked" : ""}> Sem som quando o jogo está minimizado ou noutra janela</label>
      </section>
      <section><h4>Gráficos</h4>
        <div class="cfgChips">${hooks.qualities.map((x) => `<button class="cfgChip${x.id === q ? " on" : ""}" data-q="${x.id}" title="${x.tip}">${x.icon} ${x.label}</button>`).join("")}</div>
        <small class="cfgTip">${hooks.qualities.find((x) => x.id === q)?.tip || ""}</small>
      </section>
      ${hooks.lobbyThemes ? `<section><h4>Fundo do lobby</h4>
        <div class="cfgChips">${hooks.lobbyThemes.map((x) => `<button class="cfgChip${x.id === hooks.getLobbyTheme() ? " on" : ""}" data-lt="${x.id}">${x.icon} ${x.name}</button>`).join("")}</div>
      </section>` : ""}
      <section><h4>Rato</h4>
        <label class="cfgRow"><span class="cfgName">🖱️ Sensibilidade<small>Quanto a câmara roda ao mexer o rato</small></span>
          <input type="range" min="40" max="250" step="10" value="${Math.round(sens * 100)}" data-sens><b class="cfgVal">${sens.toFixed(1).replace(".", ",")}×</b></label>
      </section>
      <button class="cfgFs fbBig">⛶ Ecrã inteiro</button>`;
  }
  let testT = 0;
  body.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.vol) {
      const k = t.dataset.vol, v = t.value / 100;
      Sfx.set(k, v); t.nextElementSibling.textContent = pct(v);
      clearTimeout(testT); testT = setTimeout(() => Sfx.test(k === "geral" ? "efeitos" : k), 150);   // ouve-se como fica
    } else if ("sens" in t.dataset) {
      sens = t.value / 100; t.nextElementSibling.textContent = sens.toFixed(1).replace(".", ",") + "×";
      try { localStorage.setItem(SENS_KEY, String(sens)); } catch { /* ignora */ }
    }
  });
  body.addEventListener("change", (e) => { if ("bg" in e.target.dataset) Sfx.set("bgMute", e.target.checked); });
  body.addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]");
    const lt = e.target.closest("[data-lt]");
    if (q) { hooks.setQuality(q.dataset.q); render(); }
    else if (lt) { hooks.setLobbyTheme(lt.dataset.lt); render(); }
    else if (e.target.closest(".cfgFs")) hooks.toggleFullscreen();
  });
  return {
    open() { render(); box.classList.add("open"); },
    close,
    get isOpen() { return box.classList.contains("open"); },
  };
}
