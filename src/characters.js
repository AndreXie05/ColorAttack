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
  S("gota",       "Gota",       "💧", 150, "coins", 1, "Sonhadora, de cabelo pelos ombros"),
  S("gato",       "Gato",       "😺", 300, "coins", 1, "Gato malhado: focinho branco, bigodes e cauda às riscas"),
  S("urso",       "Urso",       "🐻", 350, "coins", 1, "Corpo redondinho e focinho fofo"),
  S("coelho",     "Coelho",     "🐰", 350, "coins", 2, "Orelhas compridas e dentes da frente"),
  S("pinguim",    "Pinguim",    "🐧", 400, "coins", 2, "Capuz preto, bico laranja, barbatanas e pés de pato"),
  S("palhaco",    "Palhaço",    "🤡", 400, "coins", 2, "Nariz vermelho, tufos e barriga redonda"),
  S("pirata",     "Pirata",     "🏴‍☠️", 450, "coins", 3, "Lenço, pala no olho e barba"),
  S("ninja",      "Ninja",      "🥷", 500, "coins", 3, "Capuz que só mostra os olhos, fita vermelha e katana"),
  S("bombeiro",   "Bombeiro",   "🧑‍🚒", 500, "coins", 3, "Capacete com escudo, bigode, faixas refletoras e garrafa de ar"),
  S("zombie",     "Zombie",     "🧟", 550, "coins", 4, "Pele verde, cérebro à mostra, pontos e ligaduras"),
  S("vampiro",    "Vampiro",    "🧛", 600, "coins", 4, "Olhos vermelhos, caninos, capa preta e vermelha"),
  S("abelha",     "Abelha",     "🐝", 600, "coins", 4, "Gorro às riscas, antenas aos caracóis, asas e ferrão"),
  S("cavaleiro",  "Cavaleiro",  "🛡️", 750, "coins", 5, "Armadura completa e elmo com pluma"),
  S("mago",       "Mago",       "🧙", 700, "coins", 5, "Manto comprido, chapéu e barba"),
  S("robo",       "Robô",       "🤖", 10,  "gems",  5, "Corpo de metal aos quadrados"),
  S("alien",      "Extraterrestre", "👽", 12, "gems", 6, "Olhos enormes e antenas"),
  S("astronauta", "Astronauta", "👨‍🚀", 12, "gems",  6, "Fato espacial fofo e capacete"),
  S("dino",       "Dinossauro", "🦖", 15,  "gems",  7, "Focinho com dentes, espinhos laranja e cauda"),
  S("princesa",   "Princesa",   "👸", 15,  "gems",  7, "Cabelo dourado comprido, coroa com pedras e vestido"),
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
