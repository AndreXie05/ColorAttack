# ColorAttack — Prompt e progresso

## Progresso

### Fase 0 — Base
- [x] Página HTML em branco (`index.html`)
- [x] Tela inicial com logo SVG animado (círculos primários, misturas, mira, símbolos)
- [x] Botão "JOGAR" abre a escolha de mapa; botão "Instruções" (regras das cores, baús, controlos); botão "Tutorial" criado (desativado, fazer no fim)
- [x] Código separado em módulos (`src/`), correr com `./serve.sh` e abrir http://localhost:8000
- [x] Visualizador de mapas com boneco de teste (WASD, V vista aérea, E abre baús)
- [x] Baús (80% prémio / 20% vazio, 60 s para reabrir, 3 aberturas por round); itens saltam do baú e painel "Coletado" no canto superior esquerdo

### Fase 1 — Núcleo
- [x] Three.js por CDN (importmap + módulos ES, versão fixa)
- [x] Cena e câmara (decidido: manter a câmara atrás do boneco, rato preso sem clicar; sem 1.ª pessoa)
- [ ] Movimento WASD, saltar, correr
- [x] Sistema de cores: dados e regras em `src/colors.js` (tabela de misturas, símbolos, `resolveHit`)
- [ ] Escolha de cor com 1/2/3 e mistura de 0,3 s
- [ ] Tanques de tinta e munição
- [ ] Tiro, impactos e mudança de cor do alvo
- [x] Mapa 1: Parque (cena, baús, objetos; sem bots ainda)
- [ ] Bots básicos

### Fase 2 — Rounds, menus e melhorias
- [ ] Rounds (3 min), pontos, morte súbita, primeiro a 5 rounds
- [ ] Respawn (5 s) e proteção (2 s)
- [ ] Poças de tinta no chão
- [ ] Menus: inicial, configurações, como jogar, pausa, fim de jogo
- [ ] Configurações em localStorage
- [ ] Melhorias entre rounds (escolher 1 de 3)
- [ ] HUD completo

### Fase 3 — Mapas, áudio e polimento
- [x] Mapa 2: Escola (cena, baús, objetos)
- [x] Mapa 3: Restaurante (cena, baús, objetos)
- [ ] Escolha de mapa (incluindo aleatório)
- [ ] Áudio com Web Audio API (notas por cor, acordes, efeitos, música)
- [ ] Partículas e manchas de tinta (com limites)
- [ ] Qualidade gráfica (baixa/média/alta)
- [ ] Modo daltónico e remapear teclas
- [ ] Revisão final de bugs (pointer lock, transições de menu)

## Ideias novas
<!-- Acrescenta aqui as ideias à medida que forem surgindo -->
- Baús espalhados pelos mapas: ao abrir, 80% de hipótese de trazer algo (caixas de munição 65%, granada de tinta 20%, cura 15%) e 20% de vir vazio.
- Objetos de decoração espalhados em cada mapa (bolas, cones, mochilas, pratos, caixotes...) para dar vida ao ambiente.
- Já feitos: Parque de diversões e Fábrica de tintas. Mapas futuros: Mundo dos doces, Museu de arte, Praia, Supermercado.
- Objetos grandes como obstáculos/coberturas (bloqueiam a visão); objetos pequenos sem colisão.
- Área jogável fixa (100x70 m, não se expande); cenário temático decorativo fora das muralhas (`src/map-scenery.js`).
- Clima por mapa: sol, chuva e trovoada (`src/weather.js`); escolhido no menu ou aleatório; tecla C muda durante o teste. Ideias: nevoeiro, neve, vento que afeta a pontaria.
- Vida leve (decidido): 100 de vida; cor certa elimina de vez; cor errada tira 4; cor misturada atingida por uma das suas cores tira 8 (valores em `CONFIG.health`). A Cura recupera 40. Mistura de cores (teclas 1/2/3, 0,3 s) escolhe a cor da MUNIÇÃO da arma, não a cor do boneco; a cor do boneco (a que os adversários têm de acertar) é separada e só muda por tiros errados, poças ou granadas.
- Baús: cada caixa de munição = 10 tiros de uma cor primária; um baú dá 1 a 3 caixas (cores à sorte, iguais ou diferentes); lista de itens no canto superior esquerdo, sem moldura, com a quantidade à frente.
- Item raríssimo: Invisibilidade 5 s (2% dos prémios), fica guardada na lista de itens e usa-se com F; o jogador vira fantasma translúcido e os bots devem ignorá-lo (`state.invisible`).
- Baús encostados a objetos ou paredes, com distância mínima de 14 m entre eles.
- Direção de arte (referência: `foto.png`, estilo Splatoon): cenário pastel/neutro e limpo, só a tinta, os itens e as equipas têm cor viva; formas arredondadas; luz suave; céu em gradiente com nuvens fofas. Implementado: `soften()` em `materials-and-geometry.js`, camada de tinta no chão em `paint-layer.js`, céu em `weather.js`.
- Ideias de arte por fazer: tinta também nas paredes e caixas, brilho suave (bloom) nas cores fortes, sombras de contacto, contornos opcionais, minimapa no canto inferior esquerdo, personagens com mais detalhe.

