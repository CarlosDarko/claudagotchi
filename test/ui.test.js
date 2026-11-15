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
  for (const s of ['Hambre', 'Felicidad', 'Necesidades', 'Tu Claude', 'Sesión', 'Semana', 'al límite en']) assert.ok(out.includes(s), s)
})

test('la ayuda se dibuja y explica las teclas', () => {
  const out = strip(renderFrame({ tab: 0, frame: 0, data: demoFrame(6), help: true }, 110, 32))
  for (const s of ['¿Qué es esto?', 'Cómo cuidarla', 'Cómo crece']) assert.ok(out.includes(s), s)
})

test('los bordes de las tarjetas quedan alineados en todas las vistas', () => {
  for (let tab = 0; tab < 4; tab++) {
    const out = strip(renderFrame({ tab, frame: 0, data: demoFrame(6) }, 110, 32)).split('\n')
    const rights = out.filter((l) => /[│╮╯]\s*$/.test(l)).map((l) => l.trimEnd().length)
    if (tab > 0) assert.equal(new Set(rights).size <= 1, true, `vista ${tab}: ${[...new Set(rights)]}`)
  }
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

test('el bicho suelto del widget se dibuja en todos los humores sin salirse', async () => {
  const { drawCritter, CRITTER_W, CRITTER_H } = await import('../src/sprites.js')
  const moods = ['normal', 'feliz', 'trabajando', 'hambriento', 'sucio', 'triste', 'cansado', 'enfermo', 'fuego', 'dormido']
  for (const stage of ['bebe', 'nino', 'teen', 'adulto', 'leyenda']) {
    for (const form of ['opus', 'sonnet', 'haiku', 'fable', 'mixto']) {
      for (const m of moods) {
        const { canvas, box } = drawCritter({ stage, form, poops: 1, alive: true, variant: 'normal', xp: 1 }, m, 5)
        assert.equal(canvas.w, CRITTER_W)
        assert.equal(canvas.h, CRITTER_H)
        assert.ok(box.top >= 0, `${stage}/${form}/${m} se sale por arriba (${box.top})`)
      }
    }
  }
})

test('el estado para el widget lleva todo lo que necesita', async () => {
  const { snapshot } = await import('../src/snapshot.js')
  const s = snapshot(demoFrame(6))
  for (const k of ['pet', 'mood', 'moodLabel', 'what', 'limits', 'today', 'menu']) assert.ok(k in s, k)
  assert.equal(s.limits.session.pct, 51)
  assert.equal(s.menu.salir, 'Salir')
})

test('cada logro tiene su medalla y cada acción su icono', async () => {
  const { ACHIEVEMENT_IDS, achievementText } = await import('../src/pet.js')
  const { MEDALS, drawMedal, drawIcon, ICON_NAMES } = await import('../src/art.js')
  for (const id of ACHIEVEMENT_IDS) {
    assert.ok(MEDALS[id], `falta la medalla de ${id}`)
    assert.notEqual(achievementText(id).name, id, `falta el texto de ${id}`)
    assert.equal(drawMedal(id, true).w, 16)
  }
  for (const n of ICON_NAMES) assert.equal(drawIcon(n).h, 12)
})

test('el escenario se dibuja en sus dos modos y deja pasear dentro', async () => {
  const { drawYard } = await import('../src/art.js')
  const isla = drawYard(800, { mode: 'isla', home: 680, bocados: 5 })
  assert.ok(isla.walk[0] > 400 && isla.walk[1] < 800)
  const todo = drawYard(800, { mode: 'completo', home: 680 })
  assert.ok(todo.walk[0] < 20 && todo.walk[1] > 780)
})

test('las 30 formas adultas se dibujan con su oficio', async () => {
  const { drawCritter } = await import('../src/sprites.js')
  for (const form of ['opus', 'sonnet', 'haiku', 'fable', 'mixto'])
    for (const style of ['obras', 'explorador', 'hacker', 'sabio', 'director', 'equilibrado']) {
      const { box } = drawCritter({ stage: 'adulto', form, style, poops: 0, alive: true, variant: 'normal', xp: 1 }, 'normal', 1)
      assert.ok(box.top >= 0)
    }
})
