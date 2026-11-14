// Lo que pinta Claude Code en su barra de estado. Recibe un JSON por stdin
// (con rate_limits en las versiones recientes) y devuelve una o dos líneas.
import { refresh } from './store.js'
import { mood, FACE, MOOD_LABEL, latestEvent } from './pet.js'
import { burnRate, isWorking, toolKind, lastDays } from './logs.js'
import { t, tmap } from './i18n/index.js'
import { paint, dim, truncate } from './render.js'
import { fmtTokens, fmtDuration, dayKey } from './util.js'

export const STAGE_ICON = { huevo: '🥚', bebe: '🐣', nino: '🐥', teen: '🐤', nube: '👻' }
export const FORM_ICON = { opus: '🐉', sonnet: '🐦', haiku: '🐟', fable: '🧙', mixto: '🦄' }
export const petIcon = (p) => (p.stage === 'leyenda' ? '👑' : p.stage === 'adulto' ? FORM_ICON[p.form] || '🦄' : STAGE_ICON[p.stage] || '🐣')

export const pctColor = (p) => (p == null ? '#8A8AA0' : p >= 90 ? '#FF5A4E' : p >= 75 ? '#F2A93B' : '#5FD38D')
export const statColor = (v) => (v < 25 ? '#FF5A4E' : v < 50 ? '#F2A93B' : '#5FD38D')

function miniBar(pct, width = 6) {
  const p = Math.max(0, Math.min(100, pct ?? 0))
  const full = Math.round((p / 100) * width)
  return paint(pctColor(pct), '▰'.repeat(full)) + paint('#4A4A5A', '▱'.repeat(width - full))
}

export function renderStatusline({ pet, index, limits, input = {}, now = Date.now(), width = 120 }) {
  const m = mood(pet, { index, limits, now })
  const st = pet.stats
  const parts = []
  parts.push(`${petIcon(pet)} ${paint('#F6B497', pet.name)} ${FACE[m]} ${dim(MOOD_LABEL[m])}`)
  if (pet.alive && pet.stage !== 'huevo') {
    const s = (icon, v) => `${icon}${paint(statColor(v), String(Math.round(v)))}`
    parts.push([s('🍖', st.hambre), s('💖', st.felicidad), s('⚡', st.energia), s('🩺', st.salud)].join(' ') + (pet.poops ? ` ${'💩'.repeat(pet.poops)}` : ''))
  }
  const sess = limits?.weeklyOnly ? null : limits?.session
  if (sess && !sess.expired) {
    const reset = sess.resetsAt ? dim(` ${t('sl.reinicio', { dur: fmtDuration(sess.resetsAt - now) })}`) : ''
    parts.push(`5h ${miniBar(sess.pct)} ${paint(pctColor(sess.pct), `${Math.round(sess.pct)}%`)}${reset}`)
  }
  if (limits?.week && !limits.week.expired) parts.push(`7d ${paint(pctColor(limits.week.pct), `${Math.round(limits.week.pct)}%`)}`)
  if (!limits) parts.push(dim(t('sl.sinCuenta')))
  const today = index.days[dayKey(now)]
  if (isWorking(index, now)) {
    const kind = toolKind(index.lastTool)
    parts.push(paint('#5FD38D', `● ${kind ? tmap('tool')[kind] : ''} ${fmtTokens(burnRate(index, now, 5))}/min`.replace('  ', ' ')))
  } else parts.push(dim(`${t('sl.hoy')} ${fmtTokens(today?.tokens || 0)}`))
  const lines = [parts.join(dim(' │ '))]
  const ev = latestEvent(pet, now, 90_000)
  if (ev) lines.push(truncate(`💬 ${ev.text}`, width))
  return lines.join('\n')
}

async function readStdin() {
  if (process.stdin.isTTY) return {}
  return new Promise((resolve) => {
    let data = ''
    const done = () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    }
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d) => (data += d))
    process.stdin.on('end', done)
    setTimeout(done, 800)
  })
}

export async function runStatusline() {
  const input = await readStdin()
  const { pet, index, limits } = await refresh({ fromStatusline: input.rate_limits || null })
  process.stdout.write(`${renderStatusline({ pet, index, limits, input, width: process.stdout.columns || 140 })}\n`)
}
