// Sonidos de 8 bits hechos al momento (ondas cuadradas y triangulares), sin
// ficheros. Cada acción y cada reacción tiene su melodía corta.
let ctx = null
let enabled = true
let volume = 0.35

export function setSound(on, vol = volume) {
  enabled = on
  volume = vol
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// notes: [[frecuencia, duración en s, retraso], ...]
function play(notes, { type = 'square', gain = 0.12 } = {}) {
  if (!enabled) return
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + 0.01
  for (const [f, d, delay = 0] of notes) {
    if (!f) continue
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, t0 + delay)
    g.gain.setValueAtTime(0, t0 + delay)
    g.gain.linearRampToValueAtTime(gain * volume, t0 + delay + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + d)
    o.connect(g).connect(a.destination)
    o.start(t0 + delay)
    o.stop(t0 + delay + d + 0.02)
  }
}

const seq = (freqs, step = 0.08, dur = 0.09) => freqs.map((f, i) => [f, dur, i * step])

export const SFX = {
  comer: () => play(seq([523, 659, 523, 784], 0.07, 0.07)),
  chuche: () => play(seq([784, 988, 1175, 1568], 0.06, 0.08), { type: 'triangle', gain: 0.18 }),
  limpiar: () => play(seq([1200, 1500, 1800, 2100, 2400], 0.035, 0.05), { type: 'triangle', gain: 0.12 }),
  medicina: () => play(seq([392, 330, 392, 523], 0.09, 0.1), { type: 'triangle', gain: 0.16 }),
  mimo: () => play(seq([659, 880], 0.1, 0.16), { type: 'triangle', gain: 0.18 }),
  dormir: () => play(seq([523, 392, 330, 262], 0.12, 0.16), { type: 'triangle', gain: 0.14 }),
  despertar: () => play(seq([262, 330, 392, 523], 0.07, 0.1), { type: 'triangle', gain: 0.14 }),
  feliz: () => play(seq([523, 659, 784, 1047], 0.07, 0.09)),
  triste: () => play(seq([392, 370, 349, 330], 0.13, 0.14), { type: 'triangle', gain: 0.15 }),
  comprar: () => play([[988, 0.07, 0], [1319, 0.18, 0.07]], { gain: 0.1 }),
  error: () => play([[196, 0.12, 0], [165, 0.18, 0.11]], { gain: 0.1 }),
  click: () => play([[1400, 0.025, 0]], { type: 'triangle', gain: 0.08 }),
  ganar: () => play(seq([523, 659, 784, 1047, 784, 1047], 0.08, 0.1)),
  perder: () => play(seq([392, 330, 262], 0.12, 0.14), { type: 'triangle' }),
  acierto: () => play([[880, 0.08, 0], [1175, 0.12, 0.07]], { gain: 0.09 }),
  fallo: () => play([[220, 0.16, 0]], { gain: 0.08 }),
  eclosion: () => play(seq([392, 523, 659, 784, 1047, 1319, 1568], 0.07, 0.12), { gain: 0.12 }),
  chispa: () => play([[1568 + Math.random() * 400, 0.05, 0]], { type: 'triangle', gain: 0.07 }),
  logro: () => play(seq([784, 988, 1175, 1568, 1175, 1568], 0.08, 0.12), { gain: 0.11 }),
  visita: () => play(seq([659, 523, 659, 523], 0.12, 0.08), { type: 'triangle', gain: 0.14 }),
  codigoBien: () => play(seq([659, 880, 1319], 0.07, 0.1), { type: 'triangle', gain: 0.16 }),
  codigoMal: () => play(seq([330, 311, 294], 0.1, 0.12), { type: 'triangle', gain: 0.14 }),
  // Avisos de Claude: más fuertes y reconocibles, para enterarte aunque no mires
  alertaPermiso: () => play([[880, 0.14, 0], [1175, 0.14, 0.16], [880, 0.14, 0.32], [1175, 0.22, 0.48]], { gain: 0.2 }),
  alertaFin: () => play(seq([784, 988, 1319], 0.1, 0.18), { type: 'triangle', gain: 0.22 }),
  alertaLimite: () => play([[660, 0.12, 0], [660, 0.12, 0.18], [523, 0.3, 0.36]], { gain: 0.2 }),
  saltito: () => play([[523, 0.05, 0], [784, 0.08, 0.05]], { type: 'triangle', gain: 0.1 }),
}

export function sfx(name) {
  try {
    SFX[name]?.()
  } catch {}
}
