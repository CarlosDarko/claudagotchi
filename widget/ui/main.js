// El widget de escritorio: la mascota pasea por el borde de abajo de la pantalla,
// por encima de la barra de tareas. La ventana es transparente y deja pasar los
// clics salvo encima de la mascota y de su tarjeta (eso lo decide el lado Rust
// con los rectángulos que le mandamos).
import { drawCritter, CRITTER_W, CRITTER_H } from '../../src/sprites.js'
import { t, tmap, setLocale } from '../../src/i18n/index.js'
import { fmtTokens, fmtDuration, fmtClock } from '../../src/util.js'

const TAURI = window.__TAURI__
const invoke = (cmd, args) => (TAURI ? TAURI.core.invoke(cmd, args) : mockInvoke(cmd, args))

const $ = (id) => document.getElementById(id)
const petEl = $('pet'), badgeEl = $('badge'), bubbleEl = $('bubble'), cardEl = $('card')
const ctx = petEl.getContext('2d')

const NEED_COLOR = { hambre: '#F2A93B', felicidad: '#F2668B', energia: '#FFD23F', salud: '#5FD38D', higiene: '#5BC0F2' }
const ICON = { comer: '🍖', chuche: '🍬', jugar: '🎾', limpiar: '🧽', medicina: '💊', acariciar: '🤚', luces: '💡' }
const ACTION_KEY = { c: 'comer', x: 'chuche', j: 'jugar', l: 'limpiar', m: 'medicina', a: 'acariciar', d: 'luces' }
const pctColor = (p) => (p == null ? '#8A8AA0' : p >= 90 ? '#FF6B5E' : p >= 75 ? '#F2A93B' : '#5FD38D')

const S = {
  state: null,
  scale: 3,
  showBadge: true,
  x: null,
  dir: 1,
  target: null,
  idleUntil: 0,
  frame: 0,
  box: { top: 20, left: 14, right: 30, bottom: 34 },
  hover: false,
  cardOpen: false,
  pinned: false,
  closeTimer: null,
  bubble: null, // { text, alert, until }
  lastEventTs: 0,
  lastHint: null,
  game: null,
  happyUntil: 0,
}

// ---------- Datos ----------

async function load() {
  try {
    apply(JSON.parse(await invoke('get_state')))
  } catch (e) {
    console.error(e)
  }
}

function apply(state) {
  S.state = state
  setLocale(state.locale)
  const w = state.widget || {}
  S.scale = w.scale || S.scale
  S.showBadge = w.showBadge ?? S.showBadge
  if (state.event && state.event.ts > S.lastEventTs) {
    S.lastEventTs = state.event.ts
    say(state.event.text, ['aviso', 'fuego', 'muerte'].includes(state.event.kind))
  } else if (state.hint?.text && state.hint.key !== S.lastHint) say(state.hint.text, true)
  S.lastHint = state.hint?.key || null
  if (S.cardOpen && !S.game) renderCard()
  renderBadge()
}

function say(text, alert = false, ms = 8000) {
  S.bubble = { text, alert, until: Date.now() + ms }
  bubbleEl.textContent = text
  bubbleEl.classList.toggle('alert', alert)
}

async function action(name, arg = null) {
  const out = JSON.parse(await invoke('do_action', { name, arg: arg == null ? null : String(arg) }))
  if (!out.res.ok && out.res.msg) say(out.res.msg, true, 4500)
  else if (out.res.ok && !['luces', 'medicina'].includes(name)) S.happyUntil = Date.now() + 2500
  apply(out.state)
}

// ---------- Dibujo de la mascota ----------

function moodNow() {
  const st = S.state
  if (!st) return 'huevo'
  if (Date.now() < S.happyUntil && st.pet.alive && !['dormido', 'huevo'].includes(st.mood)) return 'feliz'
  return st.mood
}

