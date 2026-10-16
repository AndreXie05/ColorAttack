/* ============================================================
   MELHORIAS: no fim de cada round escolhes 1 de 3 (tecla 1, 2 ou 3). Duram até ao fim do jogo e acumulam.
   ============================================================ */
export const UPGRADES = [
  { id: "cheap",   icon: "🧪", name: "Mistura económica",    desc: "Os tiros de cores secundárias gastam só 1 bala (do tanque que tiver mais) em vez de 2.", once: true },
  { id: "pierce",  icon: "🎯", name: "Tiro que atravessa",   desc: "A bala atravessa o primeiro adversário e pode acertar noutro." },
  { id: "grenade", icon: "💣", name: "Granadas extra",       desc: "Ganhas 2 granadas já e mais 1 no início de cada round." },
  { id: "rate",    icon: "🔫", name: "Mais cadência",        desc: "Disparas 25% mais depressa." },
  { id: "speed",   icon: "👟", name: "Mais velocidade",      desc: "Andas e corres 10% mais depressa." },
  { id: "hp",      icon: "❤️", name: "Mais vida",            desc: "+25 de vida máxima." },
  { id: "damage",  icon: "💥", name: "Dano duplo",           desc: "Tiros com a cor errada tiram o dobro de vida.", once: true },
  { id: "area",    icon: "🌐", name: "Granadas maiores",     desc: "A área das tuas granadas aumenta 35%." },
  { id: "track",   icon: "📍", name: "Rastreador",           desc: "Vês no minimapa a localização de 1 adversário. Sempre que morres, o adversário seguido pode mudar ou não.", once: true },
  { id: "dual",    icon: "🎨", name: "Granada de 2 cores",   desc: "A granada cai com duas cores (primárias, mistas ou uma de cada). Quem tiver uma delas é eliminado. Tecla X troca a cor que escolhes.", once: true },
];

export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

// 3 melhorias diferentes à sorte (as "únicas" já escolhidas não voltam a sair)
export function offerUpgrades(levels, n = 3) {
  const pool = UPGRADES.filter((u) => !(u.once && levels[u.id]));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}

// Efeitos (níveis = quantas vezes cada uma foi escolhida)
export const fx = (lv) => ({
  fireMul: Math.pow(0.8, lv.rate || 0),
  speedMul: Math.pow(1.1, lv.speed || 0),
  tracked: lv.track ? 1 : 0,
  maxHp: 100 + 25 * (lv.hp || 0),
  pierce: lv.pierce || 0,
  cheapMix: !!lv.cheap,
  grenadePerRound: lv.grenade || 0,
  damageMul: lv.damage ? 2 : 1,
  grenadeMul: 1 + 0.35 * (lv.area || 0),
  dualGrenade: !!lv.dual,
});