---

## Prompt

Constrói-me um jogo completo de tiros em primeira pessoa 3D que corra no browser, num único ficheiro HTML com Three.js (carregado por CDN). Responde em português e escreve o código completo, sem omitir partes nem usar "resto igual".

NOME: ColorAttack

### CONCEITO
Shooter por equipas, colorido e estilo cartoon. Os adversários têm cores e só se eliminam com a cor certa, que o jogador mistura na arma.

### SISTEMA DE CORES
- Primárias: vermelho, azul, amarelo.
- Secundárias: vermelho+azul=roxo, vermelho+amarelo=laranja, azul+amarelo=verde.
- Na lógica usar etiquetas ("vermelho", "roxo"...) e uma tabela de misturas, nunca comparar valores RGB.
- O jogador tem 3 tanques de tinta (um por primária), cada um com munição própria que recarrega com o tempo. Uma secundária gasta munição das duas primárias que a compõem.
- Teclas 1, 2 e 3 escolhem a cor. Manter duas teclas ao mesmo tempo mistura a secundária (a mistura demora cerca de 0,3 s).
- Cada cor tem um símbolo visível acima de cada jogador e na mira (círculo, triângulo, quadrado, etc.) por acessibilidade.
- Cada jogador tem uma cor atual visível (a cor com que está "pintado"). Para o eliminar é preciso acertar com a mesma cor.
- Se o tiro acerta com a cor errada, o adversário não morre: a sua cor muda segundo a tabela de misturas (ex.: amarelo atingido por vermelho passa a laranja). Se já for secundária, o tiro apenas o empurra levemente e não tem efeito.

### FORMATO DE JOGO
- Duas equipas de 5 (5 vs 5). Eu controlo 1 jogador, com 4 bots aliados contra 5 bots inimigos.
- Cada round dura **3 minutos** (configurável). Vence o round a equipa com mais pontos no fim do tempo.
- Vence o jogo a primeira equipa a ganhar 5 rounds (máximo 9 rounds, configurável).
- Empate num round: morte súbita (o próximo ponto decide).
- Pontos: eliminação com a cor certa à primeira (bónus), eliminação normal, assistência, combo de eliminações seguidas (multiplicador).
- Quem é eliminado reaparece após 5 segundos na base da sua equipa, com proteção de 2 segundos.
- Cada eliminação deixa uma poça da cor do jogador eliminado no chão; quem passar por cima dela muda de cor segundo a tabela de misturas.
- Entre rounds: ecrã de resultado com placar e pontuação, e escolha de 1 de 3 melhorias aleatórias para o jogador (tanques maiores, mistura instantânea, tiro que atravessa, granada de tinta que muda a cor de todos numa área, mais cadência, mais velocidade). As melhorias duram até ao fim do jogo.

### BOTS
- Movem-se entre pontos do mapa, procuram adversários, desviam-se de obstáculos, escolhem a cor certa para o alvo, misturam e disparam com imprecisão dependente da dificuldade (fácil, média, difícil).
- Têm tempo de reação e recarregam.
- Aliados defendem a base e atacam, inimigos fazem o mesmo.
- Estrutura do código preparada para, mais tarde, trocar bots por jogadores online: separar estado do jogo, input e renderização.

