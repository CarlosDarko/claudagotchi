// La simulación de la mascota. Todo es puro: recibe el estado, el índice de uso,
// los límites de la cuenta y la hora, y devuelve el estado nuevo. Así se puede
// probar sin relojes ni ficheros.
import { clamp, dayKey, fmtTokens, fmtDuration, fmtClock, hashStr } from './util.js'
import { t, tmap } from './i18n/index.js'
import { buy, use, gift, ensureInventory, gearCount, isItem } from './items.js'

// Personalidad: cambia cómo bajan sus necesidades, sus frases y lo que hace en el escritorio
export const PERSONALITIES = ['dormilon', 'gloton', 'jugueton', 'presumido', 'tranquilo', 'curioso', 'mimoso', 'travieso']
const TRAIT = {
  dormilon: { energia: 1.3 },
  gloton: { hambre: 1.3 },
  jugueton: { felicidad: 1.25 },
  presumido: {},
  tranquilo: { hambre: 0.85, felicidad: 0.85, higiene: 0.85 },
  curioso: {},
  mimoso: { felicidad: 1.15 },
  travieso: { higiene: 1.3 },
}
export const SECRET_FORMS = ['buho', 'robot', 'michi', 'dorado', 'arcoiris']

export const STAGES = ['huevo', 'bebe', 'nino', 'teen', 'adulto', 'leyenda']
export const STAGE_LABEL = new Proxy({}, { get: (_, k) => tmap('stage')[k] })
export const FORM_LABEL = new Proxy({}, { get: (_, k) => tmap('form')[k] })

// Reglas de juego. Todo junto para poder equilibrarlo en un sitio.
export const RULES = {
  maxCatchUpH: 12, // si nadie lo mira más de 12 h, hiberna: no se muere en tu fin de semana
  stepMin: 15,
  foodPerPoint: 40_000, // 40k tokens nuevos = 1 punto de saciedad
  tokensPerBocado: 150_000,
  tokensPerPoop: 1_500_000,
  awakeHoursPerPoop: 8,
  maxPoops: 4,
  decay: { hambre: 4, felicidad: 2.5, higiene: 1 },
  breakAfterMin: 90,
  overworkMin: 120,
  medCooldownMin: 120,
  petCooldownMin: 20,
  evolve: {
    bebe: { xp: 250_000, ageH: 0.25 }, // el huevo necesita calor (tokens) y un rato
    nino: { xp: 2e6, ageH: 12 },
    teen: { xp: 15e6, ageH: 48 },
    adulto: { xp: 60e6, ageH: 120 },
    leyenda: { xp: 400e6, ageH: 504, care: 0.75 },
  },
  hatchWithoutFoodH: 2,
  styleMin: 0.34, // un oficio necesita al menos un tercio de las herramientas
}


export function newPet({ now = Date.now(), index = null, name = null, generation = 1, graveyard = [], achievements = {}, collection = {}, inventory = null } = {}) {
  return {
    collection,
    personality: PERSONALITIES[hashStr(`p${now}`) % PERSONALITIES.length],
    owned: {},
    gear: {},
    decor: [],
    gifts: {},
    codeStats: { commits: 0, testsOk: 0, testsFail: 0, pushes: 0 },
    lastCodeTs: 0,
    v: 1,
    name: name || t('names', {}, hashStr(String(now))),
    seed: hashStr(`${now}`) % 1000,
    born: now,
    stage: 'huevo',
    form: null,
    variant: null,
    alive: true,
    stats: { hambre: 80, felicidad: 80, energia: 100, salud: 100, higiene: 100 },
    poops: 0,
    sick: false,
    lights: true,
    xp: 0,
    diet: {},
    baseline: { food: index?.totals.food ?? 0, models: { ...(index?.totals.models || {}) }, tools: { ...(index?.totals.tools || {}) } },
    styles: {},
    style: null,
    night: false,
    dayFood: 0,
    nightFood: 0,
    resets: 0,
    goodStreakH: 0,
    bocados: 5,
    poopAcc: 0,
    awakeSincePoopH: 0,
    lastTick: now,
    ...(inventory || {}),
    care: { goodH: 0, totalH: 0, mistakes: 0, feeds: 0, plays: 0, wins: 0, cleans: 0, meds: 0, pets: 0, breaks: 0, cures: 0 },
    critical: {},
    cooldowns: {},
    streak: { days: 0, last: null },
    today: null,
    limits: { lastSession: null, lastResetAt: null, fireWarned: false },
    work: { lastStart: 0, nagged: false },
    events: [],
    achievements,
    graveyard,
    generation,
  }
}

export function say(state, text, kind = 'info', now = Date.now()) {
  state.events.push({ ts: now, text, kind })
  if (state.events.length > 30) state.events.splice(0, state.events.length - 30)
}

