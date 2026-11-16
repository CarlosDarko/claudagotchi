// El widget de escritorio: la mascota vive en su escenario, por encima de la barra
// de tareas. La ventana es transparente, ocupa la pantalla y deja pasar los clics
// salvo encima de la mascota, su pastilla y su tarjeta (lo decide el lado Rust con
// los rectángulos que le mandamos).
import { drawCritter, CRITTER_W, CRITTER_H, Canvas } from '../../src/sprites.js'
import { drawIcon, drawMedal, drawYard, drawVisitor, YARD_H, GROUND } from '../../src/art.js'
import { drawDecor } from '../../src/gear.js'
import { t, tmap, setLocale } from '../../src/i18n/index.js'
import { fmtTokens, fmtDuration, fmtClock } from '../../src/util.js'
import { sfx, setSound } from './sound.js'

const TAURI = window.__TAURI__
const invoke = (cmd, args) => (TAURI ? TAURI.core.invoke(cmd, args) : mockInvoke(cmd, args))

const $ = (id) => document.getElementById(id)
const petEl = $('pet'), yardEl = $('yard'), badgeEl = $('badge'), bubbleEl = $('bubble'), cardEl = $('card'), fxEl = $('fx'), weatherEl = $('weather'), visitorEl = $('visitor')
const ctx = petEl.getContext('2d')
const yctx = yardEl.getContext('2d')
const wctx = weatherEl.getContext('2d')
const vctx = visitorEl.getContext('2d')

const NEED_COLOR = { hambre: '#F2A93B', felicidad: '#F2668B', energia: '#FFD23F', salud: '#5FD38D', higiene: '#5BC0F2' }
const ACTION_KEY = { c: 'comer', x: 'chuche', j: 'jugar', l: 'limpiar', m: 'medicina', a: 'acariciar', d: 'luces' }
const SPECIES = ['opus', 'sonnet', 'haiku', 'fable', 'mixto']
const SECRETS = ['buho', 'robot', 'michi', 'dorado', 'arcoiris']
const STYLES = ['obras', 'explorador', 'hacker', 'sabio', 'director', 'equilibrado']
const SCENES = ['completo', 'isla', 'no']
const ACTION_SFX = { comer: 'comer', chuche: 'chuche', limpiar: 'limpiar', medicina: 'medicina', acariciar: 'mimo', comprar: 'comprar' }
const pctColor = (p) => (p == null ? '#8A8AA0' : p >= 90 ? '#FF6B5E' : p >= 75 ? '#F2A93B' : '#5FD38D')

const S = {
  state: null,
  scale: 2,
  showBadge: true,
  scene: 'completo',
  sound: true,
  x: null,
  dir: -1,
  target: null,
  idleUntil: 0,
  frame: 0,
  box: { top: 20, left: 14, right: 30, bottom: 34 },
  walk: null,
  walking: false,
  hover: false,
  cardOpen: false,
  pinned: false,
  tab: 'mascota',
  shopSlot: 'cabeza',
  closeTimer: null,
  bubble: null,
  lastEventTs: 0,
  lastHint: null,
  game: null,
  happyUntil: 0,
  hatchAt: 0,
  home: null,
  drag: null,
  cursor: null,
  workSince: 0,
  lastClaudeTs: 0,
  alert: null,
  activity: null,
  perch: null,
  activeWin: null,
  lift: 0,
  jump: null,
  visitor: null,
  particles: [],
  nextChatter: Date.now() + 8 * 60_000,
  lastWave: 0,
  yardHome: null,
  connecting: false,
}

// ---------- Utilidades de dibujo ----------

const imgCache = new Map()
function toDataURL(canvas, key) {
  if (key && imgCache.has(key)) return imgCache.get(key)
  const el = document.createElement('canvas')
  el.width = canvas.w
  el.height = canvas.h
  paint(el.getContext('2d'), canvas)
  const url = el.toDataURL()
  if (key) imgCache.set(key, url)
  return url
}

function paint(ctx2, canvas) {
  ctx2.clearRect(0, 0, canvas.w, canvas.h)
  for (let y = 0; y < canvas.h; y++) {
    for (let x = 0; x < canvas.w; x++) {
      const c = canvas.get(x, y)
      if (c) {
        ctx2.fillStyle = c
        ctx2.fillRect(x, y, 1, 1)
      }
    }
  }
}

// Recorta un lienzo a lo que tiene dibujado (para miniaturas)
function crop(canvas, { silhouette = null, pad = 2, top = 1 } = {}) {
  let x0 = canvas.w, y0 = canvas.h, x1 = 0, y1 = 0
  for (let y = 0; y < canvas.h; y++) for (let x = 0; x < canvas.w; x++) {
    const c = canvas.get(x, y)
    if (c && c.length === 7) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  }
  if (x1 < x0) return canvas
  if (top < 1) {
    // Solo la parte de arriba (para ver bien sombreros y gafas)
    y1 = Math.round(y0 + (y1 - y0) * top)
    const cx = (x0 + x1) / 2, half = Math.max(8, (y1 - y0) / 2 + 2)
    x0 = Math.max(0, Math.round(cx - half))
    x1 = Math.min(canvas.w - 1, Math.round(cx + half))
  }
  const size = Math.max(x1 - x0, y1 - y0) + pad * 2 + 1
  const ox = x0 - Math.floor((size - (x1 - x0)) / 2), oy = y0 - Math.floor((size - (y1 - y0)) / 2)
  const out = new Canvas(size, size, null)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = canvas.get(x + ox, y + oy)
    if (c && c.length === 7) out.set(x, y, silhouette || c)
  }
  return out
}

// Texto de un grupo del diccionario con {variables}
const tn = (group, key, vars = {}) => String(tmap(group)[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m))

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// ---------- Datos ----------

async function load() {
  try {
    apply(JSON.parse(await invoke('get_state')))
  } catch (e) {
    console.error(e)
  }
}

