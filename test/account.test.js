import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.CLAUDAGOTCHI_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-home-'))
const { normalizeLimits, fetchLimits, getLimits } = await import('../src/account.js')

test('entiende la API y el rate_limits de la statusline', () => {
  const now = 1_800_000_000_000
  const api = normalizeLimits({ five_hour: { utilization: 42, resets_at: '2027-01-01T00:00:00Z' }, seven_day: { utilization: 10 } }, 'api', now)
  assert.equal(api.session.pct, 42)
  assert.equal(api.week.pct, 10)
  const sl = normalizeLimits({ five_hour: { used_percentage: 7, resets_at: 1_800_000_100 } }, 'statusline', now)
  assert.equal(sl.session.resetsAt, 1_800_000_100_000)
  const weekly = normalizeLimits({ five_hour: null, seven_day: { utilization: 64 } }, 'api', now)
  assert.equal(weekly.weeklyOnly, true)
  assert.equal(normalizeLimits({}, 'api', now), null)
})

test('pide el uso con las cabeceras de OAuth y no lo intenta con el token caducado', async () => {
  let seen
  const fetchImpl = async (url, opts) => {
    seen = { url, opts }
    return { ok: true, json: async () => ({ five_hour: { utilization: 5 } }) }
  }
  const r = await fetchLimits({ fetchImpl, creds: { token: 'abc', expiresAt: Date.now() + 1e6 } })
  assert.equal(r.limits.session.pct, 5)
  assert.equal(seen.opts.headers.Authorization, 'Bearer abc')
  assert.equal(seen.opts.headers['anthropic-beta'], 'oauth-2025-04-20')
  const old = await fetchLimits({ fetchImpl, creds: { token: 'abc', expiresAt: 1 } })
  assert.equal(old.error, 'token-caducado')
})

test('una lectura vieja con la ventana pasada no se convierte en 0 %', async () => {
  const now = Date.now()
  await getLimits({ fromStatusline: { five_hour: { used_percentage: 80, resets_at: (now + 1000) / 1000 } }, now })
  const later = await getLimits({ allowNetwork: false, now: now + 10 * 60_000 })
  assert.equal(later.session.pct, 80)
  assert.equal(later.session.expired, true)
  assert.equal(later.stale, true)
})

test('login propio: abre la página de Claude, canjea el código y lo usa para el %', async () => {
  const { beginLogin, completeLogin, fetchLimits, isConnected, logout } = await import('../src/account.js')
  const url = beginLogin({ open: false })
  assert.match(url, /^https:\/\/claude\.ai\/oauth\/authorize\?/)
  assert.match(url, /code_challenge_method=S256/)
  let body
  const fetchImpl = async (u, opts) => {
    if (u.includes('/oauth/token')) {
      body = JSON.parse(opts.body)
      return { ok: true, json: async () => ({ access_token: 'tok-propio', refresh_token: 'r1', expires_in: 3600 }) }
    }
    assert.equal(opts.headers.Authorization, 'Bearer tok-propio')
    return { ok: true, json: async () => ({ five_hour: { utilization: 33 } }) }
  }
  const r = await completeLogin('CODIGO#ESTADO', { fetchImpl })
  assert.ok(r.ok)
  assert.equal(body.grant_type, 'authorization_code')
  assert.equal(body.code, 'CODIGO')
  assert.ok(body.code_verifier)
  assert.ok(isConnected())
  const lim = await fetchLimits({ fetchImpl })
  assert.equal(lim.limits.session.pct, 33)
  logout()
  assert.equal(isConnected(), false)
})