function unlock(state, id, now) {
  if (state.achievements[id]) return
  state.achievements[id] = now
  say(state, t('ev.logro', achievementText(id)), 'logro', now)
}

export const ACHIEVEMENT_IDS = [
  'eclosion', 'primer-bocado', 'nino', 'teen', 'adulto', 'leyenda',
  'millon', 'cien-millones', 'mil-millones', 'racha-7', 'racha-30', 'finde',
  'manos-a-la-obra', 'explorador', 'hacker', 'sabio', 'director', 'politoglota',
  'limpito', 'chef', 'achuchable', 'jugon', 'zen', 'superviviente', 'dia-perfecto',
  'noctambulo', 'madrugador', 'al-limite', 'fenix',
  'coleccion-3', 'coleccion-10', 'reencarnacion', 'dinastia',
  'primer-commit', 'cien-commits', 'tests-verdes', 'comprador', 'fashion', 'decorador', 'secreta', 'visitas',
]
export const achievementText = (id) => {
  const [name, desc] = tmap('ach')[id] || [id, '']
  return { id, name, desc }
}

export const ageH = (s, now) => (now - s.born) / 3600_000
export const careScore = (s) => (s.care.totalH < 1 ? 1 : s.care.goodH / s.care.totalH)

function sessionPct(limits, now) {
  const w = limits?.weeklyOnly ? limits.week : limits?.session
  if (!w || w.expired || (w.resetsAt && w.resetsAt < now)) return null
  return w.pct
}

// ---------- El tick ----------

// Mascotas guardadas con versiones anteriores: rellena lo que falte
function ensure(s) {
  s.styles ??= {}
  s.collection ??= {}
  s.dayFood ??= 0
  s.nightFood ??= 0
  s.resets ??= 0
  s.goodStreakH ??= 0
  s.baseline.tools ??= null
  s.personality ??= PERSONALITIES[(s.seed ?? 0) % PERSONALITIES.length]
  s.gifts ??= {}
  s.codeStats ??= { commits: 0, testsOk: 0, testsFail: 0, pushes: 0 }
  s.lastCodeTs ??= 0
  ensureInventory(s)
  return s
}

export function tick(state, { index, limits = null, now = Date.now() }) {
  ensure(state)
  if (!state.alive) return state
  const s = state
  dailyCheck(s, index, now)

  // Comida nueva: los tokens que has gastado desde el último tick
  const food = index.totals.food
  let newFood = food - s.baseline.food
  if (newFood < 0) newFood = 0 // índice reconstruido: no inventamos comida
  const newByModel = {}
  for (const [fam, v] of Object.entries(index.totals.models || {})) {
    const d = v - (s.baseline.models[fam] || 0)
    if (d > 0) newByModel[fam] = d
  }
  const tools = index.totals.tools || {}
  if (s.baseline.tools) {
    for (const [k, v] of Object.entries(tools)) {
      const d = v - (s.baseline.tools[k] || 0)
      if (d > 0 && d < 5000) s.styles[k] = (s.styles[k] || 0) + d
    }
  }
  s.baseline = { food, models: { ...(index.totals.models || {}) }, tools: { ...tools } }
  toolAchievements(s, now)
  codeReactions(s, index, now)
  specialEvents(s, now)

  const elapsedMs = Math.max(0, now - s.lastTick)
  const cappedMs = Math.min(elapsedMs, RULES.maxCatchUpH * 3600_000)
  if (elapsedMs > RULES.maxCatchUpH * 3600_000 && s.stage !== 'huevo') {
    say(s, t('ev.hiberno', { dur: fmtDuration(elapsedMs) }), 'info', now)
  }
  s.lastTick = now

  if (s.stage !== 'huevo' && newFood > 0) eat(s, newFood, newByModel, now)
  else if (newFood > 0) s.xp += newFood // el huevo también "escucha"

  const working = now - index.lastActivity < 90_000
  const pct = sessionPct(limits, now)
  const weekPct = limits?.week && !limits.week.expired ? limits.week.pct : null
  limitEvents(s, limits, pct, now)
  workEvents(s, index, now)

  // Integramos en pasos de 15 min para que los umbrales se crucen bien
  const stepH = RULES.stepMin / 60
  let left = cappedMs / 3600_000
  while (left > 1e-9) {
    const h = Math.min(stepH, left)
    left -= h
    if (s.stage !== 'huevo') step(s, h, { working, pct, weekPct, index, now })
    if (!s.alive) break
  }

  evolve(s, now)
  if (s.alive) checkCritical(s, now)
  return s
}