function apply(state) {
  const prev = S.state
  S.state = state
  setLocale(state.locale)
  const w = state.widget || {}
  S.scale = w.scale || S.scale
  S.showBadge = w.showBadge ?? S.showBadge
  S.scene = w.scene || S.scene
  S.sound = w.sound ?? S.sound
  setSound(S.sound, w.volume ?? 0.35)
  if (w.home != null && S.home == null) S.home = w.home
  // Primer arranque: cuenta qué ha activado y cómo quitarlo
  if (!w.welcomed && TAURI) {
    S.state.widget = { ...w, welcomed: true }
    invoke('set_config', { patch: JSON.stringify({ welcomed: true }) })
    setTimeout(() => {
      say(t('w.bienvenida'), false, 20_000)
      invoke('notify', { title: 'Claudagotchi', body: t('w.bienvenida') }).catch(() => {})
    }, 2500)
  }

  if (prev) {
    if (prev.pet.stage === 'huevo' && state.pet.stage !== 'huevo') hatch()
    // Comida de Claude: chispas que caen y se come (también si sube el % de la sesión)
    const pctUp = prev.limits?.session?.pct != null && (state.limits?.session?.pct ?? 0) > prev.limits.session.pct
    if ((state.today.food > prev.today.food || pctUp) && !S.cardOpen && !S.activity?.hidden) sparks(Math.max(state.today.food - prev.today.food, 0) || null)
    const got = (s) => Object.keys(s.achievements || {}).length
    if (got(state) > got(prev)) sfx('logro')
  }

  // Avisos de Claude Code (hooks): permiso, te espera, ha terminado
  const ce = state.claudeEvent
  if (ce && ce.ts > S.lastClaudeTs) {
    const first = S.lastClaudeTs === 0
    S.lastClaudeTs = ce.ts
    if (!first || Date.now() - ce.ts < 20_000) claudeAlert(ce.kind, ce)
  }
  // Sin hooks: lo deducimos (llevaba un rato trabajando y ha parado)
  if (!state.hooks) {
    if (state.working && !S.workSince) S.workSince = Date.now()
    if (!state.working && S.workSince) {
      if (Date.now() - S.workSince > 45_000 && state.pet.alive && state.pet.stage !== 'huevo') claudeAlert('fin')
      S.workSince = 0
    }
  }
  if (state.working && S.alert && S.alert.kind !== 'limite') stopAlert()

  if (state.event && state.event.ts > S.lastEventTs) {
    const first = S.lastEventTs === 0
    S.lastEventTs = state.event.ts
    const k = state.event.kind
    if (k === 'fuego' && !first) claudeAlert('limite', null, state.event.text)
    else {
      say(state.event.text, ['aviso', 'fuego', 'muerte', 'codigo-mal'].includes(k))
      if (!first) sfx({ 'codigo-bien': 'codigoBien', 'codigo-mal': 'codigoMal', visita: 'visita', regalo: 'logro', evolucion: 'eclosion', aviso: 'triste' }[k] || 'click')
    }
  } else if (state.hint?.text && state.hint.key !== S.lastHint) say(state.hint.text, true)
  S.lastHint = state.hint?.key || null

  if (state.visit && (!S.visitor || S.visitor.at !== state.visit.at)) startVisitor(state.visit)

  if (S.cardOpen && !S.game && !(cardEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) renderCard()
  renderBadge()
  drawYardNow()
}

function say(text, alert = false, ms = 8000) {
  S.bubble = { text, alert, until: Date.now() + ms }
  bubbleEl.textContent = text
  bubbleEl.classList.toggle('alert', !!alert)
  bubbleEl.classList.toggle('claude', alert === 'claude')
}

async function action(name, arg = null) {
  const out = JSON.parse(await invoke('do_action', { name, arg: arg == null ? null : String(arg) }))
  if (!out.res.ok && out.res.msg) {
    say(out.res.msg, true, 4500)
    sfx('error')
  } else if (out.res.ok) {
    if (name === 'luces') sfx(out.state.pet.lights ? 'despertar' : 'dormir')
    else if (ACTION_SFX[name]) sfx(ACTION_SFX[name])
    else if (name === 'usar') sfx('click')
    if (!['luces', 'medicina', 'usar', 'nombre'].includes(name)) S.happyUntil = Date.now() + 2500
    if (name === 'acariciar') hearts()
  }
  apply(out.state)
}

async function setConfig(patch) {
  if (patch.scale) S.scale = patch.scale
  if (patch.scene) S.scene = patch.scene
  if (patch.showBadge != null) S.showBadge = patch.showBadge
  if (patch.sound != null) {
    S.sound = patch.sound
    setSound(patch.sound)
  }
  if (S.state) S.state.widget = { ...(S.state.widget || {}), ...patch }
  await invoke('set_config', { patch: JSON.stringify(patch) })
  drawYardNow()
  renderBadge()
  if (S.cardOpen) renderCard()
}

// ---------- Avisos de Claude: que se note ----------
// Sonido, la mascota da saltos, la pastilla parpadea, bocadillo naranja y
// notificación del sistema. El de permiso se repite hasta que respondas.

const ALERT_SFX = { permiso: 'alertaPermiso', espera: 'alertaFin', fin: 'alertaFin', limite: 'alertaLimite' }

function claudeAlert(kind, ev = null, text = null) {
  const msg = text || tn('w.aviso', kind, { project: ev?.project || '' }).replace(' ()', '')
  S.alert = { kind, since: Date.now(), repeats: 0, msg }
  say(msg, 'claude', kind === 'permiso' ? 60_000 : 12_000)
  sfx(ALERT_SFX[kind] || 'alertaFin')
  badgeEl.classList.add('alerting')
  petEl.classList.add('alert-jump')
  invoke('notify', { title: `✻ ${S.state?.pet.name || 'Claudagotchi'}`, body: msg }).catch(() => {})
  setTimeout(() => petEl.classList.remove('alert-jump'), 2400)
  setTimeout(() => S.alert?.kind !== 'permiso' && stopAlert(), 12_000)
  renderBadge()
}

function stopAlert() {
  S.alert = null
  badgeEl.classList.remove('alerting')
  petEl.classList.remove('alert-jump')
  renderBadge()
}

// El aviso de permiso insiste cada 25 s (hasta 4 veces)
setInterval(() => {
  const a = S.alert
  if (!a || a.kind !== 'permiso') return
  if (a.repeats >= 4) return stopAlert()
  a.repeats++
  sfx('alertaPermiso')
  say(a.msg, 'claude', 25_000)
  petEl.classList.add('alert-jump')
  setTimeout(() => petEl.classList.remove('alert-jump'), 2400)
}, 25_000)

// ---------- Efectos ----------

function fx(html, { x, y, dx = 0, dy = -40, ms = 1200, cls = '' }) {
  const el = document.createElement('div')
  el.className = `fx ${cls}`
  el.innerHTML = html
  el.style.left = `${x}px`
  el.style.bottom = `${y}px`
  fxEl.appendChild(el)
  el.animate(
    [
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), ${-dy}px) scale(.9)`, opacity: 0.95, offset: 0.8 },
      { transform: `translate(calc(-50% + ${dx}px), ${-dy}px) scale(.6)`, opacity: 0 },
    ],
    { duration: ms, easing: 'cubic-bezier(.3,.7,.4,1)' },
  )
  setTimeout(() => el.remove(), ms)
}

const headY = () => petBottom() + (CRITTER_H - S.box.top) * S.scale

function sparks(delta) {
  const n = delta ? Math.min(7, Math.max(2, Math.ceil(delta / 60_000))) : 3
  const top = Math.min(window.innerHeight - 40, headY() + 260)
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const sx = S.x + (Math.random() * 2 - 1) * 70
      fx('✻', { x: sx, y: top, dx: S.x - sx, dy: -(top - headY()) - 6, ms: 1300, cls: 'spark' })
      setTimeout(() => sfx('chispa'), 1150)
    }, i * 140)
  }
  setTimeout(() => {
    if (delta) fx(`+${fmtTokens(delta)}`, { x: S.x, y: headY() + 4, dy: 34, ms: 1600, cls: 'gain' })
    S.happyUntil = Date.now() + 1500
  }, 1300)
}

function hearts() {
  for (let i = 0; i < 4; i++) setTimeout(() => fx('❤', { x: S.x + (Math.random() * 2 - 1) * 16, y: headY(), dx: (Math.random() * 2 - 1) * 20, dy: 40, ms: 1100, cls: 'heart' }), i * 120)
}

function hatch() {
  S.hatchAt = Date.now()
  petEl.classList.add('shake')
  setTimeout(() => {
    petEl.classList.remove('shake')
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      fx('✦', { x: S.x, y: headY() - 10, dx: Math.cos(a) * 46, dy: Math.sin(a) * 30 + 20, ms: 1000, cls: 'burst' })
    }
    sfx('eclosion')
    say(t('w.nacidoNombre'), false, 15000)
  }, 1600)
}

// ---------- La mascota ----------

function moodNow() {
  const st = S.state
  if (!st) return 'huevo'
  if (S.activity?.kind === 'siesta') return 'dormido'
  if (Date.now() < S.happyUntil && st.pet.alive && !['dormido', 'huevo'].includes(st.mood)) return 'feliz'
  return st.mood
}

function drawPet() {
  if (!S.state) return
  const hatching = Date.now() - S.hatchAt < 1600
  let pet = hatching ? { ...S.state.pet, stage: 'huevo', xp: 1 } : S.state.pet
  pet = { ...pet, gear: { ...(S.state.gear || {}) } }
  // Objetos de la actividad que esté haciendo, y paraguas si llueve
  if (S.activity?.prop) pet.gear.mano = S.activity.prop
  else if (['lluvia', 'tormenta'].includes(S.state.weather?.kind) && !pet.gear.mano && S.scene !== 'no') pet.gear.mano = 'paraguas'
  const { canvas, box } = drawCritter(pet, hatching ? 'huevo' : moodNow(), S.frame, { walking: S.walking, look: S.walking ? 1 : 0 })
  S.box = box
  if (petEl.width !== CRITTER_W) {
    petEl.width = CRITTER_W
    petEl.height = CRITTER_H
  }
  paint(ctx, canvas)
  petEl.style.opacity = S.activity?.hidden ? '0' : '1'
}

const yardOn = () => S.scene !== 'no'
const groundY = () => (yardOn() ? (GROUND - 2) * S.scale : 0)
// Altura de los pies: el suelo, la ventana a la que se ha subido o el salto
const petBottom = () => (S.perch ? window.innerHeight - S.perch.y : groundY()) + S.lift

const homePx = () => (S.home != null ? S.home : window.innerWidth - 120 * S.scale)

function drawYardNow() {
  if (!S.state) return
  if (!yardOn()) {
    yardEl.classList.add('hidden')
    S.walk = null
    S.yardHome = homePx()
    return
  }
  yardEl.classList.remove('hidden')
  const s = S.scale
  const wpx = Math.ceil(window.innerWidth / s)
  const home = Math.max(90, Math.round(homePx() / s))
  S.yardHome = home * s
  const st = S.state
  const y = drawYard(wpx, { mode: S.scene, home, hunger: st.pet.stats.hambre, bocados: st.pet.bocados, frame: S.frame, decor: st.decor || [], season: st.season, holiday: st.holiday })
  S.walk = [y.walk[0] * s, y.walk[1] * s]
  if (yardEl.width !== wpx || yardEl.height !== YARD_H) {
    yardEl.width = wpx
    yardEl.height = YARD_H
  }
  yardEl.style.width = `${wpx * s}px`
  yardEl.style.height = `${YARD_H * s}px`
  paint(yctx, y.canvas)
}

// ---------- Movimiento y actividades ----------

const STILL = ['dormido', 'trabajando', 'enfermo', 'huevo', 'nube', 'cansado']

function pickActivity() {
  const st = S.state
  const p = st.pet
  const pers = st.personality
  const hour = new Date().getHours()
  const night = hour >= 22 || hour < 7
  const r = Math.random()
  const s = S.scale
  if (S.perch || !p.alive || p.stage === 'huevo') return null
  if (yardOn() && (p.stats.energia < 35 || (pers === 'dormilon' && r < 0.25) || (night && r < 0.3))) return { kind: 'siesta', to: S.yardHome - 62 * s, dur: 40_000 + Math.random() * 40_000 }
  if (r < 0.14) return { kind: 'leer', prop: 'libro', dur: 9000 }
  if (yardOn() && r < 0.26) return { kind: 'regar', to: S.yardHome + 36 * s, prop: 'regadera', dur: 6000 }
  if (r < 0.36) return { kind: 'mariposa', dur: 12_000 }
  const aw = S.activeWin
  if (aw && aw.w > 320 && aw.y > 140 && aw.y < window.innerHeight - 200 && r < (pers === 'curioso' ? 0.7 : 0.5)) return { kind: 'escalar', dur: 30_000 + Math.random() * 40_000 }
  return null
}

function startActivity(a) {
  S.activity = { ...a, until: Date.now() + a.dur + 60_000, started: a.to == null }
  if (a.to == null) S.activity.until = Date.now() + a.dur
  if (a.kind === 'mariposa') startVisitor({ kind: 'mariposa', at: Date.now(), until: Date.now() + a.dur })
  if (a.kind === 'escalar') {
    const aw = S.activeWin
    S.target = Math.max(aw.x + 40, Math.min(aw.x + aw.w - 40, S.x))
  }
}

function endActivity() {
  const a = S.activity
  S.activity = null
  if (a?.kind === 'regar' || a?.kind === 'siesta') S.happyUntil = Date.now() + 2000
}

function step(dt) {
  if (S.drag) return layout()
  const W = window.innerWidth
  const s = S.scale
  const half = (CRITTER_W * s) / 2
  let [lo, hi] = S.walk ? [S.walk[0] + half * 0.4, S.walk[1] - half * 0.4] : [half, W - half]
  if (S.perch) [lo, hi] = [S.perch.x + half * 0.5, S.perch.x + S.perch.w - half * 0.5]
  if (S.x == null) S.x = Math.min(hi, W - 160)
  const now = performance.now()
  const busy = STILL.includes(S.state.mood) || S.cardOpen || S.hover || !!S.game || Date.now() - S.hatchAt < 3000 || !!S.alert
  // Saltos (a una ventana o de vuelta al suelo)
  if (S.jump) {
    const k = Math.min(1, (Date.now() - S.jump.t0) / S.jump.ms)
    S.lift = S.jump.from + (S.jump.to - S.jump.from) * k + Math.sin(k * Math.PI) * 40
    if (k >= 1) {
      S.lift = 0
      S.perch = S.jump.perch
      S.jump = null
      sfx('saltito')
    }
    return layout()
  }
  // Si estaba subido a una ventana que se ha movido o cerrado, se baja
  if (S.perch) {
    const aw = S.activeWin
    const gone = !aw || Math.abs(aw.y - S.perch.y) > 4 || Math.abs(aw.x - S.perch.x) > 4 || S.activity?.kind !== 'escalar' || Date.now() > (S.activity?.until ?? 0)
    if (gone) {
      const from = window.innerHeight - S.perch.y - groundY()
      S.perch = null
      S.jump = { from, to: 0, t0: Date.now(), ms: 650, perch: null }
      if (S.activity?.kind === 'escalar') S.activity = null
      return layout()
    }
  }
  const act = S.activity
  if (act && Date.now() > act.until) endActivity()
  else if (!act && !busy && now > S.idleUntil && Math.random() < 0.004) {
    const a = pickActivity()
    if (a) startActivity(a)
  }
  // Charla según su personalidad, de vez en cuando
  if (!busy && Date.now() > S.nextChatter && S.state.chatter?.length && S.state.pet.alive && S.state.pet.stage !== 'huevo') {
    S.nextChatter = Date.now() + (10 + Math.random() * 15) * 60_000
    say(S.state.chatter[Math.floor(Math.random() * S.state.chatter.length)], false, 7000)
  }
  // Saluda si acercas el ratón
  if (S.cursor && !busy && !S.walking && Date.now() - S.lastWave > 120_000 && Math.abs(S.cursor.x - S.x) < 120 && window.innerHeight - S.cursor.y < 220) {
    S.lastWave = Date.now()
    S.happyUntil = Date.now() + 1500
    sfx('saltito')
  }

  S.walking = false
  const cur = S.activity
  if (cur && !busy) {
    if (cur.kind === 'mariposa' && S.visitor) S.target = Math.max(lo, Math.min(hi, S.visitor.x))
    else if (cur.to != null && !cur.started) S.target = Math.max(lo, Math.min(hi, cur.to))
  }
  const outside = S.x < lo || S.x > hi
  if (outside) S.target = Math.max(lo, Math.min(hi, S.x))
  const roam = !busy && (!cur || cur.kind === 'mariposa' || (cur.to != null && !cur.started) || (cur.kind === 'escalar' && !S.perch))
  if ((roam && (now > S.idleUntil || cur)) || outside) {
    if (S.target == null) {
      const span = Math.min((hi - lo) * 0.6, 380)
      S.target = Math.max(lo, Math.min(hi, S.x + (Math.random() * 2 - 1) * span))
    }
    const d = S.target - S.x
    if (Math.abs(d) < 3) {
      S.target = null
      if (cur && cur.to != null && !cur.started) {
        cur.started = true
        cur.until = Date.now() + cur.dur
        if (cur.kind === 'siesta') cur.hidden = true
      } else if (cur?.kind === 'escalar' && !S.perch && S.activeWin) {
        const aw = S.activeWin
        S.jump = { from: 0, to: window.innerHeight - aw.y - groundY(), t0: Date.now(), ms: 700, perch: { x: aw.x, y: aw.y, w: aw.w } }
      } else if (!cur) S.idleUntil = now + 3500 + Math.random() * 9000
    } else {
      S.dir = Math.sign(d)
      S.walking = true
      S.x += Math.sign(d) * Math.min(Math.abs(d), (cur?.kind === 'mariposa' ? 24 : 15) * s * dt)
    }
  }
  layout()
}

function layout() {
  const s = S.scale
  const w = CRITTER_W * s, h = CRITTER_H * s
  petEl.style.width = `${w}px`
  petEl.style.height = `${h}px`
  petEl.style.left = `${Math.round(S.x - w / 2)}px`
  petEl.style.bottom = `${petBottom()}px`
  const near = S.cursor && !S.walking && Math.abs(S.cursor.x - S.x) < 260 && window.innerHeight - S.cursor.y < 260
  const flip = S.game?.reveal ? (S.game.reveal === 'izq' ? -1 : 1) : near ? Math.sign(S.cursor.x - S.x) || S.dir : S.dir
  petEl.style.transform = flip < 0 ? 'scaleX(-1)' : ''
  // En la siesta, el bocadillo y la pastilla salen sobre la casa
  const hidden = S.activity?.hidden
  const anchorX = hidden ? S.yardHome - 62 * s : S.x
  const hy = hidden ? groundY() + 30 * s : headY()
  place(badgeEl, hy + 6, anchorX)
  place(bubbleEl, hy + (badgeVisible() ? 34 : 10), anchorX)
  place(cardEl, headY() + 10, S.x)
  bubbleEl.classList.toggle('hidden', !S.bubble || Date.now() > S.bubble.until || S.cardOpen)
  sendHitRects()
}

function place(el, bottom, x) {
  const H = window.innerHeight
  const h = el.offsetHeight || 0
  el.style.bottom = `${Math.round(Math.min(bottom, H - h - 8))}px`
  const w = el.offsetWidth || 0
  const W = window.innerWidth
  el.style.left = `${Math.round(Math.max(8 + w / 2, Math.min(W - 8 - w / 2, x)))}px`
}

// ---------- Visitas ----------

function startVisitor(v) {
  const W = window.innerWidth
  const fromRight = Math.random() < 0.5
  S.visitor = { ...v, x: fromRight ? W + 30 : -30, dir: fromRight ? -1 : 1, leaving: false }
}

function stepVisitor(dt) {
  const v = S.visitor
  if (!v) {
    visitorEl.classList.add('hidden')
    return
  }
  const s = S.scale
  const flies = v.kind === 'pajaro' || v.kind === 'mariposa'
  if (!v.leaving && Date.now() > v.until) v.leaving = true
  const wander = v.kind === 'mariposa' ? Math.sin(Date.now() / 900) * 60 * s : 0
  const goal = v.leaving ? (v.dir < 0 ? -40 : window.innerWidth + 40) : S.x - v.dir * 40 * s + wander
  const d = goal - v.x
  const speed = (v.kind === 'tortuga' ? 6 : flies ? 30 : 16) * s
  if (Math.abs(d) > 2) {
    v.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt)
    v.facing = Math.sign(d)
  } else if (v.leaving) {
    S.visitor = null
    return
  }
  const c = drawVisitor(v.kind, S.frame)
  if (visitorEl.width !== c.w || visitorEl.height !== c.h) {
    visitorEl.width = c.w
    visitorEl.height = c.h
  }
  paint(vctx, c)
  visitorEl.classList.remove('hidden')
  visitorEl.style.width = `${c.w * s}px`
  visitorEl.style.height = `${c.h * s}px`
  visitorEl.style.left = `${Math.round(v.x - (c.w * s) / 2)}px`
  const air = flies ? 40 * s + Math.sin(Date.now() / 300) * 8 * s : 0
  visitorEl.style.bottom = `${groundY() + air}px`
  visitorEl.style.transform = (v.facing || v.dir) > 0 ? 'scaleX(-1)' : ''
}

// ---------- Lluvia y nieve ----------

function stepWeather(dt) {
  const kind = S.state?.weather?.kind
  const W = window.innerWidth
  const band = 320
  if (weatherEl.width !== W || weatherEl.height !== band) {
    weatherEl.width = W
    weatherEl.height = band
  }
  wctx.clearRect(0, 0, W, band)
  if (!yardOn() || !['lluvia', 'tormenta', 'nieve'].includes(kind)) {
    S.particles = []
    return
  }
  const snow = kind === 'nieve'
  const want = Math.round((W / 1920) * (snow ? 70 : kind === 'tormenta' ? 140 : 90))
  while (S.particles.length < want) S.particles.push({ x: Math.random() * W, y: Math.random() * band, v: snow ? 20 + Math.random() * 25 : 260 + Math.random() * 120, p: Math.random() * 6 })
  for (const p of S.particles) {
    p.y += p.v * dt
    if (snow) p.x += Math.sin((p.y + p.p * 40) / 30) * 0.4
    else p.x -= p.v * dt * 0.15
    if (p.y > band) {
      p.y = -4
      p.x = Math.random() * W
    }
    const fade = Math.min(1, p.y / 80)
    if (snow) {
      wctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`
      wctx.fillRect(Math.round(p.x), Math.round(p.y), S.scale + 1, S.scale + 1)
    } else {
      wctx.fillStyle = `rgba(160,200,255,${0.55 * fade})`
      wctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, S.scale - 1), 6 * S.scale)
    }
  }
  if (kind === 'tormenta' && Math.random() < 0.002) {
    weatherEl.classList.add('flash')
    setTimeout(() => weatherEl.classList.remove('flash'), 120)
  }
}

