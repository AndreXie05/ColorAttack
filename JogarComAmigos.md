# 👥 Jogar ColorAttack com amigos

Não é preciso link nem conta. Basta que cada pessoa tenha o jogo no PC
e que tu lhe dês o **código da sala** (4 letras).

---

## 1. Preparar o jogo (só da primeira vez, ou quando o jogo mudar)

Os ficheiros do jogo estão na pasta `dist/`:

| Sistema do amigo | Ficheiro a mandar | O que ele faz |
|---|---|---|
| **Windows** | `ColorAttack-1.0.0-Windows.zip` | Descompacta o zip e abre o `ColorAttack.exe` |
| **Linux** | `ColorAttack-1.0.0-Linux.AppImage` | Clica com o botão direito → Propriedades → "Permitir executar", e depois abre |
| **Linux (instalar)** | `ColorAttack-1.0.0-Instalar-Linux.deb` | Abre com o instalador de aplicações |

Os ficheiros são grandes (100–160 MB): manda por **Google Drive**, **WeTransfer** ou pen.

> ⚠️ No Windows pode aparecer um aviso azul ("O Windows protegeu o PC").
> Carrega em **Mais informações → Executar mesmo assim**. Acontece porque o jogo não está "assinado"; não é vírus.

### Refazer os ficheiros depois de mudar o jogo

Tu e os teus amigos **têm de ter a mesma versão**. Sempre que o jogo mudar,
refaz os ficheiros e manda-os outra vez. No terminal, dentro da pasta do jogo:

```bash
npm run build:linux    # cria o .AppImage e o .deb
npm run build:win      # cria o .zip para Windows
```

(Ou pede ao Claude: "refaz os ficheiros do jogo".)

---

## 2. Jogar

**Tu (anfitrião, quem cria a sala):**
1. Abre o jogo e carrega em **ENTRAR**.
2. No lobby, carrega em **👥 Amigos**.
3. Escreve o teu nome e carrega em **➕ Criar sala**.
4. Aparece o **código da sala** (ex.: `HMEJ`). Carrega em **📋 Copiar** e manda-o aos amigos (WhatsApp, Discord…).
5. Quando os amigos aparecerem na lista, fecha a janela, carrega em **JOGAR** e escolhe o mapa.
   Os amigos entram contigo automaticamente.

**O amigo (convidado):**
1. Abre o jogo e carrega em **ENTRAR**.
2. Carrega em **👥 Amigos**.
3. Escreve o nome, mete o **código** e carrega em **Entrar**.
4. Espera: a partida começa sozinha quando o anfitrião escolher o mapa.

---

## 3. Bom saber

- Até **10 jogadores** (5 contra 5). Os lugares vazios ficam com **bots**.
- As equipas são feitas pela ordem de entrada: 1.º equipa A, 2.º equipa B, 3.º equipa A…
- Quem cria a sala (👑) escolhe o mapa, o modo, a dificuldade dos bots, o clima e as regras (na pausa, o botão do clima fica bloqueado para os outros).
- No fim de cada round, o round seguinte começa quando **alguém** avança: quem ganhou escolhe a melhoria, quem perdeu carrega em **Começar round** (o primeiro a avançar começa para todos; quem ainda não escolheu fica com uma melhoria à sorte).
- Quem entrar a meio de uma partida joga na **próxima**.
- Se o anfitrião sair, a sala fecha para todos.
- Todos precisam de **internet**. O jogo usa um servidor grátis só para os PCs se encontrarem;
  depois, os PCs falam diretamente entre si.
- A repetição da melhor jogada não aparece a jogar com amigos.

## 4. Se não der

| Problema | O que fazer |
|---|---|
| "Sala não encontrada" | Confirma o código (4 letras, sem I nem O) e se o anfitrião ainda tem a sala aberta |
| "Sem ligação ao servidor das salas" | Confirma a internet e tenta outra vez |
| Fica preso em "A entrar…" | Algumas redes (escola, empresa) bloqueiam ligações diretas. Experimenta outra rede (ex.: a do telemóvel) |
| Mapas ou coisas diferentes entre vocês | Versões diferentes do jogo: refaz os ficheiros e manda outra vez (ponto 1) |
