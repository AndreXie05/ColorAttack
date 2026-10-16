/* ============================================================
   NÚMEROS DE DANO: quando acertas num adversário aparece o dano por cima da cabeça dele (número pequeno e vermelho, sem sinal, todos do mesmo tamanho: 4 cor errada, 8 cor que ele "leva"; ao eliminar — tiro da cor certa, canhão, granada, armadilha — a vida que lhe tiraste),
   aparece e desaparece em 1 s. Acertos seguidos no mesmo adversário SOMAM-SE (4, 8, 12…): cada acerto volta a contar
   1 s; se passar 1 s sem acertares, o número desaparece e o seguinte começa do zero. Só os teus tiros. Leve: 8 elementos reutilizados (nada é criado durante o jogo)
   e só se mexem enquanto há números no ar.
   ============================================================ */
import * as THREE from "three";

const MAX = 8, LIFE = 1.0, RISE = 0.12, HEIGHT = 2.5;                                // números ao mesmo tempo; duração (s); quanto sobem (m); altura: por cima da cabeça (os adversários não têm nome)
const _v = new THREE.Vector3();

export class DamageNumbers {
  constructor(container) {
    this.items = Array.from({ length: MAX }, () => {
      const el = document.createElement("div");
      el.className = "dmgNum";
      container.appendChild(el);
      return { el, t: 0, target: null, total: 0 };
    });
    this.next = 0; this.live = 0;
  }
  // target: o combatente atingido (o número segue-o)
  show(target, amount) {
    let it = this.items.find((x) => x.t > 0 && x.target === target);                 // ainda se vê o número deste adversário: soma
    if (it) it.total += amount;
    else {
      it = this.items[this.next]; this.next = (this.next + 1) % MAX;
      if (it.t <= 0) this.live++;
      it.target = target; it.total = amount;
    }
    it.t = LIFE;                                                                       // (volta a contar 1 s a partir deste acerto)
    it.el.textContent = String(Math.round(it.total));
  }
  update(dt, camera, w, h) {
    if (!this.live) return;
    for (const it of this.items) {
      if (it.t <= 0) continue;
      it.t -= dt;
      const p = it.target?.pos;
      if (it.t <= 0 || !p) { it.t = 0; it.el.style.opacity = "0"; this.live--; continue; }
      const k = 1 - it.t / LIFE;                                                       // 0 → 1 ao longo da vida
      _v.set(p.x, p.y + HEIGHT + k * RISE, p.z).project(camera);
      if (_v.z > 1) { it.el.style.opacity = "0"; continue; }                         // atrás da câmara
      it.el.style.transform = `translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px) translate(-50%, -50%) scale(${k < 0.15 ? 0.6 + k * 2.7 : 1})`;
      it.el.style.opacity = String(k > 0.6 ? (1 - k) / 0.4 : 1);
    }
  }
  clear() { for (const it of this.items) { it.t = 0; it.el.style.opacity = "0"; } this.live = 0; }
}