// ---------- Pastilla ----------

function badgeVisible() {
  return !S.cardOpen && !!S.state && (S.showBadge || !!S.state.hint || !!S.alert) && S.state.pet.alive
}

function renderBadge() {
  const st = S.state
  if (!st) return
  badgeEl.classList.toggle('hidden', !badgeVisible())
  const sess = st.limits?.session || st.limits?.week
  const parts = [`<span class="claude">✻</span>`]
  if (S.alert) parts.push(`<span>${esc(tmap('w.avisoCorto')[S.alert.kind] || '!')}</span>`)
  else if (sess && !sess.expired) parts.push(`<span style="color:${pctColor(sess.pct)}">${Math.round(sess.pct)}%</span>`)
  else parts.push(`<span>${fmtTokens(st.today.tokens)}</span>`)
  if (st.hint && !S.alert) parts.push(`<span class="alert">!</span>`)
  badgeEl.innerHTML = parts.join('')
  badgeEl.classList.toggle('working', !!st.working)
}

// ---------- Tarjeta ----------

function pips(v, color) {
  const n = Math.max(0, Math.min(10, Math.round(v / 10)))
  return `<div class="pips">${Array.from({ length: 10 }, (_, i) => `<span style="${i < n ? `background:${color}` : ''}"></span>`).join('')}</div>`
}