function eat(s, newFood, byModel, now) {
  const st = s.stats
  const before = st.hambre
  const points = newFood / RULES.foodPerPoint
  st.hambre = clamp(st.hambre + points)
  const overflow = Math.max(0, before + points - 100)
  s.xp += newFood
  const h = new Date(now).getHours()
  if (h >= 23 || h < 6) s.nightFood += newFood
  else s.dayFood += newFood
  for (const [k, v] of Object.entries(byModel)) s.diet[k] = (s.diet[k] || 0) + v
  if (s.xp >= 100e6) unlock(s, 'cien-millones', now)
  if (s.xp >= 1e9) unlock(s, 'mil-millones', now)
  // Bocados: moneda para darle de comer a mano. Se ganan programando.
  s.tokenBank = (s.tokenBank || 0) + newFood + overflow * RULES.foodPerPoint * 0.5
  const earned = Math.floor(s.tokenBank / RULES.tokensPerBocado)
  if (earned > 0) {
    s.bocados = Math.min(99, s.bocados + earned)
    s.tokenBank -= earned * RULES.tokensPerBocado
  }
  s.poopAcc += newFood
  while (s.poopAcc >= RULES.tokensPerPoop) {
    s.poopAcc -= RULES.tokensPerPoop
    addPoop(s, now)
  }
  if (!s.achievements['primer-bocado']) unlock(s, 'primer-bocado', now)
  if (before < 25 && st.hambre >= 25) say(s, t('ev.comio', {}, now / 1000), 'feliz', now)
}

function addPoop(s, now) {
  if (s.poops >= RULES.maxPoops) return
  s.poops += 1
  s.stats.higiene = clamp(s.stats.higiene - 12)
  s.awakeSincePoopH = 0
  if (s.poops === 1) say(s, t('ev.caca'), 'aviso', now)
}

function step(s, h, { working, pct, weekPct, index, now }) {
  const st = s.stats
  const asleep = isAsleep(s, pct)
  const slow = asleep ? 0.5 : 1

  const tr = TRAIT[s.personality] || {}
  const vain = s.personality === 'presumido' && gearCount(s) >= 2 ? 1.5 * h : 0
  st.hambre = clamp(st.hambre - RULES.decay.hambre * (tr.hambre || 1) * h * slow)
  st.felicidad = clamp(st.felicidad - RULES.decay.felicidad * (tr.felicidad || 1) * h * slow + (working ? 1.5 * h : 0) + vain)
  st.higiene = clamp(st.higiene - (RULES.decay.higiene * (tr.higiene || 1) + 2.5 * s.poops) * h)

  // Energía: con la cuenta conectada es el reverso de tu sesión. Sin ella, se cansa trabajando.
  if (pct != null) {
    const target = 100 - pct
    st.energia = clamp(target) // con el % real, la energía es lo que te queda de sesión
  } else if (asleep) st.energia = clamp(st.energia + 20 * h)
  else st.energia = clamp(st.energia + (working ? -8 * (tr.energia || 1) : 6) * h)

  if (!asleep) {
    s.awakeSincePoopH += h
    if (s.awakeSincePoopH >= RULES.awakeHoursPerPoop) addPoop(s, now)
  }

  // Salud
  let dh = 0
  if (st.hambre < 15) dh -= 4
  if (st.higiene < 25) dh -= 3
  if (st.felicidad < 10) dh -= 1
  if (weekPct != null && weekPct >= 90) dh -= 1.5
  const streakMin = working && index.workStart ? (now - index.workStart) / 60000 : 0
  if (streakMin > RULES.overworkMin) dh -= 2
  if (dh === 0) dh = s.sick ? 0.5 : 1.5
  st.salud = clamp(st.salud + dh * h)
  if (!s.sick && st.salud < 35) {
    s.sick = true
    say(s, t('ev.enfermo'), 'aviso', now)
  }

  s.care.totalH += h
  if (st.hambre >= 40 && st.felicidad >= 40 && st.higiene >= 40 && st.salud >= 40) {
    s.care.goodH += h
    s.goodStreakH += h
    if (s.goodStreakH >= 24) unlock(s, 'dia-perfecto', now)
  } else s.goodStreakH = 0

  if (st.salud <= 0) die(s, now)
}

export function isAsleep(s, pct = null) {
  return !s.lights || (pct != null && pct >= 100)
}

function die(s, now) {
  s.alive = false
  s.stage = 'nube'
  s.diedAt = now
  s.graveyard.push({ name: s.name, born: s.born, died: now, stage: s.prevStage || 'bebe', form: s.form, style: s.style, xp: s.xp, generation: s.generation })
  say(s, t('ev.muerte', { name: s.name }), 'muerte', now)
}

