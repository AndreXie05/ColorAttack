import { COLORS, PRIMARIES, SECONDARIES, chipHTML, resolveHit } from "./colors.js";
import { CONFIG } from "./game-config.js";

/* ============================================================
   ECRÃ DE INSTRUÇÕES
   Montado a partir de colors.js, por isso nunca fica desatualizado em relação às regras.
   ============================================================ */
const MOVE_KEYS = [
  ["W A S D", "Mover o boneco"],
  ["Rato", "Rodar a câmara (sem clicar)"],
  ["Shift", "Correr"],
  ["Espaço", "Saltar"],
  ["1 · 2 · 3", "Escolher vermelho · azul · amarelo"],
  ["Duas teclas juntas", "Misturar (ex.: 1 + 2 = roxo), demora 0,1 s"],
  ["Clique esquerdo", "Disparar tinta com a cor que tens na mão (segura para continuar)"],
];
const OTHER_KEYS = [
  ["E", "Abrir um baú"],
  ["G", "Granada de tinta: segura para apontar, roda do rato muda a cor, larga para lançar"],
  ["H", "Usar uma Cura (+40 de vida)"],
  ["F", "Usar a Invisibilidade (5 s)"],
  ["V", "Vista aérea do mapa"],
  ["C · Q", "Mudar o clima · mudar a qualidade gráfica"],
  ["Esc", "Pausa"],
  ["R", "Reiniciar o round (teste)"],
];
const keyTable = (rows) => `<table class="keys">${rows.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join("")}</table>`;

const eq = (a, b, r) => `<div class="eq">${chipHTML(a, 60)}<span>+</span>${chipHTML(b, 60)}<span>=</span>${chipHTML(r, 60)}</div>`;

function card(title, body) {
  return `<section class="howCard"><h3>${title}</h3>${body}</section>`;
}

