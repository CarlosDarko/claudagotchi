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

# La mascota de escritorio (pasea por encima de la barra de tareas)
WIDGET=""
if [ -z "${CLAUDAGOTCHI_SIN_WIDGET:-}" ]; then
  base="https://github.com/$REPO/releases/latest/download"
  if [ "$os" = darwin ]; then
    mkdir -p "$HOME/Applications"
    if curl -fsSL "$base/Claudagotchi-macos-$arch.app.tar.gz" | tar -xz -C "$HOME/Applications" 2>/dev/null; then
      WIDGET="$HOME/Applications/Claudagotchi.app"
      ok "Mascota de escritorio en $WIDGET"
      open "$WIDGET" || true
    fi
  elif [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && [ "$arch" = x64 ]; then
    if curl -fsSL "$base/Claudagotchi-linux-x64.AppImage" -o "$DIR/Claudagotchi.AppImage"; then
      chmod +x "$DIR/Claudagotchi.AppImage"
      WIDGET="$DIR/Claudagotchi.AppImage"
      ok "Mascota de escritorio en $WIDGET"
      (nohup "$WIDGET" >/dev/null 2>&1 &) || true
    fi
  fi
fi

echo
c "Listo. Tu mascota ya vive en la barra de abajo de Claude Code."
if [ -n "$WIDGET" ]; then
  echo "Y en tu escritorio: pasea por encima de la barra de tareas. Pasa el ratón por encima para verla, clic para cuidarla."
  echo "Sus opciones están en el icono junto al reloj."
fi
echo "Para la vista completa en la terminal, abre una nueva y escribe: claudagotchi"
echo

# Sin mascota de escritorio, la abrimos en la terminal para que la conozcas
if [ -z "$WIDGET" ] && [ -z "${CLAUDAGOTCHI_NO_OPEN:-}" ] && [ -e /dev/tty ] && [ -t 1 ]; then
  sleep 1
  "$BIN" < /dev/tty
fi