### MENUS
- Menu inicial: Jogar, Configurações, Como jogar.
- Configurações: sensibilidade do rato, volume (música e efeitos), campo de visão, qualidade gráfica (baixa/média/alta), dificuldade dos bots, duração do round (por defeito 3 min, opções de 1 a 5 min), rounds para vencer, modo daltónico (símbolos maiores), remapear teclas.
- Guardar configurações em localStorage (com try/catch; se falhar, usar valores por defeito em memória).
- Menu de pausa (Esc) com Continuar, Configurações, Sair para o menu.
- Ecrã de fim de jogo com resultado final, estatísticas e botão para jogar de novo.

### CONTROLOS
WASD mover, rato mirar (PointerLockControls), clique esquerdo disparar, 1/2/3 cores, R recarregar, espaço saltar, Shift correr, Tab placar, Esc pausa.

### MAPAS
Cada um é uma função que devolve a cena, spawns das equipas, pontos de patrulha dos bots, luzes e obstáculos.
1. Parque: relva, árvores, bancos, baloiços e escorregas feitos com formas simples, uma base de cada lado. Poças de tinta na relva duram mais tempo.
2. Escola: corredores, salas e pátio. Quadros e cacifos pintados dão munição extra.
3. Restaurante: sala e cozinha. Tachos e máquinas misturam as cores de quem passa.
- Antes de cada jogo o jogador escolhe o mapa (e há uma opção "aleatório"). Mapas equilibrados e simétricos.

### VISUAL
- Estilo cartoon alegre, cores saturadas, luz ambiente forte, sombras suaves.
- Tinta no chão e nas paredes onde os tiros acertam (planos pequenos com mancha, com limite máximo para não pesar).
- Partículas da cor do tiro nos impactos e nas eliminações.
- Os jogadores são personagens simples (corpo e cabeça com formas básicas) tingidos da cor atual, com símbolo acima da cabeça.
- Arma em primeira pessoa com recuo e tremor leve de câmara ao disparar.
- HUD: cor atual e mistura em curso, os 3 tanques, vida, pontos de cada equipa, tempo do round, rounds ganhos (ex.: 3-2), indicador de eliminação, mira com símbolo da cor.
- Qualidade gráfica ajusta resolução, sombras e partículas.

### SOM
Web Audio API, sem ficheiros externos.
- Cada cor tem uma nota musical; mistura soa como acorde.
- Sons de tiro, acerto, eliminação, recarga, fim de round e vitória.
- Música de fundo simples e animada gerada por código, com volume separado.

### ARQUITETURA
- Secções comentadas: configurações, estado do jogo, cores, armas, bots, mapas, HUD, menus, áudio, loop principal.
- Código legível e fácil de estender (novos mapas, cores, melhorias e tipos de bot).

### REQUISITOS TÉCNICOS
- Corre a 60 fps em portátil normal; reutilizar geometrias e materiais, limitar partículas e manchas de tinta.
- Sem bugs ao trocar entre menu, pausa e jogo (libertar e recuperar o pointer lock corretamente).
- Verifica o código mentalmente antes de o enviar: sem variáveis por definir, sem funções em falta.
- Three.js com `<script type="importmap">` e módulos ES via CDN (versão fixa), `PointerLockControls` importado de `three/addons`.

