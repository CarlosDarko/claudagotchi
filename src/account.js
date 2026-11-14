// El % real del plan (sesión de 5 h y semana). Tres fuentes, de mejor a peor:
// 1) el JSON que Claude Code pasa a la statusline (campo rate_limits), gratis y oficial
// 2) la caché local si tiene menos de 3 minutos
// 3) la API de uso de la cuenta, con el token que Claude Code ya guardó al iniciar sesión
//    (nunca pedimos login propio ni guardamos el token)
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { CLAUDE_DIR, files, readJSON, writeJSON } from './paths.js'

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const FRESH_MS = 3 * 60_000
const FAIL_BACKOFF_MS = 5 * 60_000

const toMs = (v) => {
  if (v == null) return null
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

function window(w) {
  if (!w || typeof w !== 'object') return null
  const pct = Number(w.used_percentage ?? w.utilization ?? w.percent)
  if (!Number.isFinite(pct)) return null
  return { pct: Math.max(0, Math.min(100, pct)), resetsAt: toMs(w.resets_at ?? w.resetsAt) }
}

// Normaliza la respuesta de la API o el campo rate_limits de la statusline.
export function normalizeLimits(raw, source, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null
  const session = window(raw.five_hour)
  const week = window(raw.seven_day)
  const opus = window(raw.seven_day_opus)
  if (!session && !week) return null
  return { session, week, opus, fetchedAt: now, source, weeklyOnly: !session && !!week }
}

export function readCredentials() {
  const file = path.join(CLAUDE_DIR, '.credentials.json')
  let creds = readJSON(file, null)
  if (!creds && process.platform === 'darwin') {
    try {
      const out = execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1500,
      })
      creds = JSON.parse(out)
    } catch {}
  }
  const o = creds?.claudeAiOauth
  if (!o?.accessToken) return null
  return { token: o.accessToken, expiresAt: o.expiresAt || null, plan: o.subscriptionType || null }
}

export async function fetchLimits({ fetchImpl = globalThis.fetch, creds = readCredentials(), now = Date.now() } = {}) {
  if (!creds) return { error: 'sin-credenciales' }
  if (creds.expiresAt && creds.expiresAt < now) return { error: 'token-caducado' }
  try {
    const res = await fetchImpl(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'anthropic-version': '2023-06-01',
        'User-Agent': 'claudagotchi',
      },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return { error: `http-${res.status}` }
    const lim = normalizeLimits(await res.json(), 'api', now)
    return lim ? { limits: { ...lim, plan: creds.plan } } : { error: 'respuesta-rara' }
  } catch (e) {
    return { error: e?.name === 'TimeoutError' ? 'timeout' : 'red' }
  }
}

// Devuelve los límites actuales usando la mejor fuente disponible.
export async function getLimits({ fromStatusline = null, allowNetwork = true, now = Date.now(), fetchImpl } = {}) {
  const cache = readJSON(files.limits(), {})
  if (fromStatusline) {
    const lim = normalizeLimits(fromStatusline, 'statusline', now)
    if (lim) {
      writeJSON(files.limits(), { ...cache, limits: lim })
      return lim
    }
  }
  const cached = cache.limits
  if (cached && now - cached.fetchedAt < FRESH_MS) return cached
  if (!allowNetwork || (cache.failedAt && now - cache.failedAt < FAIL_BACKOFF_MS)) return withExpiry(cached, now)
  const { limits, error } = await fetchLimits({ now, fetchImpl })
  if (limits) {
    writeJSON(files.limits(), { limits })
    return limits
  }
  writeJSON(files.limits(), { ...cache, failedAt: now, error })
  return withExpiry(cached, now)
}

// Una lectura vieja cuya ventana ya pasó no vale: nunca se inventa un 0 %.
function withExpiry(lim, now) {
  if (!lim) return null
  const out = { ...lim, stale: true }
  for (const k of ['session', 'week']) if (out[k]?.resetsAt && out[k].resetsAt < now) out[k] = { ...out[k], expired: true }
  return out
}

export function lastError() {
  return readJSON(files.limits(), {}).error || null
}

export const hasCredentialsFile = () => fs.existsSync(path.join(CLAUDE_DIR, '.credentials.json'))