function meter(label, w, sub) {
  if (!w) return ''
  if (w.expired) return `<div class="meter"><span>${label}</span><span class="pct">—</span><span class="dim">${t('ui.caducada')}</span></div>`
  const c = pctColor(w.pct)
  return `<div class="meter"><span>${label}</span><span class="pct" style="color:${c}">${Math.round(w.pct)}%</span><div class="bar"><b style="width:${w.pct}%;background:${c}"></b></div></div>${sub}`
}

const weekday = (ts) => new Date(ts).toLocaleDateString(t('locale'), { weekday: 'short' }).replace('.', '')

function renderCard() {
  const st = S.state
  if (!st) return
  const p = st.pet
  const T = tmap('w.tabs')
  let html = ''
  if (st.update) html += `<button class="update" data-a="update">✨ ${esc(t('w.update', { v: st.update.latest }))}</button>`
  html += `<div class="head"><span class="name">${esc(p.name)}</span><span class="what">${esc(st.what)}</span><span class="mood"><i style="background:${st.mood === 'fuego' || st.mood === 'enfermo' ? '#FF6B5E' : '#E07A55'}"></i>${esc(st.moodLabel)}</span></div>`
  html += `<div class="tabs">${['mascota', 'tienda', 'logros', 'coleccion', 'ajustes', 'guia'].map((k) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${T[k]}</button>`).join('')}</div>`
  if (S.game) html += gameHtml()
  else if (S.tab === 'tienda') html += shopHtml()
  else if (S.tab === 'logros') html += achievementsHtml()
  else if (S.tab === 'coleccion') html += collectionHtml()
  else if (S.tab === 'ajustes') html += settingsHtml()
  else if (S.tab === 'guia') html += guideHtml()
  else html += petHtml()
  cardEl.innerHTML = html
}

function petHtml() {
  const st = S.state
  const p = st.pet
  let html = ''
  if (p.alive && p.stage !== 'huevo') {
    html += '<div class="needs">'
    for (const k of ['hambre', 'felicidad', 'energia', 'salud', 'higiene']) {
      const v = p.stats[k], low = v < 25
      const g = guideEntry(k)
      html += `<span class="lbl${low ? ' low' : ''}" data-info="${esc(g[1])}">${tmap('stat')[k]}</span><span data-info="${esc(g[1])}">${pips(v, low ? '#FF6B5E' : NEED_COLOR[k])}</span>`
    }
    html += '</div>'
    if (st.personalityText) html += `<div class="dim small pers">${esc(st.personalityText[0])} · ${esc(st.personalityText[1])}</div>`
  } else if (p.alive && st.egg) {
    const pct = Math.min(100, (st.egg.have / st.egg.need) * 100)
    html += `<div class="egg"><div class="dim">${esc(t('w.huevo', { need: fmtTokens(st.egg.need) }))}</div><div class="bar big"><b style="width:${pct}%;background:linear-gradient(90deg,#E07A55,#FFB38A)"></b></div><div class="dim small">${t('w.huevoProgreso', { have: fmtTokens(st.egg.have), need: fmtTokens(st.egg.need) })}</div></div>`
  } else html += `<div class="dim">${esc(t('ui.nubeInfo', { name: p.name }))}</div>`

  html += `<div class="section"><span class="claude">✻</span> ${t('w.tuClaude')}</div>`
  if (S.alert) html += `<div class="row alertrow">${esc(S.alert.msg)}</div>`
  html += st.working
    ? `<div class="row"><span class="working">● ${esc(t('w.claudeTrabaja', { kind: st.activity || t('w.ahora') }))}</span><span class="dim">${t('w.ritmo', { rate: fmtTokens(st.rate) })}</span></div>`
    : `<div class="row"><span class="dim">○ ${t('w.claudeReposo')}</span></div>`
  const L = st.limits
  if (!L) {
    const why = tmap('w.sinPorQue')
    html += `<div class="dim small why">${esc(why[st.limitsReason] || why.otro)}</div>`
    // Conectar la cuenta desde aquí mismo (login oficial de Claude en el navegador)
    if (S.connecting) html += `<div class="dim small" style="margin-top:6px">${esc(t('w.conectarPaso'))}</div><div class="inline" style="margin-top:6px"><input id="in-code" placeholder="${esc(t('w.conectarCodigo'))}"><button data-a="connect-code">OK</button></div>`
    else html += `<button class="connect" data-a="connect">✻ ${esc(t('w.conectar'))}</button>`
  } else {
    const s = L.session
    const proj = st.projection ? ` · <span class="${st.projection.color === '#5FD38D' ? 'ok' : 'warn'}">${esc(st.projection.text.replace(/^[▲✓] /, ''))}</span>` : ''
    const sSub = s?.resetsAt ? `<div class="sub">${t('ui.reiniciaCorto', { dur: fmtDuration(s.resetsAt - Date.now()) })}${proj}</div>` : ''
    if (s) html += meter(t('ui.sesion'), s, sSub)
    const w = L.week
    html += meter(t('ui.semana'), w, w?.resetsAt ? `<div class="sub">${t('ui.reiniciaDiaCorto', { dia: weekday(w.resetsAt), hora: fmtClock(w.resetsAt) })}</div>` : '')
  }
  html += `<div class="row"><span class="dim">${t('w.hoy')}</span><span><strong>${fmtTokens(st.today.tokens)}</strong> ${t('ui.tokensHoy')}</span></div>`

  const A = tmap('w.acciones')
  if (p.alive && p.stage !== 'huevo') {
    const hot = st.hint?.key ? ACTION_KEY[st.hint.key] : null
    const list = ['comer', 'chuche', 'jugar', 'limpiar', 'medicina', 'acariciar', 'luces', 'escenario']
    html += `<div class="actions">${list
      .map((a) => {
        const key = a === 'luces' && !p.lights ? 'luces_on' : a
        const icon = a === 'luces' ? (p.lights ? 'luna' : 'luz') : a === 'acariciar' ? 'mimo' : a
        const label = a === 'escenario' ? tmap('w.escenario')[S.scene] : A[key][0]
        return `<button data-a="${a}" data-info="${esc(`${A[key][0]}: ${A[key][1]}`)}" class="${hot === a ? 'hot' : ''}"><img src="${toDataURL(drawIcon(icon), `i-${icon}`)}" alt=""><small>${esc(label)}</small></button>`
      })
      .join('')}</div>`
  } else if (!p.alive) html += `<div class="actions one"><button data-a="nuevo"><span style="font-size:18px">🥚</span><small>${tmap('ui.btn').huevo}</small></button></div>`
  html += `<div class="info">${esc(p.alive && p.stage !== 'huevo' ? t('w.pasaRaton') : '')}</div>`
  html += `<div class="foot"><span title="${esc(t('w.bocadosInfo'))}">🍪 ${t('ui.bocadosN', { n: p.bocados })}</span><button class="link" data-a="full">${t('w.verTodo')} ↗</button></div>`
  return html
}

// Tienda: accesorios por hueco y decoración del escenario
// La guía: cómo funciona cada cosa (la energía depende de si ves el % real)
function guideEntry(key) {
  const G = tmap('w.guia')
  if (key === 'energia') return S.state?.limits ? G.energiaCon : G.energiaSin
  return G[key] || ['', '']
}

function guideHtml() {
  const G = tmap('w.guia')
  const keys = ['hambre', 'energia', 'felicidad', 'salud', 'higiene', 'dormir', 'bocados', 'crecer', 'forma', 'avisos', 'descuido']
  let html = `<div class="dim small" style="margin-bottom:8px">${esc(G.intro)}</div><div class="guide">`
  for (const k of keys) {
    const [title, text] = guideEntry(k)
    html += `<div class="gitem"><b>${esc(title)}</b><span>${esc(text)}</span></div>`
  }
  return `${html}</div>`
}

function shopHtml() {
  const st = S.state
  const shop = st.shop
  const slots = ['cabeza', 'cara', 'cuello', 'mano', 'espalda', 'decor']
  let html = `<div class="chips">${slots.map((k) => `<button data-slot="${k}" class="${S.shopSlot === k ? 'on' : ''}">${esc(shop.slots[k])}</button>`).join('')}</div>`
  const list = S.shopSlot === 'decor' ? shop.decor : shop.gear.filter((g) => g.slot === S.shopSlot)
  html += `<div class="shop">${list
    .map((it) => {
      const own = !!st.owned[it.id]
      const on = S.shopSlot === 'decor' ? (st.decor || []).includes(it.id) : st.gear[S.shopSlot] === it.id
      if (!own && !it.price) return '' // los regalos solo aparecen cuando los tienes
      const state = on ? tn('w.tienda', 'puesto') : own ? tn('w.tienda', 'tuyo') : `🍪 ${it.price}`
      const can = own || st.pet.bocados >= it.price
      const info = own ? tn('w.tienda', on ? 'quitar' : 'poner', { item: it.name }) : tn('w.tienda', 'comprar', { item: it.name, price: it.price })
      return `<button data-item="${it.id}" class="${on ? 'on' : ''}${can ? '' : ' cant'}" data-info="${esc(info)}"><img src="${preview(it.id, S.shopSlot)}" alt=""><small>${esc(it.name)}</small><em>${esc(state)}</em></button>`
    })
    .join('')}</div>`
  html += `<div class="info">${esc(tn('w.tienda', 'info', { n: st.pet.bocados }))}</div>`
  return html
}

function preview(id, slot) {
  const st = S.state
  const key = `p-${id}-${st.pet.stage}-${st.pet.form}-${st.pet.seed}`
  if (imgCache.has(key)) return imgCache.get(key)
  let canvas
  if (slot === 'decor') {
    canvas = new Canvas(40, 34, null)
    drawDecor(canvas, id, 4, 32, { night: false, frame: 2, season: st.season })
  } else {
    const p = st.pet.stage === 'huevo' || !st.pet.alive ? { stage: 'bebe', seed: st.pet.seed } : st.pet
    canvas = drawCritter({ ...p, gear: { [slot]: id }, poops: 0, alive: true, xp: 1 }, 'normal', 2).canvas
  }
  return toDataURL(crop(canvas, { top: slot === 'cabeza' || slot === 'cara' ? 0.62 : 1 }), key)
}

function achievementsHtml() {
  const st = S.state
  const ids = st.achievementIds || []
  const got = ids.filter((id) => st.achievements[id]).length
  const ach = tmap('ach')
  let html = `<div class="row"><span class="dim">${t('w.logrosN', { n: got, total: ids.length })}</span></div><div class="bar"><b style="width:${(got / Math.max(1, ids.length)) * 100}%;background:#F2C230"></b></div>`
  html += `<div class="medals">${ids
    .map((id) => {
      const ok = !!st.achievements[id]
      const [name, desc] = ach[id] || [id, '']
      const when = ok ? ` (${new Date(st.achievements[id]).toLocaleDateString(t('locale'))})` : ''
      return `<span class="medal${ok ? '' : ' locked'}" data-info="${esc(`${name}${when}: ${desc}`)}"><img src="${toDataURL(drawMedal(id, ok), `m-${id}-${ok}`)}" alt="${esc(name)}"></span>`
    })
    .join('')}</div>`
  html += `<div class="info">${esc(t('w.pasaLogro'))}</div>`
  return html
}

function collectionHtml() {
  const st = S.state
  const col = st.collection || {}
  const form = tmap('form'), style = tmap('style'), info = tmap('styleInfo'), sinfo = st.secretInfo || {}
  const total = SPECIES.length * STYLES.length + SECRETS.length
  let html = `<div class="row"><span class="dim">${t('w.coleccionN', { n: Object.keys(col).length, total })}</span></div><div class="grid">`
  for (const sp of SPECIES) {
    for (const stl of STYLES) {
      const ok = !!col[`${sp}-${stl}`]
      const name = `${form[sp]}${style[stl] ? ` ${style[stl]}` : ''}`
      html += `<span class="thumb${ok ? '' : ' locked'}" data-info="${esc(ok ? `${name}: ${info[stl]}` : t('w.bloqueado', { name: info[stl] }))}"><img src="${thumb(sp, stl, ok)}" alt=""></span>`
    }
  }
  html += `</div><div class="section">${t('w.secretas')}</div><div class="grid">`
  for (const sp of SECRETS) {
    const ok = !!col[`${sp}-secreta`]
    html += `<span class="thumb${ok ? '' : ' locked'}" data-info="${esc(ok ? `${form[sp]}: ${sinfo[sp]}` : `??? · ${sinfo[sp]}`)}"><img src="${thumb(sp, 'equilibrado', ok)}" alt=""></span>`
  }
  html += `</div><div class="info">${esc(t('w.coleccionInfo'))}</div>`
  return html
}

function thumb(form, style, ok) {
  const key = `c-${form}-${style}-${ok}`
  if (imgCache.has(key)) return imgCache.get(key)
  const { canvas } = drawCritter({ stage: 'adulto', form, style, poops: 0, alive: true, variant: 'normal', xp: 1 }, 'normal', 0)
  return toDataURL(crop(canvas, { silhouette: ok ? null : '#3A3852' }), key)
}

// Ajustes: nombre, ciudad, sonido, escenario, tamaño, avisos y compartir
function settingsHtml() {
  const st = S.state
  const W = tmap('w.ajustes')
  const sw = (key, on) => `<button class="switch${on ? ' on' : ''}" data-set="${key}"><i></i></button>`
  const seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button data-${key}="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`
  let html = `<label class="field"><span>${W.nombre}</span><div class="inline"><input id="in-name" maxlength="20" value="${esc(st.pet.name)}"><button data-a="save-name">${W.guardar}</button></div></label>`
  html += `<label class="field"><span>${W.ciudad}</span><div class="inline"><input id="in-city" maxlength="40" placeholder="${esc(W.ciudadEj)}" value="${esc(st.city || '')}"><button data-a="save-city">${W.guardar}</button></div></label>`
  if (st.weather) html += `<div class="dim small">${esc(t('w.tiempo', { kind: tmap('w.tiempos')[st.weather.kind], temp: Math.round(st.weather.temp ?? 0), city: st.weather.city }))}</div>`
  html += `<div class="setrow"><span>${W.escenario}</span>${seg('scene', [['completo', tmap('w.escenario').completo], ['isla', tmap('w.escenario').isla], ['no', tmap('w.escenario').no]], S.scene)}</div>`
  html += `<div class="setrow"><span>${W.tamano}</span>${seg('scale', [[2, W.pequena], [3, W.mediana], [4, W.grande]], S.scale)}</div>`
  html += `<div class="setrow"><span>${W.sonido}</span>${sw('sound', S.sound)}</div>`
  html += `<div class="setrow"><span>${W.porcentaje}</span>${sw('showBadge', S.showBadge)}</div>`
  html += `<div class="setrow"><span>${W.avisos}</span>${sw('hooks', st.hooks)}</div>`
  html += `<div class="section">${W.privacidad}</div>`
  html += `<div class="setrow"><span>${W.consultar}</span>${sw('noUsage', !st.widget?.noUsage)}</div>`
  html += `<div class="setrow"><span>${W.versiones}</span>${sw('noUpdates', !st.widget?.noUpdates)}</div>`
  if (st.connected) html += `<div class="setrow"><span></span><button class="link" data-a="disconnect">${W.desconectar}</button></div>`
  html += `<div class="actions two"><button data-a="share"><img src="${toDataURL(drawIcon('escenario'), 'i-escenario')}" alt=""><small>${W.compartir}</small></button><button data-a="full"><img src="${toDataURL(drawIcon('luz'), 'i-luz')}" alt=""><small>${t('w.verTodo')}</small></button></div>`
  html += `<div class="foot"><span>Claudagotchi ${esc(st.version)}</span>${st.update ? `<button class="link" data-a="update">${t('w.actualizar')}</button>` : `<span>${W.aldia}</span>`}</div>`
  return html
}

