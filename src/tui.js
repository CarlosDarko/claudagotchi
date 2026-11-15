// La interfaz animada: la mascota en su habitación, sus necesidades, tu uso real
// de Claude y las teclas para cuidarla.
import { refresh, doAction, newEgg, loadConfig, saveConfig } from './store.js'
import { act, mood, MOOD_LABEL, STAGE_LABEL, FORM_LABEL, latestEvent, ACHIEVEMENT_IDS, achievementText } from './pet.js'
import { drawScene } from './sprites.js'
import { canvasToAnsi, paint, dim, bold, bar, bg, padEnd, truncate, wrap, visibleWidth, RESET } from './render.js'
import { lastDays, sumBy, burnRate, isWorking, toolKind } from './logs.js'
import { petIcon, pctColor } from './statusline.js'
import { t, tmap } from './i18n/index.js'
import { fmtTokens, fmtDuration, fmtClock, dayKey } from './util.js'

const ACCENT = '#E07A55'
const MUTED = '#8A8AA0'
const KEYS = { c: 'comer', x: 'chuche', l: 'limpiar', m: 'medicina', a: 'acariciar', d: 'luces', C: 'comer', X: 'chuche', L: 'limpiar', M: 'medicina', A: 'acariciar', D: 'luces' }

export function startTui({ demo = null } = {}) {
  const out = process.stdout
  const cfg = loadConfig()
  const ui = { tab: 0, frame: 0, data: null, flash: null, happyUntil: 0, game: null, busy: false, demo: !!demo, help: !!demo || !cfg.helpSeen }
  if (!cfg.helpSeen && !demo) saveConfig({ helpSeen: true })

  const cleanup = () => {
    out.write('\x1b[?25h\x1b[?1049l')
    try { process.stdin.setRawMode(false) } catch {}
  }
  process.on('exit', cleanup)
  out.write('\x1b[?1049h\x1b[?25l\x1b[2J')

  async function load() {
    if (demo) {
      if (!ui.data) ui.data = demo.next()
      return
    }
    if (ui.busy) return
    ui.busy = true
    try { ui.data = await refresh() } catch (e) { ui.flash = { text: String(e.message || e), until: Date.now() + 5000 } }
    ui.busy = false
  }

  function action(name, arg) {
    let res
    if (demo) res = act(ui.data.pet, name, Date.now(), arg) // en la demo se juega sin guardar nada
    else {
      const r = doAction(name, arg)
      ui.data = { ...ui.data, pet: r.pet }
      res = r.res
    }
    ui.flash = res.ok ? null : { text: res.msg, until: Date.now() + 4000 }
    if (res.ok && name !== 'luces' && name !== 'medicina') ui.happyUntil = Date.now() + 2500
  }

  function onKey(k) {
    if (k === '\u0003' || ((k === 'q' || k === 'Q') && !ui.help) || (k === '\x1b' && !ui.game && !ui.help)) return quit()
    const pet = ui.data?.pet
    if (ui.help) {
      ui.help = false
      return draw()
    }
    if (k === '?') {
      ui.help = true
      return draw()
    }
    if (ui.game) return gameKey(k)
    if (demo && (k === '\x1b[C' || k === ' ')) {
      ui.data = demo.next()
      return draw()
    }
    if (k === '\t') ui.tab = (ui.tab + 1) % 4
    else if ('1234'.includes(k) && k) ui.tab = Number(k) - 1
    else if (KEYS[k]) action(KEYS[k])
    else if ((k === 'j' || k === 'J') && pet?.alive && pet.stage !== 'huevo') {
      if (pet.stats.energia < 10) ui.flash = { text: t('act.cansado'), until: Date.now() + 3000 }
      else ui.game = { round: 1, wins: 0, last: null, dir: null, results: [] }
    } else if ((k === 'h' || k === 'H') && pet && !pet.alive && !demo) {
      ui.data = { ...ui.data, pet: newEgg() }
    }
    draw()
  }

  function gameKey(k) {
    const g = ui.game
    const pick = k === '\x1b[D' ? 'izq' : k === '\x1b[C' ? 'der' : null
    if (k === '\x1b') { ui.game = null; return draw() }
    if (!pick || g.round > 5) return
    g.dir = Math.random() < 0.5 ? 'izq' : 'der'
    g.last = g.dir === pick
    g.results.push(g.last)
    if (g.last) g.wins += 1
    g.round += 1
    if (g.round > 5) {
      setTimeout(() => {
        action('jugar', g.wins)
        ui.game = null
        draw()
      }, 900)
    }
    draw()
  }

  function quit() {
    clearInterval(anim)
    clearInterval(poll)
    cleanup()
    process.exit(0)
  }

  function draw() {
    if (!ui.data) return
    const W = out.columns || 80
    const H = out.rows || 24
    out.write(`\x1b[H${renderFrame(ui, W, H)}`)
  }

  const anim = setInterval(() => {
    ui.frame += 1
    draw()
  }, 220)
  const poll = setInterval(load, 5000)

  process.stdin.setRawMode?.(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', onKey)
  out.on('resize', () => {
    out.write('\x1b[2J')
    draw()
  })
  load().then(draw)
}

// ---------- Dibujo ----------
// Todo es una función pura: renderFrame(ui, ancho, alto) devuelve el fotograma.

const NEED_COLOR = { hambre: '#F2A93B', felicidad: '#F2668B', energia: '#FFD23F', salud: '#5FD38D', higiene: '#5BC0F2' }
const RED = '#FF6B5E'
const GREEN = '#5FD38D'
const EMPTY = '#34324A'
const BORDER = '#3E3B57'
const TEXT = '#E8E6F0'
const SOFT = '#A8A4C4'

const keycap = (k, hot = false) => (hot ? `\x1b[48;2;224;122;85m\x1b[38;2;27;26;36m\x1b[1m ${k} \x1b[22m\x1b[39m\x1b[49m` : `\x1b[48;2;52;50;74m\x1b[38;2;232;230;240m ${k} \x1b[39m\x1b[49m`)

// Tarjeta con borde redondeado y título. `width` es el ancho total.
export function card(lines, width, { title = '', right = '', color = BORDER, height = 0 } = {}) {
  const inner = width - 4
  const t1 = title ? ` ${bold(paint(SOFT, title))} ` : ''
  const t2 = right ? ` ${right} ` : ''
  const fill = Math.max(0, width - 3 - visibleWidth(t1) - visibleWidth(t2))
  const out = [`${paint(color, '╭─')}${t1}${paint(color, '─'.repeat(fill))}${t2}${paint(color, '╮')}`]
  const body = [...lines]
  while (body.length < height - 2) body.push('')
  for (const l of body) out.push(`${paint(color, '│')} ${padEnd(truncateAnsi(l, inner), inner)} ${paint(color, '│')}`)
  out.push(paint(color, `╰${'─'.repeat(width - 2)}╯`))
  return out
}

const center = (s, width) => ' '.repeat(Math.max(0, Math.floor((width - visibleWidth(s)) / 2))) + s

// Qué le hace falta ahora mismo, por urgencia: sirve para el bocadillo y para
// resaltar la tecla buena.
export function needHint(pet, limits) {
  if (!pet.alive) return { key: 'h', text: null }
  if (pet.stage === 'huevo') return null
  const s = pet.stats
  if (pet.sick) return { key: 'm', text: t('ui.pista.medicina') }
  if (s.hambre < 35) return { key: 'c', text: t('ui.pista.hambre') }
  if (pet.poops || s.higiene < 40) return { key: 'l', text: t('ui.pista.limpiar') }
  if (s.felicidad < 40) return { key: 'j', text: t('ui.pista.jugar') }
  if (!limits && s.energia < 20 && pet.lights) return { key: 'd', text: t('ui.pista.dormir') }
  return null
}

export function renderFrame(ui, W, H, now = Date.now()) {
  if (W < 60 || H < 20) return `\x1b[2J${t('ui.pequena')}`
  const { pet, index, limits } = ui.data
  let m = mood(pet, { index, limits, now })
  if (now < ui.happyUntil && pet.alive && !['dormido', 'huevo'].includes(m)) m = 'feliz'
  const hint = needHint(pet, limits)

  const lines = [header(ui, pet, now, W), '']
  const bodyH = H - 4
  let body
  if (ui.help) body = helpView(W)
  else if (ui.tab === 0 || ui.game) body = mainView(ui, pet, index, limits, m, hint, now, W, bodyH)
  else if (ui.tab === 1) body = usageView(index, pet, now, W)
  else if (ui.tab === 2) body = achievementsView(pet, W)
  else body = albumView(pet, W)

  // Centrado vertical: el hueco que sobre, un tercio arriba y el resto abajo
  const top = Math.max(0, Math.floor((bodyH - body.length) / 3))
  for (let i = 0; i < bodyH; i++) lines.push(body[i - top] ?? '')
  const flash = ui.flash && now < ui.flash.until ? ui.flash.text : null
  lines.push(flash ? `  ${paint('#FFD38A', `▲ ${flash}`)}` : '')
  lines.push(footer(ui, pet, hint, W))
  return lines.slice(0, H).map((l) => `${truncateAnsi(l, W)}${RESET}\x1b[K`).join('\n')
}

function mainView(ui, pet, index, limits, m, hint, now, W, bodyH) {
  const zoom = W >= 150 && bodyH >= 40 ? 2 : 1
  // En terminales estrechas la habitación se encoge para que quepan las tarjetas
  const sceneW = zoom === 1 && W < 100 ? 40 : 48
  const sceneCols = sceneW * zoom
  const sceneH = 36
  const scene = canvasToAnsi(drawScene(pet, m, { w: sceneW, h: sceneH, frame: ui.frame, wander: !ui.game, now }), zoom)
  // El bocadillo flota sobre la pared, encima de la habitación
  const bub = bubble(pet, now, sceneCols, ui.game ? null : hint).filter((l) => l !== '')
  const inner = scene.map((l, i) => (i < bub.length ? overlay(l, bub[i], sceneCols) : l))
  if (ui.game) inner.push(gameArrow(ui, sceneCols))
  const moodTxt = paint(m === 'fuego' || m === 'enfermo' ? RED : ACCENT, `● ${MOOD_LABEL[m]}`)
  const left = card(inner, sceneCols + 4, { right: moodTxt })
  const leftW = sceneCols + 4 + 1
  const rightW = Math.min(56, W - leftW - 3)
  if (rightW < 30) return [...left.map((l) => ` ${l}`), ...rightCards(ui, pet, index, limits, now, Math.min(W - 2, 60), 0).map((l) => ` ${l}`)]
  const right = rightCards(ui, pet, index, limits, now, rightW, left.length)
  return sideBySide(left.map((l) => ` ${l}`), right, leftW + 2, Math.max(left.length, right.length))
}

// Pone el texto `top` centrado encima de una línea de la escena, sobre la pared
function overlay(sceneLine, top, width) {
  const tw = visibleWidth(top)
  const start = Math.max(0, Math.floor((width - tw) / 2))
  const pre = cutAnsi(sceneLine, start)
  const rest = dropAnsi(sceneLine, start + tw)
  return `${pre}${RESET}${top.trimStart()}${RESET}${rest}`
}
// Quita las primeras `n` columnas de una línea con códigos ANSI, conservando el color
function dropAnsi(s, n) {
  let width = 0
  let codes = ''
  let out = ''
  for (const m of s.matchAll(/\x1b\[[0-9;]*m|[\s\S]/gu)) {
    const tok = m[0]
    if (tok.startsWith('\x1b')) {
      if (width < n) codes += tok
      else out += tok
      continue
    }
    if (width >= n) out += tok
    width += visibleWidth(tok)
  }
  return codes + out
}

function rightCards(ui, pet, index, limits, now, w, matchH) {
  const compact = w < 44
  if (ui.game) return card(gameLines(ui, pet), w, { title: t('ui.juego.nombre'), height: matchH })
  const needs = card(needLines(pet, compact), w, { title: t('ui.necesidades'), right: pet.alive && pet.stage !== 'huevo' ? dim(`🍪 ${compact ? pet.bocados : t('ui.bocadosN', { n: pet.bocados })}`) : '' })
  const claude = card(claudeLines(pet, index, limits, now, w - 4, compact), w, { title: t('ui.tuClaude'), height: matchH ? matchH - needs.length : 0 })
  return [...needs, ...claude]
}

function header(ui, pet, now, W) {
  const what = pet.stage === 'adulto' || pet.stage === 'leyenda' ? `${FORM_LABEL[pet.form] || ''}${tmap('variant')[pet.variant] || ''}` : STAGE_LABEL[pet.stage]
  const bits = [what]
  if (pet.alive) bits.push(fmtDuration(now - pet.born))
  if (pet.generation > 1) bits.push(t('ui.genN', { n: pet.generation }))
  const left = `  ${petIcon(pet)} ${bold(paint(ACCENT, pet.name))}  ${dim(bits.join(' · '))}`
  const tabs = tmap('ui.tabs').map((label, i) => (i === ui.tab && !ui.help ? `${paint(ACCENT, '●')} ${bold(paint(TEXT, label))}` : dim(`${i + 1} ${label}`))).join('   ')
  const right = `${tabs}  `
  const gap = W - visibleWidth(left) - visibleWidth(right)
  return gap >= 2 ? left + ' '.repeat(gap) + right : left
}

function footer(ui, pet, hint, W) {
  const B = tmap('ui.btn')
  if (ui.help) return `  ${dim(B.cualquiera)}`
  if (ui.game) return `  ${keycap('←')} ${keycap('→')} ${dim(B.elegir)}   ${keycap('Esc')} ${dim(B.salirJuego)}`
  const hot = hint?.key
  const btn = (k, label, short) => `${keycap(k.toUpperCase(), hot === k)} ${short ? '' : hot === k ? paint(TEXT, label) : dim(label)}`.trimEnd()
  const build = (short) => {
    let left
    if (!pet.alive) left = btn('h', B.huevo, false)
    else if (pet.stage === 'huevo') left = dim(B.esperaHuevo)
    else left = [btn('c', B.comer, short), btn('x', B.chuche, short), btn('j', B.jugar, short), btn('l', B.limpiar, short), btn('m', B.medicina, short), btn('a', B.mimo, short), btn('d', pet.lights ? B.apagar : B.encender, short)].join(short ? ' ' : '  ')
    const demo = ui.demo ? `${paint('#FFD23F', 'DEMO')} ${keycap('→')}${short ? '' : ` ${dim(B.siguiente)}`}   ` : ''
    const right = `${demo}${keycap('?')}${short ? '' : ` ${dim(B.ayuda)}`}   ${keycap('Q')}${short ? '' : ` ${dim(B.salir)}`}`
    return { left: `  ${left}`, right: `${right}  ` }
  }
  const fits = (f) => visibleWidth(f.left) + visibleWidth(f.right) + 2 <= W
  let f = build(false)
  if (!fits(f)) f = { ...f, right: build(true).right }
  if (!fits(f)) f = { left: f.left.replace(/ {2}(?=\x1b\[48)/g, ' '), right: `${keycap('?')}  ` }
  if (!fits(f)) f = build(true)
  return f.left + ' '.repeat(Math.max(2, W - visibleWidth(f.left) - visibleWidth(f.right))) + f.right
}

function bubble(pet, now, width, hint) {
  const ev = latestEvent(pet, now, 3 * 60_000)
  const text = ev?.text || hint?.text
  if (!text) return []
  const alert = ev ? ['aviso', 'fuego', 'muerte'].includes(ev.kind) : true
  const txt = wrap(text, Math.min(42, width - 6)).slice(0, 3)
  const w = Math.max(...txt.map(visibleWidth))
  const border = alert ? '#B5694F' : '#6E6A88'
  const tail = Math.floor((w + 2) / 2)
  const box = [paint(border, `╭${'─'.repeat(w + 2)}╮`)]
  for (const l of txt) box.push(`${paint(border, '│')} ${paint(alert ? '#FFD3C2' : TEXT, padEnd(l, w))} ${paint(border, '│')}`)
  box.push(paint(border, `╰${'─'.repeat(tail)}┬${'─'.repeat(w + 1 - tail)}╯`))
  box.push(`${' '.repeat(tail + 1)}${paint(border, '╵')}${' '.repeat(Math.max(0, w + 2 - tail))}`)
  return box.map((l) => `${bg('#211D33')}${l.replace(/\x1b\[0m/g, `\x1b[0m${bg('#211D33')}`)}`)
}

// Medidor de 10 pastillas, como en un tamagotchi
function pips(v, color) {
  const n = Math.max(0, Math.min(10, Math.round(v / 10)))
  return paint(color, '▆ '.repeat(n)) + paint(EMPTY, '▆ '.repeat(10 - n))
}

function pipsTight(v, color) {
  const n = Math.max(0, Math.min(10, Math.round(v / 10)))
  return paint(color, '▮'.repeat(n)) + paint(EMPTY, '▮'.repeat(10 - n))
}

function needLines(pet, compact = false) {
  if (!pet.alive) return wrap(t('ui.nubeInfo', { name: pet.name }), 40).map(dim)
  if (pet.stage === 'huevo') return wrap(t('ui.huevoInfo'), 40).map(dim)
  return ['hambre', 'felicidad', 'energia', 'salud', 'higiene'].map((k) => {
    const v = pet.stats[k]
    const low = v < 25
    const name = tmap('stat')[k]
    const meter = compact ? pipsTight(v, low ? RED : NEED_COLOR[k]) : pips(v, low ? RED : NEED_COLOR[k])
    return `${padEnd(low ? bold(paint(RED, name)) : paint(TEXT, name), compact ? 10 : 11)}${meter}`
  })
}

function claudeLines(pet, index, limits, now, inner, compact = false) {
  const L = []
  const col = compact ? 0 : 10
  const label = (x) => (compact ? '' : padEnd(x, col))
  const sub = (text, color = null) => {
    for (const l of wrap(text, inner - col)) L.push(`${' '.repeat(col)}${color ? paint(color, l) : dim(l)}`)
  }
  if (!limits) wrap(t('ui.sinCuenta'), inner).forEach((l) => L.push(dim(l)))
  else {
    const win = (title, x, isSession) => {
      if (!x) return
      if (x.expired) {
        L.push(`${padEnd(paint(TEXT, title), 10)}${dim(t('ui.caducada'))}`)
        return
      }
      const pct = bold(paint(pctColor(x.pct), `${Math.round(x.pct)}%`.padStart(4)))
      if (compact) {
        L.push(`${padEnd(paint(TEXT, title), inner - 4)}${pct}`)
        L.push(bar(x.pct, inner, pctColor(x.pct)))
      } else L.push(`${label(paint(TEXT, title))}${pct}  ${bar(x.pct, Math.max(8, inner - col - 6), pctColor(x.pct))}`)
      if (x.resetsAt) {
        const v = { dur: fmtDuration(x.resetsAt - now), dia: weekday(x.resetsAt), hora: fmtClock(x.resetsAt) }
        sub(t(isSession ? (compact ? 'ui.reiniciaCorto' : 'ui.reiniciaEn') : compact ? 'ui.reiniciaDiaCorto' : 'ui.reiniciaDia', v))
      }
      const p = isSession ? projection(index, limits, now) : null
      if (p) sub(p.text, p.color)
    }
    if (!limits.weeklyOnly) win(t('ui.sesion'), limits.session, true)
    win(t('ui.semana'), limits.week, !!limits.weeklyOnly)
    if (limits.stale) sub(t('ui.viejo', { dur: fmtDuration(now - limits.fetchedAt) }))
  }
  if (!compact) L.push('')
  const today = index.days[dayKey(now)] || { tokens: 0, food: 0 }
  const lab = (x) => padEnd(x, 10)
  if (isWorking(index, now)) {
    const kind = toolKind(index.lastTool)
    const what = t('ui.trabajando', { kind: kind ? tmap('tool')[kind] : '', rate: fmtTokens(burnRate(index, now, 5)) })
    if (compact) L.push(paint(GREEN, '● ') + paint(TEXT, kind ? tmap('tool')[kind] : t('ui.ahora')))
    else L.push(`${lab(paint(GREEN, `● ${t('ui.ahora')}`))}${paint(TEXT, what)}`)
  } else L.push(`${lab(dim(`○ ${t('ui.ahora')}`))}${dim(t('ui.reposo'))}`)
  L.push(`${lab(paint(TEXT, t('ui.hoy')))}${bold(paint(TEXT, fmtTokens(today.tokens)))} ${dim(t('ui.tokensHoy'))}`)
  L.push(`${lab(paint(TEXT, t('ui.racha')))}${compact ? t('ui.rachaCorta', { n: pet.streak.days }) : t('ui.rachaDias', { n: pet.streak.days })}`)
  return L
}

function weekday(ts) {
  return new Date(ts).toLocaleDateString(t('locale'), { weekday: 'short' }).replace('.', '')
}

function gameLines(ui, pet) {
  const g = ui.game
  const L = [paint(TEXT, t('ui.juego.titulo', { name: pet.name })), dim(t('ui.juego.como')), '']
  const marks = []
  for (let i = 0; i < 5; i++) marks.push(i < g.results.length ? paint(g.results[i] ? GREEN : RED, '●') : paint(EMPTY, '●'))
  L.push(`${marks.join(' ')}   ${dim(t('ui.juego.aciertos', { w: g.wins }))}`)
  if (g.last != null) L.push('', g.last ? bold(paint(GREEN, t('ui.juego.bien'))) : bold(paint(RED, t('ui.juego.mal'))))
  return L
}

function gameArrow(ui, cols) {
  const g = ui.game
  if (!g.dir) return center(bold(paint(TEXT, '◀   ?   ▶')), cols)
  return center(bold(paint(g.last ? GREEN : RED, g.dir === 'izq' ? '◀◀◀      ' : '      ▶▶▶')), cols)
}

// ---------- Ayuda ----------

export function helpView(W) {
  const H = tmap('help')
  const w = Math.min(W - 4, 104)
  const colW = Math.floor((w - 2) / 2)
  const mk = (key) => card(H[key].lines.flatMap((l) => (l ? wrap(l, colW - 4) : [''])).map((l, i) => (i === 0 && key === 'que' ? paint(TEXT, l) : l)), colW, { title: H[key].title })
  const row = (a, b) => {
    const A = mk(a), B = mk(b)
    const h = Math.max(A.length, B.length)
    const A2 = card(H[a].lines.flatMap((l) => (l ? wrap(l, colW - 4) : [''])), colW, { title: H[a].title, height: h })
    const B2 = card(H[b].lines.flatMap((l) => (l ? wrap(l, colW - 4) : [''])), colW, { title: H[b].title, height: h })
    return A2.map((l, i) => `  ${l}  ${B2[i]}`)
  }
  return [...row('que', 'teclas'), '', ...row('claves', 'crece')]
}

// ---------- Piezas reutilizables ----------

export function projection(index, limits, now) {
  const s = limits?.session
  if (!s || s.expired || !s.resetsAt || s.pct <= 0 || s.pct >= 100) return null
  // Pasamos el ritmo de tokens a % con la proporción de esta sesión
  const sessionStart = s.resetsAt - 5 * 3600_000
  let sessTok = 0
  for (const [ts, tok] of index.recent) if (ts >= sessionStart) sessTok += tok
  const rate = burnRate(index, now, 20)
  if (sessTok < 1 || rate <= 0 || now - sessionStart < 5 * 60_000) return null
  const pctPerMin = (rate / sessTok) * s.pct
  const minsToLimit = (100 - s.pct) / pctPerMin
  const minsToReset = (s.resetsAt - now) / 60000
  if (minsToLimit < minsToReset) return { text: `▲ ${t('ui.ritmo.agota', { dur: fmtDuration(minsToLimit * 60000) })}`, color: '#FF8A7A' }
  return { text: `✓ ${t('ui.ritmo.llega')}`, color: GREEN }
}

function sideBySide(left, right, leftW, h) {
  const rows = []
  for (let i = 0; i < h; i++) rows.push(padEnd(left[i] ?? '', leftW) + (right[i] ?? ''))
  return rows
}

function truncateAnsi(s, w) {
  return visibleWidth(s) <= w ? s : cutAnsi(s, w)
}
function cutAnsi(s, w) {
  let out = ''
  let width = 0
  const re = /\x1b\[[0-9;]*m|[\s\S]/gu
  for (const m of s.matchAll(re)) {
    const tok = m[0]
    if (tok.startsWith('\x1b')) { out += tok; continue }
    const cw = visibleWidth(tok)
    if (width + cw > w) break
    out += tok
    width += cw
  }
  return out
}

// ---------- Vista de uso ----------

// Gráfico de columnas con bloques de octavos: alto `h` filas
function columns(values, h, colW, color, highlightLast = true) {
  const max = Math.max(1, ...values)
  const parts = ' ▁▂▃▄▅▆▇█'
  const rows = []
  for (let r = h - 1; r >= 0; r--) {
    let line = ''
    values.forEach((v, i) => {
      const units = (v / max) * h * 8
      const cell = Math.max(0, Math.min(8, Math.round(units - r * 8)))
      const ch = v > 0 && r === 0 && cell === 0 ? '▁' : parts[cell]
      const c = highlightLast && i === values.length - 1 ? '#FFB38A' : color
      line += paint(c, ch.repeat(colW)) + (colW > 1 ? ' ' : '')
    })
    rows.push(line)
  }
  return rows
}

export function usageView(index, pet, now, W) {
  const w = Math.min(W - 4, 110)
  const days30 = lastDays(index, 30, now)
  const vals = days30.map((d) => d.tokens)
  const total30 = vals.reduce((a, b) => a + b, 0)
  const active = vals.filter(Boolean).length
  const best = days30.reduce((a, d) => (d.tokens > a.tokens ? d : a), days30[0])
  const colW = w >= 100 ? 2 : 1
  const chart = columns(vals, 6, colW, ACCENT)
  const step = colW + (colW > 1 ? 1 : 0)
  const axis = dim(`${days30[0].key.slice(5)}${' '.repeat(Math.max(1, 30 * step - 11))}${t('ui.hoyMin')}`)
  const stats = `${bold(paint(TEXT, fmtTokens(total30)))} ${dim(t('ui.tokens30'))}   ${bold(paint(TEXT, fmtTokens(active ? total30 / active : 0)))} ${dim(t('ui.mediaDia'))}   ${bold(paint(TEXT, fmtTokens(best.tokens)))} ${dim(t('ui.mejorDia', { dia: best.key.slice(5) }))}`
  const out = card([stats, '', ...chart, axis], w, { title: t('ui.mapa30t') }).map((l) => `  ${l}`)

  const half = Math.floor((w - 2) / 2)
  const days7 = lastDays(index, 7, now)
  const ranked = (rows, colors) => {
    if (!rows.length) return [dim(t('ui.sinDatos'))]
    const top = rows[0][1] || 1
    const bw = Math.max(8, half - 4 - 15 - 7)
    return rows.map(([k, v], i) => `${padEnd(paint(TEXT, truncate(k, 13)), 15)}${bar((v / top) * 100, bw, colors[i % colors.length])} ${dim(fmtTokens(v).padStart(5))}`)
  }
  const MODEL_COLORS = { opus: '#8B6CF0', sonnet: '#F2A93B', haiku: '#2BB8A6', fable: '#5B9DF2' }
  const models = sumBy(days7, 'models')
  const mLines = ranked(models, models.map(([k]) => MODEL_COLORS[k] || SOFT))
  let projects = sumBy(days7, 'projects')
  if (projects.length > 5) projects = [...projects.slice(0, 4), [t('ui.otros'), projects.slice(4).reduce((a, [, v]) => a + v, 0)]]
  const pLines = ranked(projects, [ACCENT])
  const h1 = Math.max(mLines.length, pLines.length) + 2
  const A = card(mLines, half, { title: t('ui.modelos7'), height: h1 })
  const B = card(pLines, half, { title: t('ui.proyectos7'), height: h1 })
  out.push('', ...A.map((l, i) => `  ${l}  ${B[i]}`))

  const hours = index.days[dayKey(now)]?.hours || Array(24).fill(0)
  const hourChart = columns(hours, 3, 1, GREEN, false)
  const hLines = [...hourChart.map((l) => ` ${l}`), dim(' 0     6     12    18    23')]
  const today = index.days[dayKey(now)] || { tokens: 0, food: 0 }
  const sLines = [
    `${padEnd(paint(TEXT, t('ui.hoy')), 16)}${bold(paint(TEXT, fmtTokens(today.tokens)))} ${dim(t('ui.tokensHoy'))}`,
    `${padEnd(paint(TEXT, t('ui.comida')), 16)}${bold(paint(TEXT, fmtTokens(today.food)))} ${dim(t('ui.sinCache'))}`,
    `${padEnd(paint(TEXT, t('ui.racha')), 16)}${t('ui.rachaDias', { n: pet.streak.days })}`,
    `${padEnd(paint(TEXT, t('ui.haComido', { name: pet.name })), 16)}${fmtTokens(pet.xp)}`,
  ]
  const h2 = Math.max(hLines.length, sLines.length) + 2
  const C = card(hLines, half, { title: t('ui.horas'), height: h2 })
  const D = card(sLines, half, { title: t('ui.resumen'), height: h2 })
  out.push('', ...C.map((l, i) => `  ${l}  ${D[i]}`))
  return out
}

export function achievementsView(pet, W) {
  const w = Math.min(W - 4, 110)
  const got = Object.keys(pet.achievements).length
  const total = ACHIEVEMENT_IDS.length
  const colW = Math.floor((w - 4) / 2)
  const cell = (id) => {
    const a = achievementText(id)
    const ok = pet.achievements[id]
    return ok
      ? [`${paint('#FFD23F', '★')} ${bold(paint(TEXT, a.name))} ${dim(new Date(ok).toLocaleDateString(t('locale')))}`, `  ${dim(truncate(a.desc, colW - 2))}`]
      : [`${paint(EMPTY, '☆')} ${paint('#6E6A88', a.name)}`, `  ${paint('#55526B', truncate(a.desc, colW - 2))}`]
  }
  const lines = [`${bar((got / total) * 100, Math.min(30, w - 30), '#FFD23F')}  ${bold(paint(TEXT, `${got}/${total}`))} ${dim(t('ui.conseguidos'))}`, '']
  for (let i = 0; i < ACHIEVEMENT_IDS.length; i += 2) {
    const a = cell(ACHIEVEMENT_IDS[i])
    const b = ACHIEVEMENT_IDS[i + 1] ? cell(ACHIEVEMENT_IDS[i + 1]) : ['', '']
    lines.push(padEnd(a[0], colW) + b[0], padEnd(a[1], colW) + b[1])
  }
  return card(lines, w, { title: t('ui.logrosT') }).map((l) => `  ${l}`)
}

export function albumView(pet, W) {
  const w = Math.min(W - 4, 110)
  const lines = []
  if (!pet.graveyard.length) lines.push('', center(dim(t('ui.albumVacio')), w - 4), '')
  for (const g of [...pet.graveyard].reverse()) {
    const stage = g.stage === 'adulto' || g.stage === 'leyenda' ? FORM_LABEL[g.form] || STAGE_LABEL[g.stage] : STAGE_LABEL[g.stage]
    lines.push(`${g.retired ? '🏡' : '☁️'} ${bold(paint(TEXT, g.name))}  ${dim(t('ui.albumFila', { gen: g.generation, stage, dur: fmtDuration(g.died - g.born), tokens: fmtTokens(g.xp) }))}`)
  }
  return card(lines, w, { title: t('ui.album') }).map((l) => `  ${l}`)
}