function checkCritical(s, now) {
  for (const k of ['hambre', 'felicidad', 'higiene', 'salud']) {
    const low = s.stats[k] < 15
    if (low && !s.critical[k]) {
      s.care.mistakes += 1
      say(s, t(`ev.critico.${k}`), 'aviso', now)
    }
    s.critical[k] = low
  }
}

function dailyCheck(s, index, now) {
  const today = dayKey(now)
  if (s.today === today) return
  const yesterday = dayKey(now - 86400_000)
  const prev = s.today
  s.today = today
  if (!prev) return
  // Racha de días con actividad
  const activeYesterday = (index.days[yesterday]?.food || 0) > 0
  if (activeYesterday) {
    s.streak.days = s.streak.last === dayKey(now - 2 * 86400_000) || s.streak.last === yesterday ? s.streak.days + 1 : 1
    s.streak.last = yesterday
  } else if (s.streak.last !== yesterday) s.streak.days = 0
  if (s.streak.days >= 7) unlock(s, 'racha-7', now)
  if (s.streak.days >= 30) unlock(s, 'racha-30', now)
  s.bocados = Math.min(99, s.bocados + 2)
  const y = index.days[yesterday]
  if (y && Object.keys(y.models || {}).length >= 3) unlock(s, 'politoglota', now)
  const dow = new Date(now - 86400_000).getDay()
  if (dow === 0 && (y?.food || 0) > 0 && (index.days[dayKey(now - 2 * 86400_000)]?.food || 0) > 0) unlock(s, 'finde', now)
  const hour = new Date(now).getHours()
  const hello = t(hour < 5 ? 'ev.hola.noche' : hour < 13 ? 'ev.hola.manana' : hour < 20 ? 'ev.hola.tarde' : 'ev.hola.cena')
  const extra = y?.tokens ? t('ev.hola.ayer', { tokens: fmtTokens(y.food) }) : t('ev.hola.ayer0')
  const racha = s.streak.days > 1 ? t('ev.hola.racha', { days: s.streak.days }) : ''
  say(s, hello + extra + racha + t('ev.hola.bocados'), 'saludo', now)
}

function limitEvents(s, limits, pct, now) {
  const L = s.limits
  const w = limits?.weeklyOnly ? limits.week : limits?.session
  if (pct == null) return
  // Detectamos el reinicio de la ventana: bajó mucho el %, o cambió la hora de reinicio
  if (L.lastSession != null && L.lastSession - pct >= 25 && L.lastSession >= 50) {
    say(s, t('ev.ventana'), 'feliz', now)
    s.resets += 1
    if (s.resets >= 10) unlock(s, 'fenix', now)
    s.stats.felicidad = clamp(s.stats.felicidad + 10)
    L.fireWarned = false
  }
  if (pct >= 90 && !L.fireWarned) {
    L.fireWarned = true
    const left = w?.resetsAt ? t('ev.fuego.reset', { dur: fmtDuration(w.resetsAt - now) }) : ''
    say(s, t('ev.fuego', { pct: Math.round(pct) }) + left, 'fuego', now)
  }
  if (pct >= 100 && (L.lastSession ?? 0) < 100) {
    unlock(s, 'al-limite', now)
    say(s, t('ev.agotado', { hora: w?.resetsAt ? fmtClock(w.resetsAt) : t('ev.agotado.sinhora') }), 'aviso', now)
  }
  if (pct < 85) L.fireWarned = false
  L.lastSession = pct
}

function workEvents(s, index, now) {
  const W = s.work
  const start = index.workStart || 0
  const hour = new Date(index.lastActivity || now).getHours()
  if (now - index.lastActivity < 120_000) {
    if (hour >= 2 && hour < 5) unlock(s, 'noctambulo', now)
    else if (hour >= 5 && hour < 7) unlock(s, 'madrugador', now)
  }
  if (start !== W.lastStart) {
    // Empezó un tramo de trabajo nuevo: ¿el anterior fue largo? Entonces has descansado.
    const prevLen = W.lastEnd && W.lastStart ? (W.lastEnd - W.lastStart) / 60000 : 0
    if (W.lastStart && prevLen >= RULES.breakAfterMin) {
      s.care.breaks += 1
      s.stats.salud = clamp(s.stats.salud + 10)
      s.stats.felicidad = clamp(s.stats.felicidad + 5)
      say(s, t('ev.descanso'), 'feliz', now)
      if (s.care.breaks >= 5) unlock(s, 'zen', now)
    }
    W.lastStart = start
    W.nagged = false
  }
  W.lastEnd = index.lastActivity
  const mins = (index.lastActivity - start) / 60000
  if (start && now - index.lastActivity < 120_000 && mins >= RULES.breakAfterMin && !W.nagged) {
    W.nagged = true
    say(s, t('ev.estirar', { dur: fmtDuration(mins * 60000) }), 'aviso', now)
  }
  const today = index.days[dayKey(now)]
  if (today && today.food >= 1e6) unlock(s, 'millon', now)
}

