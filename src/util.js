export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

export function dayKey(ts) {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fmtTokens(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`
  return String(Math.round(n))
}

export function fmtDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms < 0) ms = 0
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export function fmtClock(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Familia del modelo a partir de su id (claude-opus-5-5, claude-sonnet-4-5-20250929...)
export function modelFamily(model) {
  const m = String(model || '').toLowerCase()
  for (const f of ['opus', 'sonnet', 'haiku', 'fable']) if (m.includes(f)) return f
  return m.startsWith('<synthetic') || !m ? null : 'otro'
}

// Nombre corto de proyecto a partir del cwd o del nombre de carpeta codificado
export function projectName(cwd, folder) {
  if (cwd) {
    const parts = String(cwd).split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] || '~'
  }
  const parts = String(folder || '').split('-').filter(Boolean)
  return parts[parts.length - 1] || '~'
}

export function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pick(list, seed) {
  return list[Math.abs(seed) % list.length]
}
