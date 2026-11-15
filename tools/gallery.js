// Galería de todas las etapas, formas y humores (HTML con SVG) para la documentación.
import { drawScene, drawCritter } from '../src/sprites.js'
import { canvasToSvg } from '../src/render.js'

const base = { poops: 0, xp: 1, alive: true, variant: 'normal', stats: { hambre: 70 } }
const noon = new Date(2026, 5, 1, 12).getTime()
const cases = [
  ['Huevo', { stage: 'huevo' }, 'huevo'], ['Bebé', { stage: 'bebe' }, 'feliz'], ['Peque', { stage: 'nino', poops: 2 }, 'sucio'],
  ['Adolescente', { stage: 'teen' }, 'trabajando'], ['Opusaurio', { stage: 'adulto', form: 'opus' }, 'normal'],
  ['Sonetín', { stage: 'adulto', form: 'sonnet' }, 'feliz'], ['Haikoi', { stage: 'adulto', form: 'haiku' }, 'hambriento'],
  ['Fabulín brillante', { stage: 'adulto', form: 'fable', variant: 'brillante' }, 'fuego'],
  ['Quimerilla gruñona', { stage: 'adulto', form: 'mixto', variant: 'grunon' }, 'triste'],
  ['Leyenda', { stage: 'leyenda', form: 'opus' }, 'feliz'], ['Durmiendo', { stage: 'nino' }, 'dormido'],
  ['Enfermo', { stage: 'teen' }, 'enfermo'], ['En la nube', { stage: 'nube', alive: false }, 'nube'],
]
const mode = process.argv[2] || 'scene'
let html = '<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;background:#1b1a24;color:#e8e6f0;font:14px system-ui;display:grid;grid-template-columns:repeat(5,1fr);gap:14px">'
for (const [n, p, m] of cases) {
  const svg = mode === 'critter' ? canvasToSvg(drawCritter({ ...base, ...p }, m, 3).canvas, 4, '#3d4766') : canvasToSvg(drawScene({ ...base, ...p }, m, { frame: 3, now: noon }), 4)
  html += `<figure style="margin:0">${svg}<figcaption style="margin-top:4px">${n}</figcaption></figure>`
}
process.stdout.write(`${html}</body>`)
