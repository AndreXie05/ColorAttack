import { COLORS } from "../base/colors.js";

/* ============================================================
   TUTORIAL: partida guiada no Parque com 3 alvos parados (não disparam). Cada passo só avança quando fazes o que pedem.
   (N salta o passo.) O jogo (map-viewer.js) avisa dos acontecimentos com event(nome).
   ============================================================ */
const isSecondary = (id) => COLORS[id] && COLORS[id].kind === "secundaria";

export const STEPS = [
  { icon: "🕹️", text: "Anda com <b>W A S D</b> e olha à volta mexendo o rato (sem clicar). Dá uma voltinha!",
    done: (c) => c.f.dist >= 12 },
  { icon: "🏃", text: "Segura <b>Shift</b> enquanto andas para correres e carrega em <b>Espaço</b> para saltares.",
    done: (c) => c.f.ran && c.f.jumped },
  { icon: "🎨", text: "As teclas <b>1</b>, <b>2</b> e <b>3</b> escolhem a cor da tua munição: vermelho, azul e amarelo. Experimenta as três!",
    done: (c) => c.f.digits.size >= 3 },
  { icon: "🧪", text: "Para misturar, mantém <b>duas teclas ao mesmo tempo</b> (ex.: 1 e 3 dá laranja). Fica com uma cor secundária na mão.",
    done: (c) => isSecondary(c.api.state.colors.current) },
  { icon: "🎯", text: "Estes alvos são <b>amarelos</b>. Escolhe uma cor <b>diferente</b>, aponta e dispara com o clique esquerdo: vê a cor deles mudar!",
    setup: (a) => a.targets(["amarelo", "amarelo", "amarelo"]), done: (c) => c.f.ev.recolor },
  { icon: "💥", text: "Agora a cor <b>certa</b>: o alvo tem a cor do boneco todo. Escolhe a <b>mesma cor</b> na tua arma e dispara: é eliminado de uma vez e ganhas balas e um radar!",
    setup: (a) => a.targets(["azul", "vermelho", "amarelo"]), done: (c) => c.f.ev.killExact },
  { icon: "🟣", text: "O alvo deixou uma <b>poça da cor dele</b>. Pisa-a para ficares dessa cor (dura 15 s). É a única tinta no chão que muda a tua cor.",
    done: (c) => c.f.ev.puddle || c.stepT > 25 },
  { icon: "🎁", text: "Os baús escondem munição e itens. Aproxima-te de um (pontos amarelos no minimapa) e carrega em <b>E</b>.",
    done: (c) => c.f.ev.chest, hint: (a) => `baú mais perto: ${a.nearestChestDist()} m` },
  { icon: "📦", text: "Do baú saltaram caixas de munição. <b>Anda até elas</b>: ao tocares numa, apanhas as balas (não precisas de carregar em nada).",
    done: (c) => c.f.ev.collected || c.stepT > 20 },
  { icon: "💣", text: "Ganhaste 2 granadas! Segura <b>G</b> para ver onde cai, escolhe a cor com a <b>roda do rato</b> (ou com 1, 2, 3) e larga <b>G</b> para lançar. Se o adversário tiver a cor da granada, é eliminado.",
    setup: (a) => a.give("grenade", 2), done: (c) => c.f.ev.grenade },
  { icon: "💊", text: "Estás ferido! Usa a Cura com a tecla <b>T</b>.",
    setup: (a) => { a.give("health", 1); a.setHp(45); }, done: (c) => c.f.ev.cure },
  { icon: "⏸️", text: "Por fim, carrega em <b>Esc</b> para abrires a pausa: aí podes mudar a qualidade, ver as classificações e sair.",
    done: (c) => c.f.ev.paused },
];

export class Tutorial {
  constructor(api) {
    this.api = api; this.i = -1; this.finished = false; this.last = null;
    this.next();
  }
  _reset() { this.f = { dist: 0, ran: false, jumped: false, digits: new Set(), ev: {} }; this.stepT = 0; }

  next() {
    this.i++; this._reset();
    if (this.i >= STEPS.length) { this.finished = true; this.api.render({ done: true, total: STEPS.length }); this.api.celebrate(); return; }
    const s = STEPS[this.i];
    if (s.setup) s.setup(this.api);
    this.api.render({ i: this.i, total: STEPS.length, icon: s.icon, text: s.text, hint: "" });
  }
  skip() { if (!this.finished) this.next(); }

  event(name, data = {}) {
    if (this.finished) return;
    if (name === "digit") this.f.digits.add(typeof data === "string" ? data : data.n);
    else if (name === "recolor") { if (!data.isPlayer && !data.why) this.f.ev.recolor = true; else if (data.isPlayer && data.why === "puddle") this.f.ev.puddle = true; }
    else this.f.ev[name] = true;
  }

  update(dt) {
    if (this.finished) return;
    const st = this.api.state, p = st.player.pos, f = this.f;
    this.stepT += dt;
    if (this.last) { const d = Math.hypot(p.x - this.last.x, p.z - this.last.z); if (d < 5) f.dist += d; }
    this.last = { x: p.x, z: p.z };
    if (p.y > 0.4) f.jumped = true;
    const v = st.player.motion; if (v && this.api.keys.has("ShiftLeft") && Math.hypot(v.vx, v.vz) > 9) f.ran = true;
    const s = STEPS[this.i];
    if (s.hint) this.api.hint(s.hint(this.api));
    if (s.done({ f, api: this.api, stepT: this.stepT })) this.next();
  }
}
