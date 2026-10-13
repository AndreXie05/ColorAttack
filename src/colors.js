/* ============================================================
   SISTEMA DE CORES
   A lógica usa SEMPRE etiquetas ("vermelho", "roxo"...) e a tabela de misturas,
   nunca valores RGB. O hex serve só para desenhar.
   Para acrescentar uma cor nova basta uma entrada em COLORS.
   ============================================================ */
export const COLORS = {
  vermelho: { id: "vermelho", name: "Vermelho", hex: 0xff3b4a, kind: "primaria",   symbol: "circulo",   key: "1" },
  azul:     { id: "azul",     name: "Azul",     hex: 0x2f7bff, kind: "primaria",   symbol: "triangulo", key: "2" },
  amarelo:  { id: "amarelo",  name: "Amarelo",  hex: 0xffd21f, kind: "primaria",   symbol: "quadrado",  key: "3" },
  roxo:     { id: "roxo",     name: "Roxo",     hex: 0xa447ff, kind: "secundaria", symbol: "diamante",  parts: ["vermelho", "azul"] },
  laranja:  { id: "laranja",  name: "Laranja",  hex: 0xff8a1f, kind: "secundaria", symbol: "estrela",   parts: ["vermelho", "amarelo"] },
  verde:    { id: "verde",    name: "Verde",    hex: 0x2fd15a, kind: "secundaria", symbol: "hexagono",  parts: ["azul", "amarelo"] },
  castanho: { id: "castanho", name: "Castanho", hex: 0x8b5a2b, kind: "terciaria",  symbol: "cruz",      parts: ["vermelho", "azul", "amarelo"] },   // só no modo Paleta Completa (1 + 2 + 3)
};
// Regras do modo de jogo: triple = Paleta Completa (há castanho, a mistura das 3 primárias)
export const COLOR_RULES = { triple: false };
export const TERTIARY = "castanho";
export const PRIMARIES = Object.values(COLORS).filter((c) => c.kind === "primaria").map((c) => c.id);
export const SECONDARIES = Object.values(COLORS).filter((c) => c.kind === "secundaria").map((c) => c.id);
// Todas as cores em jogo (com o castanho só no modo Paleta Completa)
export const paletteColors = () => [...PRIMARIES, ...SECONDARIES, ...(COLOR_RULES.triple ? [TERTIARY] : [])];

const pairKey = (a, b) => [a, b].sort().join("+");

// Tabela de misturas, gerada a partir das secundárias: { "azul+vermelho": "roxo", ... }
export const MIX = {};
for (const c of Object.values(COLORS)) if (c.parts && c.parts.length === 2) MIX[pairKey(c.parts[0], c.parts[1])] = c.id;

export const css = (id) => "#" + COLORS[id].hex.toString(16).padStart(6, "0");
export const isPrimary = (id) => COLORS[id].kind === "primaria";

// Primárias de que a cor é feita (uma primária é feita dela própria)
export const ingredients = (id) => (COLORS[id].parts ? [...COLORS[id].parts] : [id]);

// Mistura de duas cores primárias -> secundária (ou null se não houver mistura)
export function mixColors(a, b) {
  return MIX[pairKey(a, b)] || null;
}

// Resultado de um tiro de cor `shot` num alvo com a cor `target`:
//   "kill"   -> cores iguais, o alvo é eliminado
//   "change" -> cor errada: o alvo passa a `newColor` (união das primárias das duas cores)
//   "push"   -> sem efeito além de um pequeno empurrão (alvo já secundário, ou mistura impossível)
// Paleta Completa: se a união das primárias for as 3, o alvo (primário ou secundário) fica castanho; o castanho não muda
export function resolveHit(shot, target) {
  if (shot === target) return { result: "kill" };
  const parts = new Set([...ingredients(target), ...ingredients(shot)]);
  if (COLOR_RULES.triple && target !== TERTIARY && parts.size === 3) return { result: "change", newColor: TERTIARY };
  if (!isPrimary(target)) return { result: "push" };
  if (parts.size === 2) {
    const [a, b] = [...parts];
    const mixed = mixColors(a, b);
    if (mixed) return { result: "change", newColor: mixed };
  }
  return { result: "push" };
}

// Dano de um tiro de cor `shot` num alvo com a cor `target` (vida leve):
//   cor certa -> elimina (Infinity); cor errada -> `wrong`; alvo de cor misturada atingido por uma das cores
//   de que é feito -> `partial` (o dobro). Só a cor certa interessa de verdade: errar tira muito pouco.
export function hitDamage(shot, target, dmg = { wrong: 4, partial: 8 }) {
  if (shot === target) return Infinity;
  if (!isPrimary(target) && ingredients(target).includes(shot)) return dmg.partial;
  return dmg.wrong;
}

/* ---------- símbolos (acessibilidade): um por cor, desenhados em SVG ---------- */
function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? inner : outer;
    pts.push((cx + Math.cos(a) * r).toFixed(1) + "," + (cy + Math.sin(a) * r).toFixed(1));
  }
  return pts.join(" ");
}
const SHAPES = {
  circulo:   '<circle cx="12" cy="12" r="7"/>',
  triangulo: '<polygon points="12,4 20,19 4,19"/>',
  quadrado:  '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  diamante:  '<polygon points="12,3 21,12 12,21 3,12"/>',
  estrela:   `<polygon points="${starPoints(12, 12.5, 9.5, 4)}"/>`,
  hexagono:  '<polygon points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5"/>',
  cruz:      '<polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9"/>',
};

// Símbolo sozinho (branco com contorno escuro)
export function symbolSVG(shape, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#fff" stroke="#1a1033" stroke-width="2" stroke-linejoin="round">${SHAPES[shape]}</svg>`;
}

// Bolinha da cor com o símbolo lá dentro (usada nas instruções e no HUD)
export function chipHTML(id, size = 44) {
  const c = COLORS[id];
  return `<span class="colorChip" style="width:${size}px;height:${size}px;background:${css(id)}" title="${c.name}">${symbolSVG(c.symbol, Math.round(size * 0.68))}</span>`;
}
