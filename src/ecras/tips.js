import { CONFIG } from "../base/game-config.js";

/* ============================================================
   DICAS 💡: frases curtas sobre o jogo. O lobby mostra uma diferente de cada vez que lá entras (randomTip).
   Ao mudar teclas ou regras, rever estas frases (como as instruções).
   ============================================================ */
export const TIPS = [
  "Só eliminas um adversário com a cor certa: a cor dele é a que tens de ter na mão.",
  "Carrega em duas teclas ao mesmo tempo para misturar: 1 + 2 = roxo, 2 + 3 = verde, 1 + 3 = laranja.",
  "Acertar com a cor errada também tira vida e muda a cor do adversário (pela tabela de misturas).",
  "Eliminar com a cor certa devolve-te balas e dá-te um radar: vês os adversários no minimapa.",
  "Segura G para apontar a granada e roda o rato para mudar a cor dela.",
  `Cair de ${CONFIG.fallDeath} m ou mais elimina logo. Os saltos de trampolim não contam!`,
  "A meio de cada round um baú fica dourado: procura a estrela no minimapa.",
  "Na morte súbita, a primeira equipa a eliminar alguém ganha o round.",
  "Carrega em T para usares uma Cura e em F para ficares invisível.",
  "Carrega em V para veres o mapa todo de cima.",
  "Segura o clique direito para mirar: a vista passa para 1.ª pessoa, a partir da mira.",
  "Ctrl agacha (e Ctrl outra vez levanta): ficas mais pequeno atrás dos muretes.",
  "No Rouba-Latas, leva a lata dos adversários até à tua base: vale 2 pontos.",
  "No Pinta e Conquista, ganha a zona a equipa com mais tinta lá dentro.",
  "Com chuva as poças de tinta duram menos e com nevoeiro os tiros chegam menos longe.",
  "Carrega em Z para celebrar. Escolhe a celebração no Inventário.",
  "O 7.º dia seguido do prémio diário dá 💎 joias!",
  "Roda a 🎡 roda da sorte todos os dias: pode sair uma joia ou um item da loja!",
  "Põe um autocolante na tua arma: estão na Loja, na categoria Autocolantes.",
  "As missões do dia (📅) mudam à meia-noite e dão moedas extra.",
  "Clica no teu nível, lá em cima, para veres as conquistas.",
  "Ganha o round para escolheres uma melhoria: só a equipa que ganha recebe uma.",
  "De noite (🌙) os bots veem menos longe: aproveita para te aproximares.",
  "Na Cidade Neon, os pads de salto levam-te aos telhados.",
  `Um baú aberto volta a ter prémio passados ${CONFIG.chest.reopenSeconds} s: lembra-te onde estão.`,
  "Quando chegares ao nível 15 podes comprar tudo na loja.",
];

let last = -1;
/** Uma dica à sorte (nunca a mesma duas vezes seguidas). */
export function randomTip() {
  let i = Math.floor(Math.random() * TIPS.length);
  if (i === last) i = (i + 1) % TIPS.length;
  last = i;
  return TIPS[i];
}
