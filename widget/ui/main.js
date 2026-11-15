// El widget de escritorio: la mascota vive en su escenario, por encima de la barra
// de tareas. La ventana es transparente y deja pasar los clics salvo encima de la
// mascota, de su pastilla y de su tarjeta (eso lo decide el lado Rust con los
// rectángulos que le mandamos).
import { drawCritter, CRITTER_W, CRITTER_H } from '../../src/sprites.js'
import { drawIcon, drawMedal, drawYard, YARD_H, GROUND } from '../../src/art.js'
import { t, tmap, setLocale } from '../../src/i18n/index.js'
import { fmtTokens, fmtDuration, fmtClock } from '../../src/util.js'

const TAURI = window.__TAURI__
const invoke = (cmd, args) => (TAURI ? TAURI.core.invoke(cmd, args) : mockInvoke(cmd, args))

const $ = (id) => document.getElementById(id)
const petEl = $('pet'), yardEl = $('yard'), badgeEl = $('badge'), bubbleEl = $('bubble'), cardEl = $('card'), fxEl = $('fx')
const ctx = petEl.getContext('2d')
const yctx = yardEl.getContext('2d')

const NEED_COLOR = { hambre: '#F2A93B', felicidad: '#F2668B', energia: '#FFD23F', salud: '#5FD38D', higiene: '#5BC0F2' }
const ACTION_KEY = { c: 'comer', x: 'chuche', j: 'jugar', l: 'limpiar', m: 'medicina', a: 'acariciar', d: 'luces' }
const SPECIES = ['opus', 'sonnet', 'haiku', 'fable', 'mixto']
const STYLES = ['obras', 'explorador', 'hacker', 'sabio', 'director', 'equilibrado']
const SCENES = ['isla', 'completo', 'no']
const pctColor = (p) => (p == null ? '#8A8AA0' : p >= 90 ? '#FF6B5E' : p >= 75 ? '#F2A93B' : '#5FD38D')

const S = {
  state: null,
  prev: null,
  scale: 2,
  showBadge: true,
  scene: 'isla',
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
  info: null,
  closeTimer: null,
  bubble: null,
  lastEventTs: 0,
  lastHint: null,
  game: null,
  happyUntil: 0,
  hatchAt: 0,
}

// ---------- Utilidades de dibujo ----------

// Lienzo de pixel art -> imagen (para iconos, medallas y miniaturas)
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
  // Eclosión
  if (prev && prev.pet.stage === 'huevo' && state.pet.stage !== 'huevo') hatch()
  // Comida de Claude: chispas que caen y se come
  if (prev && state.today.food > prev.today.food && !S.cardOpen) sparks(state.today.food - prev.today.food)
  if (state.event && state.event.ts > S.lastEventTs) {
    S.lastEventTs = state.event.ts
    say(state.event.text, ['aviso', 'fuego', 'muerte'].includes(state.event.kind))
  } else if (state.hint?.text && state.hint.key !== S.lastHint) say(state.hint.text, true)
  S.lastHint = state.hint?.key || null
  if (S.cardOpen && !S.game) renderCard()
  renderBadge()
  drawYardNow()
}

function say(text, alert = false, ms = 8000) {
  S.bubble = { text, alert, until: Date.now() + ms }
  bubbleEl.textContent = text
  bubbleEl.classList.toggle('alert', alert)
}

async function action(name, arg = null) {
  const out = JSON.parse(await invoke('do_action', { name, arg: arg == null ? null : String(arg) }))
  if (!out.res.ok && out.res.msg) say(out.res.msg, true, 4500)
  else if (out.res.ok && !['luces', 'medicina'].includes(name)) {
    S.happyUntil = Date.now() + 2500
    if (name === 'acariciar') hearts()
  }
  apply(out.state)
}

