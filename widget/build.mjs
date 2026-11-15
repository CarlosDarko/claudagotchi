// Empaqueta la interfaz del widget en widget/dist (un solo main.js, sin dependencias).
// Uso: node widget/build.mjs   (necesita bun para empaquetar)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, 'dist')
fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })
execFileSync('bun', ['build', path.join(here, 'ui', 'main.js'), '--outdir', dist, '--minify', '--target', 'browser'], { stdio: 'inherit' })
fs.copyFileSync(path.join(here, 'ui', 'index.html'), path.join(dist, 'index.html'))
console.log('widget/dist listo')
