// Lector incremental de los logs locales de Claude Code (~/.claude/projects/**/*.jsonl).
// Solo lee los bytes nuevos de cada fichero desde la última vez, así la statusline
// puede llamarlo en cada refresco sin coste.
import fs from 'node:fs'
import path from 'node:path'
import { PROJECTS_DIR, files, readJSON, writeJSON } from './paths.js'
import { dayKey, modelFamily, projectName } from './util.js'

const KEEP_DAYS = 60
const RECENT_MS = 8 * 3600_000
const BREAK_MS = 15 * 60_000
const VERSION = 4

export function emptyIndex() {
  return {
    v: VERSION,
    files: {},
    days: {},
    recent: [],
    totals: { tokens: 0, food: 0, models: {}, tools: {} },
    lastActivity: 0,
    lastTool: null,
    workStart: 0,
    pending: {},
    codeEvents: [],
  }
}

function listJsonl(dir) {
  const out = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listJsonl(p))
    else if (e.name.endsWith('.jsonl')) out.push(p)
  }
  return out
}

function day(index, key) {
  if (!index.days[key]) index.days[key] = { tokens: 0, food: 0, out: 0, msgs: 0, models: {}, projects: {}, hours: Array(24).fill(0) }
  return index.days[key]
}

// Clave de actividad según la última herramienta. El texto visible sale de i18n ('tool').
const TOOL_KIND = {
  Read: 'leyendo', Grep: 'buscando', Glob: 'buscando', Edit: 'editando', Write: 'escribiendo', MultiEdit: 'editando',
  NotebookEdit: 'editando', Bash: 'ejecutando', WebFetch: 'investigando', WebSearch: 'investigando',
  Task: 'delegando', Agent: 'delegando', TodoWrite: 'planificando', ExitPlanMode: 'planificando',
}
// Estilo de trabajo según la herramienta: decide el oficio de la mascota adulta
const TOOL_STYLE = {
  Edit: 'obras', Write: 'obras', MultiEdit: 'obras', NotebookEdit: 'obras',
  Read: 'explorador', Grep: 'explorador', Glob: 'explorador', LS: 'explorador',
  Bash: 'hacker', BashOutput: 'hacker', KillShell: 'hacker',
  WebFetch: 'sabio', WebSearch: 'sabio',
  Task: 'director', Agent: 'director',
}
export const toolStyle = (name) => TOOL_STYLE[name] || null

// Qué tipo de comando de código es (para que la mascota reaccione)
export function codeKind(cmd) {
  const c = String(cmd || '')
  if (/\bgit\s+commit\b/.test(c)) return 'commit'
  if (/\bgit\s+push\b/.test(c)) return 'push'
  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\bpytest\b|\bjest\b|\bvitest\b|\bcargo\s+test\b|\bgo\s+test\b|\bmvn\s+test\b|\bgradle\w*\s+test\b|\brspec\b|\bphpunit\b|\bdotnet\s+test\b|node\s+--test\b/.test(c)) return 'test'
  if (/\b(npm|pnpm|yarn|bun)\s+run\s+build\b|\bcargo\s+build\b|\btsc\b|\bmake\b|\bgo\s+build\b|\bmvn\s+(package|compile)\b/.test(c)) return 'build'
  return null
}

// ¿Ha ido bien? Por el error del resultado y por el texto que suelta
export function codeOutcome(kind, result) {
  if (result.is_error) return false
  const text = (Array.isArray(result.content) ? result.content.map((x) => x.text || '').join('\n') : String(result.content || '')).slice(-4000)
  if (kind === 'test') {
    const failed = text.match(/(\d+)\s+(failed|failing|failures?|errors?)\b/i)
    if (failed && Number(failed[1]) > 0) return false
    if (/\bFAIL(ED)?\b|✗|✖/.test(text) && !/\b0 failed\b/i.test(text)) return false
    return true
  }
  if (/error|fatal|failed/i.test(text) && kind !== 'commit') return !/\b0 errors?\b/i.test(text) ? false : true
  return !/nothing to commit|fatal/i.test(text)
}

export const toolKind = (name) => TOOL_KIND[name] || (name?.startsWith('mcp__') ? 'herramientas' : name ? 'trabajando' : null)