function gameHtml() {
  const g = S.game
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < g.results.length ? (g.results[i] ? 'win' : 'lose') : ''}"></i>`).join('')
  const msg = g.last == null ? t('w.ronda', { r: g.results.length + 1 }) : g.last ? t('ui.juego.bien') : t('ui.juego.mal')
  return `<div class="game"><div class="q">${t('w.juego')}</div><div class="btns"><button data-g="izq">◀</button><button data-g="der">▶</button></div><div class="dots">${dots}</div><div class="dim small">${esc(msg)}</div></div>`
}

function openCard(pin = false) {
  clearTimeout(S.closeTimer)
  if (pin) S.pinned = true
  if (S.alert && S.alert.kind !== 'limite') stopAlert()
  if (!S.cardOpen) {
    S.cardOpen = true
    renderCard()
    cardEl.classList.remove('hidden')
    renderBadge()
  }
}

function closeCard() {
  S.cardOpen = false
  S.pinned = false
  S.game = null
  cardEl.classList.add('hidden')
  renderBadge()
}

cardEl.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-info]')
  const infoEl = cardEl.querySelector('.info')
  if (el && infoEl) infoEl.textContent = el.dataset.info
})
cardEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'in-name') cardEl.querySelector('[data-a="save-name"]')?.click()
  if (e.key === 'Enter' && e.target.id === 'in-city') cardEl.querySelector('[data-a="save-city"]')?.click()
  if (e.key === 'Enter' && e.target.id === 'in-code') cardEl.querySelector('[data-a="connect-code"]')?.click()
  e.stopPropagation()
})
cardEl.addEventListener('click', async (e) => {
  const d = (k) => e.target.closest(`[data-${k}]`)?.dataset[k]
  const tab = d('tab'), a = d('a'), g = d('g'), slot = d('slot'), item = d('item'), set = d('set'), scene = d('scene'), scale = d('scale')
  S.pinned = true
  if (tab || slot || set || scene || scale) sfx('click')
  if (tab) {
    S.tab = tab
    S.game = null
    return renderCard()
  }
  if (slot) {
    S.shopSlot = slot
    return renderCard()
  }
  if (item) return action(S.state.owned[item] ? 'usar' : 'comprar', item)
  if (scene) return setConfig({ scene })
  if (scale) return setConfig({ scale: Number(scale) })
  if (set === 'sound') return setConfig({ sound: !S.sound })
  if (set === 'showBadge') return setConfig({ showBadge: !S.showBadge })
  if (set === 'noUsage' || set === 'noUpdates') {
    await setConfig({ [set]: !S.state.widget?.[set] })
    return load()
  }
  if (a === 'disconnect') {
    await invoke('run_cli', { args: ['desconectar'] }).catch(() => {})
    return load()
  }
  if (set === 'hooks') {
    const on = !S.state.hooks
    S.state.hooks = on // se ve al instante
    renderCard()
    await invoke('run_cli', { args: ['avisos', on ? 'si' : 'no'] }).catch(() => {})
    return load()
  }
  if (a === 'connect') {
    S.connecting = true
    renderCard()
    await invoke('run_cli', { args: ['conectar'] }).catch(() => {})
    setTimeout(() => cardEl.querySelector('#in-code')?.focus(), 50)
    return
  }
  if (a === 'connect-code') {
    const code = cardEl.querySelector('#in-code')?.value || ''
    const out = String(await invoke('run_cli', { args: ['conectar', code.trim()] }).catch(() => '')).trim()
    const ok = out.startsWith('✓')
    S.connecting = !ok
    say(ok ? t('w.conectarOk') : t('w.conectarMal'), !ok, 6000)
    sfx(ok ? 'logro' : 'error')
    if (cardEl.contains(document.activeElement)) document.activeElement.blur()
    return load()
  }
  if (a === 'save-name') return action('nombre', cardEl.querySelector('#in-name')?.value)
  if (a === 'save-city') {
    const out = await invoke('run_cli', { args: ['ciudad', cardEl.querySelector('#in-city')?.value || ''] }).catch(() => '')
    say(String(out || '').trim(), false, 5000)
    return load()
  }
  if (a === 'share') return shareCard()
  if (a === 'update') return invoke('update_now')
  if (a === 'full') return invoke('open_full')
  if (a === 'escenario') return setConfig({ scene: SCENES[(SCENES.indexOf(S.scene) + 1) % SCENES.length] })
  if (a === 'jugar') {
    if ((S.state?.pet.stats.energia ?? 0) < 10) return say(t('act.cansado'), true, 4000)
    S.game = { results: [], wins: 0, last: null, reveal: null }
    return renderCard()
  }
  if (a) return action(a)
  if (g && S.game && S.game.results.length < 5) {
    const dir = Math.random() < 0.5 ? 'izq' : 'der'
    S.game.reveal = dir
    S.game.last = dir === g
    S.game.results.push(S.game.last)
    if (S.game.last) S.game.wins++
    sfx(S.game.last ? 'acierto' : 'fallo')
    renderCard()
    if (S.game.results.length === 5) {
      const wins = S.game.wins
      setTimeout(() => {
        S.game = null
        sfx(wins >= 3 ? 'ganar' : 'perder')
        action('jugar', wins)
        renderCard()
      }, 1100)
    }
  }
})

