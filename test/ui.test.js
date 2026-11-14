import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ui-'))
process.env.CLAUDAGOTCHI_HOME = path.join(tmp, 'data')
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude')
process.env.NO_COLOR = '1'
const { renderFrame } = await import('../src/tui.js')
const { renderStatusline } = await import('../src/statusline.js')
const { demoFrame, SCENES } = await import('../src/demo.js')
const { install, uninstall } = await import('../src/install.js')
const { t, setLocale } = await import('../src/i18n/index.js')
const { drawScene } = await import('../src/sprites.js')
const { canvasToSvg } = await import('../src/render.js')

const strip = (s) => s.replace(/\x1b\[[0-9;]*[mKH]/g, '')

test('cada escena de la demo se dibuja sin romperse en las cuatro vistas', () => {
  for (let i = 0; i < SCENES.length; i++) {
    const data = demoFrame(i)
    for (let tab = 0; tab < 4; tab++) {
      const out = strip(renderFrame({ tab, frame: i, data, game: null }, 110, 32))
      assert.ok(out.includes('Pixel'))
      assert.ok(out.split('\n').length <= 32)
    }
  }
})

test('la vista principal enseña necesidades, sesión y semana', () => {
  const out = strip(renderFrame({ tab: 0, frame: 0, data: demoFrame(6), game: null }, 110, 32))
  for (const s of ['Hambre', 'Felicidad', 'Sesión 5 h', 'Semana', 'hasta el límite']) assert.ok(out.includes(s), s)
})

test('terminal demasiado pequeña: aviso en vez de dibujo roto', () => {
  assert.match(renderFrame({ tab: 0, frame: 0, data: demoFrame(0) }, 40, 10), /más grande/)
})

test('la statusline cabe en una línea más el bocadillo', () => {
  const data = demoFrame(5)
  const out = strip(renderStatusline({ ...data, width: 100 }))
  const lines = out.split('\n')
  assert.ok(lines.length <= 2)
  assert.match(lines[0], /Pixel/)
  assert.match(lines[0], /5h .* 93%/)
})

test('instalar guarda la statusline anterior y desinstalar la devuelve', () => {
  const settings = path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json')
  fs.mkdirSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true })
  fs.writeFileSync(settings, JSON.stringify({ model: 'opus', statusLine: { type: 'command', command: 'mi-script.sh' } }))
  install()
  let s = JSON.parse(fs.readFileSync(settings, 'utf8'))
  assert.match(s.statusLine.command, /claudagotchi/)
  assert.equal(s.model, 'opus')
  uninstall()
  s = JSON.parse(fs.readFileSync(settings, 'utf8'))
  assert.equal(s.statusLine.command, 'mi-script.sh')
})

test('i18n: un idioma desconocido cae al castellano y las variables se rellenan', () => {
  assert.equal(setLocale('xx'), 'es')
  assert.equal(t('act.gana', { wins: 4 }), '🎉 ¡Ganamos! 4/5 aciertos.')
  assert.equal(t('clave.que.no.existe'), 'clave.que.no.existe')
})

test('los sprites se exportan a SVG', () => {
  const svg = canvasToSvg(drawScene(demoFrame(6).pet, 'feliz', { frame: 1 }))
  assert.match(svg, /^<svg/)
  assert.ok(svg.length > 1000)
})