// ---------- Evolución ----------

export function dominantForm(diet) {
  const total = Object.values(diet).reduce((a, b) => a + b, 0)
  if (!total) return 'mixto'
  const [fam, v] = Object.entries(diet).sort((a, b) => b[1] - a[1])[0]
  if (v / total < 0.55 || !FORM_LABEL[fam]) return 'mixto'
  return fam
}

export const STYLES = ['obras', 'explorador', 'hacker', 'sabio', 'director', 'equilibrado']
export const SPECIES = ['opus', 'sonnet', 'haiku', 'fable', 'mixto']

export function dominantStyle(styles) {
  const total = Object.values(styles || {}).reduce((a, b) => a + b, 0)
  if (total < 20) return 'equilibrado'
  const [k, v] = Object.entries(styles).sort((a, b) => b[1] - a[1])[0]
  return v / total >= RULES.styleMin && STYLES.includes(k) ? k : 'equilibrado'
}

export const collectionKey = (p) => (SECRET_FORMS.includes(p.form) ? `${p.form}-secreta` : `${p.form || 'mixto'}-${p.style || 'equilibrado'}`)

// Nombre completo de un adulto: especie, oficio y variante ("Opusaurio constructor brillante")
export function formLabel(p) {
  if (p.stage !== 'adulto' && p.stage !== 'leyenda') return STAGE_LABEL[p.stage]
  const style = tmap('style')[p.style || 'equilibrado'] || ''
  return `${FORM_LABEL[p.form] || FORM_LABEL.mixto}${style ? ` ${style}` : ''}${tmap('variant')[p.variant] || ''}${p.night ? tmap('variant').noche : ''}`
}

// Formas secretas: condiciones raras al hacerse adulto
export function secretForm(s) {
  const total = s.nightFood + s.dayFood
  const diet = Object.values(s.diet || {})
  const dietTotal = diet.reduce((a, b) => a + b, 0)
  const styles = s.styles || {}
  const stTotal = Object.values(styles).reduce((a, b) => a + b, 0)
  if (total > 0 && s.nightFood / total > 0.6) return 'buho'
  if (stTotal >= 50 && (styles.hacker || 0) / stTotal > 0.7) return 'robot'
  if ((s.care?.pets || 0) >= 150) return 'michi'
  if (s.xp >= 300e6 && careScore(s) >= 0.85) return 'dorado'
  if (dietTotal > 0 && diet.filter((v) => v / dietTotal >= 0.12).length >= 3) return 'arcoiris'
  return null
}

// Lo que pasa en tu código (lo cuenta logs.js): commits, tests, push, builds
function codeReactions(s, index, now) {
  const evs = (index.codeEvents || []).filter((e) => e.ts > s.lastCodeTs)
  if (!evs.length) return
  s.lastCodeTs = Math.max(...evs.map((e) => e.ts))
  if (now - s.lastCodeTs > 30 * 60_000) return // eventos viejos (primera lectura): sin reacción
  const C = s.codeStats
  const last = {}
  for (const e of evs) {
    if (e.kind === 'commit' && e.ok) C.commits++
    if (e.kind === 'push' && e.ok) C.pushes++
    if (e.kind === 'test') e.ok ? C.testsOk++ : C.testsFail++
    last[`${e.kind}-${e.ok ? 'ok' : 'ko'}`] = e
  }
  const st = s.stats
  if (last['test-ko']) {
    st.felicidad = clamp(st.felicidad - 3)
    say(s, t('ev.code.testKo', {}, now / 1000), 'codigo-mal', now)
  } else if (last['test-ok']) {
    st.felicidad = clamp(st.felicidad + 4)
    say(s, t('ev.code.testOk', {}, now / 1000), 'codigo-bien', now)
  }
  if (last['build-ko']) say(s, t('ev.code.buildKo'), 'codigo-mal', now)
  if (last['commit-ok']) {
    st.felicidad = clamp(st.felicidad + 5)
    say(s, t('ev.code.commit', {}, now / 1000), 'codigo-bien', now)
  }
  if (last['push-ok']) say(s, t('ev.code.push'), 'codigo-bien', now)
  if (C.commits >= 1) unlock(s, 'primer-commit', now)
  if (C.commits >= 100) unlock(s, 'cien-commits', now)
  if (C.testsOk >= 50) unlock(s, 'tests-verdes', now)
}

