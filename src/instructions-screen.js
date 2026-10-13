import { COLORS, PRIMARIES, SECONDARIES, chipHTML, resolveHit } from "./colors.js";
import { WEATHERS, WEATHER_IDS } from "./weather.js";
import { CONFIG } from "./game-config.js";
import { UPGRADES } from "./upgrades.js";

/* ============================================================
   ECRÃ DE INSTRUÇÕES
   Montado a partir de colors.js, por isso nunca fica desatualizado em relação às regras.
   ============================================================ */
const MOVE_KEYS = [
  ["W A S D", "Mover o boneco"],
  ["Rato", "Rodar a câmara (sem clicar)"],
  ["Shift", "Correr"],
  ["Espaço", "Saltar"],
  ["Caps Lock", "Agachar: carrega uma vez para agachar e outra para te levantares"],
  ["1 · 2 · 3", "Escolher vermelho · azul · amarelo"],
  ["Duas teclas juntas", "Misturar (ex.: 1 + 2 = roxo), demora 0,1 s"],
  ["Clique esquerdo", "Disparar tinta com a cor que tens na mão (segura para continuar)"],
  ["Clique direito", "Mirar: segura para passares à vista em 1.ª pessoa, a partir da mira"],
];
const OTHER_KEYS = [
  ["E", "Abrir um baú"],
  ["G", "Granada de tinta: segura para apontar, roda do rato (ou 1, 2, 3) muda a cor, larga para lançar"],
  ["T", "Usar uma Cura (+40 de vida)"],
  ["F", "Usar a Invisibilidade (5 s)"],
  ["C", "Pousar uma Armadilha de tinta com a cor da mão"],
  ["V", "Vista aérea do mapa"],
  ["B · Q", "Mudar o clima · mudar a qualidade gráfica"],
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
      <p>Duas equipas de 5 (tu + 4 bots contra 5 bots). Cada round dura <b>${Math.round(CONFIG.roundSeconds / 60)} minutos</b> e ganha a equipa com mais pontos.
      Vence o jogo quem ganhar primeiro <b>${CONFIG.match.toWin} rounds</b>. Se o tempo acabar empatado em eliminações, há <b>morte súbita</b>: a primeira equipa a fazer uma eliminação ganha o round. Nessa altura os baús são reabastecidos, mas só têm item em metade das vezes, todos os itens são igualmente prováveis e cada baú dá uma só caixa de munição, com <b>1 a 5 balas</b> da mesma cor.</p>
      <p>Antes de jogar escolhes a <b>dificuldade dos adversários</b>: Fácil, Médio, Difícil ou Impossível. Os bots também apanham e usam itens, e os bots da equipa que ganha cada round ganham melhorias. Quem és novo? Faz o <b>Tutorial</b> no ecrã inicial.</p>
      <p>Quando uma equipa chega a <b>${CONFIG.match.intenseAt} rounds ganhos</b> entra o <b>modo intenso</b>: as cores de toda a gente mudam de 5 em 5 segundos até haver um vencedor. A cada round o mapa muda.</p>
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
        <li><b>Mesma cor</b>: é eliminado de uma vez, e ganhas <b>balas de volta</b> e um <b>radar</b> de 5 s (os adversários aparecem no minimapa).</li>
        <li><b>Cor errada</b>: tira <b>4</b> de vida e a cor dele muda pela tabela de misturas.</li>
        <li>Cor <b>misturada</b>: não muda, mas se acertares numa das cores que a formam, tira <b>8</b>.</li>
      </ul>
      <div class="eq">${chipHTML("vermelho", 56)}<span>acerta em</span>${chipHTML("amarelo", 56)}<span>→</span>${chipHTML(example.newColor, 56)}</div>
      <p><b>Como sei a cor deles?</b> O boneco fica <b>todo da cor</b> que tem. Nomes <b>azuis</b> = aliados, <b>vermelhos</b> = adversários.</p>
      <p>Quem é eliminado volta 5 s depois, num dos 5 lugares da base, com 2 s de proteção. Durante a proteção fica <b>branco</b>: ninguém sabe a cor dele até a proteção acabar. No canto direito vês quem eliminou quem.</p>
      <p><b>Série:</b> ${CONFIG.streak.kills} eliminações seguidas sem morrer dão um radar de ${CONFIG.streak.radarSeconds} s e +${CONFIG.streak.grenades} granada.</p>`),

    card("🟣 Poças de tinta", `
      <p>Cada eliminação deixa uma <b>poça da cor</b> do jogador eliminado, que dura ${CONFIG.paint.lifeSeconds} segundos.
      Quem passar por cima dela <b>fica dessa cor</b>, por isso cuidado por onde andas, ou usa-as para mudares a tua cor!</p>
      <p>As poças também mudam a <b>velocidade</b> durante uns segundos: cores quentes (vermelho, laranja, amarelo) deixam-te <b>mais rápido</b> ⚡ e cores frias (azul, roxo, verde) <b>mais lento</b> 🐌.</p>
      <p>Só estas poças e as das <b>armadilhas</b> mudam a cor de quem as pisa. A tinta dos tiros e das granadas que pinta o chão é só decoração e <b>não faz nada</b> a quem passa por cima.</p>`),

    card("🎁 Baús", `
      <p>Espalhados pelo mapa. Chega-te perto e carrega em <b>E</b>. Em 80% das vezes sai um item: munição (64%), granada de tinta (14%), cura (12%), armadilha de tinta (7%) ou, muito raramente, invisibilidade (3%). Em 20% está vazio. A <b>Invisibilidade</b> 👻 fica guardada na lista e, com <b>F</b>, ficas invisível durante 5 segundos, ideal para aparecer atrás de alguém. Cada caixa de munição dá ${CONFIG.ammoBox.shots} balas de uma cor, e um baú pode dar de 1 a 3 caixas.</p>
      <p><b>Granada de tinta:</b> segura <b>G</b> para ver o círculo onde vai cair (tem alcance limitado), escolhe a cor com a <b>roda do rato</b> (as 3 primárias e as 3 secundárias) ou com as teclas <b>1, 2, 3</b> (juntando duas, misturas) e larga <b>G</b> para lançar. Os adversários na área que já tenham essa cor são <b>eliminados</b>; os outros ficam dessa cor. Os teus colegas de equipa também ficam dessa cor, mas nunca são eliminados.</p>
      <p><b>Armadilha de tinta</b> 🪤: carrega em <b>C</b> para a pousar no chão com a cor que tens na mão. Fica ativa ao fim de ${CONFIG.trap.arm} s. Quando um adversário passa a menos de ${CONFIG.trap.trigger} m, ela aparece a piscar e explode ${String(CONFIG.trap.fuse).replace(".", ",")} s depois (área de ${String(CONFIG.trap.radius).replace(".", ",")} m), por isso quem reagir logo ainda foge: se ele já tiver essa cor é eliminado, senão fica dessa cor. Deixa uma <b>poça</b> da sua cor que, tal como a dos eliminados, muda a cor (e a velocidade) de quem a pisa, incluindo tu e os teus colegas. As armadilhas dos adversários são <b>invisíveis</b>: só dás por elas quando explodem!</p>
      <p><b>Baú dourado</b> 🌟: a meio de cada round um baú fica dourado, com um feixe de luz e uma estrela no minimapa. Quem o abrir ganha <b>${CONFIG.golden.grenades} granadas</b> ou <b>${CONFIG.golden.invisibleSeconds} s de invisibilidade</b>. Os bots também correm para lá!</p>
      <p>Cada baú volta a abrir ao fim de <b>1 minuto</b> e pode ser aberto <b>3 vezes por round</b>. Passa por cima dos itens para os apanhares.</p>`),

    card("🎮 Modos de jogo", `
      <p>Escolhes o modo no ecrã dos mapas, ao lado do clima.</p>
      <ul>
        <li><b>🎨 Normal</b>: as regras de sempre.</li>
        <li><b>🕵️ Cores Secretas</b>: os adversários ficam <b>cinzentos</b> e não sabes a cor deles. Cada tiro dá uma pista no painel do alvo (aparece quando apontas):
          <b>−8</b> = a cor dele <b>leva</b> essa tinta (é uma mistura com ela); <b>−4</b> = <b>não leva</b>; <b>"e mudou de cor!"</b> = era primário e o teu tiro transformou-o numa mistura.
          As poças dos eliminados mostram a cor verdadeira. Os bots também têm mais dificuldade em acertar a cor.<br>
          <i>Exemplo (ele é verde em segredo):</i> vermelho → −4, não leva vermelho · azul → −8, leva azul · amarelo → −8, leva amarelo · azul + amarelo = <b>verde</b> → dispara verde e está eliminado!<br>
          <i>Exemplo (ele é vermelho em segredo):</i> azul → −4 e mudou de cor (agora é roxo ou verde) · vermelho → −8, leva vermelho, por isso é <b>roxo</b> → dispara roxo!</li>
        <li><b>🟤 Paleta Completa</b>: há uma 7.ª cor, o <b>castanho</b>, feita com as 3 primárias (<b>1 + 2 + 3</b> ao mesmo tempo, gasta uma bala de cada tanque). Se um tiro juntar as 3 primárias (ex.: verde num vermelho, ou vermelho num verde), o alvo fica castanho. Um castanho só se elimina com castanho.</li>
      </ul>
      <div class="eq">${chipHTML("vermelho", 52)}<span>+</span>${chipHTML("azul", 52)}<span>+</span>${chipHTML("amarelo", 52)}<span>=</span>${chipHTML("castanho", 52)}</div>`),

    card("🗺️ Surpresas dos mapas", `
      <ul>
        <li><b>⛲ Fonte de tinta</b> (Parque e Fábrica de Tintas): de 20 em 20 s a fonte do centro avisa com um <b>anel a piscar</b> no chão, da cor que vai lançar. Depois atira tinta: quem estiver na praça <b>fica dessa cor</b> (colegas e adversários). Foge, ou aproveita para mudar de cor!</li>
        <li><b>🌉 Pontes com interruptor</b> (Castelo): junto ao rio há <b>placas coloridas</b>. Acerta numa com a <b>mesma cor</b> e uma ponte <b>sobe do fundo do rio</b> durante 25 s. É um <b>atalho pelos lados</b>, junto às muralhas, para apanhar os adversários por um flanco. Quando a placa começa a <b>piscar</b> e a ponte a <b>tremer</b>, faltam 4 s: depois a ponte <b>afunda-se</b> e <b>quem ainda estiver em cima vai ao fundo com ela e é eliminado</b>! Depois a placa muda de cor.</li>
      </ul>`),

    card("🌦️ O clima conta", `
      <p>O clima não é só para ver: muda o jogo.</p>
      <ul>${WEATHER_IDS.map((id) => `<li><b>${WEATHERS[id].icon} ${WEATHERS[id].name}</b>: ${WEATHERS[id].play.desc || "tudo normal"}.</li>`).join("")}</ul>
      <p>Cada round começa com uma contagem <b>3, 2, 1, PINTA!</b>, e no fim do jogo há <b>destaques</b> para os melhores de cada coisa.</p>`),

    card("⬆️ Melhorias", `
      <p><b>Só a equipa que ganha o round recebe uma melhoria.</b> Se ganhares, aparecem <b>3 à sorte</b> e escolhes uma com o clique ou carregando em <b>1</b>, <b>2</b> ou <b>3</b>; os bots da tua equipa também recebem uma. Se perderes, quem recebe são os bots adversários. Quanto mais ganhas, mais fortes ficas!
      Duram até ao fim do jogo e podem acumular (as marcadas com ★ só se escolhem uma vez).</p>
      <div class="upList">${UPGRADES.map((u) => `<div><b>${u.icon} ${u.name}${u.once ? " ★" : ""}</b><small>${u.desc}</small></div>`).join("")}</div>`),

    card("🧗 Subir, agachar e cair", `
      <ul>
        <li><b>Agachar</b>: carrega no <kbd>Caps Lock</kbd> uma vez para te agachares e outra vez para te levantares (saltar também te levanta). Parado, pões um <b>joelho no chão</b>; a andar, vais de joelhos dobrados e mais devagar. Ficas mais baixo e mais difícil de acertar, e atrás de um <b>murete</b> só fica de fora a cabeça.</li>
        <li><b>Degraus</b> baixos sobem-se a andar; o que for mais baixo do que o boneco (até ~2 m) sobe-se a <b>saltar</b>. Muros altos não.</li>
        <li><b>Rampas e escadas</b> levam aos sítios altos: lá de cima vês e disparas por cima das coberturas, e há <b>esconderijos</b> com fresta.</li>
        <li><b>Escadas de mão</b>: anda contra a escada para subir; se a largares no ar, escorregas devagar.</li>
        <li><b>Tapetes rolantes</b> empurram-te, os <b>carrosséis</b> rodam contigo e os <b>trampolins</b> atiram-te ao ar.</li>
        <li>⚠️ Cair de <b>${CONFIG.fallDeath} m ou mais</b> elimina logo (o ponto vai para a outra equipa). Os saltos de trampolim não contam.</li>
      </ul>`),

    card("🕹️ Movimento e tiro", keyTable(MOVE_KEYS)),

    card("⌨️ Outros comandos", keyTable(OTHER_KEYS) + `
      <p><b>Placar:</b> está sempre no topo do ecrã. Os rounds ganhos ficam ao lado do relógio (tua equipa à esquerda) e as eliminações do round por baixo.</p>`),
  ];
}

// Instruções página a página: Anterior / Seguinte (ou setas do teclado)
export function createInstructions({ content, prev, next, dots, onClose }) {
  let pages = buildPages();
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
  return { go, reset() { pages = buildPages(); i = 0; render(); } };
}