async function setConfig(patch) {
  if (patch.scale) S.scale = patch.scale
  if (patch.scene) S.scene = patch.scene
  if (patch.showBadge != null) S.showBadge = patch.showBadge
  await invoke('set_config', { patch: JSON.stringify(patch) })
  drawYardNow()
  if (S.cardOpen) renderCard()
}

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

function headY() {
  return petBottom() + (CRITTER_H - S.box.top) * S.scale
}

// Chispas de Claude: los tokens nuevos caen como chispas naranjas y se los come
function sparks(delta) {
  const n = Math.min(7, Math.max(2, Math.ceil(delta / 60_000)))
  const top = window.innerHeight - 40
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const sx = S.x + (Math.random() * 2 - 1) * 70
      fx('✻', { x: sx, y: top, dx: S.x - sx, dy: -(top - headY()) - 6, ms: 1300, cls: 'spark' })
    }, i * 140)
  }
  setTimeout(() => {
    fx(`+${fmtTokens(delta)}`, { x: S.x, y: headY() + 4, dy: 34, ms: 1600, cls: 'gain' })
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
    say(t('w.nacido'), false, 6000)
  }, 1600)
}

// ---------- La mascota ----------

function moodNow() {
  const st = S.state
  if (!st) return 'huevo'
  if (Date.now() < S.happyUntil && st.pet.alive && !['dormido', 'huevo'].includes(st.mood)) return 'feliz'
  return st.mood
}

function drawPet() {
  if (!S.state) return
  const hatching = Date.now() - S.hatchAt < 1600
  const pet = hatching ? { ...S.state.pet, stage: 'huevo', xp: 1 } : S.state.pet
  const { canvas, box } = drawCritter(pet, hatching ? 'huevo' : moodNow(), S.frame, { walking: S.walking, look: S.walking ? 1 : 0 })
  S.box = box
  if (petEl.width !== CRITTER_W) {
    petEl.width = CRITTER_W
    petEl.height = CRITTER_H
  }
  paint(ctx, canvas)
}

const yardOn = () => S.scene !== 'no'
const petBottom = () => (yardOn() ? (GROUND - 2) * S.scale : 0)

function drawYardNow() {
  if (!S.state) return
  if (!yardOn()) {
    yardEl.classList.add('hidden')
    S.walk = null
    return
  }
  yardEl.classList.remove('hidden')
  const s = S.scale
  const wpx = Math.ceil(window.innerWidth / s)
  const home = Math.max(90, wpx - 120)
  const y = drawYard(wpx, { mode: S.scene, home, hunger: S.state.pet.stats.hambre, bocados: S.state.pet.bocados, frame: S.frame })
  S.walk = [y.walk[0] * s, y.walk[1] * s]
  if (yardEl.width !== wpx || yardEl.height !== YARD_H) {
    yardEl.width = wpx
    yardEl.height = YARD_H
  }
  yardEl.style.width = `${wpx * s}px`
  yardEl.style.height = `${YARD_H * s}px`
  paint(yctx, y.canvas)
}

// ---------- Movimiento ----------

const STILL = ['dormido', 'trabajando', 'enfermo', 'huevo', 'nube', 'cansado']

