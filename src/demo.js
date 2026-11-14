// Un paseo por todas las etapas y humores, con datos de mentira. Sirve para
// enseñar la mascota sin esperar semanas, y para las capturas de la documentación.
import { newPet, say } from './pet.js'
import { emptyIndex } from './logs.js'
import { dayKey } from './util.js'
import { t } from './i18n/index.js'

export function fakeIndex(now = Date.now(), { working = false } = {}) {
  const idx = emptyIndex()
  for (let i = 0; i < 30; i++) {
    const k = dayKey(now - i * 86400_000)
    const v = Math.round((Math.sin(i * 1.7) + 1.3) * 9e6 * (i % 7 === 5 ? 0.1 : 1))
    idx.days[k] = {
      tokens: v, food: Math.round(v * 0.12), out: Math.round(v * 0.02), msgs: 100,
      models: { opus: Math.round(v * 0.6), sonnet: Math.round(v * 0.3), haiku: Math.round(v * 0.1) },
      projects: { claudagotchi: Math.round(v * 0.5), 'mi-web': Math.round(v * 0.3), scripts: Math.round(v * 0.2) },
      hours: Array.from({ length: 24 }, (_, h) => (h > 8 && h < 21 ? Math.round(v / 12 * (1 + Math.sin(h))) : 0)),
    }
  }
  idx.lastActivity = working ? now - 5000 : now - 3600_000
  idx.workStart = now - 50 * 60_000
  idx.lastTool = 'Edit'
  for (let m = 0; m < 30; m++) idx.recent.push([now - m * 60_000, 180_000, 20_000])
  return idx
}

export function fakeLimits(now, pct, week = 34) {
  return {
    session: { pct, resetsAt: now + 2 * 3600_000 + 14 * 60_000 },
    week: { pct: week, resetsAt: now + 3 * 86400_000 },
    fetchedAt: now, source: 'demo', weeklyOnly: false,
  }
}

export const SCENES = [
  { stage: 'huevo', pct: 10, ev: 'ev.huevo' },
  { stage: 'bebe', pct: 12, ev: 'ev.eclosion', stats: { felicidad: 90 } },
  { stage: 'nino', pct: 38, working: true, ev: 'ev.comio' },
  { stage: 'nino', pct: 45, poops: 2, stats: { higiene: 25 }, ev: 'ev.caca' },
  { stage: 'teen', pct: 60, stats: { hambre: 12 }, ev: 'ev.critico.hambre' },
  { stage: 'teen', pct: 93, ev: 'ev.fuego', evVars: { pct: 93 } },
  { stage: 'adulto', form: 'opus', pct: 51, working: true, ev: 'ev.estirar', evVars: { dur: '1h 35m' } },
  { stage: 'adulto', form: 'sonnet', pct: 22, stats: { felicidad: 95 }, ev: 'act.caricia' },
  { stage: 'adulto', form: 'haiku', pct: 100, ev: 'ev.agotado', evVars: { hora: '18:40' } },
  { stage: 'adulto', form: 'fable', variant: 'brillante', pct: 30, sick: true, stats: { salud: 30 }, ev: 'ev.enfermo' },
  { stage: 'leyenda', form: 'opus', pct: 15, stats: { felicidad: 99 }, ev: 'ev.evoluciona', evVars: { label: 'Leyenda' } },
  { stage: 'nube', alive: false, pct: 0, ev: 'ev.muerte' },
]

export function demoFrame(i, now = Date.now()) {
  const sc = SCENES[i % SCENES.length]
  const pet = newPet({ now: now - 9 * 86400_000, name: 'Pixel' })
  Object.assign(pet, { stage: sc.stage, form: sc.form || null, variant: sc.variant || 'normal', poops: sc.poops || 0, sick: !!sc.sick, alive: sc.alive !== false, xp: 123e6, bocados: 7 })
  Object.assign(pet.stats, { hambre: 70, felicidad: 60, energia: 100 - sc.pct, salud: 90, higiene: 85 }, sc.stats || {})
  pet.streak.days = 12
  for (const id of ['eclosion', 'primer-bocado', 'nino', 'teen', 'millon', 'racha-7']) pet.achievements[id] = now - 86400_000
  if (!pet.alive) pet.graveyard.push({ name: 'Pixel', born: now - 9 * 86400_000, died: now, stage: 'teen', xp: 40e6, generation: 1 })
  say(pet, t(sc.ev, { name: 'Pixel', gen: 2, ...(sc.evVars || {}) }), sc.ev.includes('critico') || sc.ev === 'ev.fuego' ? 'aviso' : 'info', now)
  return { pet, index: fakeIndex(now, { working: !!sc.working }), limits: fakeLimits(now, sc.pct) }
}

export function demoIterator() {
  let i = 0
  return { next: () => demoFrame(i++) }
}