function drawPet() {
  if (!S.state) return
  const { canvas, box } = drawCritter(S.state.pet, moodNow(), S.frame)
  S.box = box
  if (petEl.width !== CRITTER_W) {
    petEl.width = CRITTER_W
    petEl.height = CRITTER_H
  }
  ctx.clearRect(0, 0, CRITTER_W, CRITTER_H)
  for (let y = 0; y < CRITTER_H; y++) {
    for (let x = 0; x < CRITTER_W; x++) {
      const c = canvas.get(x, y)
      if (c) {
        ctx.fillStyle = c
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
}

// ---------- Movimiento ----------

const STILL = ['dormido', 'trabajando', 'enfermo', 'huevo', 'nube', 'cansado']

function step(dt) {
  const W = window.innerWidth
  const s = S.scale
  const half = (CRITTER_W * s) / 2
  if (S.x == null) S.x = S.state?.widget?.x ?? W - 220
  S.x = Math.max(half, Math.min(W - half, S.x))
  const still = STILL.includes(moodNow()) || S.cardOpen || S.hover || S.game
  const now = performance.now()
  if (!still && now > S.idleUntil) {
    if (S.target == null) {
      // Paseos cortos, casi siempre cerca de donde está
      const span = Math.min(W * 0.35, 420)
      S.target = Math.max(half, Math.min(W - half, S.x + (Math.random() * 2 - 1) * span))
    }
    const d = S.target - S.x
    const speed = 16 * s
    if (Math.abs(d) < 2) {
      S.target = null
      S.idleUntil = now + 3000 + Math.random() * 9000
    } else {
      S.dir = Math.sign(d)
      S.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt)
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
  const flip = S.game?.reveal ? (S.game.reveal === 'izq' ? -1 : 1) : S.dir
  petEl.style.transform = flip < 0 ? 'scaleX(-1)' : ''
  const headY = (CRITTER_H - S.box.top) * s // altura de la cabeza desde abajo
  place(badgeEl, headY + 6)
  place(bubbleEl, headY + (badgeVisible() ? 34 : 10))
  place(cardEl, headY + 10)
  bubbleEl.classList.toggle('hidden', !S.bubble || Date.now() > S.bubble.until || S.cardOpen)
  sendHitRects()
}

function place(el, bottom) {
  el.style.bottom = `${Math.round(bottom)}px`
  const w = el.offsetWidth || 0
  const W = window.innerWidth
  const left = Math.max(8 + w / 2, Math.min(W - 8 - w / 2, S.x))
  el.style.left = `${Math.round(left)}px`
}

// ---------- Pastilla con el % ----------

function badgeVisible() {
  return !S.cardOpen && !!S.state && (S.showBadge || !!S.state.hint) && S.state.pet.alive
}

function renderBadge() {
  const st = S.state
  if (!st) return
  badgeEl.classList.toggle('hidden', !badgeVisible())
  const sess = st.limits?.session || st.limits?.week
  const parts = []
  if (S.showBadge && sess && !sess.expired) parts.push(`<span class="dot" style="background:${pctColor(sess.pct)}"></span>${Math.round(sess.pct)}%`)
  else if (S.showBadge) parts.push(`<span class="dot" style="background:${st.working ? '#5FD38D' : '#77738F'}"></span>${fmtTokens(st.today.tokens)}`)
  if (st.hint) parts.push(`<span class="alert">!</span>`)
  badgeEl.innerHTML = parts.join(' ')
}

// ---------- Tarjeta ----------

function pips(v, color) {
  const n = Math.max(0, Math.min(10, Math.round(v / 10)))
  return `<div class="pips">${Array.from({ length: 10 }, (_, i) => `<span style="${i < n ? `background:${color}` : ''}"></span>`).join('')}</div>`
}

function meter(label, w, sub) {
  if (!w) return ''
  if (w.expired) return `<div class="meter"><span>${label}</span><span class="pct">—</span><span class="sub">${t('ui.caducada')}</span></div>`
  const c = pctColor(w.pct)
  return `<div class="meter"><span>${label}</span><span class="pct" style="color:${c}">${Math.round(w.pct)}%</span><div class="bar"><b style="width:${w.pct}%;background:${c}"></b></div></div>${sub}`
}

function weekday(ts) {
  return new Date(ts).toLocaleDateString(t('locale'), { weekday: 'short' }).replace('.', '')
}

function renderCard() {
  const st = S.state
  if (!st) return
  const p = st.pet
  const B = tmap('ui.btn')
  let html = `<div class="head"><span class="name">${esc(p.name)}</span><span class="what">${esc(st.what)}</span><span class="mood"><i style="background:${st.mood === 'fuego' || st.mood === 'enfermo' ? '#FF6B5E' : '#E07A55'}"></i>${esc(st.moodLabel)}</span></div>`

  if (S.game) html += gameHtml()
  else {
    if (p.alive && p.stage !== 'huevo') {
      html += '<div class="needs">'
      for (const k of ['hambre', 'felicidad', 'energia', 'salud', 'higiene']) {
        const v = p.stats[k], low = v < 25
        html += `<span class="lbl${low ? ' low' : ''}">${tmap('stat')[k]}</span>${pips(v, low ? '#FF6B5E' : NEED_COLOR[k])}`
      }
      html += '</div>'
    } else html += `<div class="sub wide" style="color:var(--soft)">${esc(p.alive ? t('ui.huevoInfo') : t('ui.nubeInfo', { name: p.name }))}</div>`

    html += '<hr>'
    const L = st.limits
    if (!L) html += `<div class="row"><span>${t('w.sinCuenta')}</span></div>`
    else {
      const s = L.session
      const sSub = s?.resetsAt ? `<div class="sub">${t('ui.reiniciaCorto', { dur: fmtDuration(s.resetsAt - Date.now()) })}</div>` : ''
      const proj = st.projection ? `<div class="sub ${st.projection.color === '#5FD38D' ? 'ok' : 'warn'}" style="margin-top:-4px">${esc(st.projection.text)}</div>` : ''
      if (s) html += meter(t('ui.sesion'), s, sSub + proj)
      const w = L.week
      html += meter(t('ui.semana'), w, w?.resetsAt ? `<div class="sub">${t('ui.reiniciaDiaCorto', { dia: weekday(w.resetsAt), hora: fmtClock(w.resetsAt) })}</div>` : '')
    }
    html += `<div class="row"><span>${st.working ? `<span class="working">● ${esc(st.activity || t('w.ahora'))}</span>` : t('w.hoy')}</span><span><strong>${fmtTokens(st.today.tokens)}</strong> ${t('ui.tokensHoy')}</span></div>`

    if (p.alive && p.stage !== 'huevo') {
      const hot = st.hint?.key ? ACTION_KEY[st.hint.key] : null
      const btns = [['comer', B.comer], ['chuche', B.chuche], ['jugar', B.jugar], ['limpiar', B.limpiar], ['medicina', B.medicina], ['acariciar', B.mimo], ['luces', B.apagar]]
      html += `<div class="actions">${btns.map(([a, label]) => `<button data-a="${a}" class="${hot === a ? 'hot' : ''}" title="${label}">${ICON[a]}<small>${label}</small></button>`).join('')}</div>`
    } else if (!p.alive) html += `<div class="actions" style="grid-template-columns:1fr"><button data-a="nuevo">🥚<small>${B.huevo}</small></button></div>`
    html += `<div class="foot"><span>🍪 ${t('ui.bocadosN', { n: p.bocados })}</span><button class="link" data-a="full">${t('w.verTodo')} ↗</button></div>`
  }
  cardEl.innerHTML = html
}

function gameHtml() {
  const g = S.game
  const dots = Array.from({ length: 5 }, (_, i) => (i < g.results.length ? (g.results[i] ? '🟢' : '🔴') : '⚪')).join('')
  const msg = g.last == null ? t('w.ronda', { r: g.results.length + 1 }) : g.last ? t('ui.juego.bien') : t('ui.juego.mal')
  return `<div class="game"><div class="q">${t('w.juego')}</div><div class="btns"><button data-g="izq">◀</button><button data-g="der">▶</button></div><div class="dots">${dots}</div><div class="sub wide" style="margin-top:6px;color:var(--soft)">${esc(msg)}</div></div>`
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

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

cardEl.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a
  const g = e.target.closest('[data-g]')?.dataset.g
  if (a === 'full') return invoke('open_full')
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
// En Tauri la ventana no recibe el ratón cuando deja pasar los clics, así que el
// lado Rust nos manda la posición del cursor. En el navegador usamos mousemove.

function rectOf(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

function petRect() {
  const s = S.scale
  const left = S.x - (CRITTER_W * s) / 2
  const top = window.innerHeight - CRITTER_H * s
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
  } else if (!S.hover && was && !S.pinned) {
    clearTimeout(S.closeTimer)
    S.closeTimer = setTimeout(() => !S.hover && !S.pinned && closeCard(), 450)
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

petEl.addEventListener('click', () => (S.pinned ? closeCard() : openCard(true)))
badgeEl.addEventListener('click', () => openCard(true))
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCard()
})
if (TAURI) {
  TAURI.event.listen('cursor', (e) => onCursor(e.payload))
  TAURI.event.listen('config', (e) => {
    Object.assign(S, { scale: e.payload.scale ?? S.scale, showBadge: e.payload.showBadge ?? S.showBadge })
    renderBadge()
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
}, 200)
setInterval(load, 5000)
load().then(() => {
  drawPet()
  requestAnimationFrame(loop)
})

// ---------- Vista previa en el navegador (sin Tauri) ----------

async function mockInvoke(cmd, args) {
  if (cmd === 'get_state') return JSON.stringify(window.__MOCK__ || (await (await fetch('./mock.json')).json()))
  if (cmd === 'do_action') return JSON.stringify({ res: { ok: true, msg: '' }, state: S.state })
  return null
}
window.__claudagotchi = S