// ---------- Ficha para compartir ----------

function canvasEl(c, k = 1) {
  const el = document.createElement('canvas')
  el.width = c.w
  el.height = c.h
  paint(el.getContext('2d'), c)
  void k
  return el
}

async function shareCard() {
  const st = S.state
  const p = st.pet
  const Wc = 720, Hc = 400
  const el = document.createElement('canvas')
  el.width = Wc
  el.height = Hc
  const g = el.getContext('2d')
  const grad = g.createLinearGradient(0, 0, Wc, Hc)
  grad.addColorStop(0, '#2B2650')
  grad.addColorStop(1, '#7A3E5C')
  g.fillStyle = grad
  g.fillRect(0, 0, Wc, Hc)
  g.imageSmoothingEnabled = false
  const yard = drawYard(Math.ceil(Wc / 4), { mode: 'completo', home: 110, hunger: p.stats.hambre, bocados: p.bocados, decor: st.decor || [], season: st.season, holiday: st.holiday, frame: 2 })
  g.drawImage(canvasEl(yard.canvas), 0, Hc - YARD_H * 4, yard.canvas.w * 4, YARD_H * 4)
  const crit = drawCritter({ ...p, gear: st.gear, poops: 0 }, p.alive ? 'feliz' : 'nube', 2).canvas
  g.drawImage(canvasEl(crit), 30, Hc - (GROUND - 2) * 4 - crit.h * 6, crit.w * 6, crit.h * 6)
  const ach = Object.keys(st.achievements || {}).length
  const col = Object.keys(st.collection || {}).length
  g.fillStyle = '#FFB38A'
  g.font = '700 40px system-ui, Segoe UI, sans-serif'
  g.fillText(p.name, 380, 70)
  g.fillStyle = '#ECEAF5'
  g.font = '500 20px system-ui, Segoe UI, sans-serif'
  const lines = [
    st.what,
    st.personalityText ? st.personalityText[0] : '',
    t('w.ficha.edad', { dur: fmtDuration(Date.now() - p.born), gen: p.generation }),
    t('w.ficha.comido', { tokens: fmtTokens(p.xp) }),
    t('w.ficha.logros', { n: ach, total: (st.achievementIds || []).length }),
    tn('w.ficha', 'coleccion', { n: col, total: 35 }),
  ].filter(Boolean)
  lines.forEach((l, i) => g.fillText(l, 380, 110 + i * 30))
  g.fillStyle = 'rgba(255,255,255,.6)'
  g.font = '500 14px system-ui, Segoe UI, sans-serif'
  g.fillText('✻ Claudagotchi · github.com/CarlosDarko/claudagotchi', 380, 300)
  const data = el.toDataURL('image/png')
  sfx('comprar')
  if (TAURI) {
    const file = await invoke('save_png', { name: `${p.name}-claudagotchi`, data }).catch(() => null)
    if (file) say(tn('w.ficha', 'guardada'), false, 6000)
  } else {
    const a = document.createElement('a')
    a.href = data
    a.download = `${p.name}-claudagotchi.png`
    a.click()
  }
}

