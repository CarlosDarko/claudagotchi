import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

export const HOME = os.homedir()
export const DATA_DIR = process.env.CLAUDAGOTCHI_HOME || path.join(HOME, '.claudagotchi')
export const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude')
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

export const files = {
  pet: () => path.join(DATA_DIR, 'pet.json'),
  index: () => path.join(DATA_DIR, 'usage-index.json'),
  limits: () => path.join(DATA_DIR, 'limits-cache.json'),
  config: () => path.join(DATA_DIR, 'config.json'),
}

export function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

// Escritura atómica: la statusline puede lanzarse varias veces a la vez.
export function writeJSON(file, data, pretty = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, pretty ? `${JSON.stringify(data, null, 2)}\n` : JSON.stringify(data))
  fs.renameSync(tmp, file)
}
