import * as Daily from "../progresso/daily-login.js";

/* ============================================================
   ECRÃ DO PRÉMIO DIÁRIO 🎁 (caixa #dailyBox do index.html)
   Calendário de 7 dias: os já recebidos têm ✔, o de hoje brilha e o 7.º (joias) é maior.
   Abre sozinho a 1.ª vez que entras no lobby num dia em que ainda não recebeste o prémio; o botão 🎁 do lobby abre-o sempre.
   onClaim(prémio) = o lobby atualiza as moedas/joias e mostra um aviso.
   ============================================================ */
export function createDailyScreen({ onClaim }) {
  const $ = (id) => document.getElementById(id);
  let autoShownFor = "";

  function render(justGot = 0) {
    const s = Daily.status();
    $("dyDays").innerHTML = Daily.REWARDS.map((r, i) => {
      const n = i + 1, got = n < s.day || (s.claimed && n === s.day), now = n === s.day && !s.claimed;
      const cls = ["dyDay", got ? "got" : "", now ? "now" : "", n === 7 ? "big" : "", n === justGot ? "stamp" : ""].join(" ");
      const ic = r.gems ? "💎" : n >= 5 ? "💰" : "🪙";
      return `<div class="${cls}"><small>Dia ${n}</small><span class="dyIc">${ic}</span><b>${r.gems ? `💎 ${r.gems}<br><i>+ 🪙 ${r.coins}</i>` : `🪙 ${r.coins}`}</b>${got ? '<em class="dyOk">✔</em>' : ""}</div>`;
    }).join("");
    $("dyNote").textContent = s.claimed ? `Já recebeste o prémio de hoje (dia ${s.day} de 7). Volta amanhã para o dia ${(s.day % 7) + 1}!`
      : s.lost ? "Falhaste um dia: a série recomeçou no dia 1. Entra todos os dias para chegares às joias do dia 7!"
      : "Entra todos os dias! O 7.º dia dá 💎 joias. Se falhares um dia, voltas ao dia 1.";
    const b = $("dyClaim");
    b.disabled = s.claimed;
    b.textContent = s.claimed ? "Volta amanhã ⏰" : `Receber ${Daily.prizeText(Daily.REWARDS[s.day - 1])}`;
    const badge = $("dailyBadge"); if (badge) badge.textContent = s.claimed ? "" : "!";
  }
  function open() { render(); $("dailyBox").style.display = "flex"; }
  function close() { $("dailyBox").style.display = "none"; }

  $("dyClaim").addEventListener("click", () => {
    const r = Daily.claim();
    if (!r) return;
    render(r.day);
    onClaim?.(r);
  });
  $("dyClose").addEventListener("click", close);
  $("dailyBox").addEventListener("click", (e) => { if (e.target.id === "dailyBox") close(); });   // clicar fora da caixa fecha

  return {
    open, close, refresh: () => render(),
    get isOpen() { return $("dailyBox").style.display === "flex"; },
    // ao entrar no lobby: abre sozinho uma vez por dia, se o prémio ainda não foi recebido
    auto() {
      const s = Daily.status(), day = new Date().toDateString();
      render();
      if (!s.claimed && autoShownFor !== day) { autoShownFor = day; open(); }
    },
  };
}
