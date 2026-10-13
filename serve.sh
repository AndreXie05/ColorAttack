#!/bin/bash
# Arranca o servidor local (sem cache) e abre o jogo no navegador.
# Os módulos JS precisam de http, não de file://.  Uso:  ./serve.sh   (ou  ./serve.sh 8001  para outra porta)
cd "$(dirname "$0")"
PORT="${1:-8000}"
URL="http://localhost:$PORT"

abrir() {                                   # tenta os abridores habituais do Linux / macOS
  ( xdg-open "$URL" || sensible-browser "$URL" || gio open "$URL" || open "$URL" ) >/dev/null 2>&1 &
}

if (echo > "/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  echo "Já há um servidor na porta $PORT: a abrir o jogo em $URL"
  abrir
  exit 0
fi

echo "A arrancar o servidor em $URL  (Ctrl+C para parar)"
( sleep 1; abrir ) &
exec python3 serve.py "$PORT"
