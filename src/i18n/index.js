// Multiidioma: todos los textos viven en src/i18n/<idioma>.js.
// Para añadir un idioma: copia es.js a en.js (por ejemplo), tradúcelo y añádelo a LOCALES.
// Se elige con CLAUDAGOTCHI_LANG=en, con "claudagotchi idioma en", en config.json o según el sistema.
import es from './es.js'
import en from './en.js'

export const LOCALES = { es, en }
export const LOCALE_NAMES = { es: 'Español', en: 'English' }
export const DEFAULT_LOCALE = 'es'
let current = DEFAULT_LOCALE

export function setLocale(code) {
  const c = String(code || '').toLowerCase().slice(0, 2)
  current = LOCALES[c] ? c : DEFAULT_LOCALE
  return current
}
export const getLocale = () => current

// Idioma del sistema: castellano si el sistema está en español, inglés en el resto
export function systemLocale(env = process.env) {
  let l = env.LC_ALL || env.LC_MESSAGES || env.LANG || ''
  if (!l || /^(C|POSIX)/.test(l)) { try { l = Intl.DateTimeFormat().resolvedOptions().locale } catch {} }
  return String(l || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'
}

function lookup(key) {
  return LOCALES[current]?.[key] ?? LOCALES[DEFAULT_LOCALE][key]
}

const fill = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m))

// t('clave', { var: valor }). Si la entrada es una lista, elige una con `seed`.
export function t(key, vars = {}, seed = 0) {
  let v = lookup(key)
  if (v == null) return key
  if (Array.isArray(v)) v = v[Math.abs(Math.floor(seed)) % v.length]
  if (typeof v === 'function') return v(vars)
  return fill(v, vars)
}

// Para objetos de etiquetas (por ejemplo, nombres de humores)
export const tmap = (key) => lookup(key) || {}