// Eventos especiales del calendario y visitas
export function seasonOf(now, lat = 40) {
  const m = new Date(now).getMonth()
  const north = lat >= 0
  const seasons = ['invierno', 'invierno', 'primavera', 'primavera', 'primavera', 'verano', 'verano', 'verano', 'otono', 'otono', 'otono', 'invierno']
  const sv = seasons[m]
  if (north) return sv
  return { invierno: 'verano', verano: 'invierno', primavera: 'otono', otono: 'primavera' }[sv]
}

export function holidayOf(now) {
  const d = new Date(now)
  const m = d.getMonth() + 1, day = d.getDate()
  if ((m === 12 && day >= 15) || (m === 1 && day <= 6)) return 'navidad'
  if ((m === 10 && day >= 25) || (m === 11 && day <= 2)) return 'halloween'
  if (m === 2 && day === 14) return 'sanvalentin'
  return null
}

const VISITORS = ['pajaro', 'gato', 'cartero', 'mariposa', 'tortuga']

function specialEvents(s, now) {
  if (s.stage === 'huevo') return
  const hol = holidayOf(now)
  const year = new Date(now).getFullYear()
  const giftOnce = (key, items, textKey) => {
    if (s.gifts[key]) return
    s.gifts[key] = now
    for (const id of items) gift(s, id, now)
    say(s, t(textKey), 'regalo', now)
  }
  if (hol === 'navidad') giftOnce(`navidad-${year}`, ['papa-noel', 'cuernos-reno', 'arbol-navidad', 'muneco-nieve'], 'ev.navidad')
  if (hol === 'halloween') giftOnce(`halloween-${year}`, ['calabaza'], 'ev.halloween')
  if (hol === 'sanvalentin') giftOnce(`sanvalentin-${year}`, ['pegatinas'], 'ev.sanvalentin')
  // Cumplemés: cada 30 días de vida
  const months = Math.floor((now - s.born) / (30 * 86400_000))
  if (months >= 1 && !s.gifts[`mes-${months}`]) {
    s.gifts[`mes-${months}`] = now
    gift(s, 'tarta', now)
    gift(s, 'fiesta', now)
    s.bocados = Math.min(99, s.bocados + 5)
    say(s, t('ev.cumplemes', { n: months }), 'regalo', now)
  }
  // Una visita al día como mucho, a una hora al azar (determinista por día)
  const today = dayKey(now)
  if (s.visit && now > s.visit.until) s.visit = null
  if (!s.gifts[`visita-${today}`]) {
    const at = (hashStr(today + s.name) % 10) + 10 // entre las 10 y las 19
    if (new Date(now).getHours() >= at) {
      s.gifts[`visita-${today}`] = now
      const kind = VISITORS[hashStr(today) % VISITORS.length]
      s.visit = { kind, at: now, until: now + 3 * 60_000 }
      if (kind === 'pajaro') s.bocados = Math.min(99, s.bocados + 3)
      if (kind === 'gato') s.stats.felicidad = clamp(s.stats.felicidad + 10)
      if (kind === 'cartero') {
        const cheap = ['gorra', 'lazo', 'cafe', 'piruleta', 'panuelo', 'fiesta', 'setas', 'cactus', 'buzon'].filter((id) => !s.owned[id])
        if (cheap.length) gift(s, cheap[hashStr(today + 'c') % cheap.length], now)
      }
      say(s, t(`ev.visita.${kind}`), 'visita', now)
      s.visits = (s.visits || 0) + 1
      if (s.visits >= 10) unlock(s, 'visitas', now)
    }
  }
  // Limpia regalos viejos de visitas
  for (const k of Object.keys(s.gifts)) if (k.startsWith('visita-') && k < `visita-${dayKey(now - 10 * 86400_000)}`) delete s.gifts[k]
}

function toolAchievements(s, now) {
  const T = s.styles
  if ((T.obras || 0) >= 1000) unlock(s, 'manos-a-la-obra', now)
  if ((T.explorador || 0) >= 1000) unlock(s, 'explorador', now)
  if ((T.hacker || 0) >= 500) unlock(s, 'hacker', now)
  if ((T.sabio || 0) >= 100) unlock(s, 'sabio', now)
  if ((T.director || 0) >= 25) unlock(s, 'director', now)
}

