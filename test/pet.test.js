import test from 'node:test'
import assert from 'node:assert/strict'
import { newPet, tick, act, reincarnate, mood, dominantForm, RULES } from '../src/pet.js'
import { emptyIndex } from '../src/logs.js'

const H = 3600_000
const T0 = Date.UTC(2026, 0, 10, 10)

function feed(index, food, model = 'opus') {
  index.totals.food += food
  index.totals.models[model] = (index.totals.models[model] || 0) + food
}

function hatched(now = T0) {
  const idx = emptyIndex()
  const p = newPet({ now, index: idx, name: 'Test' })
  feed(idx, 300_000)
  tick(p, { index: idx, now: now + 20 * 60_000 })
  return { p, idx, now: now + 20 * 60_000 }
}

test('el huevo no eclosiona con poco: necesita tokens y un rato', () => {
  const idx = emptyIndex()
  const p = newPet({ now: T0, index: idx })
  feed(idx, 1000)
  tick(p, { index: idx, now: T0 + 20 * 60_000 })
  assert.equal(p.stage, 'huevo')
})

test('el huevo eclosiona cuando come y pasan unos minutos', () => {
  const { p } = hatched()
  assert.equal(p.stage, 'bebe')
  assert.ok(p.achievements.eclosion)
  assert.match(p.events.at(-1).text, /Test/)
})

test('los tokens nuevos llenan la saciedad y dan bocados', () => {
  const { p, idx, now } = hatched()
  p.stats.hambre = 20
  const b0 = p.bocados
  feed(idx, 40 * RULES.foodPerPoint)
  tick(p, { index: idx, now: now + 1000 })
  assert.ok(p.stats.hambre > 55, `hambre ${p.stats.hambre}`)
  assert.ok(p.bocados > b0)
  assert.ok(p.xp >= 40 * RULES.foodPerPoint)
})

test('pasa hambre con el tiempo, pero hiberna después de 12 h', () => {
  const { p, idx, now } = hatched()
  tick(p, { index: idx, now: now + 6 * H })
  const after6 = p.stats.hambre
  assert.ok(after6 < 80 - 20)
  const q = hatched().p
  tick(q, { index: idx, now: now + 5 * 24 * H })
  assert.ok(q.alive, 'no muere en un fin de semana sin abrirlo')
  assert.match(q.events.map((e) => e.text).join(' '), /Hiberné/)
})

test('las cacas bajan la higiene y limpiar las quita', () => {
  const { p, idx, now } = hatched()
  feed(idx, RULES.tokensPerPoop * 2)
  tick(p, { index: idx, now: now + 1000 })
  assert.equal(p.poops, 2)
  const r = act(p, 'limpiar', now + 2000)
  assert.ok(r.ok)
  assert.equal(p.poops, 0)
})

test('la energía es el reverso del % de la sesión', () => {
  const { p, idx, now } = hatched()
  const limits = { session: { pct: 70, resetsAt: now + 2 * H }, week: { pct: 10 } }
  tick(p, { index: idx, limits, now: now + H })
  assert.ok(Math.abs(p.stats.energia - 30) < 2, `energia ${p.stats.energia}`)
})

test('al 90 % de la sesión avisa una vez y al 100 % se duerme', () => {
  const { p, idx, now } = hatched()
  const L = (pct) => ({ session: { pct, resetsAt: now + 2 * H }, week: { pct: 10 } })
  tick(p, { index: idx, limits: L(92), now: now + 1000 })
  tick(p, { index: idx, limits: L(95), now: now + 2000 })
  assert.equal(p.events.filter((e) => e.kind === 'fuego').length, 1)
  assert.equal(mood(p, { index: idx, limits: L(95), now: now + 2000 }), 'fuego')
  tick(p, { index: idx, limits: L(100), now: now + 3000 })
  assert.equal(mood(p, { index: idx, limits: L(100), now: now + 3000 }), 'dormido')
  assert.ok(p.achievements['al-limite'])
})

