import * as Progress from "../progresso/progress.js";
import { Sfx } from "../som/sfx.js";

/* ============================================================
   FAIXA "NÍVEL X!" NO LOBBY: quando voltas ao lobby depois de subires de nível (numa partida, com conquistas...),
   aparece uma faixa com o nível novo e o prémio (💎 e 🪙 por cada nível), com um som. Só no lobby, nunca a meio do jogo.
   Guarda o último nível já mostrado em localStorage "colorattack.levelSeen" (na 1.ª vez fica o nível atual, sem faixa).
   ============================================================ */
const KEY = "colorattack.levelSeen";
const read = () => { try { const v = parseInt(localStorage.getItem(KEY), 10); return Number.isFinite(v) ? v : null; } catch { return null; } };
const write = (n) => { try { localStorage.setItem(KEY, String(n)); } catch { /* ignora */ } };
let timer = 0;

/** Chamado ao entrar no lobby. Devolve true se mostrou a faixa. */
export function checkLevelUp() {
  const now = Progress.levelInfo().level, seen = read();
  if (seen === null || now < seen) { write(now); return false; }                  // 1.ª vez (ou progresso apagado): nada a mostrar
  if (now === seen) return false;
  const ups = now - seen;
  write(now);
  const el = document.getElementById("lvBanner");
  el.innerHTML = `<div class="lvbStripe"><span class="lvStar big"><b>${now}</b></span><div><b class="lvbTitle">NÍVEL ${now}!</b>
    <span class="lvbSub">${ups > 1 ? `Subiste ${ups} níveis · ` : "Subiste de nível · "}💎 +${ups * Progress.GEMS_PER_LEVEL} · 🪙 +${ups * Progress.COINS_PER_LEVEL}</span></div></div>`;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  Sfx.play("win");
  clearTimeout(timer); timer = setTimeout(() => el.classList.remove("show"), 3600);
  return true;
}
