import * as Wheel from "../progresso/lucky-wheel.js";
import { Sfx } from "../som/sfx.js";

/* ============================================================
   ECRÃ DA RODA DA SORTE 🎡 (caixa #wheelBox do index.html; botão 🎡 no lobby)
   A roda é desenhada uma vez num canvas (8 fatias com o prémio). Ao rodar, o prémio é escolhido logo (lucky-wheel.js) e a roda
   gira ~4 s (CSS) até essa fatia ficar debaixo do ponteiro; só então aparece o prémio.
   onPrize(resultado) = o lobby atualiza as moedas/nível e mostra um aviso.
   ============================================================ */
export function createWheelScreen({ onPrize }) {
  const $ = (id) => document.getElementById(id);
  const N = Wheel.SLICES.length, STEP = 360 / N;
  let angle = 0, spinning = false;

  // desenho da roda (uma vez)
  const cv = $("whCanvas"), g = cv.getContext("2d"), R = cv.width / 2;
  Wheel.SLICES.forEach((s, i) => {
    const a0 = (i * STEP - 90) * Math.PI / 180, a1 = ((i + 1) * STEP - 90) * Math.PI / 180;
    g.beginPath(); g.moveTo(R, R); g.arc(R, R, R - 6, a0, a1); g.closePath();
    g.fillStyle = s.color; g.fill(); g.lineWidth = 4; g.strokeStyle = "#1a1033"; g.stroke();
    g.save(); g.translate(R, R); g.rotate((a0 + a1) / 2);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "34px sans-serif"; g.fillText(s.icon, R * 0.66, 0);
    g.font = "20px 'Titan One', sans-serif"; g.lineWidth = 5; g.strokeStyle = "#1a1033"; g.strokeText(s.label, R * 0.4, 0); g.fillStyle = "#fff"; g.fillText(s.label, R * 0.4, 0);
    g.restore();
  });
  g.beginPath(); g.arc(R, R, R - 4, 0, Math.PI * 2); g.lineWidth = 8; g.strokeStyle = "#fff"; g.stroke();
  g.beginPath(); g.arc(R, R, 30, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 5; g.strokeStyle = "#1a1033"; g.stroke();

  function render() {
    const can = Wheel.canSpin();
    const b = $("whSpin");
    b.disabled = !can || spinning;
    // enquanto gira, o botão diz só "A rodar…"; o "Volta daqui a…" só aparece depois de saíres com o prémio
    b.textContent = spinning ? "A rodar… 🎡" : can ? "Rodar! 🎡" : `Volta daqui a ${Wheel.untilNext()} ⏰`;
    if (!spinning && can) $("whResult").textContent = "Uma volta por dia: pode sair 🪙 moedas, ⭐ XP, 💎 uma joia ou 🎁 um item da loja!";
    const badge = $("wheelBadge"); if (badge) badge.textContent = can || spinning ? "!" : "";
  }
  function open() {
    if (!spinning && !Wheel.canSpin()) $("whResult").textContent = "Já rodaste a roda hoje! Volta amanhã para outra volta. 🌙";
    render(); $("wheelBox").style.display = "flex";
  }
  function close() { if (!spinning) $("wheelBox").style.display = "none"; }

  $("whSpin").addEventListener("click", () => {
    if (spinning) return;
    const res = Wheel.spin();
    if (!res) return render();
    spinning = true; render();
    $("whResult").textContent = "A rodar…";
    const target = res.index * STEP + STEP / 2, jitter = (Math.random() - 0.5) * STEP * 0.6;     // a fatia fica debaixo do ponteiro (em cima)
    angle += 360 * 5 + ((360 - target - jitter - (angle % 360)) % 360 + 360) % 360;
    cv.style.transform = `rotate(${angle}deg)`;
    Sfx.play("whoosh");
    setTimeout(() => {
      spinning = false;
      $("whResult").innerHTML = `Ganhaste <b>${res.text}</b>! Volta amanhã para outra volta. 🌙`;
      Sfx.play("golden");
      render(); onPrize?.(res);
    }, 4300);
  });
  $("whClose").addEventListener("click", close);
  $("wheelBox").addEventListener("click", (e) => { if (e.target.id === "wheelBox") close(); });

  return { open, close, refresh: render, get isOpen() { return $("wheelBox").style.display === "flex"; } };
}
