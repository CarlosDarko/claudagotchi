// Galería de todas las etapas, formas y humores (HTML con SVG) para la documentación.
import { drawScene, drawCritter } from '../src/sprites.js'
import { canvasToSvg } from '../src/render.js'

const base = { poops: 0, xp: 1, alive: true, variant: 'normal', stats: { hambre: 70 } }
const noon = new Date(2026, 5, 1, 12).getTime()
const cases = [
  ['Huevo', { stage: 'huevo', xp: 1 }, 'huevo'], ['Bebé', { stage: 'bebe', seed: 2 }, 'feliz'], ['Peque', { stage: 'nino', seed: 3, poops: 2 }, 'sucio'],
  ['Adolescente', { stage: 'teen', seed: 4 }, 'trabajando'], ['Opusaurio constructor', { stage: 'adulto', form: 'opus', style: 'obras' }, 'normal'],
  ['Sonetín sabio', { stage: 'adulto', form: 'sonnet', style: 'sabio' }, 'feliz'], ['Haikoi hacker', { stage: 'adulto', form: 'haiku', style: 'hacker' }, 'hambriento'],
  ['Fabulín explorador', { stage: 'adulto', form: 'fable', style: 'explorador', variant: 'brillante' }, 'fuego'],
  ['Quimerilla director', { stage: 'adulto', form: 'mixto', style: 'director', variant: 'grunon' }, 'triste'],
  ['Leyenda', { stage: 'leyenda', form: 'opus', style: 'equilibrado' }, 'feliz'], ['Durmiendo', { stage: 'nino', seed: 5 }, 'dormido'],
  ['Enfermo', { stage: 'teen', seed: 6 }, 'enfermo'], ['En la nube', { stage: 'nube', alive: false }, 'nube'],
]
const mode = process.argv[2] || 'scene'
let html = '<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;background:#1b1a24;color:#e8e6f0;font:14px system-ui;display:grid;grid-template-columns:repeat(5,1fr);gap:14px">'
for (const [n, p, m] of cases) {
  const svg = mode === 'critter' ? canvasToSvg(drawCritter({ ...base, ...p }, m, 3).canvas, 4, '#3d4766') : canvasToSvg(drawScene({ ...base, ...p }, m, { frame: 3, now: noon }), 4)
  html += `<figure style="margin:0">${svg}<figcaption style="margin-top:4px">${n}</figcaption></figure>`
}
process.stdout.write(`${html}</body>`)
