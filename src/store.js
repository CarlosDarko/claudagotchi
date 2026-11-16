// Carga, avanza y guarda la mascota. Siempre leer-modificar-guardar de golpe,
// porque la statusline y la interfaz pueden tocarla a la vez.
import { files, readJSON, writeJSON } from './paths.js'
import { newPet, tick, act, reincarnate } from './pet.js'
import { scan } from './logs.js'
import { getLimits } from './account.js'
import { setLocale, systemLocale } from './i18n/index.js'

export function loadConfig() {
  return readJSON(files.config(), {})
}
export function saveConfig(patch) {
  const c = { ...loadConfig(), ...patch }
  writeJSON(files.config(), c)
  return c
}

export function initLocale() {
  return setLocale(process.env.CLAUDAGOTCHI_LANG || loadConfig().lang || systemLocale())
}

export function loadPet(index, now = Date.now()) {
  const p = readJSON(files.pet(), null)
  if (p && p.v === 1) return p
  const pet = newPet({ now, index })
  writeJSON(files.pet(), pet)
  return pet
}

export const savePet = (pet) => writeJSON(files.pet(), pet)

// Un paso completo: leer logs, límites, avanzar la simulación y guardar.
export async function refresh({ fromStatusline = null, allowNetwork = true, now = Date.now() } = {}) {
  const index = scan({ now })
  const limits = await getLimits({ fromStatusline, allowNetwork, now })
  const pet = loadPet(index, now)
  tick(pet, { index, limits, now })
  savePet(pet)
  return { pet, index, limits }
}

export function doAction(action, arg, now = Date.now()) {
  const index = scan({ now })
  const pet = loadPet(index, now)
  const res = act(pet, action, now, arg)
  savePet(pet)
  return { pet, res }
}

export function newEgg(name = null, now = Date.now()) {
  const index = scan({ now })
  const old = readJSON(files.pet(), null)
  const pet = reincarnate(old, { now, index, name })
  savePet(pet)
  return pet
}

export function rename(name) {
  const pet = readJSON(files.pet(), null)
  if (!pet) return null
  pet.name = String(name).slice(0, 20)
  savePet(pet)
  return pet
}