### ENTREGA
Um único ficheiro HTML completo, pronto a abrir no browser, e no fim uma lista curta de como jogar e o que cada tecla faz.
- Boneco feito no Blender (`tools/blender/build_character.py` -> `assets/character.glb`, carregado por `src/character-model.js`; se o ficheiro faltar usa o boneco simples de `src/test-dummy.js`). Convenções: objetos Body, LegL, LegR, ArmL, ArmR (origem na articulação); materiais "Paint" (cor do jogador) e "AmmoTank" (cor da munição). Blender 5.2.2 em `~/Applications/blender-5.2.2/`, ligado ao Claude pelo addon MCP (porta 9876).
- FEITO para o Parque: mapa feito no Blender (`tools/blender/build_park_map.py` -> `assets/maps/parque.glb`, lido por `src/glb-map.js`; se o ficheiro falhar usa a versão em código). Marcadores no .glb: Col_Box_n / Col_Cyl_n (colisões, extras w/d/top ou r/top) e Patrol_n; as bases, os reaparecimentos e os baús continuam a ser criados pelo jogo. Falta fazer o mesmo para Escola, Restaurante, Parque de Diversões e Fábrica.
- (Ideia original) mapas feitos no Blender no estilo da foto (`foto.png`). Pipeline proposto: um script constrói o cenário e exporta `assets/maps/<mapa>.glb` com (1) a geometria visível, (2) caixas de colisão chamadas `Col_*`, (3) empties `SpawnA_n`/`SpawnB_n`/`Chest_n`/`Patrol_n`; o jogo lê isto em vez de construir tudo em código. Luz/oclusão pode ser cozinhada em cores de vértice. Começar por um único mapa como teste.
- Personagens (uso pessoal; versões chibi minhas inspiradas nos Jovens Titãs: Robin, Starfire, Cyborg, Raven, Beast Boy): `tools/blender/build_titans.py` -> `assets/characters/*.glb`; lista e regras de equipa em `src/characters.js`. Cada equipa tem os 5 sem repetir (se o jogador é o Robin, os 4 aliados são os outros; a equipa inimiga tem os 5). ANTES DE PUBLICAR: apagar `assets/characters/`, `tools/blender/build_titans.py` e a lista de Titãs em `src/characters.js` (são personagens da DC) e usar personagens originais.
- TODOS os 5 mapas já são feitos no Blender (`tools/blender/build_*_map.py` + `map_kit.py`/`common.py` -> `assets/maps/*.glb`, lidos por `src/glb-map.js`; a versão em código fica como alternativa). Animações no .glb (extras anim = spin|bob|loop|counter): roda gigante, carrosséis, torres de queda, pás das cubas, latas nos tapetes. Regra da tinta: tudo o que cobre o chão fica abaixo de z=0.04 (a camada de tinta está a 0.045).
- HUD: mensagens do jogo em fila no canto superior esquerdo (já não há aviso grande ao centro); bloco "Na mão" mostra a cor da munição e a mistura a decorrer; as linhas dos tanques dessa cor ficam realçadas.
- Próximo foco decidido pelo utilizador: melhorar o movimento.
- As bolinhas do topo mostram a cara de cada personagem em campo (retratos tirados dos modelos do Blender em `src/portraits.js`, com a cor da equipa na peça "Paint"); eliminado = mesma cara muito clara.
- Movimento melhorado (`src/player-motion.js`): inércia, controlo no ar, salto de altura variável, coyote time e jump buffer; câmara suave com colisão e FOV que abre ao correr; animações do boneco (`src/character-animator.js`): andar proporcional à velocidade, inclinação, respirar, pose de salto e aterragem. HUD do canto superior esquerdo mais pequeno.
- Lista de eliminações no lado direito (`reportKill(killer, victim, cor, comCorCerta)` em `map-viewer.js`): cara de quem eliminou + cor usada + cara da vítima; mensagem diferente se foi com a cor certa ou não. Teclas de teste: J (simula eliminação), K (alterna uma bolinha).
- Ecrã de escolha de personagem antes do mapa (JOGAR -> personagem -> mapa); equipas pré-definidas com os 5 Titãs sem repetir. Bots (`src/bots.js`): 4 aliados + 5 inimigos, por agora só patrulham (sem tiro, sem escolha de cor); falta ligar o tiro, a vida e a IA de combate.
- COMBATE a funcionar (`src/combat.js`, `src/bots.js`, integração em `src/map-viewer.js`): clique esquerdo dispara a cor da munição (secundária gasta 1 de cada tanque), tanques por cor primária (início 30, máx. 100, recarga lenta; caixas somam 10), cor certa elimina, cor errada tira 4 (8 se for uma das cores de uma mistura) e muda a cor do alvo primário, sem fogo amigo, reaparece em 5 s com 2 s de proteção, poça da cor do eliminado. Vida no canto superior esquerdo, cura com a tecla H (+40). Bots disparam (dificuldade em `CONFIG.bots`). Ajudas para saber a cor dos adversários: símbolo por cima da cabeça, painel do alvo ao apontar (cor + como misturar), cor do boné/camisola, ajuda de pontaria. Debug: abrir index.html?debug expõe window.__ca.

