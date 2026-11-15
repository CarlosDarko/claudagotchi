#!/usr/bin/env bash
# Instalador de Claudagotchi para macOS y Linux. No necesita Node.
#   curl -fsSL https://raw.githubusercontent.com/CarlosDarko/claudagotchi/main/install.sh | bash
set -euo pipefail

REPO="CarlosDarko/claudagotchi"
DIR="${CLAUDAGOTCHI_BIN_DIR:-$HOME/.claudagotchi/bin}"
c() { printf '\033[38;5;209m%s\033[0m\n' "$1"; }
ok() { printf '\033[38;5;114m✓\033[0m %s\n' "$1"; }

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) echo "Este instalador es para macOS y Linux. En Windows usa install.ps1 (mira el README)."; exit 1 ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) echo "Procesador no soportado: $(uname -m)"; exit 1 ;;
esac

c "🥚 Instalando Claudagotchi..."
mkdir -p "$DIR"
url="https://github.com/$REPO/releases/latest/download/claudagotchi-$os-$arch.tar.gz"
if curl -fsSL "$url" | tar -xz -C "$DIR" 2>/dev/null; then
  chmod +x "$DIR/claudagotchi"
  BIN="$DIR/claudagotchi"
  ok "Descargado en $DIR"
elif command -v npm >/dev/null 2>&1; then
  # Plan B si todavía no hay versión publicada: con Node instalado
  npm install -g --silent "github:$REPO"
  BIN="$(command -v claudagotchi)"
  ok "Instalado con npm"
else
  echo "No he podido descargarlo. Revisa tu conexión y vuelve a probar."
  exit 1
fi

# Que el comando 'claudagotchi' funcione en las terminales nuevas
if [ "$BIN" = "$DIR/claudagotchi" ] && ! printf '%s' ":$PATH:" | grep -q ":$DIR:"; then
  line="export PATH=\"$DIR:\$PATH\""
  for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
    if [ -f "$rc" ] || [ "$rc" = "$HOME/.zshrc" -a "$(basename "${SHELL:-}")" = zsh ]; then
      grep -qsF "$DIR" "$rc" || printf '\n# Claudagotchi\n%s\n' "$line" >> "$rc"
    fi
  done
fi

"$BIN" instalar
echo
c "Listo. Tu mascota ya vive en la barra de abajo de Claude Code."
echo "Para verla en grande, abre una terminal nueva y escribe: claudagotchi"
echo

# Abrirla ahora mismo, si hay una terminal donde dibujar
if [ -z "${CLAUDAGOTCHI_NO_OPEN:-}" ] && [ -e /dev/tty ] && [ -t 1 ]; then
  sleep 1
  "$BIN" < /dev/tty
fi
