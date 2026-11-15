// El mundo de fuera: el tiempo real de tu ciudad (Open-Meteo, gratis y sin cuenta)
// y si hay una versión nueva de Claudagotchi. Todo con caché y sin bloquear.
import path from 'node:path'
import { DATA_DIR, readJSON, writeJSON } from './paths.js'
import { loadConfig, saveConfig } from './store.js'
import { VERSION, REPO } from './version.js'

const weatherFile = () => path.join(DATA_DIR, 'weather.json')
const updateFile = () => path.join(DATA_DIR, 'update.json')
const get = async (url, ms = 2500) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'claudagotchi' } })
  if (!r.ok) throw new Error(`http-${r.status}`)
  return r.json()
}

// Códigos WMO -> lo que dibujamos
export function weatherKind(code) {
  if (code == null) return 'despejado'
  if (code === 0 || code === 1) return 'despejado'
  if (code === 2 || code === 3) return 'nublado'
  if (code === 45 || code === 48) return 'niebla'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'lluvia'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'nieve'
  if (code >= 95) return 'tormenta'
  return 'despejado'
}

export async function setCity(name) {
  const q = String(name || '').trim()
  if (!q) {
    saveConfig({ city: null })
    return null
  }
  const g = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=es&format=json`)
  const r = g.results?.[0]
  if (!r) return null
  const city = { name: r.name, country: r.country_code, lat: r.latitude, lon: r.longitude }
  saveConfig({ city })
  writeJSON(weatherFile(), {})
  return city
}

export async function getWeather(now = Date.now()) {
  const city = loadConfig().city
  if (!city) return null
  const cache = readJSON(weatherFile(), {})
  if (cache.at && now - cache.at < 30 * 60_000 && cache.city === city.name) return cache.w
  if (cache.failedAt && now - cache.failedAt < 10 * 60_000) return cache.w || null
  try {
    const d = await get(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=weather_code,temperature_2m,is_day`)
    const w = { kind: weatherKind(d.current?.weather_code), temp: d.current?.temperature_2m ?? null, city: city.name, lat: city.lat }
    writeJSON(weatherFile(), { at: now, city: city.name, w })
    return w
  } catch {
    writeJSON(weatherFile(), { ...cache, failedAt: now })
    return cache.w || null
  }
}

const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number), pb = String(b).replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  return false
}

export async function checkUpdate(now = Date.now()) {
  const cache = readJSON(updateFile(), {})
  if (!(cache.at && now - cache.at < 3600_000)) {
    try {
      const r = await get(`https://api.github.com/repos/${REPO}/releases/latest`, 3000)
      cache.latest = r.tag_name
      cache.at = now
      writeJSON(updateFile(), cache)
    } catch {
      cache.at = now - 45 * 60_000 // reintenta en un cuarto de hora
      writeJSON(updateFile(), cache)
    }
  }
  return cache.latest && newer(cache.latest, VERSION) ? { current: VERSION, latest: cache.latest } : null
}