// Uma entrada por página; cada página mostra uma ou duas "cartas"
function buildPages() {
  const prim = PRIMARIES.map((p) => `<div class="colorLine">${chipHTML(p, 64)}<b>${COLORS[p].name}</b></div>`).join("");
  const sec = SECONDARIES.map((s) => `<div class="colorLine">${chipHTML(s, 64)}<b>${COLORS[s].name}</b></div>`).join("");
  const mixes = SECONDARIES.map((s) => eq(COLORS[s].parts[0], COLORS[s].parts[1], s)).join("");
  const keyRow = PRIMARIES.map((p) => `<div class="keyChip">${chipHTML(p, 62)}<kbd>${COLORS[p].key}</kbd></div>`).join("");
  const example = resolveHit("vermelho", "amarelo");               // exemplo vindo da própria lógica do jogo

  return [
    card("🎯 Objetivo", `
      <p>Duas equipas de 5 (tu + 4 bots contra 5 bots). Cada round dura <b>3 minutos</b> e ganha a equipa com mais pontos.
      Vence o jogo quem ganhar primeiro <b>${CONFIG.match.toWin} rounds</b>. Se o tempo acabar empatado em eliminações, há <b>morte súbita</b>: a primeira equipa a fazer uma eliminação ganha o round. Nessa altura os baús são reabastecidos, mas só têm item em metade das vezes, todos os itens são igualmente prováveis e cada baú dá uma só caixa de munição, com <b>1 a 5 balas</b> da mesma cor.</p>
      <p>Os adversários têm cores. <b>Só os eliminas com a cor certa</b>, que tu misturas na arma.</p>`),

    card("🎨 As cores", `
      <p><b>Primárias</b></p><div class="colorGrid">${prim}</div>
      <p><b>Secundárias</b></p><div class="colorGrid">${sec}</div>
      <p>Cada cor tem o seu <b>símbolo</b>, que aparece nas caixas de munição e na lista, para não dependeres só da cor.</p>`),

    card("🧪 Como misturar", `
      <p>Cada tecla escolhe a cor da <b>tinta da tua arma</b> (a munição):</p><div class="keyRow">${keyRow}</div>
      <p>Mantém <b>duas teclas ao mesmo tempo</b> para misturar: durante 0,1 s o depósito da arma muda de cor e ficas com munição secundária.
      A cor do teu boneco é outra coisa: é essa que os adversários têm de acertar para te eliminar.</p>
      <div class="eqGrid">${mixes}</div>`),

    card("🛢️ Tanques de tinta", `
      <p>Tens <b>3 tanques</b>, um por primária, cada um com a sua munição (até <b>${CONFIG.ammo.max} balas</b> por tanque), que recarrega com o tempo.</p>
      <p>Um tiro secundário gasta munição <b>dos dois tanques</b> de que é feito (o roxo gasta vermelho e azul).</p>`),

    card("💥 Acertar no adversário", `
      <ul>
        <li><b>Mesma cor</b> do adversário: é eliminado de uma vez. Se acertares à primeira, ganhas bónus.</li>
        <li><b>Cor errada</b>: tira só <b>4</b> de vida e a cor dele muda pela tabela de misturas.</li>
        <li>Se ele já tiver <b>cor misturada</b>, a cor não muda (só o empurra um pouco), mas se acertares numa das cores que a formam, tira <b>8</b> em vez de 4.</li>
      </ul>
      <p>Exemplo: um adversário amarelo atingido por vermelho fica laranja.</p>
      <div class="eq">${chipHTML("vermelho", 60)}<span>acerta em</span>${chipHTML("amarelo", 60)}<span>→</span>${chipHTML(example.newColor, 60)}</div>
      <p><b>Como sei a cor deles?</b> O boneco de cada jogador fica <b>todo da cor</b> que tem agora. Os nomes por cima da cabeça são <b>azuis</b> nos teus aliados e <b>vermelhos</b> nos adversários. Quando apontas para um adversário, aparece no topo o nome, a cor dele e o que carregar para a teres na mão.</p>
      <p>Pontos: eliminação com a cor certa à primeira (bónus), eliminação normal, assistência e combos de eliminações seguidas.
      Quem é eliminado volta 5 segundos depois na sua base, com 2 segundos de proteção.</p>
      <p>No canto direito do ecrã aparece, a cada eliminação, <b>quem eliminou quem</b>, a cor usada e se foi com a <b>cor certa</b> ou não.</p>`),

    card("🟣 Poças de tinta", `
      <p>Cada eliminação deixa uma <b>poça da cor</b> do jogador eliminado. Quem passar por cima muda de cor pela tabela de misturas,
      por isso cuidado por onde andas!</p>`),

    card("🎁 Baús", `
      <p>Espalhados pelo mapa. Chega-te perto e carrega em <b>E</b>. Em 80% das vezes sai um item: munição (70%), granada de tinta (15%), cura (12%) ou, muito raramente, invisibilidade (3%). Em 20% está vazio. A <b>Invisibilidade</b> 👻 fica guardada na lista e, com <b>F</b>, ficas invisível durante 5 segundos, ideal para aparecer atrás de alguém. Cada caixa de munição dá ${CONFIG.ammoBox.shots} balas de uma cor, e um baú pode dar de 1 a 3 caixas.</p>
      <p><b>Granada de tinta:</b> segura <b>G</b> para ver o círculo onde vai cair (tem alcance limitado), usa a <b>roda do rato</b> para escolher a cor (as 3 primárias e as 3 secundárias, sem misturar nada) e larga <b>G</b> para lançar. Os adversários na área que já tenham essa cor são <b>eliminados</b>; os outros ficam dessa cor. Os teus colegas de equipa também ficam dessa cor, mas nunca são eliminados.</p>
      <p>Cada baú volta a abrir ao fim de <b>1 minuto</b> e pode ser aberto <b>3 vezes por round</b>. Passa por cima dos itens para os apanhares.</p>`),

    card("⬆️ Melhorias", `
      <p>No fim de cada round escolhes <b>1 de 3 melhorias</b> aleatórias, carregando na tecla <b>1</b>, <b>2</b> ou <b>3</b>: tanques turbo, mistura instantânea, tiro que atravessa, granadas extra, mais cadência, mais velocidade ou mais vida. Duram até ao fim do jogo e podem acumular. As melhorias incluem também dano duplo com a cor errada, granadas maiores e <b>granada de 2 cores</b> (tecla <b>X</b> troca qual das duas cores estás a escolher com a roda do rato).</p>`),

    card("🕹️ Movimento e tiro", keyTable(MOVE_KEYS)),

    card("⌨️ Outros comandos", keyTable(OTHER_KEYS) + `
      <p><b>Placar:</b> está sempre no topo do ecrã. Os rounds ganhos ficam ao lado do relógio (tua equipa à esquerda) e as eliminações do round por baixo.</p>`),
  ];
}

// Instruções página a página: Anterior / Seguinte (ou setas do teclado)
export function createInstructions({ content, prev, next, dots, onClose }) {
  const pages = buildPages();
  let i = 0;

  function render() {
    content.innerHTML = pages[i];
    dots.innerHTML = pages.map((_, k) => `<span class="dot${k === i ? " on" : ""}"></span>`).join("");
    prev.disabled = i === 0;
    next.textContent = i === pages.length - 1 ? "Concluir ✓" : "Seguinte →";
  }
  function go(d) {
    if (d > 0 && i === pages.length - 1) { onClose(); return; }
    i = Math.max(0, Math.min(pages.length - 1, i + d));
    render();
  }
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  render();
  return { go, reset() { i = 0; render(); } };
}
