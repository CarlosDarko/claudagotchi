// El estado de la mascota en JSON, para el widget de escritorio. El widget no lee
// ficheros: llama a "claudagotchi json" y "claudagotchi accion <x>" y dibuja.
import { mood, MOOD_LABEL, STAGE_LABEL, FORM_LABEL, formLabel, latestEvent } from './pet.js'
import { burnRate, isWorking, toolKind } from './logs.js'
import { getLocale, tmap } from './i18n/index.js'
import { dayKey } from './util.js'
import { projection, needHint } from './tui.js'
import { loadConfig } from './store.js'
import { lastError } from './account.js'
import { isInstalled } from './install.js'
import { RULES, ACHIEVEMENT_IDS } from './pet.js'

export function snapshot({ pet, index, limits }, now = Date.now()) {
  const m = mood(pet, { index, limits, now })
  const today = index.days[dayKey(now)] || { tokens: 0, food: 0 }
  const ev = latestEvent(pet, now, 2 * 60_000)
  const kind = toolKind(index.lastTool)
  const proj = projection(index, limits, now)
  return {
    v: 1,
    now,
    locale: getLocale(),
    pet: {
      name: pet.name, stage: pet.stage, form: pet.form, variant: pet.variant, alive: pet.alive, poops: pet.poops,
      sick: pet.sick, lights: pet.lights, xp: pet.xp, bocados: pet.bocados, born: pet.born, generation: pet.generation,
      stats: pet.stats, streak: pet.streak.days, seed: pet.seed, style: pet.style, night: !!pet.night,
      styles: pet.styles || {}, diet: pet.diet || {},
    },
    achievements: pet.achievements || {},
    achievementIds: ACHIEVEMENT_IDS,
    collection: pet.collection || {},
    egg: pet.stage === 'huevo' ? { need: RULES.evolve.bebe.xp, have: pet.xp, ageMin: (now - pet.born) / 60000, minAge: RULES.evolve.bebe.ageH * 60 } : null,
    limitsReason: limits ? null : lastError(),
    mood: m,
    moodLabel: MOOD_LABEL[m],
    what: formLabel(pet),
    hint: needHint(pet, limits),
    event: ev ? { ts: ev.ts, text: ev.text, kind: ev.kind } : null,
    limits: limits
      ? { session: limits.weeklyOnly ? null : limits.session, week: limits.week, weeklyOnly: !!limits.weeklyOnly, stale: !!limits.stale, fetchedAt: limits.fetchedAt }
      : null,
    projection: proj,
    today: { tokens: today.tokens, food: today.food },
    working: isWorking(index, now),
    activity: kind ? tmap('tool')[kind] : null,
    rate: burnRate(index, now, 5),
    widget: loadConfig().widget || {},
    menu: tmap('menu'),
    escenarios: tmap('w.escenario'),
    statusline: isInstalled(),
  }
}
