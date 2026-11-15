// Avisos de Claude Code al instante con sus 'hooks' oficiales: Claude Code ejecuta
// "claudagotchi hook <evento>" cuando necesita permiso, cuando espera tu respuesta
// y cuando termina. Guardamos el último aviso y el widget lo enseña (con sonido).
import path from 'node:path'
import { CLAUDE_DIR, DATA_DIR, readJSON, writeJSON } from './paths.js'
import { statuslineCommand } from './install.js'

const settingsFile = () => path.join(CLAUDE_DIR, 'settings.json')
const eventFile = () => path.join(DATA_DIR, 'claude-event.json')
const hookCmd = (ev) => statuslineCommand().replace(/ statusline$/, ` hook ${ev}`)
const ours = (h) => typeof h?.command === 'string' && h.command.includes('claudagotchi') && h.command.includes(' hook ')

const EVENTS = { Notification: 'notificacion', Stop: 'fin' }

export function hooksInstalled() {
  const hooks = readJSON(settingsFile(), {}).hooks || {}
  return Object.keys(EVENTS).every((ev) => (hooks[ev] || []).some((g) => (g.hooks || []).some(ours)))
}

export function installHooks() {
  const file = settingsFile()
  const settings = readJSON(file, {})
  settings.hooks ??= {}
  for (const [ev, name] of Object.entries(EVENTS)) {
    const groups = (settings.hooks[ev] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !ours(h)) })).filter((g) => g.hooks.length)
    groups.push({ hooks: [{ type: 'command', command: hookCmd(name) }] })
    settings.hooks[ev] = groups
  }
  writeJSON(file, settings, true)
}

export function uninstallHooks() {
  const file = settingsFile()
  const settings = readJSON(file, {})
  if (!settings.hooks) return
  for (const ev of Object.keys(EVENTS)) {
    const groups = (settings.hooks[ev] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !ours(h)) })).filter((g) => g.hooks.length)
    if (groups.length) settings.hooks[ev] = groups
    else delete settings.hooks[ev]
  }
  if (!Object.keys(settings.hooks).length) delete settings.hooks
  writeJSON(file, settings, true)
}

// Lo que ejecuta Claude Code. Debe ser rapidísimo y no fallar nunca.
export function handleHook(name, input = {}, now = Date.now()) {
  let kind = 'fin'
  if (name === 'notificacion') kind = /permis/i.test(input.message || '') ? 'permiso' : 'espera'
  const project = input.cwd ? path.basename(input.cwd) : null
  writeJSON(eventFile(), { ts: now, kind, message: input.message || '', project })
}

export function lastClaudeEvent(now = Date.now(), maxAgeMs = 15 * 60_000) {
  const e = readJSON(eventFile(), null)
  return e && now - e.ts < maxAgeMs ? e : null
}
