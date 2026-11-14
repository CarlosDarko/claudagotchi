#!/usr/bin/env bash
# Regenera las capturas de docs/img (necesita Playwright con Chromium).
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
export CLAUDAGOTCHI_TRUECOLOR=1 CLAUDAGOTCHI_HOME="$tmp/home"
shot() { node bin/claudagotchi.js foto 110 "$3" $2 | node tools/ansi2html.js > "$tmp/$1.html"; node tools/shot.cjs "$tmp/$1.html" "docs/img/$1.png" 1000 300; }
shot principal "--demo 6" 25
shot dormido "--demo 8" 22
shot fuego "--demo 5" 22
shot uso "--demo 6 --uso" 24
shot logros "--demo 6 --logros" 24
node tools/gallery.js > "$tmp/galeria.html"
node tools/shot.cjs "$tmp/galeria.html" docs/img/galeria.png 1000 300
echo "Capturas en docs/img"