// ---------- Ratón ----------

function rectOf(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

function petRect() {
  const s = S.scale
  const left = S.x - (CRITTER_W * s) / 2
  const top = window.innerHeight - petBottom() - CRITTER_H * s
  const b = S.box
  return { x: left + (b.left - 3) * s, y: top + (b.top - 3) * s, w: (b.right - b.left + 6) * s, h: (CRITTER_H - b.top + 3) * s }
}

const inside = (p, r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

function onCursor(p) {
  S.cursor = p
  if (S.drag) {
    S.x = Math.max(20, Math.min(window.innerWidth - 20, S.drag.x0 + (p.x - S.drag.px)))
    if (S.scene === 'isla') S.home = S.drag.home0 + (S.x - S.drag.x0)
    if (Math.abs(p.x - S.drag.px) > 4) S.drag.moved = true
    S.target = null
    drawYardNow()
    return
  }
  const overPet = !S.activity?.hidden && inside(p, petRect())
  const overCard = S.cardOpen && inside(p, rectOf(cardEl))
  const overBadge = badgeVisible() && inside(p, rectOf(badgeEl))
  const was = S.hover
  S.hover = overPet || overCard || overBadge
  if (S.hover && !was) {
    clearTimeout(S.closeTimer)
    S.closeTimer = setTimeout(() => S.hover && openCard(), 220)
  } else if (!S.hover && was) {
    clearTimeout(S.closeTimer)
    S.closeTimer = setTimeout(() => !S.hover && !(cardEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') && closeCard(), S.pinned ? 5000 : 450)
  }
}

let lastRects = ''
function sendHitRects() {
  if (!TAURI) return
  // Mientras se arrastra, la ventana entera recibe el ratón para no perder el 'soltar'
  const rects = S.drag ? [{ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }] : S.activity?.hidden ? [] : [petRect()]
  if (S.cardOpen && !S.drag) rects.push(rectOf(cardEl))
  if (badgeVisible() && !S.drag) rects.push(rectOf(badgeEl))
  const key = JSON.stringify(rects.map((r) => [r.x, r.y, r.w, r.h].map(Math.round)))
  if (key === lastRects) return
  lastRects = key
  invoke('set_hit_rects', { rects: rects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })) })
}

// Arrastrar: se coge con el ratón y se lleva donde quieras (en modo isla, con su isla)
petEl.addEventListener('mousedown', (e) => {
  S.drag = { px: e.clientX, x0: S.x, home0: homePx(), moved: false }
})
window.addEventListener('mousemove', (e) => S.drag && onCursor({ x: e.clientX, y: e.clientY }))
window.addEventListener('mouseup', () => {
  if (!S.drag) return
  if (S.drag.moved) {
    S.idleUntil = performance.now() + 8000
    S.perch = null
    if (S.scene === 'isla') setConfig({ home: Math.round(S.home) })
    petEl.dataset.dragged = '1'
  }
  S.drag = null
})

petEl.addEventListener('click', () => {
  if (petEl.dataset.dragged) {
    delete petEl.dataset.dragged
    return
  }
  if (S.alert) stopAlert()
  if (S.pinned) closeCard()
  else {
    openCard(true)
    S.happyUntil = Date.now() + 1200
    sfx('saltito')
  }
})
badgeEl.addEventListener('click', () => openCard(true))
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCard()
})
window.addEventListener('resize', drawYardNow)
if (TAURI) {
  TAURI.event.listen('cursor', (e) => !S.drag && onCursor(e.payload))
  TAURI.event.listen('active-window', (e) => {
    S.activeWin = e.payload
  })
  TAURI.event.listen('config', (e) => {
    const c = e.payload
    if (c.scale) S.scale = c.scale
    if (c.showBadge != null) S.showBadge = c.showBadge
    if (c.scene) S.scene = c.scene
    if (c.sound != null) {
      S.sound = c.sound
      setSound(c.sound)
    }
    renderBadge()
    drawYardNow()
    if (S.cardOpen) renderCard()
  })
  TAURI.event.listen('refresh', load)
} else window.addEventListener('mousemove', (e) => !S.drag && onCursor({ x: e.clientX, y: e.clientY }))

