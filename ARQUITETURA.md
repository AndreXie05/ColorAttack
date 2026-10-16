# 🏗️ Arquitetura do ColorAttack

O código do jogo está em `src/`, arrumado em **pastas por tema**.
Regra: cada ficheiro novo vai para a pasta do seu tema. Nada solto em `src/`.

```
index.html            página do jogo (estilos + ecrãs); arranca src/jogo/map-viewer.js
assets/               mapas (.glb), imagens, ícones
vendor/               bibliotecas guardadas no jogo (three.js, PeerJS)
electron/             app de PC (Windows/Linux)
src/
├── base/             regras e números comuns a todo o jogo
├── jogo/             a partida: ciclo do jogo, combate, bots, rounds
├── movimento/        andar, saltar, alturas e colisões
├── personagens/      bonecos (skins), animações, celebrações
├── loja/             itens da loja e acessórios
├── progresso/        níveis, moedas, conquistas, missões, estatísticas
├── visual/           materiais, tinta no chão, clima, aspeto dos mapas
├── mapas/            os mapas e as coisas especiais de cada um
├── online/           jogar com amigos
├── ecras/            lobby, instruções, configurações
├── som/              sons do jogo
└── tools/            ferramentas (Blender) — não entram no jogo
```

## O que há em cada pasta

### `base/` — regras comuns
| Ficheiro | O que faz |
|---|---|
| `game-config.js` | Todos os números do jogo: vida, munição, tempo do round, equipas, dificuldade dos bots |
| `colors.js` | As cores, as misturas (vermelho + azul = roxo) e o que acontece quando um tiro acerta |

### `jogo/` — a partida
| Ficheiro | O que faz |
|---|---|
| `map-viewer.js` | **O coração do jogo**: ecrãs, ciclo de cada frame, teclas, HUD, rounds, fim do round |
| `combat.js` | Tiros, granadas, armadilhas, dano e eliminações |
| `bots.js` | A inteligência dos bots (personalidades, para onde vão, quando disparam) |
| `upgrades.js` | Melhorias escolhidas no fim de cada round |
| `pickups.js` | Itens no chão (munição, curas…) |
| `chests-and-loot.js` | Baús e o que sai deles; desenha todos os baús de uma vez (instâncias) |
| `replay.js` | Repetição da melhor jogada |
| `tutorial.js` | O tutorial guiado |
| `test-dummy.js` | O boneco do jogador no tutorial / alvos |

### `movimento/`
| Ficheiro | O que faz |
|---|---|
| `player-motion.js` | Andar, correr, saltar (velocidades, aceleração, gravidade) — usado pelo jogador e pelos bots |
| `surfaces.js` | Alturas do mapa: plataformas, degraus, rampas, escadas, trampolins; **grelha espacial** (`near`) que dá só os obstáculos perto de um ponto |
| `collisions.js` | Não atravessar paredes |

### `personagens/`
| Ficheiro | O que faz |
|---|---|
| `characters.js` | Lista das skins (nome, preço, nível) |
| `light-character.js` | Como cada skin é desenhada (feita em código) |
| `character-model.js` | Carregar/clonar bonecos, pintar a camisola com a cor |
| `character-animator.js` | Animações (andar, correr, saltar, agachar) |
| `emotes.js` | Celebrações (tecla Z) |
| `portraits.js` | Fotografias dos bonecos (HUD, loja) |

### `loja/` — acessórios
| Ficheiro | O que faz |
|---|---|
| `cosmetics.js` | Todos os itens da loja: skins, armas, celebrações, rastos (preço e nível mínimo 1–15) |
| `trails.js` | Os rastos atrás do boneco |
| `shop-art.js` | Imagens dos cartões da loja |

### `progresso/`
| Ficheiro | O que faz |
|---|---|
| `progress.js` | XP, níveis, moedas, joias, comprar e equipar |
| `achievements.js` | Conquistas 🏅 e títulos |
| `missions.js` | Missões diárias 📅 |
| `stats.js` | Classificações e estatísticas |

### `visual/`
| Ficheiro | O que faz |
|---|---|
| `materials-and-geometry.js` | Materiais e formas partilhadas |
| `paint-layer.js` | A tinta no chão |
| `weather.js` | Clima: chuva, nevoeiro, trovoada… |
| `map-look.js` | Sombras e texturas dos mapas .glb |
| `symbol-sprites.js` | Símbolos por cima dos bonecos |
| `damage-numbers.js` | Números de dano vermelhos por cima de quem acertas (somam-se, 1 s) |

### `mapas/`
| Ficheiro | O que faz |
|---|---|
| `map-definitions.js` | A lista dos mapas |
| `glb-map.js` | Carregar mapas feitos no Blender (.glb); junta as peças por tipo de material (a cor vai para os vértices), também dentro dos objetos animados |
| `map-builder.js`, `map-props.js`, `map-scenery.js` | Construir mapas e decoração em código |
| `map-features.js` | Coisas especiais: fonte, pontes, canhões, Estúdio, latas, zonas |

### `online/`
| Ficheiro | O que faz |
|---|---|
| `online.js` | Salas com código (criar, entrar, equipas) |
| `net-game.js` | O que passa entre os PCs durante a partida |

### `ecras/`
| Ficheiro | O que faz |
|---|---|
| `lobby.js` | O lobby: loja, inventário, perfil, conquistas |
| `settings.js` | ⚙️ Configurações: som, gráficos, rato |
| `instructions-screen.js` | Ecrã de instruções |
| `color-selector.js` | Escolher e misturar cores (teclas 1, 2, 3) |

### `som/`
| Ficheiro | O que faz |
|---|---|
| `sfx.js` | Todos os sons (feitos na hora, sem ficheiros), volumes por grupo |

## Como as peças se ligam

```
base/  ◄── usado por quase tudo
  ▲
movimento/  personagens/  visual/  som/
  ▲             ▲           ▲       ▲
  └──── jogo/map-viewer.js ─┴───────┘ ──► mapas/, online/, ecras/, progresso/, loja/
```

- **`jogo/map-viewer.js` é quem junta tudo**; os outros ficheiros não dependem dele.
- Os ficheiros de `base/`, `movimento/` e `som/` não sabem nada do resto (fáceis de mudar e testar).

## Regras de desempenho (para manter o jogo leve)
- Nada de percorrer **todos** os obstáculos: usar `near(colliders, x, z)` (surfaces.js).
- Peças que não mexem e têm o mesmo tipo de material → juntar numa só (cor nos vértices).
- Muitas cópias do mesmo objeto (baús) → `InstancedMesh`.
- Quando um boneco sai do jogo → `disposeCharacter` (liberta só o que é dele).
- Não marcar materiais com `needsUpdate` em cada frame.
- Testar sempre com o som da janela de testes desligado.

## Próximo passo possível
`jogo/map-viewer.js` tem ~2500 linhas. Dá para o partir por temas (HUD, teclas, rounds, ecrãs)
em ficheiros mais pequenos dentro de `jogo/`.