function step(dt) {
  const W = window.innerWidth
  const s = S.scale
  const half = (CRITTER_W * s) / 2
  const [lo, hi] = S.walk ? [S.walk[0] + half * 0.4, S.walk[1] - half * 0.4] : [half, W - half]
  if (S.x == null) S.x = Math.min(hi, W - 160)
  const still = STILL.includes(moodNow()) || S.cardOpen || S.hover || S.game || Date.now() - S.hatchAt < 3000
  const now = performance.now()
  S.walking = false
  const outside = S.x < lo || S.x > hi
  if (outside) S.target = Math.max(lo, Math.min(hi, S.x))
  if ((!still && now > S.idleUntil) || outside) {
    if (S.target == null) {
      const span = Math.min((hi - lo) * 0.6, 380)
      S.target = Math.max(lo, Math.min(hi, S.x + (Math.random() * 2 - 1) * span))
    }
    const d = S.target - S.x
    if (Math.abs(d) < 2) {
      S.target = null
      S.idleUntil = now + 3500 + Math.random() * 9000
    } else {
      S.dir = Math.sign(d)
      S.walking = true
      S.x += Math.sign(d) * Math.min(Math.abs(d), 15 * s * dt)
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
  const flip = S.game?.reveal ? (S.game.reveal === 'izq' ? -1 : 1) : S.dir
  petEl.style.transform = flip < 0 ? 'scaleX(-1)' : ''
  const hy = headY()
  place(badgeEl, hy + 6)
  place(bubbleEl, hy + (badgeVisible() ? 34 : 10))
  place(cardEl, hy + 10)
  bubbleEl.classList.toggle('hidden', !S.bubble || Date.now() > S.bubble.until || S.cardOpen)
  sendHitRects()
}

function place(el, bottom) {
  el.style.bottom = `${Math.round(bottom)}px`
  const w = el.offsetWidth || 0
  const W = window.innerWidth
  el.style.left = `${Math.round(Math.max(8 + w / 2, Math.min(W - 8 - w / 2, S.x)))}px`
}

// ---------- Pastilla ----------

function badgeVisible() {
  return !S.cardOpen && !!S.state && (S.showBadge || !!S.state.hint) && S.state.pet.alive
}

function renderBadge() {
  const st = S.state
  if (!st) return
  badgeEl.classList.toggle('hidden', !badgeVisible())
  const sess = st.limits?.session || st.limits?.week
  const parts = []
  if (S.showBadge) {
    parts.push(`<span class="claude">✻</span>`)
    if (sess && !sess.expired) parts.push(`<span style="color:${pctColor(sess.pct)}">${Math.round(sess.pct)}%</span>`)
    else parts.push(`<span>${fmtTokens(st.today.tokens)}</span>`)
  }
  if (st.hint) parts.push(`<span class="alert">!</span>`)
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
  let html = `<div class="head"><span class="name">${esc(p.name)}</span><span class="what">${esc(st.what)}</span><span class="mood"><i style="background:${st.mood === 'fuego' || st.mood === 'enfermo' ? '#FF6B5E' : '#E07A55'}"></i>${esc(st.moodLabel)}</span></div>`
  html += `<div class="tabs">${['mascota', 'logros', 'coleccion'].map((k) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${T[k]}</button>`).join('')}</div>`
  if (S.game) html += gameHtml()
  else if (S.tab === 'logros') html += achievementsHtml()
  else if (S.tab === 'coleccion') html += collectionHtml()
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
      html += `<span class="lbl${low ? ' low' : ''}">${tmap('stat')[k]}</span>${pips(v, low ? '#FF6B5E' : NEED_COLOR[k])}`
    }
    html += '</div>'
  } else if (p.alive && st.egg) {
    const pct = Math.min(100, (st.egg.have / st.egg.need) * 100)
    html += `<div class="egg"><div class="dim">${esc(t('w.huevo', { need: fmtTokens(st.egg.need) }))}</div><div class="bar big"><b style="width:${pct}%;background:linear-gradient(90deg,#E07A55,#FFB38A)"></b></div><div class="dim small">${t('w.huevoProgreso', { have: fmtTokens(st.egg.have), need: fmtTokens(st.egg.need) })}</div></div>`
  } else html += `<div class="dim">${esc(t('ui.nubeInfo', { name: p.name }))}</div>`

  // Tu Claude Code
  html += `<div class="section"><span class="claude">✻</span> ${t('w.tuClaude')}</div>`
  html += st.working
    ? `<div class="row"><span class="working">● ${esc(t('w.claudeTrabaja', { kind: st.activity || t('w.ahora') }))}</span><span class="dim">${t('w.ritmo', { rate: fmtTokens(st.rate) })}</span></div>`
    : `<div class="row"><span class="dim">○ ${t('w.claudeReposo')}</span></div>`
  const L = st.limits
  if (!L) {
    const why = tmap('w.sinPorQue')
    html += `<div class="dim small why">${esc(why[st.limitsReason] || why.otro)}</div>`
  } else {
    const s = L.session
    const proj = st.projection ? ` · <span class="${st.projection.color === '#5FD38D' ? 'ok' : 'warn'}">${esc(st.projection.text.replace(/^[▲✓] /, ''))}</span>` : ''
    const sSub = s?.resetsAt ? `<div class="sub">${t('ui.reiniciaCorto', { dur: fmtDuration(s.resetsAt - Date.now()) })}${proj}</div>` : ''
    if (s) html += meter(t('ui.sesion'), s, sSub)
    const w = L.week
    html += meter(t('ui.semana'), w, w?.resetsAt ? `<div class="sub">${t('ui.reiniciaDiaCorto', { dia: weekday(w.resetsAt), hora: fmtClock(w.resetsAt) })}</div>` : '')
  }
  html += `<div class="row"><span class="dim">${t('w.hoy')}</span><span><strong>${fmtTokens(st.today.tokens)}</strong> ${t('ui.tokensHoy')}</span></div>`

  // Acciones
  const A = tmap('w.acciones')
  const sceneBtn = () => `<button data-a="escenario" data-info="${esc(`${A.escenario[0]}: ${A.escenario[1]}`)}"><img src="${toDataURL(drawIcon('escenario'), 'i-escenario')}" alt=""><small>${esc(tmap('w.escenario')[S.scene])}</small></button>`
  if (p.alive && p.stage !== 'huevo') {
    const hot = st.hint?.key ? ACTION_KEY[st.hint.key] : null
    const list = ['comer', 'chuche', 'jugar', 'limpiar', 'medicina', 'acariciar', 'luces']
    html += `<div class="actions">${list
      .map((a) => {
        const key = a === 'luces' && !p.lights ? 'luces_on' : a
        const icon = a === 'luces' ? (p.lights ? 'luna' : 'luz') : a === 'acariciar' ? 'mimo' : a
        return `<button data-a="${a}" data-info="${esc(`${A[key][0]}: ${A[key][1]}`)}" class="${hot === a ? 'hot' : ''}"><img src="${toDataURL(drawIcon(icon), `i-${icon}`)}" alt=""><small>${esc(A[key][0])}</small></button>`
      })
      .join('')}${sceneBtn()}</div>`
  } else if (p.alive) html += `<div class="actions one">${sceneBtn()}</div>`
  else html += `<div class="actions one"><button data-a="nuevo"><span style="font-size:18px">🥚</span><small>${tmap('ui.btn').huevo}</small></button></div>`
  html += `<div class="info">${esc(S.info || (p.alive && p.stage !== 'huevo' ? t('w.pasaRaton') : ''))}</div>`
  html += `<div class="foot"><span title="${esc(t('w.bocadosInfo'))}">🍪 ${t('ui.bocadosN', { n: p.bocados })}</span><button class="link" data-a="full">${t('w.verTodo')} ↗</button></div>`
  return html
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
  const form = tmap('form'), style = tmap('style'), info = tmap('styleInfo')
  const total = SPECIES.length * STYLES.length
  let html = `<div class="row"><span class="dim">${t('w.coleccionN', { n: Object.keys(col).length, total })}</span></div>`
  html += `<div class="grid">`
  for (const sp of SPECIES) {
    for (const stl of STYLES) {
      const key = `${sp}-${stl}`
      const ok = !!col[key]
      const name = `${form[sp]}${style[stl] ? ` ${style[stl]}` : ''}`
      const img = toDataURL(thumb(sp, stl, ok), `c-${key}-${ok}`)
      html += `<span class="thumb${ok ? '' : ' locked'}" data-info="${esc(ok ? `${name}: ${info[stl]}` : t('w.bloqueado', { name: info[stl] }))}"><img src="${img}" alt=""></span>`
    }
  }
  html += `</div><div class="info">${esc(t('w.coleccionInfo'))}</div>`
  return html
}

// Miniatura recortada a la criatura (sin la sombra)
function thumb(form, style, ok) {
  const { canvas } = drawCritter({ stage: 'adulto', form, style, poops: 0, alive: true, variant: 'normal', xp: 1 }, 'normal', 0)
  let x0 = canvas.w, y0 = canvas.h, x1 = 0, y1 = 0
  for (let y = 0; y < canvas.h; y++) for (let x = 0; x < canvas.w; x++) {
    const c = canvas.get(x, y)
    if (c && c.length === 7) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  }
  const size = Math.max(x1 - x0, y1 - y0) + 3
  const ox = x0 - Math.floor((size - (x1 - x0)) / 2), oy = y0 - Math.floor((size - (y1 - y0)) / 2)
  const out = new canvas.constructor(size, size, null)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = canvas.get(x + ox, y + oy)
    if (c && c.length === 7) out.set(x, y, ok ? c : '#3A3852')
  }
  return out
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
cardEl.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]')?.dataset.tab
  const a = e.target.closest('[data-a]')?.dataset.a
  const g = e.target.closest('[data-g]')?.dataset.g
  S.pinned = true
  if (tab) {
    S.tab = tab
    S.game = null
    return renderCard()
  }
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
    renderCard()
    if (S.game.results.length === 5) {
      const wins = S.game.wins
      setTimeout(() => {
        S.game = null
        action('jugar', wins)
        renderCard()
      }, 1100)
    }
  }
})

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
  const overPet = inside(p, petRect())
  const overCard = S.cardOpen && inside(p, rectOf(cardEl))
  const overBadge = badgeVisible() && inside(p, rectOf(badgeEl))
  const was = S.hover
  S.hover = overPet || overCard || overBadge
  if (S.hover && !was) {
    clearTimeout(S.closeTimer)
    S.closeTimer = setTimeout(() => S.hover && openCard(), 220)
  } else if (!S.hover && was) {
    clearTimeout(S.closeTimer)
    // Fijada con clic aguanta más al alejar el ratón
    S.closeTimer = setTimeout(() => !S.hover && closeCard(), S.pinned ? 5000 : 450)
  }
}

let lastRects = ''
function sendHitRects() {
  if (!TAURI) return
  const rects = [petRect()]
  if (S.cardOpen) rects.push(rectOf(cardEl))
  if (badgeVisible()) rects.push(rectOf(badgeEl))
  const key = JSON.stringify(rects.map((r) => [r.x, r.y, r.w, r.h].map(Math.round)))
  if (key === lastRects) return
  lastRects = key
  invoke('set_hit_rects', { rects: rects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })) })
}

petEl.addEventListener('click', () => {
  if (S.pinned) closeCard()
  else {
    openCard(true)
    S.happyUntil = Date.now() + 1200
  }
})
badgeEl.addEventListener('click', () => openCard(true))
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCard()
})
window.addEventListener('resize', drawYardNow)
if (TAURI) {
  TAURI.event.listen('cursor', (e) => onCursor(e.payload))
  TAURI.event.listen('config', (e) => {
    const c = e.payload
    if (c.scale) S.scale = c.scale
    if (c.showBadge != null) S.showBadge = c.showBadge
    if (c.scene) S.scene = c.scene
    renderBadge()
    drawYardNow()
    if (S.cardOpen) renderCard()
  })
  TAURI.event.listen('refresh', load)
} else window.addEventListener('mousemove', (e) => onCursor({ x: e.clientX, y: e.clientY }))

// ---------- Bucle ----------

let last = performance.now()
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (S.state) step(dt)
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
