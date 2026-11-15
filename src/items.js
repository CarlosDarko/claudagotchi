// Tienda: accesorios para la mascota y decoración para el escenario. Se compran con
// bocados (que se ganan programando con Claude) y se quedan para siempre, también
// para las siguientes generaciones. Los nombres visibles están en i18n ('item').

// Accesorios: [id, hueco, precio]
export const GEAR = [
  // Cabeza
  ['gorra', 'cabeza', 6], ['gorro-lana', 'cabeza', 8], ['lazo', 'cabeza', 5], ['corona-flores', 'cabeza', 10],
  ['chistera', 'cabeza', 18], ['vaquero', 'cabeza', 14], ['vikingo', 'cabeza', 20], ['orejas-gato', 'cabeza', 9],
  ['boina', 'cabeza', 8], ['birrete', 'cabeza', 16], ['tiara', 'cabeza', 22], ['paja', 'cabeza', 10],
  ['helice', 'cabeza', 12], ['aureola', 'cabeza', 25], ['chef', 'cabeza', 12], ['pirata', 'cabeza', 15],
  ['antenas', 'cabeza', 9], ['papa-noel', 'cabeza', 0], ['cuernos-reno', 'cabeza', 0], ['fiesta', 'cabeza', 7],
  ['casco-espacial', 'cabeza', 40],
  // Cara
  ['gafas-sol', 'cara', 10], ['gafas-redondas', 'cara', 8], ['monoculo', 'cara', 14], ['bigote', 'cara', 7],
  ['antifaz', 'cara', 9], ['parche', 'cara', 8], ['gafas-3d', 'cara', 11], ['nariz-payaso', 'cara', 6],
  ['pegatinas', 'cara', 5],
  // Cuello
  ['pajarita', 'cuello', 7], ['perlas', 'cuello', 15], ['bufanda-roja', 'cuello', 9], ['medalla', 'cuello', 20],
  ['corbata', 'cuello', 8], ['panuelo', 'cuello', 6], ['cascabel', 'cuello', 7], ['lei', 'cuello', 10],
  // Mano
  ['globo', 'mano', 6], ['varita', 'mano', 14], ['espada', 'mano', 12], ['cafe', 'mano', 5],
  ['piruleta', 'mano', 6], ['paraguas', 'mano', 9], ['bandera', 'mano', 8],
  // Espalda
  ['mochila', 'espalda', 10], ['capa', 'espalda', 18], ['alas-hada', 'espalda', 24], ['alas-angel', 'espalda', 30],
]

// Decoración del escenario: [id, precio, ancho en píxeles de dibujo]
export const DECOR = [
  ['banco', 10, 16], ['buzon', 6, 7], ['pozo', 18, 16], ['farolillos', 12, 26], ['banderines', 8, 30],
  ['estanque', 20, 26], ['columpio', 22, 18], ['tienda-campana', 16, 20], ['hoguera', 12, 10], ['cartel', 6, 14],
  ['espantapajaros', 14, 12], ['girasoles', 8, 12], ['rosal', 9, 12], ['cactus', 6, 8], ['cerezo', 25, 26],
  ['pino', 15, 16], ['carretilla', 8, 14], ['estatua', 30, 12], ['fuente', 28, 18], ['escritorio', 20, 18],
  ['setas', 4, 9], ['calabaza', 0, 10], ['arbol-navidad', 0, 16], ['tarta', 0, 10], ['muneco-nieve', 0, 12],
]

export const SLOTS = ['cabeza', 'cara', 'cuello', 'mano', 'espalda']
export const gearSlot = (id) => GEAR.find((g) => g[0] === id)?.[1] || null
export function priceOf(id) {
  const g = GEAR.find((x) => x[0] === id)
  if (g) return g[2]
  const d = DECOR.find((x) => x[0] === id)
  return d ? d[1] : null
}
export const isDecor = (id) => DECOR.some((d) => d[0] === id)
export const isItem = (id) => isDecor(id) || !!gearSlot(id)
// Los de precio 0 no se venden: llegan de regalo en eventos especiales
export const forSale = (id) => (priceOf(id) ?? 0) > 0

export function ensureInventory(s) {
  s.owned ??= {}
  s.gear ??= {}
  s.decor ??= []
  return s
}

// Comprar (y ponérselo / colocarlo). Devuelve { ok, code }
export function buy(s, id, now) {
  ensureInventory(s)
  if (!isItem(id)) return { ok: false, code: 'noexiste' }
  if (s.owned[id]) return { ok: false, code: 'yatienes' }
  if (!forSale(id)) return { ok: false, code: 'regalo' }
  const price = priceOf(id)
  if (s.bocados < price) return { ok: false, code: 'caro', price }
  s.bocados -= price
  s.owned[id] = now
  use(s, id, true)
  return { ok: true, code: 'comprado' }
}

// Regalo (eventos): se añade sin pagar
export function gift(s, id, now) {
  ensureInventory(s)
  if (s.owned[id]) return false
  s.owned[id] = now
  return true
}

// Ponérselo / quitárselo, o colocar / quitar del escenario
export function use(s, id, force = null) {
  ensureInventory(s)
  if (!s.owned[id]) return { ok: false, code: 'notienes' }
  if (isDecor(id)) {
    const on = s.decor.includes(id)
    const want = force ?? !on
    s.decor = s.decor.filter((d) => d !== id)
    if (want) s.decor.push(id)
    return { ok: true, code: want ? 'colocado' : 'guardado' }
  }
  const slot = gearSlot(id)
  const on = s.gear[slot] === id
  const want = force ?? !on
  s.gear[slot] = want ? id : null
  return { ok: true, code: want ? 'puesto' : 'quitado' }
}

export const gearCount = (s) => Object.values(s.gear || {}).filter(Boolean).length