function evolve(s, now) {
  if (!s.alive) return
  const age = ageH(s, now)
  const E = RULES.evolve
  const next = { huevo: 'bebe', bebe: 'nino', nino: 'teen', teen: 'adulto', adulto: 'leyenda' }[s.stage]
  if (!next) return
  const r = E[next]
  let ok
  if (s.stage === 'huevo') ok = (age >= r.ageH && s.xp >= r.xp) || age >= RULES.hatchWithoutFoodH
  else ok = s.xp >= r.xp && age >= r.ageH && (r.care == null || careScore(s) >= r.care)
  if (!ok) return
  s.prevStage = s.stage
  s.stage = next
  if (next === 'bebe') {
    unlock(s, 'eclosion', now)
    say(s, t('ev.eclosion', { name: s.name }), 'evolucion', now)
    return
  }
  if (next === 'adulto') {
    s.form = dominantForm(s.diet)
    s.style = dominantStyle(s.styles)
    s.night = s.nightFood > s.dayFood * 0.6
    const secret = secretForm(s)
    if (secret) {
      s.form = secret
      s.secret = true
      unlock(s, 'secreta', now)
      say(s, t('ev.secreta'), 'evolucion', now)
    }
    const c = careScore(s)
    s.variant = c >= 0.7 && s.care.mistakes <= 3 ? 'brillante' : c < 0.35 ? 'grunon' : 'normal'
  }
  unlock(s, next, now)
  if (next === 'adulto' || next === 'leyenda') {
    const key = collectionKey(s)
    if (!s.collection[key]) s.collection[key] = now
    const n = Object.keys(s.collection).length
    if (n >= 3) unlock(s, 'coleccion-3', now)
    if (n >= 10) unlock(s, 'coleccion-10', now)
  }
  const label = next === 'adulto' ? formLabel(s) : STAGE_LABEL[next]
  say(s, t('ev.evoluciona', { name: s.name, label }), 'evolucion', now)
}

// ---------- Acciones del jugador ----------

function cooldown(s, key, min, now) {
  const last = s.cooldowns[key] || 0
  if (now - last < min * 60000) return Math.ceil((min * 60000 - (now - last)) / 60000)
  s.cooldowns[key] = now
  return 0
}

const itemName = (id) => tmap('item')[id] || id
// La tienda y el nombre funcionan también con el huevo
function shopAct(s, action, now, arg) {
  const stage = s.stage
  if (stage === 'huevo') s.stage = 'bebe'
  try {
    return act2(s, action, now, arg)
  } finally {
    s.stage = stage
  }
}

export function act(s, action, now = Date.now(), arg = null) {
  ensure(s)
  if (['comprar', 'usar', 'nombre'].includes(action) && s.alive) return shopAct(s, action, now, arg)
  return act2(s, action, now, arg)
}

function act2(s, action, now, arg) {
  if (!s.alive && action !== 'nuevo') return { ok: false, msg: t('act.muerto') }
  if (s.stage === 'huevo' && !['luces', 'nuevo'].includes(action)) return { ok: false, msg: t('act.huevo') }
  const st = s.stats
  const done = (msg, kind = 'feliz') => {
    say(s, msg, kind, now)
    return { ok: true, msg }
  }
  switch (action) {
    case 'comer': {
      if (st.hambre >= 95) return { ok: false, msg: t('act.lleno') }
      if (s.bocados < 1) return { ok: false, msg: t('act.sinbocados') }
      s.bocados -= 1
      st.hambre = clamp(st.hambre + 25)
      st.felicidad = clamp(st.felicidad + 3)
      s.care.feeds += 1
      if (s.care.feeds >= 50) unlock(s, 'chef', now)
      return done(t('act.comer', {}, now / 1000))
    }
    case 'chuche': {
      if (s.bocados < 1) return { ok: false, msg: t('act.sinbocados') }
      s.bocados -= 1
      st.hambre = clamp(st.hambre + 8)
      st.felicidad = clamp(st.felicidad + 15)
      st.salud = clamp(st.salud - 3)
      return done(t('act.chuche'))
    }
    case 'limpiar': {
      if (!s.poops && st.higiene > 90) return { ok: false, msg: t('act.yalimpio') }
      s.poops = 0
      st.higiene = clamp(st.higiene + 45)
      st.felicidad = clamp(st.felicidad + 2)
      s.care.cleans += 1
      if (s.care.cleans >= 10) unlock(s, 'limpito', now)
      return done(t('act.limpiar'))
    }
    case 'medicina': {
      if (!s.sick && st.salud > 80) return { ok: false, msg: t('act.sano') }
      const wait = cooldown(s, 'med', RULES.medCooldownMin, now)
      if (wait) return { ok: false, msg: t('act.espera', { min: wait }) }
      st.salud = clamp(st.salud + 35)
      st.felicidad = clamp(st.felicidad - 5)
      s.care.meds += 1
      if (s.sick && st.salud >= 35) {
        s.sick = false
        s.care.cures += 1
        unlock(s, 'superviviente', now)
      }
      return done(t('act.medicina'))
    }
    case 'acariciar': {
      const wait = cooldown(s, 'pet', RULES.petCooldownMin, now)
      st.felicidad = clamp(st.felicidad + (wait ? 1 : 8))
      s.care.pets += 1
      if (s.care.pets >= 50) unlock(s, 'achuchable', now)
      return done(wait ? t('act.cosquillas') : t('act.caricia'))
    }
    case 'jugar': {
      // arg = número de aciertos (0..5), lo decide el minijuego
      const wins = Number(arg) || 0
      if (st.energia < 10) return { ok: false, msg: t('act.cansado') }
      st.felicidad = clamp(st.felicidad + 4 + wins * 5)
      st.energia = clamp(st.energia - 5)
      st.hambre = clamp(st.hambre - 4)
      s.care.plays += 1
      if (wins >= 3) {
        s.care.wins += 1
        if (s.care.wins >= 10) unlock(s, 'jugon', now)
        return done(t('act.gana', { wins }))
      }
      return done(t('act.pierde', { wins }), 'info')
    }
    case 'luces': {
      s.lights = !s.lights
      return done(s.lights ? t('act.luzon') : t('act.luzoff'), 'info')
    }
    case 'comprar': {
      const r = buy(s, arg, now)
      if (r.ok) {
        if (Object.keys(s.owned).length >= 10) unlock(s, 'comprador', now)
        if (gearCount(s) >= 5) unlock(s, 'fashion', now)
        if (s.decor.length >= 8) unlock(s, 'decorador', now)
        return done(t('act.comprado', { item: itemName(arg) }))
      }
      return { ok: false, msg: t(`act.tienda.${r.code}`, { price: r.price, item: itemName(arg) }) }
    }
    case 'usar': {
      if (!isItem(arg)) return { ok: false, msg: t('act.nose') }
      const r = use(s, arg)
      if (!r.ok) return { ok: false, msg: t(`act.tienda.${r.code}`) }
      if (gearCount(s) >= 5) unlock(s, 'fashion', now)
      if (s.decor.length >= 8) unlock(s, 'decorador', now)
      return { ok: true, msg: '' }
    }
    case 'nombre': {
      const name = String(arg || '').trim().slice(0, 20)
      if (!name) return { ok: false, msg: t('act.nombreVacio') }
      s.name = name
      return done(t('act.nombre', { name }))
    }
    default:
      return { ok: false, msg: t('act.nose') }
  }
}