// Procesa una línea ya parseada. Exportada para los tests.
export function ingest(index, entry, folder, seen) {
  const ts = Date.parse(entry.timestamp)
  if (!Number.isFinite(ts)) return
  index.pending ??= {}
  index.codeEvents ??= []
  // Resultados de comandos de código que estábamos esperando
  if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
    for (const r of entry.message.content) {
      if (r.type !== 'tool_result' || !index.pending[r.tool_use_id]) continue
      const { kind } = index.pending[r.tool_use_id]
      delete index.pending[r.tool_use_id]
      index.codeEvents.push({ ts, kind, ok: codeOutcome(kind, r) })
      if (index.codeEvents.length > 40) index.codeEvents.splice(0, index.codeEvents.length - 40)
    }
  }
  if (entry.type === 'user' || entry.type === 'assistant') {
    if (ts > index.lastActivity) {
      if (ts - index.lastActivity > BREAK_MS) index.workStart = ts
      index.lastActivity = ts
    }
  }
  if (entry.type !== 'assistant') return
  const msg = entry.message || {}
  const tools = Array.isArray(msg.content) ? msg.content.filter((c) => c.type === 'tool_use') : []
  if (tools.length && ts >= index.lastActivity) index.lastTool = tools[tools.length - 1].name
  // Las herramientas se cuentan por bloque (cada una tiene su id propio)
  for (const tu of tools) {
    if (tu.name === 'Bash' && tu.id) {
      const kind = codeKind(tu.input?.command)
      if (kind) index.pending[tu.id] = { kind, ts }
    }
    const key = `t:${tu.id || ''}`
    if (tu.id && seen.has(key)) continue
    if (tu.id) seen.add(key)
    const st = toolStyle(tu.name)
    if (st) {
      index.totals.tools[st] = (index.totals.tools[st] || 0) + 1
      const dd = day(index, dayKey(ts))
      dd.tools = dd.tools || {}
      dd.tools[st] = (dd.tools[st] || 0) + 1
    }
  }
  const u = msg.usage
  if (!u) return
  const id = `${msg.id || ''}:${entry.requestId || ''}`
  if (msg.id) {
    if (seen.has(id)) return
    seen.add(id)
  }
  const fresh = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0)
  const tokens = fresh + (u.cache_read_input_tokens || 0)
  if (!tokens) return
  const d = day(index, dayKey(ts))
  d.tokens += tokens
  d.food += fresh
  d.out += u.output_tokens || 0
  d.msgs += 1
  d.hours[new Date(ts).getHours()] += tokens
  const fam = modelFamily(msg.model)
  if (fam) d.models[fam] = (d.models[fam] || 0) + tokens
  const proj = projectName(entry.cwd, folder)
  d.projects[proj] = (d.projects[proj] || 0) + tokens
  index.totals.tokens += tokens
  index.totals.food += fresh
  if (fam) index.totals.models[fam] = (index.totals.models[fam] || 0) + fresh
  if (Date.now() - ts < RECENT_MS) index.recent.push([ts, tokens, fresh])
}

export function scan({ dir = PROJECTS_DIR, index = null, save = true, now = Date.now() } = {}) {
  const idx = index || readJSON(files.index(), null)
  const state = idx && idx.v === VERSION ? idx : emptyIndex()
  const seenPaths = new Set()
  let changed = false
  for (const file of listJsonl(dir)) {
    seenPaths.add(file)
    let st
    try {
      st = fs.statSync(file)
    } catch {
      continue
    }
    const rec = state.files[file] || { offset: 0, ids: [] }
    if (st.size < rec.offset) Object.assign(rec, { offset: 0, ids: [] }) // fichero reescrito
    if (st.size === rec.offset) {
      state.files[file] = rec
      continue
    }
    const fd = fs.openSync(file, 'r')
    try {
      const len = st.size - rec.offset
      const buf = Buffer.alloc(len)
      fs.readSync(fd, buf, 0, len, rec.offset)
      const lastNl = buf.lastIndexOf(10)
      if (lastNl < 0) continue // línea a medio escribir
      const text = buf.subarray(0, lastNl).toString('utf8')
      const seen = new Set(rec.ids)
      const folder = path.basename(path.dirname(file))
      for (const line of text.split('\n')) {
        if (!line || (!line.includes('"assistant"') && !line.includes('"user"'))) continue
        let entry
        try {
          entry = JSON.parse(line)
        } catch {
          continue
        }
        ingest(state, entry, folder, seen)
      }
      rec.offset += lastNl + 1
      rec.ids = [...seen].slice(-160)
      state.files[file] = rec
      changed = true
    } finally {
      fs.closeSync(fd)
    }
  }
  for (const f of Object.keys(state.files)) if (!seenPaths.has(f)) delete state.files[f]
  prune(state, now)
  if (save && changed) writeJSON(files.index(), state)
  return state
}

function prune(state, now) {
  for (const [id, p] of Object.entries(state.pending || {})) if (now - p.ts > 3600_000) delete state.pending[id]
  state.recent = state.recent.filter(([ts]) => now - ts < RECENT_MS).sort((a, b) => a[0] - b[0])
  const cutoff = dayKey(now - KEEP_DAYS * 86400_000)
  for (const k of Object.keys(state.days)) if (k < cutoff) delete state.days[k]
}

// ---------- Consultas ----------

export function lastDays(index, n, now = Date.now()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const k = dayKey(now - i * 86400_000)
    out.push({ key: k, ...(index.days[k] || { tokens: 0, food: 0, out: 0, msgs: 0, models: {}, projects: {} }) })
  }
  return out
}

export function sumBy(days, field) {
  const acc = {}
  for (const d of days) for (const [k, v] of Object.entries(d[field] || {})) acc[k] = (acc[k] || 0) + v
  return Object.entries(acc).sort((a, b) => b[1] - a[1])
}

export function tokensSince(index, since) {
  let t = 0
  for (const [ts, tok] of index.recent) if (ts >= since) t += tok
  return t
}

// Ritmo reciente (tokens/min) en los últimos `windowMin` minutos.
export function burnRate(index, now = Date.now(), windowMin = 20) {
  return tokensSince(index, now - windowMin * 60_000) / windowMin
}

export function isWorking(index, now = Date.now()) {
  return now - index.lastActivity < 90_000
}
