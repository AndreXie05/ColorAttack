/* ============================================================
   PERSONAGENS (SKINS) E EQUIPAS
   Cada skin é um boneco leve feito em código (o aspeto está em light-character.js, com o mesmo id).
   Todos começam com a skin "Iniciante" (grátis); as outras compram-se na loja (categoria "Skins"). Equipar uma skin muda o teu boneco.
   Algumas skins têm corpo próprio (robô, armadura, fato espacial, vestido, manto, dinossauro, redondinho); as outras só mudam a cabeça.
   Os bots usam skins à sorte (todas, mesmo as que ainda não tens: assim vês como são) e nomes de pessoas.
   price/cur/level: preço em moedas (coins) ou joias (gems) e nível mínimo para comprar.
   ============================================================ */
const S = (id, name, icon, price, cur, level, desc) => ({ id, name, icon, price, cur, level, desc, url: "light:" + id });
export const CHARACTERS = [
  S("iniciante",  "Iniciante",  "🙂", 0,   "coins", 1, "A skin de quem está a começar"),
  S("gota",       "Gota",       "💧", 600, "coins", 1, "Sonhadora, de cabelo pelos ombros"),
  S("gato",       "Gato",       "😺", 1200, "coins", 1, "Gato malhado: focinho branco, bigodes e cauda às riscas"),
  S("urso",       "Urso",       "🐻", 1400, "coins", 1, "Corpo redondinho e focinho fofo"),
  S("coelho",     "Coelho",     "🐰", 1400, "coins", 2, "Orelhas compridas e dentes da frente"),
  S("pinguim",    "Pinguim",    "🐧", 1600, "coins", 2, "Capuz preto, bico laranja, barbatanas e pés de pato"),
  S("palhaco",    "Palhaço",    "🤡", 1600, "coins", 2, "Nariz vermelho, tufos e barriga redonda"),
  S("pirata",     "Pirata",     "🏴‍☠️", 1800, "coins", 3, "Lenço, pala no olho e barba"),
  S("ninja",      "Ninja",      "🥷", 2000, "coins", 3, "Capuz que só mostra os olhos, fita vermelha e katana"),
  S("bombeiro",   "Bombeiro",   "🧑‍🚒", 2000, "coins", 3, "Capacete com escudo, bigode, faixas refletoras e garrafa de ar"),
  S("zombie",     "Zombie",     "🧟", 2200, "coins", 4, "Pele verde, cérebro à mostra, pontos e ligaduras"),
  S("vampiro",    "Vampiro",    "🧛", 2400, "coins", 4, "Olhos vermelhos, caninos, capa preta e vermelha"),
  S("abelha",     "Abelha",     "🐝", 2400, "coins", 4, "Gorro às riscas, antenas aos caracóis, asas e ferrão"),
  S("cavaleiro",  "Cavaleiro",  "🛡️", 3000, "coins", 5, "Armadura completa e elmo com pluma"),
  S("mago",       "Mago",       "🧙", 2800, "coins", 5, "Manto comprido, chapéu e barba"),
  S("robo",       "Robô",       "🤖", 45,  "gems",  5, "Corpo de metal aos quadrados"),
  S("alien",      "Extraterrestre", "👽", 55, "gems", 6, "Olhos enormes e antenas"),
  S("astronauta", "Astronauta", "👨‍🚀", 55, "gems",  6, "Fato espacial fofo e capacete"),
  S("dino",       "Dinossauro", "🦖", 70,  "gems",  7, "Focinho com dentes, espinhos laranja e cauda"),
  S("panda",      "Panda",      "🐼", 1200, "coins", 2, "Manchas pretas nos olhos e muito sono"),
  S("sapo",       "Sapo",       "🐸", 1000, "coins", 1, "Olhos em cima da cabeça e um sorriso enorme"),
  S("raposa",     "Raposa",     "🦊", 1600, "coins", 3, "Orelhas em bico e cauda fofa com a ponta branca"),
  S("chef",       "Chef",       "👨‍🍳", 1800, "coins", 3, "Chapéu alto e bigode de cozinheiro"),
  S("cowboy",     "Cowboy",     "🤠", 2200, "coins", 4, "Chapéu de abas largas e lenço ao pescoço"),
  S("fantasma",   "Fantasma",   "👻", 2600, "coins", 5, "Um lençol branco… e uns olhos a espreitar"),
  S("rei",        "Rei",        "🤴", 60,   "gems",  7, "Coroa com pedras preciosas, manto e barba branca"),
  S("unicornio",  "Unicórnio",  "🦄", 90,   "gems",  9, "Corno dourado e crina com as cores do arco-íris"),
  S("princesa",   "Princesa",   "👸", 70,  "gems",  7, "Cabelo dourado comprido, coroa com pedras e vestido"),
];
export const PLAYABLE = CHARACTERS.map((c) => c.id);
export const charById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

// Nomes dos bots (pessoas): sorteados em cada partida, sem repetir
export const NAMES = [
  "Tiago", "Inês", "Rafael", "Beatriz", "Diogo", "Mariana", "Gonçalo", "Leonor", "Rodrigo", "Matilde", "Tomás", "Carolina",
  "Duarte", "Sofia", "Martim", "Lara", "Afonso", "Francisca", "Guilherme", "Margarida", "Salvador", "Benedita", "Lourenço", "Clara",
  "Santiago", "Alice", "Vicente", "Camila", "Miguel", "Joana", "Pedro", "Rita", "João", "Ana", "Simão", "Eva", "Gabriel", "Luana",
  "Dinis", "Madalena", "Henrique", "Constança", "Bernardo", "Mafalda", "Lucas", "Íris", "Frederico", "Laura", "Vasco", "Teresa",
  "Hugo", "Catarina", "André", "Marta", "Bruno", "Sara", "Ricardo", "Filipa", "Nuno", "Helena", "Rui", "Patrícia", "Daniel",
  "Bianca", "Leandro", "Yara", "Kevin", "Jéssica", "Samuel", "Letícia", "Enzo", "Lia", "Noah", "Maria", "David", "Luísa",
  "Artur", "Vitória", "Caetano", "Aurora", "Xavier", "Pilar", "Raul", "Olívia", "Jorge", "Glória", "Fábio", "Débora", "Igor", "Nádia",
];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Equipas: A é a do jogador (tu primeiro), B é a adversária; 5 em cada, com skins diferentes (à sorte) e nomes de pessoas
export function buildRosters(playerId) {
  const looks = shuffle(PLAYABLE.filter((id) => id !== playerId)), names = shuffle([...NAMES]);
  return {
    A: [playerId, ...looks.slice(0, 4)], B: looks.slice(4, 9),
    names: { A: ["Tu", ...names.slice(0, 4)], B: names.slice(4, 9) },
  };
}
