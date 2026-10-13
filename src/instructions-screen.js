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
  ["E", "Abrir um baú · subir para o canhão de tinta (e sair dele)"],
  ["G", "Granada de tinta: segura para apontar, roda do rato (ou 1, 2, 3) muda a cor, larga para lançar"],
  ["T", "Usar uma Cura (+40 de vida)"],
  ["F", "Usar a Invisibilidade (5 s)"],
  ["C", "Pousar uma Armadilha de tinta com a cor da arma (só nos modos Cores Secretas e Paleta Completa)"],
  ["V", "Vista aérea do mapa"],
  ["B · Q", "Mudar o clima · mudar a qualidade gráfica"],
  ["Esc", "Pausa"],
  ["R", "Reiniciar o round (teste)"],
];
const keyTable = (rows) => `<table class="keys">${rows.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join("")}</table>`;

const eq = (a, b, r, n = 60) => `<div class="eq">${chipHTML(a, n)}<span>+</span>${chipHTML(b, n)}<span>=</span>${chipHTML(r, n)}</div>`;
// tabela de teclas partida em duas, lado a lado (para listas compridas)
const keyTable2 = (rows) => { const h = Math.ceil(rows.length / 2); return `<div class="keys2">${keyTable(rows.slice(0, h))}${keyTable(rows.slice(h))}</div>`; };

// quadrado pequeno (itens, surpresas dos mapas): ícone, tecla, nome e uma frase, lado a lado com outros
const tile = (icon, key, name, text) => `<div class="tile"><b class="tt">${icon} ${name}${key ? ` <kbd>${key}</kbd>` : ""}</b>${text}</div>`;

function card(title, body) {
  return `<section class="howCard"><h3>${title}</h3>${body}</section>`;
}

