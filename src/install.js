// Mete (o saca) claudagotchi en la statusline de Claude Code, en ~/.claude/settings.json.
// Si ya había otra statusline, la guarda para devolverla al desinstalar.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLAUDE_DIR, files, readJSON, writeJSON } from './paths.js'
import { t } from './i18n/index.js'

const settingsFile = () => path.join(CLAUDE_DIR, 'settings.json')
const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'claudagotchi.js')

// Compilado como programa independiente (bun --compile) el código vive dentro del
// propio ejecutable, así que la barra de estado llama al ejecutable directamente.
export const isStandalone = () => import.meta.url.includes('$bunfs') || import.meta.url.includes('~BUN')

export function statuslineCommand() {
  if (isStandalone()) return `"${process.execPath}" statusline`
  return `node "${BIN}" statusline`
}

const isOurs = (sl) => typeof sl?.command === 'string' && sl.command.includes('claudagotchi')

export function install() {
  const file = settingsFile()
  const settings = readJSON(file, {})
  const out = []
  if (settings.statusLine && !isOurs(settings.statusLine)) {
    const cfg = readJSON(files.config(), {})
    writeJSON(files.config(), { ...cfg, previousStatusLine: settings.statusLine })
    out.push(t('cli.yaHabia', { cmd: settings.statusLine.command || '?' }))
  }
  settings.statusLine = { type: 'command', command: statuslineCommand(), padding: 0 }
  writeJSON(file, settings, true)
  out.push(t('cli.instalado', { file }))
  return out.join('\n')
}

export function uninstall() {
  const file = settingsFile()
  const settings = readJSON(file, {})
  if (!isOurs(settings.statusLine)) return t('cli.noInstalado')
  const cfg = readJSON(files.config(), {})
  if (cfg.previousStatusLine) {
    settings.statusLine = cfg.previousStatusLine
    delete cfg.previousStatusLine
    writeJSON(files.config(), cfg)
  } else delete settings.statusLine
  writeJSON(file, settings, true)
  return t('cli.desinstalado')
}

export function isInstalled() {
  return isOurs(readJSON(settingsFile(), {}).statusLine)
}
