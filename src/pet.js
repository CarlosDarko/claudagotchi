// La simulación de la mascota. Todo es puro: recibe el estado, el índice de uso,
// los límites de la cuenta y la hora, y devuelve el estado nuevo. Así se puede
// probar sin relojes ni ficheros.
import { clamp, dayKey, fmtTokens, fmtDuration, fmtClock, hashStr } from './util.js'
import { t, tmap } from './i18n/index.js'

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
    bebe: { xp: 0, ageH: 0.05 },
    nino: { xp: 2e6, ageH: 12 },
    teen: { xp: 15e6, ageH: 48 },
    adulto: { xp: 60e6, ageH: 120 },
    leyenda: { xp: 400e6, ageH: 504, care: 0.75 },
  },
  hatchWithoutFoodH: 0.5,
}


export function newPet({ now = Date.now(), index = null, name = null, generation = 1, graveyard = [], achievements = {} } = {}) {
  return {
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
    baseline: { food: index?.totals.food ?? 0, models: { ...(index?.totals.models || {}) } },
    bocados: 5,
    poopAcc: 0,
    awakeSincePoopH: 0,
    lastTick: now,
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

export const ACHIEVEMENT_IDS = ['eclosion', 'primer-bocado', 'nino', 'teen', 'adulto', 'leyenda', 'millon', 'racha-7', 'racha-30', 'limpito', 'jugon', 'zen', 'superviviente', 'noctambulo', 'madrugador', 'al-limite', 'reencarnacion']
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

export function tick(state, { index, limits = null, now = Date.now() }) {
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
  s.baseline = { food, models: { ...(index.totals.models || {}) } }

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
  for (const [k, v] of Object.entries(byModel)) s.diet[k] = (s.diet[k] || 0) + v
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

  st.hambre = clamp(st.hambre - RULES.decay.hambre * h * slow)
  st.felicidad = clamp(st.felicidad - RULES.decay.felicidad * h * slow + (working ? 1.5 * h : 0))
  st.higiene = clamp(st.higiene - (RULES.decay.higiene + 2.5 * s.poops) * h)

  // Energía: con la cuenta conectada es el reverso de tu sesión. Sin ella, se cansa trabajando.
  if (pct != null) {
    const target = 100 - pct
    st.energia = clamp(st.energia + (target - st.energia) * Math.min(1, h * 4))
  } else if (asleep) st.energia = clamp(st.energia + 20 * h)
  else st.energia = clamp(st.energia + (working ? -8 : 6) * h)

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
  if (st.hambre >= 40 && st.felicidad >= 40 && st.higiene >= 40 && st.salud >= 40) s.care.goodH += h

  if (st.salud <= 0) die(s, now)
}

export function isAsleep(s, pct = null) {
  return !s.lights || (pct != null && pct >= 100)
}

function die(s, now) {
  s.alive = false
  s.stage = 'nube'
  s.diedAt = now
  s.graveyard.push({ name: s.name, born: s.born, died: now, stage: s.prevStage || 'bebe', form: s.form, xp: s.xp, generation: s.generation })
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

function evolve(s, now) {
  if (!s.alive) return
  const age = ageH(s, now)
  const E = RULES.evolve
  const next = { huevo: 'bebe', bebe: 'nino', nino: 'teen', teen: 'adulto', adulto: 'leyenda' }[s.stage]
  if (!next) return
  const r = E[next]
  let ok
  if (s.stage === 'huevo') ok = age >= r.ageH && (s.xp > 0 || age >= RULES.hatchWithoutFoodH)
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
    const c = careScore(s)
    s.variant = c >= 0.7 && s.care.mistakes <= 3 ? 'brillante' : c < 0.35 ? 'grunon' : 'normal'
  }
  unlock(s, next, now)
  const label = next === 'adulto' ? FORM_LABEL[s.form] + tmap('variant')[s.variant] : STAGE_LABEL[next]
  say(s, t('ev.evoluciona', { name: s.name, label }), 'evolucion', now)
}

// ---------- Acciones del jugador ----------

function cooldown(s, key, min, now) {
  const last = s.cooldowns[key] || 0
  if (now - last < min * 60000) return Math.ceil((min * 60000 - (now - last)) / 60000)
  s.cooldowns[key] = now
  return 0
}

export function act(s, action, now = Date.now(), arg = null) {
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
    default:
      return { ok: false, msg: t('act.nose') }
  }
}

export function reincarnate(old, { now = Date.now(), index = null, name = null } = {}) {
  const graveyard = old ? [...old.graveyard] : []
  if (old?.alive) graveyard.push({ name: old.name, born: old.born, died: now, stage: old.stage, form: old.form, xp: old.xp, generation: old.generation, retired: true })
  const p = newPet({ now, index, name, generation: (old?.generation || 0) + 1, graveyard, achievements: old?.achievements || {} })
  if (old) unlock(p, 'reencarnacion', now)
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
