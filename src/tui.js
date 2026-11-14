// La interfaz animada: la mascota en su habitación, sus necesidades, tu uso real
// de Claude y las teclas para cuidarla.
import { refresh, doAction, newEgg } from './store.js'
import { mood, MOOD_LABEL, STAGE_LABEL, FORM_LABEL, ageH, latestEvent, ACHIEVEMENT_IDS, achievementText } from './pet.js'
import { drawScene } from './sprites.js'
import { canvasToAnsi, paint, dim, bold, bar, padEnd, truncate, wrap, visibleWidth, RESET } from './render.js'
import { lastDays, sumBy, burnRate, isWorking, toolKind } from './logs.js'
import { petIcon, pctColor, statColor } from './statusline.js'
import { t, tmap } from './i18n/index.js'
import { fmtTokens, fmtDuration, fmtClock, dayKey } from './util.js'

const ACCENT = '#E07A55'
const MUTED = '#8A8AA0'
const KEYS = { c: 'comer', x: 'chuche', l: 'limpiar', m: 'medicina', a: 'acariciar', d: 'luces' }

export function startTui({ demo = null } = {}) {
  const out = process.stdout
  const ui = { tab: 0, frame: 0, data: null, flash: null, happyUntil: 0, game: null, busy: false }

  const cleanup = () => {
    out.write('\x1b[?25h\x1b[?1049l')
    try { process.stdin.setRawMode(false) } catch {}
  }
  process.on('exit', cleanup)
  out.write('\x1b[?1049h\x1b[?25l\x1b[2J')

  async function load() {
    if (demo) { ui.data = demo.next(); return }
    if (ui.busy) return
    ui.busy = true
    try { ui.data = await refresh() } catch (e) { ui.flash = { text: String(e.message || e), until: Date.now() + 5000 } }
    ui.busy = false
  }

  function action(name, arg) {
    if (demo) return
    const { pet, res } = doAction(name, arg)
    ui.data = { ...ui.data, pet }
    ui.flash = { text: res.msg, until: Date.now() + 4000 }
    if (res.ok && name !== 'luces' && name !== 'medicina') ui.happyUntil = Date.now() + 2500
  }

  function onKey(k) {
    if (k === '\u0003' || k === 'q' || (k === '\x1b' && !ui.game)) return quit()
    const pet = ui.data?.pet
    if (ui.game) return gameKey(k)
    if (k === '\t') ui.tab = (ui.tab + 1) % 4
    else if ('1234'.includes(k) && k) ui.tab = Number(k) - 1
    else if (KEYS[k]) action(KEYS[k])
    else if (k === 'j' && pet?.alive && pet.stage !== 'huevo') {
      if (pet.stats.energia < 10) ui.flash = { text: t('act.cansado'), until: Date.now() + 3000 }
      else ui.game = { round: 1, wins: 0, last: null, dir: null }
    } else if (k === 'h' && pet && !pet.alive && !demo) {
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
  const poll = setInterval(load, demo ? 2500 : 5000)

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


export function renderFrame(ui, W, H, now = Date.now()) {
  if (W < 60 || H < 20) return `\x1b[2J${t('ui.pequena')}`
  const { pet, index, limits } = ui.data
  let m = mood(pet, { index, limits, now })
  if (now < ui.happyUntil && pet.alive && !['dormido', 'huevo'].includes(m)) m = 'feliz'

  const lines = []
  lines.push(header(pet, now))
  lines.push(tabs(ui))

  const zoom = W >= 150 && H >= 40 ? 2 : 1
  const sceneW = 48
  const sceneCols = sceneW * zoom
  const bodyH = H - 4
  let left = []
  if (ui.tab === 0 || ui.game) {
    left = bubble(pet, now, sceneCols)
    const sceneLines = canvasToAnsi(drawScene(pet, m, { w: sceneW, h: 26, frame: ui.frame, wander: !ui.game }), zoom)
    left.push(...sceneLines)
    if (ui.game) left.push(...gameArrow(ui, sceneCols))
    else left.push(` ${paint(ACCENT, MOOD_LABEL[m])}${pet.sick ? ' 🤒' : ''}${pet.poops ? ` ${'💩'.repeat(pet.poops)}` : ''}`)
  }
  let right
  let body
  if (ui.tab === 0 || ui.game) {
    const panelW = Math.min(56, W - sceneCols - 4)
    right = ui.game ? gamePanel(ui, pet, panelW) : petPanel(pet, index, limits, now, panelW)
    if (panelW >= 34) body = sideBySide(left, right, sceneCols + 2, bodyH)
    else body = [...left, '', ...right].slice(0, bodyH)
  } else if (ui.tab === 1) body = usageView(index, now, W - 2)
  else if (ui.tab === 2) body = achievementsView(pet, W - 2)
  else body = albumView(pet, W - 2)

  for (let i = 0; i < bodyH; i++) lines.push(body[i] ?? '')
  lines.push(footer(ui, pet, now))
  return lines.slice(0, H).map((l) => `${truncateAnsi(l, W)}${RESET}\x1b[K`).join('\n')
}

function header(pet, now) {
  const name = `${petIcon(pet)} ${bold(paint(ACCENT, pet.name))}`
  const stage = pet.stage === 'adulto' || pet.stage === 'leyenda' ? `${STAGE_LABEL[pet.stage]} · ${FORM_LABEL[pet.form] || ''}${tmap('variant')[pet.variant] || ''}` : STAGE_LABEL[pet.stage]
  const bits = [stage, t('ui.edad', { dur: fmtDuration(now - pet.born) }), t('ui.gen', { n: pet.generation }), `🍪 ${t('ui.bocados', { n: pet.bocados })}`, t('ui.comido', { tokens: fmtTokens(pet.xp) })]
  return ` ${name}  ${dim(bits.join(' · '))}`
}

function tabs(ui) {
  return ` ${tmap('ui.tabs').map((label, i) => (i === ui.tab ? paint(ACCENT, `▌${label}`) : dim(` ${label}`))).join('  ')}`
}

function footer(ui, pet, now) {
  const flash = ui.flash && now < ui.flash.until ? ui.flash.text : null
  if (flash) return ` ${paint('#FFE7A8', flash)}`
  return ` ${dim(pet.alive ? t('ui.teclas') : t('ui.teclasNube'))}`
}

function bubble(pet, now, width) {
  const ev = latestEvent(pet, now, 3 * 60_000)
  if (!ev) return ['', '', '']
  const inner = Math.max(10, width - 6)
  const txt = wrap(ev.text, inner).slice(0, 2)
  const w = Math.max(...txt.map(visibleWidth))
  const c = ev.kind === 'aviso' || ev.kind === 'fuego' || ev.kind === 'muerte' ? '#FFB38A' : '#E8E6F0'
  const out = [paint(MUTED, ` ╭${'─'.repeat(w + 2)}╮`)]
  for (const l of txt) out.push(`${paint(MUTED, ' │ ')}${paint(c, padEnd(l, w))}${paint(MUTED, ' │')}`)
  out.push(paint(MUTED, ` ╰─┬${'─'.repeat(Math.max(0, w - 1))}╯`))
  while (out.length < 3) out.unshift('')
  return out
}

function petPanel(pet, index, limits, now, w) {
  const L = []
  const label = (s) => padEnd(dim(s), 11)
  const bw = Math.max(10, w - 17)
  L.push('')
  if (pet.alive && pet.stage !== 'huevo') {
    const icons = { hambre: '🍖', felicidad: '💖', energia: '⚡', salud: '🩺', higiene: '🧼' }
    for (const k of ['hambre', 'felicidad', 'energia', 'salud', 'higiene']) {
      const v = pet.stats[k]
      L.push(`${icons[k]} ${label(tmap('stat')[k])}${bar(v, bw, statColor(v))} ${paint(statColor(v), String(Math.round(v)).padStart(3))}`)
    }
  } else L.push(dim(pet.alive ? t('act.huevo') : t('ev.muerte', { name: pet.name })))
  L.push('')
  // Límites reales
  if (!limits) {
    wrap(t('ui.sinCuenta'), w).forEach((l) => L.push(dim(l)))
  } else {
    const win = (title, x) => {
      if (!x) return
      if (x.expired) {
        L.push(`${bold(title)}  ${dim('—')}`)
        L.push(dim(`  ${t('ui.caducada')}`))
        return
      }
      L.push(`${padEnd(bold(title), 12)}${bar(x.pct, bw - 1, pctColor(x.pct))} ${paint(pctColor(x.pct), `${Math.round(x.pct)}%`.padStart(4))}`)
      if (x.resetsAt) L.push(dim(`  ${t('ui.reinicia', { dur: fmtDuration(x.resetsAt - now), hora: fmtClock(x.resetsAt) })}`))
    }
    if (!limits.weeklyOnly) {
      win(t('ui.sesion'), limits.session)
      const proj = projection(index, limits, now)
      if (proj) L.push(proj)
    }
    win(limits.weeklyOnly ? t('ui.semanaSola') : t('ui.semana'), limits.week)
    if (limits.stale) L.push(dim(`  ${t('ui.viejo', { dur: fmtDuration(now - limits.fetchedAt) })}`))
  }
  L.push('')
  const today = index.days[dayKey(now)] || { tokens: 0, food: 0 }
  if (isWorking(index, now)) {
    const kind = toolKind(index.lastTool)
    L.push(paint('#5FD38D', t('ui.trabajando', { kind: kind ? tmap('tool')[kind] : '', rate: fmtTokens(burnRate(index, now, 5)) })))
  } else L.push(dim(t('ui.reposo', { tokens: fmtTokens(today.tokens) })))
  L.push(`${label(t('ui.hoy'))}${t('ui.tokens', { tokens: fmtTokens(today.tokens), food: fmtTokens(today.food) })}`)
  L.push(`${label(t('ui.racha'))}${t('ui.rachaDias', { n: pet.streak.days })}`)
  return L
}

function gamePanel(ui, pet, w) {
  const g = ui.game
  const L = ['', bold(t('ui.juego.titulo', { name: pet.name })), '', dim(t('ui.juego.ayuda', { r: Math.min(5, g.round), w: g.wins }))]
  if (g.last != null) L.push('', g.last ? paint('#5FD38D', t('ui.juego.bien')) : paint('#FF8A7A', t('ui.juego.mal')))
  return L.map((l) => truncate(l, w))
}

function gameArrow(ui, cols) {
  const g = ui.game
  if (!g.dir) return [' '.repeat(Math.floor(cols / 2) - 2) + bold('← ? →')]
  const arrow = g.dir === 'izq' ? '◀◀◀' : '▶▶▶'
  return [' '.repeat(Math.floor(cols / 2) - 2) + paint(g.last ? '#5FD38D' : '#FF8A7A', arrow)]
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
  if (minsToLimit < minsToReset) return paint('#FF8A7A', `  ${t('ui.ritmo.agota', { dur: fmtDuration(minsToLimit * 60000) })}`)
  return dim(`  ${t('ui.ritmo.llega')}`)
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

const HEAT = ['#2A2A38', '#5A3328', '#8A4632', '#C2603F', '#E07A55', '#FFB38A']

export function usageView(index, now, w) {
  const L = ['']
  const days30 = lastDays(index, 30, now)
  const total30 = days30.reduce((a, d) => a + d.tokens, 0)
  const max = Math.max(1, ...days30.map((d) => d.tokens))
  L.push(bold(t('ui.mapa30', { tokens: fmtTokens(total30) })))
  const level = (v) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)))
  L.push(` ${days30.map((d) => paint(HEAT[level(d.tokens)], '■')).join(' ')}`)
  L.push(dim(` ${days30[0].key.slice(5)}${' '.repeat(Math.max(1, 30 * 2 - 11))}${days30[29].key.slice(5)}`))
  L.push('')
  const days7 = lastDays(index, 7, now)
  const block = (title, rows, colors) => {
    L.push(bold(title))
    if (!rows.length) { L.push(dim(` ${t('ui.sinDatos')}`)); return }
    const top = rows[0][1] || 1
    const bw = Math.max(10, Math.min(40, w - 30))
    rows.forEach(([k, v], i) => L.push(` ${padEnd(truncate(k, 14), 15)}${bar((v / top) * 100, bw, colors[i % colors.length])} ${fmtTokens(v)}`))
    L.push('')
  }
  block(t('ui.modelos7'), sumBy(days7, 'models'), ['#8B6CF0', '#F2A93B', '#2BB8A6', '#5B9DF2'])
  let projects = sumBy(days7, 'projects')
  if (projects.length > 6) projects = [...projects.slice(0, 5), [t('ui.otros'), projects.slice(5).reduce((a, [, v]) => a + v, 0)]]
  block(t('ui.proyectos7'), projects, ['#E07A55'])
  const hours = index.days[dayKey(now)]?.hours || Array(24).fill(0)
  const hmax = Math.max(1, ...hours)
  const spark = '▁▂▃▄▅▆▇█'
  L.push(bold(t('ui.horas')))
  L.push(` ${hours.map((v) => paint(v ? '#5FD38D' : '#3A3A4A', spark[Math.min(7, Math.floor((v / hmax) * 7.999))])).join('')}`)
  L.push(dim(' 0     6     12    18   23'))
  return L
}

export function achievementsView(pet, w) {
  const got = Object.keys(pet.achievements).length
  const L = ['', bold(t('ui.logros', { n: got, total: ACHIEVEMENT_IDS.length })), '']
  for (const id of ACHIEVEMENT_IDS) {
    const a = achievementText(id)
    const ok = pet.achievements[id]
    L.push(truncate(ok ? `${paint('#FFD23F', '🏅')} ${bold(a.name)} ${dim(`· ${a.desc} · ${new Date(ok).toLocaleDateString(t('locale'))}`)}` : dim(`·· ${a.name} · ${a.desc}`), w))
  }
  return L
}

export function albumView(pet, w) {
  const L = ['', bold(t('ui.album')), '']
  if (!pet.graveyard.length) L.push(dim(t('ui.albumVacio')))
  for (const g of [...pet.graveyard].reverse()) {
    const stage = g.stage === 'adulto' || g.stage === 'leyenda' ? FORM_LABEL[g.form] || STAGE_LABEL[g.stage] : STAGE_LABEL[g.stage]
    L.push(truncate(`${g.retired ? '🏡' : '☁️ '} ${t('ui.albumFila', { name: g.name, gen: g.generation, stage, dur: fmtDuration(g.died - g.born), tokens: fmtTokens(g.xp) })}`, w))
  }
  return L
}