export function reincarnate(old, { now = Date.now(), index = null, name = null } = {}) {
  const graveyard = old ? [...old.graveyard] : []
  if (old?.alive) graveyard.push({ name: old.name, born: old.born, died: now, stage: old.stage, form: old.form, style: old.style, xp: old.xp, generation: old.generation, retired: true })
  const inventory = old ? { owned: old.owned || {}, gear: old.gear || {}, decor: old.decor || [], gifts: old.gifts || {}, bocados: old.bocados ?? 5 } : null
  const p = newPet({ now, index, name, generation: (old?.generation || 0) + 1, graveyard, achievements: old?.achievements || {}, collection: old?.collection || {}, inventory })
  if (old) unlock(p, 'reencarnacion', now)
  if (p.generation >= 3) unlock(p, 'dinastia', now)
  say(p, t('ev.huevo', { gen: p.generation, name: p.name }), 'evolucion', now)
  return p
}

// ---------- Humor (para dibujar y para la statusline) ----------

export function mood(s, { index, limits, now = Date.now() }) {
  if (!s.alive) return 'nube'
  if (s.stage === 'huevo') return 'huevo'
  const pct = sessionPct(limits, now)
  if (isAsleep(s, pct)) return 'dormido'
  if (s.sick) return 'enfermo'
  if (pct != null && pct >= 90) return 'fuego'
  if (s.stats.hambre < 25) return 'hambriento'
  if (s.poops >= 2 || s.stats.higiene < 30) return 'sucio'
  if (index && now - index.lastActivity < 90_000) return 'trabajando'
  if (s.stats.energia < 20) return 'cansado'
  if (s.stats.felicidad < 30) return 'triste'
  if (s.stats.felicidad >= 70) return 'feliz'
  return 'normal'
}

export const MOOD_LABEL = new Proxy({}, { get: (_, k) => tmap('mood')[k] })

export const FACE = {
  huevo: '(  🥚  )', nube: '(  ☁️  )', dormido: '(-ω-)zZ', enfermo: '(×﹏×)', fuego: '(╬ಠ益ಠ)🔥', hambriento: '(◕﹃◕)',
  sucio: '(¬_¬)💩', trabajando: '(•̀ᴗ•́)و', cansado: '(＿ ＿;)', triste: '(╥﹏╥)', feliz: '(◕ᴗ◕✿)', normal: '(•ᴗ•)',
}

export function latestEvent(s, now, maxAgeMs) {
  const e = s.events[s.events.length - 1]
  return e && now - e.ts < maxAgeMs ? e : null
}
