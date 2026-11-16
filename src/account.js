// El % real del plan (sesión de 5 h y semana). Tres fuentes, de mejor a peor:
// 1) el JSON que Claude Code pasa a la statusline (campo rate_limits), gratis y oficial
// 2) la caché local si tiene menos de 3 minutos
// 3) la API de uso de la cuenta, con el token que Claude Code ya guardó al iniciar sesión
//    (nunca pedimos login propio ni guardamos el token)
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { CLAUDE_DIR, DATA_DIR, files, readJSON, writeJSON } from './paths.js'

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
// Login propio (el mismo cliente público que Claude Code), por si no encontramos el suyo
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const REDIRECT = 'https://platform.claude.com/oauth/code/callback'
const AUTHORIZE = 'https://claude.ai/oauth/authorize'
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token'
const SCOPE = 'org:create_api_key user:profile user:inference'
const UA = 'claude-cli/2.1.181 (external, cli)'
const authFile = () => path.join(DATA_DIR, 'auth.json')
const pendingFile = () => path.join(DATA_DIR, 'auth-pending.json')
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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

// Paso 1: la dirección para iniciar sesión (y la abre en el navegador)
export function beginLogin({ open = true } = {}) {
  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(32))
  const q = new URLSearchParams({ code: 'true', client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPE, code_challenge: challenge, code_challenge_method: 'S256', state })
  const url = `${AUTHORIZE}?${q.toString()}`
  writeJSON(pendingFile(), { verifier, state, at: Date.now() })
  if (open) openUrl(url)
  return url
}

export function openUrl(url) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url.replace(/&/g, '^&')], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
  } catch {}
}

function saveAuth(j, prevRefresh = null) {
  const t = { access_token: j.access_token, refresh_token: j.refresh_token || prevRefresh, expires_at: Date.now() + (j.expires_in > 0 ? j.expires_in : 3600) * 1000 }
  writeJSON(authFile(), t)
  try { fs.chmodSync(authFile(), 0o600) } catch {}
  return t
}

// Paso 2: el código que enseña Claude ("código#estado") o un token largo de "claude setup-token"
export async function completeLogin(pasted, { fetchImpl = globalThis.fetch } = {}) {
  const raw = String(pasted || '').trim()
  if (!raw) return { ok: false, error: 'vacio' }
  if (!raw.includes('#')) {
    writeJSON(authFile(), { access_token: raw, refresh_token: null, expires_at: Date.now() + 365 * 86400_000 })
    return { ok: true }
  }
  const pending = readJSON(pendingFile(), null)
  if (!pending) return { ok: false, error: 'sin-inicio' }
  const [code, returned] = raw.split('#')
  try {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ grant_type: 'authorization_code', code, state: returned || pending.state, code_verifier: pending.verifier, client_id: CLIENT_ID, redirect_uri: REDIRECT }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { ok: false, error: `http-${res.status}` }
    saveAuth(await res.json())
    try { fs.unlinkSync(pendingFile()) } catch {}
    writeJSON(files.limits(), {})
    return { ok: true }
  } catch {
    return { ok: false, error: 'red' }
  }
}

export function logout() {
  try { fs.unlinkSync(authFile()) } catch {}
  writeJSON(files.limits(), {})
}

async function ownToken({ fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const t = readJSON(authFile(), null)
  if (!t?.access_token) return null
  if (t.expires_at && t.expires_at - now < 60_000) {
    if (!t.refresh_token) return null
    try {
      const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: CLIENT_ID }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      return { token: saveAuth(await res.json(), t.refresh_token).access_token, expiresAt: null, own: true }
    } catch {
      return null
    }
  }
  return { token: t.access_token, expiresAt: t.expires_at, own: true }
}

export const isConnected = () => !!readJSON(authFile(), null)?.access_token

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

export async function fetchLimits({ fetchImpl = globalThis.fetch, creds = undefined, now = Date.now() } = {}) {
  if (creds === undefined) creds = (await ownToken({ fetchImpl, now })) || readCredentials()
  if (!creds) return { error: 'sin-credenciales' }
  if (creds.expiresAt && creds.expiresAt < now) return { error: 'token-caducado' }
  try {
    const res = await fetchImpl(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'anthropic-version': '2023-06-01',
        'User-Agent': UA,
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
export const usageDisabled = () => !!readJSON(files.config(), {}).widget?.noUsage

export async function getLimits({ fromStatusline = null, allowNetwork = true, now = Date.now(), fetchImpl } = {}) {
  if (usageDisabled()) return null // apagado por el usuario en ⚙
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
  if (usageDisabled()) return 'desactivado'
  return readJSON(files.limits(), {}).error || null
}

export const hasCredentialsFile = () => fs.existsSync(path.join(CLAUDE_DIR, '.credentials.json'))

// Explica por qué hay (o no hay) % real. Para "claudagotchi diagnostico".
export async function diagnose(now = Date.now()) {
  const out = []
  const file = path.join(CLAUDE_DIR, '.credentials.json')
  out.push(`Carpeta de Claude Code: ${CLAUDE_DIR}`)
  out.push(`Fichero de login: ${fs.existsSync(file) ? 'sí está' : 'no está'} (${file})`)
  const creds = readCredentials()
  if (!creds) out.push('Login de Claude Code: no encontrado. Abre Claude Code e inicia sesión con tu cuenta de Claude (no con una API key).')
  else {
    out.push(`Login de Claude Code: encontrado${creds.plan ? `, plan ${creds.plan}` : ''}`)
    if (creds.expiresAt) out.push(`Caduca: ${new Date(creds.expiresAt).toLocaleString()}${creds.expiresAt < now ? ' (YA CADUCADO: abre Claude Code un momento y se renueva solo)' : ''}`)
    const r = await fetchLimits({ creds, now })
    out.push(r.limits ? `Consulta del %: bien. Sesión ${r.limits.session?.pct ?? '—'} %, semana ${r.limits.week?.pct ?? '—'} %` : `Consulta del %: falla (${r.error})`)
  }
  const cache = readJSON(files.limits(), {})
  if (cache.limits) out.push(`Última lectura guardada: ${new Date(cache.limits.fetchedAt).toLocaleString()} (vía ${cache.limits.source})`)
  if (cache.error) out.push(`Último error: ${cache.error}`)
  return out.join('\n')
}