// Uma entrada por página; cada página mostra uma ou duas "cartas"
function buildPages() {
  const prim = PRIMARIES.map((p) => `<div class="colorLine">${chipHTML(p, 64)}<b>${COLORS[p].name}</b></div>`).join("");
  const sec = SECONDARIES.map((s) => `<div class="colorLine">${chipHTML(s, 64)}<b>${COLORS[s].name}</b></div>`).join("");
  const mixes = SECONDARIES.map((s) => eq(COLORS[s].parts[0], COLORS[s].parts[1], s, 44)).join("");
  const keyRow = PRIMARIES.map((p) => `<div class="keyChip">${chipHTML(p, 62)}<kbd>${COLORS[p].key}</kbd></div>`).join("");
  const example = resolveHit("vermelho", "amarelo");               // exemplo vindo da própria lógica do jogo

  return [
    card("🎯 Objetivo", `
      <p>Duas equipas de 5 (tu + 4 bots contra 5 bots). Cada round dura <b>${Math.round(CONFIG.roundSeconds / 60)} minutos</b> e ganha a equipa com mais pontos.
      Vence o jogo quem ganhar primeiro <b>${CONFIG.match.toWin} rounds</b>. Se o tempo acabar empatado em eliminações, há <b>morte súbita</b>: a primeira equipa a fazer uma eliminação ganha o round. Nessa altura os baús são reabastecidos, mas só têm item em metade das vezes, todos os itens são igualmente prováveis e cada baú dá uma só caixa de munição, com <b>1 a 5 balas</b> da mesma cor.</p>
      <p>Antes de jogar escolhes a <b>dificuldade dos bots</b>: Fácil, Médio, Difícil ou Impossível. Vale para os <b>9 bots</b>, os teus colegas e os adversários, que ficam sempre do mesmo nível. Os bots também apanham e usam itens, e os bots da equipa que ganha cada round ganham melhorias. És novo? Faz o <b>Tutorial</b> no ecrã inicial.</p>
      <p>Quando uma equipa chega a <b>${CONFIG.match.intenseAt} rounds ganhos</b> entra o <b>modo intenso</b>: as cores de toda a gente mudam de 5 em 5 segundos até haver um vencedor. A cada round o mapa muda.</p>
      <p>Os adversários têm cores. <b>Só os eliminas com a cor certa</b>, que tu misturas na arma.</p>
      <p><b>⭐ Níveis:</b> no fim de cada partida ganhas XP (eliminações, cor certa, rounds ganhos e vitória; mais XP nas dificuldades altas) e vais subindo de nível. O teu nível aparece no ecrã inicial.</p>`),

    card("🎨 As cores", `
      <p><b>Primárias</b></p><div class="colorGrid">${prim}</div>
      <p><b>Secundárias</b></p><div class="colorGrid">${sec}</div>
      <p>Cada cor tem o seu <b>símbolo</b>, que aparece nas caixas de munição e na lista, para não dependeres só da cor.</p>`),

    card("🧪 Como misturar", `
      <p>Cada tecla escolhe a cor da <b>tinta da tua arma</b> (a munição):</p><div class="keyRow">${keyRow}</div>
      <p>Mantém <b>duas teclas ao mesmo tempo</b> para misturar: durante 0,1 s o depósito da arma muda de cor e ficas com munição secundária.
      A cor do teu boneco é outra coisa: é essa que os adversários têm de acertar para te eliminar.</p>
      <div class="eqGrid three">${mixes}</div>`),

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
      <p>Só estas poças e as das <b>armadilhas</b> mudam a cor de quem as pisa, e reconheces-as pelo <b>anel branco a pulsar</b> à volta. A tinta dos tiros e das granadas que pinta o chão é só decoração e <b>não faz nada</b> a quem passa por cima.</p>`),

    card("🎁 Baús", `
      <p>Espalhados pelo mapa. Chega-te perto e carrega em <b>E</b>. Em 80% das vezes sai um item; em 20% está vazio. Passa por cima dos itens para os apanhares: ficam guardados na lista, em baixo, cada um com a sua tecla.</p>
      <p>Munição · granada de tinta · cura · invisibilidade (rara). Nos modos <b>Cores Secretas</b> e <b>Paleta Completa</b> também podem sair <b>armadilhas</b>.</p>
      <p>Cada caixa de munição dá ${CONFIG.ammoBox.shots} balas de uma cor, e um baú pode dar de 1 a 3 caixas. Cada baú volta a abrir ao fim de <b>${CONFIG.chest.reopenSeconds} segundos</b> e pode ser aberto <b>3 vezes por round</b>.</p>
      <p><b>Baú dourado</b> 🌟: a meio de cada round um baú fica dourado, com um feixe de luz e uma estrela no minimapa. Quem o abrir ganha <b>${CONFIG.golden.grenades} granadas</b> ou <b>${CONFIG.golden.invisibleSeconds} s de invisibilidade</b>. Os bots também correm para lá!</p>`),

    card("🧰 Os itens", `<div class="tiles">
      ${tile("💣", "G", "Granada de tinta", `Segura <b>G</b> para apontar, a roda do rato muda a cor, larga para lançar. Quem já tiver essa cor é <b>eliminado</b>; os outros ficam dessa cor.`)}
      ${tile("💊", "T", "Cura", `+${CONFIG.health.cure} de vida (demora 1 s).`)}
      ${tile("👻", "F", "Invisibilidade", `5 s invisível: ideal para aparecer atrás de alguém. Disparar revela-te.`)}
      ${tile("🪤", "C", "Armadilha de tinta", `<i>Só em Cores Secretas e Paleta Completa.</i> Fica no chão com a cor da tua arma e é <b>invisível</b> para os adversários. Quem passar perto fá-la explodir meio segundo depois.`)}
    </div>`),

    card("🎮 Modos para jogar", `
      <p>Escolhes o modo na página <b>Prepara a partida</b>, depois de escolheres o mapa. Todos funcionam em qualquer mapa.</p>
      <div class="tiles">
      <div class="tile wide"><b class="tt">🎨 Normal</b>As regras de sempre: baús com granadas, curas e invisibilidade.</div>
      ${tile("🥫", "", "Rouba-Latas", `Cada equipa tem uma <b>lata de tinta</b> na sua base. Vai à base adversária, passa por cima da lata deles para a apanhares e leva-a até à <b>lata da tua equipa</b>: cada entrega vale <b>+2 pontos</b>.<br>
        Enquanto a levas andas mais devagar e todos te veem no minimapa. Se fores eliminado, a lata cai: um colega pode apanhá-la de novo, mas se um adversário lhe tocar ela volta para a base deles.`)}
      ${tile("🖌️", "", "Pinta e Conquista", `Há <b>zonas</b> marcadas no chão. Toda a tinta que disparas, de qualquer cor, conta para a tua equipa. Conta só a tinta <b>que se vê</b>: se pintares por cima da dos adversários, a percentagem deles desce. Quem tiver mais numa zona fica com ela, e a cada <b>15 segundos</b> cada zona vale <b>+1 ponto</b>.<br>
        Um quadro à esquerda mostra a percentagem de cada zona: <b>a tua equipa primeiro</b> (ex.: 25% / 20%). A tinta <b>seca em 10 segundos</b> e cada caixa de munição dá <b>25 balas</b>.`)}
      </div>`),

    card("🎨 Modos das cores", `
      <p>Estes modos mudam as regras das cores e são mais difíceis.</p>
      <div class="tiles" style="grid-template-columns: 1fr">
      ${tile("⚡", "", "Mistura Relâmpago", `De 30 em 30 segundos as <b>misturas trocam</b>: por exemplo, vermelho + azul pode passar a dar verde. Um quadro à esquerda do ecrã mostra as misturas em vigor e quanto falta para a próxima troca, e há um aviso 5 segundos antes. As cores dos jogadores não mudam, só as receitas.`)}
      ${tile("🟤", "", "Paleta Completa", `<i>Os baús também dão armadilhas.</i> Há uma 7.ª cor, o <b>castanho</b> (<b>1 + 2 + 3</b> ao mesmo tempo, gasta uma bala de cada tanque). Um tiro que junte as 3 primárias deixa o alvo castanho, e um castanho só se elimina com castanho.`)}
      <div class="tile wide"><b class="tt">🕵️ Cores Secretas</b><i>Os baús também dão armadilhas.</i> Os adversários ficam <b>cinzentos</b>. Cada tiro dá uma pista no painel do alvo: <b>−8</b> = a cor dele <b>leva</b> essa tinta; <b>−4</b> = <b>não leva</b>; <b>"e mudou de cor!"</b> = era primário e virou mistura. As poças dos eliminados mostram a cor verdadeira.<br>
        <i>Exemplo (é verde em segredo):</i> vermelho → −4 · azul → −8 · amarelo → −8 → leva azul e amarelo = <b>verde</b>: dispara verde!</div>
      </div>`),

    card("🗺️ Surpresas dos mapas", `
      <p>Alguns mapas têm algo especial que pode mudar o rumo do round.</p>
      <div class="tiles">
      ${tile("⛲", "", "Fonte de tinta", `<i>Parque e Fábrica de Tintas</i><br>A cada 20 segundos a fonte lança tinta. Antes, um <b>anel a piscar</b> mostra a cor. Quem estiver na praça <b>fica dessa cor</b>.`)}
      ${tile("💥", "E", "Canhão de tinta", `<i>Castelo e Restaurante</i><br>Sobe ao canhão e carrega em <b>E</b>: durante ${CONFIG.cannon.use} segundos, cada clique dispara uma <b>bola gigante</b> que só afeta os adversários.`)}
      ${tile("🌉", "", "Pontes do rio", `<i>Castelo</i><br>Acerta numa <b>placa</b> com a mesma cor e uma ponte sobe da água. Quando começar a <b>tremer</b>, sai: afunda e <b>elimina quem estiver em cima</b>.`)}
      ${tile("🎨", "", "Chão que muda de cor", `<i>Estúdio de Tinta</i><br>4 <b>poças gigantes</b> mudam a tua cor. A meio do round, metade do chão ganha uma cor (quente = mais rápido, fria = mais lento) e as poças começam a andar.`)}
      </div>`),

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

    card("⌨️ Outros comandos", keyTable2(OTHER_KEYS) + `
      <p><b>Placar:</b> está sempre no topo do ecrã. Os rounds ganhos ficam ao lado do relógio (tua equipa à esquerda) e as eliminações do round por baixo.</p>`),
  ];
}

// Instruções página a página: Anterior / Seguinte (ou setas do teclado)
// Temas do menu das instruções: cada um mostra só as suas páginas (índices das cartas de buildPages, pela ordem)
const TOPICS = [
  { icon: "🎯", name: "Objetivo",            desc: "Como se ganha",                  pages: [0] },
  { icon: "🎨", name: "Cores e misturas",    desc: "As 6 cores e como misturar",     pages: [1, 2] },
  { icon: "💥", name: "Tiro e munição",      desc: "Tanques, acertos e vida",        pages: [3, 4] },
  { icon: "🟣", name: "Poças",               desc: "Mudam a cor e a velocidade",     pages: [5] },
  { icon: "🎁", name: "Baús e itens",        desc: "Granadas, curas, armadilhas…",   pages: [6, 7] },
  { icon: "🎮", name: "Modos de jogo",       desc: "Latas, zonas, relâmpago…",       pages: [8, 9] },
  { icon: "🗺️", name: "Surpresas dos mapas", desc: "Fontes, canhões, pontes…",       pages: [10] },
  { icon: "🌦️", name: "Clima",               desc: "Chuva, nevoeiro, trovoada",      pages: [11] },
  { icon: "⬆️", name: "Melhorias",           desc: "O que ganhas ao vencer",         pages: [12] },
  { icon: "🕹️", name: "Movimento",           desc: "Andar, saltar, agachar, subir",  pages: [14, 13] },
  { icon: "⌨️", name: "Teclas",              desc: "Todos os comandos",              pages: [15] },
];

// Ecrã de instruções: primeiro um menu de temas; ao escolher um, vê-se só esse tema (setas para as páginas dele)
export function createInstructions({ content, prev, next, dots, nav, back, onClose }) {
  let pages = buildPages();
  let topic = null, i = 0;

  function render() {
    if (!topic) {
      content.innerHTML = `<div class="topicGrid">${TOPICS.map((t, k) => `<button class="topicBtn" data-k="${k}" style="--d:${k * 0.03}s"><span class="ti">${t.icon}</span><b>${t.name}</b><small>${t.desc}</small></button>`).join("")}</div>`;
      nav.style.visibility = "hidden";
      back.textContent = "Sair das instruções";
      return;
    }
    content.innerHTML = pages[topic.pages[i]];
    const n = topic.pages.length;
    nav.style.visibility = "visible";
    dots.innerHTML = n > 1 ? topic.pages.map((_, k) => `<span class="dot${k === i ? " on" : ""}"></span>`).join("") : "";
    prev.disabled = i === 0;
    next.textContent = i === n - 1 ? "Temas ✓" : "Seguinte →";
    back.textContent = "← Voltar aos temas";
  }
  function open(k) { topic = TOPICS[k]; i = 0; render(); }
  function go(d) {
    if (!topic) return;
    if (d > 0 && i === topic.pages.length - 1) { topic = null; render(); return; }   // fim do tema: volta ao menu
    i = Math.max(0, Math.min(topic.pages.length - 1, i + d));
    render();
  }
  function goBack() { if (topic) { topic = null; render(); } else onClose(); }   // Esc / botão de baixo: tema → menu → sair
  content.addEventListener("click", (e) => { const b = e.target.closest(".topicBtn"); if (b) open(Number(b.dataset.k)); });
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  render();
  return { go, back: goBack, reset() { pages = buildPages(); topic = null; i = 0; render(); } };
}