test('enferma si se descuida, la medicina lo cura y sin cuidados acaba en la nube', () => {
  const { p, idx, now } = hatched()
  p.stats.hambre = 0
  p.stats.higiene = 0
  tick(p, { index: idx, now: now + 10 * H })
  assert.ok(p.sick)
  const r = act(p, 'medicina', now + 10 * H)
  assert.ok(r.ok)
  assert.equal(act(p, 'medicina', now + 10 * H + 1000).ok, false, 'tiene espera')
  let t = now + 10 * H
  for (let i = 0; i < 10 && p.alive; i++) {
    t += 12 * H - 1
    p.stats.hambre = 0
    p.stats.higiene = 0
    tick(p, { index: idx, now: t })
  }
  assert.equal(p.alive, false)
  assert.equal(p.graveyard.length, 1)
  const egg = reincarnate(p, { now: t, index: idx })
  assert.equal(egg.stage, 'huevo')
  assert.equal(egg.generation, 2)
  assert.equal(egg.graveyard.length, 1)
  assert.ok(egg.achievements.reencarnacion)
})

test('evoluciona por tokens y edad, y la forma adulta sale de su dieta', () => {
  const { p, idx } = hatched()
  let t = T0
  const steps = [['nino', 3e6, 13], ['teen', 20e6, 49], ['adulto', 70e6, 121]]
  for (const [stage, food, ageH] of steps) {
    feed(idx, food, 'sonnet')
    t = T0 + ageH * H
    p.lastTick = t - 1000
    tick(p, { index: idx, now: t })
    assert.equal(p.stage, stage)
  }
  assert.equal(p.form, 'sonnet')
  assert.equal(p.style, 'equilibrado')
  assert.ok(Object.keys(p.collection).includes('sonnet-equilibrado'))
  assert.ok(['brillante', 'normal', 'grunon'].includes(p.variant))
})

test('dieta variada da Quimerilla', () => {
  assert.equal(dominantForm({ opus: 50, sonnet: 50 }), 'mixto')
  assert.equal(dominantForm({ haiku: 90, opus: 10 }), 'haiku')
  assert.equal(dominantForm({}), 'mixto')
})

test('las acciones gastan bocados y respetan los límites', () => {
  const { p, now } = hatched()
  p.stats.hambre = 50
  p.bocados = 1
  assert.ok(act(p, 'comer', now).ok)
  assert.equal(p.bocados, 0)
  assert.equal(act(p, 'comer', now).ok, false)
  assert.ok(act(p, 'jugar', now, 4).ok)
  assert.equal(p.care.wins, 1)
  assert.ok(act(p, 'luces', now).ok)
  assert.equal(p.lights, false)
  assert.equal(mood(p, { index: emptyIndex(), now }), 'dormido')
})

test('un huevo no se puede alimentar a mano', () => {
  const p = newPet({ now: T0, index: emptyIndex() })
  assert.equal(act(p, 'comer', T0).ok, false)
})

test('el oficio sale de las herramientas que usa Claude', async () => {
  const { dominantStyle, formLabel } = await import('../src/pet.js')
  assert.equal(dominantStyle({ obras: 80, explorador: 30, hacker: 10 }), 'obras')
  assert.equal(dominantStyle({ obras: 30, explorador: 30, hacker: 30, sabio: 30 }), 'equilibrado')
  assert.equal(dominantStyle({ hacker: 3 }), 'equilibrado')
  assert.equal(formLabel({ stage: 'adulto', form: 'opus', style: 'hacker', variant: 'brillante' }), 'Opusaurio hacker brillante')
})

test('cuenta las herramientas de Claude durante su vida', () => {
  const { p, idx, now } = hatched()
  idx.totals.tools = { obras: 40, hacker: 2 }
  tick(p, { index: idx, now: now + 1000 })
  idx.totals.tools = { obras: 140, hacker: 12 }
  tick(p, { index: idx, now: now + 2000 })
  assert.equal(p.styles.obras, 140)
  assert.equal(p.styles.hacker, 12)
})
