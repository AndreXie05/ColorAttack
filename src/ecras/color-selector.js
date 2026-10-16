import { mixColors, COLOR_RULES, TERTIARY } from "../base/colors.js";

/* ============================================================
   ESCOLHA E MISTURA DE COR (lógica pura, sem DOM)
   - Uma tecla (1/2/3) escolhe logo essa primária.
   - Manter duas teclas ao mesmo tempo mistura: ao fim de `mixSeconds` fica a secundária.
   - Largar uma tecla antes do fim cancela a mistura e a cor atual mantém-se.
   - mixSeconds = 0 -> mistura instantânea (melhoria do jogo).
   - Modo Paleta Completa: três teclas ao mesmo tempo dão castanho.
   ============================================================ */
export class ColorSelector {
  constructor({ mixSeconds = 0.3, start = "vermelho" } = {}) {
    this.mixSeconds = mixSeconds;
    this.current = start;
    this.held = [];                      // primárias de teclas carregadas, por ordem
    this.mix = null;                     // { a, b, result, t } enquanto mistura
  }

  press(primary) {
    if (this.held.includes(primary)) return;
    this.held.push(primary);
    if (this.held.length === 1) { this.current = primary; this.mix = null; return; }
    if (this.held.length === 2) {
      const result = mixColors(this.held[0], this.held[1]);
      if (!result) return;
      this.mix = { a: this.held[0], b: this.held[1], result, t: 0, need: 2 };
      if (this.mixSeconds <= 0) this._finish();
    } else if (this.held.length === 3 && COLOR_RULES.triple) {
      this.mix = { a: this.held[0], b: this.held[1], result: TERTIARY, t: 0, need: 3 };
      if (this.mixSeconds <= 0) this._finish();
    }
  }

  release(primary) {
    this.held = this.held.filter((p) => p !== primary);
    if (this.mix && this.held.length < this.mix.need) this.mix = null;       // cancelou
  }

  update(dt) {
    if (!this.mix) return;
    this.mix.t += dt;
    if (this.mix.t >= this.mixSeconds) this._finish();
  }

  _finish() { this.current = this.mix.result; this.mix = null; }

  get progress() { return this.mix ? Math.min(1, this.mix.t / Math.max(this.mixSeconds, 1e-6)) : 0; }
  get mixing() { return this.mix !== null; }
  reset(start = "vermelho") { this.current = start; this.held = []; this.mix = null; }
}