// ---------- Bucle ----------

let last = performance.now()
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (S.state) {
    step(dt)
    stepVisitor(dt)
    stepWeather(dt)
  }
  requestAnimationFrame(loop)
}
setInterval(() => {
  S.frame++
  drawPet()
  if (S.frame % 5 === 0) drawYardNow()
}, 200)
setInterval(load, 5000)
load().then(() => {
  drawPet()
  drawYardNow()
  requestAnimationFrame(loop)
})

// ---------- Vista previa en el navegador (sin Tauri) ----------

async function mockInvoke(cmd, args) {
  if (cmd === 'get_state') return JSON.stringify(window.__MOCK__ || (await (await fetch('./mock.json')).json()))
  if (cmd === 'do_action') return JSON.stringify({ res: { ok: true, msg: '' }, state: S.state })
  if (cmd === 'set_config') {
    const st = S.state
    st.widget = { ...(st.widget || {}), ...JSON.parse(args.patch) }
    return JSON.stringify(st.widget)
  }
  return null
}
window.__claudagotchi = S
window.__claudagotchiOpen = (tab) => {
  S.tab = tab || 'mascota'
  openCard(true)
  renderCard()
}
window.__claudagotchiAlert = (kind) => claudeAlert(kind, { project: 'mi-web' })
