import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ex-'))
process.env.CLAUDAGOTCHI_HOME = path.join(tmp, 'data')
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude')
const { newPet, tick, act, secretForm, holidayOf, seasonOf, reincarnate, PERSONALITIES } = await import('../src/pet.js')
const { emptyIndex } = await import('../src/logs.js')
const { GEAR, DECOR, priceOf } = await import('../src/items.js')
const { hasGear, hasDecor } = await import('../src/gear.js')
const { installHooks, uninstallHooks, handleHook, lastClaudeEvent, hooksInstalled } = await import('../src/hooks.js')
const { tmap } = await import('../src/i18n/index.js')

const T0 = Date.UTC(2026, 5, 10, 12)
const adult = () => {
  const idx = emptyIndex()
  const p = newPet({ now: T0, index: idx })
  p.stage = 'adulto'
  return { p, idx }
}

test('hay muchos accesorios y decoraciones, todos dibujados y con nombre', () => {
  assert.ok(GEAR.length >= 40)
  assert.ok(DECOR.length >= 20)
  const names = tmap('item')
  for (const [id] of GEAR) assert.ok(hasGear(id), `falta el dibujo de ${id}`), assert.ok(names[id], `falta el nombre de ${id}`)
  for (const [id] of DECOR) assert.ok(hasDecor(id), `falta el dibujo de ${id}`), assert.ok(names[id], `falta el nombre de ${id}`)
})

test('la tienda cobra en bocados, se pone y se quita, y no vende los regalos', () => {
  const { p } = adult()
  p.bocados = 10
  assert.equal(act(p, 'comprar', T0, 'chistera').ok, false, 'cuesta 18')
  assert.ok(act(p, 'comprar', T0, 'gorra').ok)
  assert.equal(p.bocados, 10 - priceOf('gorra'))
  assert.equal(p.gear.cabeza, 'gorra')
  assert.ok(act(p, 'usar', T0, 'gorra').ok)
  assert.equal(p.gear.cabeza, null)
  assert.equal(act(p, 'comprar', T0, 'papa-noel').ok, false)
  assert.ok(act(p, 'comprar', T0, 'setas').ok)
  assert.deepEqual(p.decor, ['setas'])
})

test('el inventario pasa a la siguiente generación', () => {
  const { p, idx } = adult()
  p.bocados = 50
  act(p, 'comprar', T0, 'capa')
  const egg = reincarnate(p, { now: T0, index: idx })
  assert.ok(egg.owned.capa)
  assert.equal(egg.gear.espalda, 'capa')
})

test('se le puede poner nombre, también al huevo', () => {
  const p = newPet({ now: T0, index: emptyIndex() })
  assert.ok(act(p, 'nombre', T0, 'Turrón').ok)
  assert.equal(p.name, 'Turrón')
  assert.equal(p.stage, 'huevo')
})

test('cada mascota tiene personalidad', () => {
  const { p } = adult()
  assert.ok(PERSONALITIES.includes(p.personality))
  assert.ok(tmap('chatter')[p.personality].length >= 3)
})

test('formas secretas con condiciones raras', () => {
  assert.equal(secretForm({ nightFood: 80, dayFood: 20, diet: {}, styles: {}, care: { pets: 0 }, xp: 0 }), 'buho')
  assert.equal(secretForm({ nightFood: 0, dayFood: 1, diet: {}, styles: { hacker: 90, obras: 10 }, care: { pets: 0 }, xp: 0 }), 'robot')
  assert.equal(secretForm({ nightFood: 0, dayFood: 1, diet: {}, styles: {}, care: { pets: 200 }, xp: 0 }), 'michi')
  assert.equal(secretForm({ nightFood: 0, dayFood: 1, diet: { opus: 40, sonnet: 30, haiku: 30 }, styles: {}, care: { pets: 0 }, xp: 0 }), 'arcoiris')
  assert.equal(secretForm({ nightFood: 0, dayFood: 1, diet: { opus: 100 }, styles: {}, care: { pets: 0 }, xp: 0 }), null)
})

test('Navidad trae regalos una vez y el cumplemés su tarta', () => {
  const xmas = Date.UTC(2026, 11, 20, 12)
  assert.equal(holidayOf(xmas), 'navidad')
  assert.equal(seasonOf(xmas, 40), 'invierno')
  assert.equal(seasonOf(xmas, -33), 'verano')
  const idx = emptyIndex()
  const p = newPet({ now: xmas - 45 * 86400_000, index: idx })
  p.stage = 'bebe'
  p.lastTick = xmas - 1000
  tick(p, { index: idx, now: xmas })
  assert.ok(p.owned['papa-noel'] && p.owned['arbol-navidad'])
  assert.ok(p.owned.tarta, 'cumplemés')
  const n = Object.keys(p.owned).length
  tick(p, { index: idx, now: xmas + 1000 })
  assert.equal(Object.keys(p.owned).length, n)
})

test('una visita al día', () => {
  const idx = emptyIndex()
  const day = Date.UTC(2026, 5, 10, 21)
  const p = newPet({ now: day - 86400_000, index: idx })
  p.stage = 'bebe'
  p.lastTick = day - 1000
  tick(p, { index: idx, now: day })
  assert.ok(p.visit, 'ha venido alguien')
  const v = p.visit
  tick(p, { index: idx, now: day + 60_000 })
  assert.equal(p.visit.at, v.at)
})

test('reacciona a los tests y commits que lanza Claude', () => {
  const { p, idx } = adult()
  idx.codeEvents = [{ ts: T0 + 1000, kind: 'test', ok: true }, { ts: T0 + 2000, kind: 'commit', ok: true }]
  p.lastTick = T0
  tick(p, { index: idx, now: T0 + 3000 })
  assert.equal(p.codeStats.commits, 1)
  assert.equal(p.codeStats.testsOk, 1)
  assert.ok(p.achievements['primer-commit'])
})

test('los avisos de Claude Code se instalan sin pisar tus hooks y se guardan', () => {
  fs.mkdirSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true })
  const file = path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json')
  fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'mio.sh' }] }] } }))
  installHooks()
  installHooks() // dos veces: no se duplica
  assert.ok(hooksInstalled())
  const s = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(s.hooks.Stop.length, 2)
  handleHook('notificacion', { message: 'Claude needs your permission to use Bash', cwd: '/x/web' })
  assert.equal(lastClaudeEvent().kind, 'permiso')
  assert.equal(lastClaudeEvent().project, 'web')
  uninstallHooks()
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop[0].hooks[0].command, 'mio.sh')
})
