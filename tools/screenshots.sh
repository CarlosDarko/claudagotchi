#!/usr/bin/env bash
# Regenera las capturas de docs/img (necesita Playwright con Chromium).
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
export CLAUDAGOTCHI_TRUECOLOR=1 CLAUDAGOTCHI_HOME="$tmp/home"
shot() { node bin/claudagotchi.js foto "${4:-110}" "$3" $2 | node tools/ansi2html.js > "$tmp/$1.html"; node tools/shot.cjs "$tmp/$1.html" "docs/img/$1.png" $(( ${4:-110} * 9 + 40 )) 300; }
shot principal "--demo 6" 26
shot ayuda "--demo 6 --ayuda" 30
shot compacta "--demo 4" 24 80
shot dormido "--demo 8" 26
shot fuego "--demo 5" 26
shot uso "--demo 6 --uso" 30
shot logros "--demo 6 --logros" 28
node tools/gallery.js > "$tmp/galeria.html"
node tools/shot.cjs "$tmp/galeria.html" docs/img/galeria.png 1000 300
echo "Capturas en docs/img"

# El widget de escritorio en el navegador, sobre un fondo de escritorio
node widget/build.mjs >/dev/null
node --input-type=module -e "
import { demoFrame } from './src/demo.js'; import { snapshot } from './src/snapshot.js'; import fs from 'node:fs'
const f = demoFrame(6)
f.pet.collection = { 'opus-obras': 1, 'sonnet-sabio': 1, 'haiku-hacker': 1, 'mixto-equilibrado': 1, 'fable-explorador': 1 }
for (const id of ['manos-a-la-obra', 'chef', 'finde', 'fenix']) f.pet.achievements[id] = Date.now()
const s = snapshot(f); s.widget = { scale: 2, showBadge: true, scene: 'isla' }
fs.writeFileSync('widget/dist/mock.json', JSON.stringify(s))"
node tools/widget-preview.cjs widget/dist/mock.json docs/img/widget.png idle
node tools/widget-preview.cjs widget/dist/mock.json docs/img/widget-tarjeta.png mascota
node tools/widget-preview.cjs widget/dist/mock.json docs/img/widget-logros.png logros
node tools/widget-preview.cjs widget/dist/mock.json docs/img/widget-coleccion.png coleccion
node tools/gallery.js critter > "$tmp/mascotas.html" && node tools/shot.cjs "$tmp/mascotas.html" docs/img/mascotas.png 1200 300
