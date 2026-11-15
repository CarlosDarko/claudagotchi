// Pixel art dibujado en código, sin imágenes. Cada cuerpo se sombrea píxel a píxel
// como si fuera una esfera iluminada desde arriba a la izquierda, con rampas de
// color que viran a morado en las sombras y a cálido en las luces, trama de puntos
// (dithering) entre tonos y contorno selectivo (más suave donde da la luz).
// Cara, brazos, patas y accesorios se montan encima según etapa, forma y humor.

// ---------- Lienzo ----------

export class Canvas {
  constructor(w, h, bg = null) {
    this.w = w
    this.h = h
    this.px = Array.from({ length: h }, () => Array(w).fill(bg))
  }
  set(x, y, c) {
    x = Math.round(x)
    y = Math.round(y)
    if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y][x] = c
  }
  get(x, y) {
    return this.px[y]?.[x] ?? null
  }
  // Mezcla un color encima del que haya (para sombras, luz y transparencias)
  blend(x, y, c, a) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const under = this.px[y][x]
    if (!under) this.px[y][x] = withAlpha(c, a)
    else this.px[y][x] = mix(solid(under), c, a)
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  stamp(x, y, rows, palette) {
    rows.forEach((row, j) => {
      ;[...row].forEach((ch, i) => {
        if (palette[ch]) this.set(x + i, y + j, palette[ch])
      })
    })
  }
  // Aplica una función de color a todo el lienzo (noche, enfermedad...)
  map(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.px[y][x]) this.px[y][x] = fn(this.px[y][x], x, y)
  }
}

// ---------- Color ----------

const rgb = (hex) => {
  const n = parseInt(hex.slice(1, 7), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
const solid = (c) => (c.length > 7 ? c.slice(0, 7) : c)
const withAlpha = (c, a) => `${solid(c)}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b)
  return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}
function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return [h, s, l]
}
function fromHsl([h, s, l]) {
  h = ((h % 360) + 360) % 360
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return hex([f(0) * 255, f(8) * 255, f(4) * 255])
}
// Gira el tono hacia `target` un máximo de `amt` grados
function hueToward(h, target, amt) {
  let d = ((target - h + 540) % 360) - 180
  return h + Math.sign(d) * Math.min(Math.abs(d), amt)
}
// Rampa de 6 tonos a partir de un color base, con desplazamiento de tono
export function ramp(base) {
  const [h, s, l] = toHsl(rgb(base))
  const tone = (dl, dh, ds, target) => fromHsl([hueToward(h, target, dh), Math.max(0, Math.min(1, s + ds)), Math.max(0.03, Math.min(0.97, l * dl))])
  return {
    outline: tone(0.32, 28, 0.08, 255),
    deep: tone(0.56, 18, 0.04, 255),
    shade: tone(0.78, 9, 0.02, 255),
    base,
    light: tone(1.16, 8, -0.04, 55),
    high: tone(1.36, 14, -0.12, 55),
  }
}
export const desaturate = (c, k) => {
  const [h, s, l] = toHsl(rgb(solid(c)))
  return fromHsl([h, s * (1 - k), l])
}

// Matriz de Bayer 4x4 para la trama
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
const bayer = (x, y) => BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]

const LIGHT = (() => {
  const v = [-0.55, -0.72, 0.6]
  const n = Math.hypot(...v)
  return v.map((x) => x / n)
})()

// Volumen sombreado: superelipse con base algo plana. Devuelve la máscara.
export function shaded(c, cx, cy, rx, ry, R, { n = 2.3, flat = 0.25, outline = true, spec = true, alpha = 1 } = {}) {
  const inside = (x, y) => {
    const dx = (x - cx) / rx
    let dy = (y - cy) / ry
    const nn = dy > 0 ? n + flat * 4 : n
    return Math.abs(dx) ** nn + Math.abs(dy) ** nn <= 1
  }
  const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1), y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1)
  const put = (x, y, col) => (alpha < 1 ? c.blend(x, y, col, alpha) : c.set(x, y, col))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue
      const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5)
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)))
      const I = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
      if (edge && outline) {
        // Contorno selectivo: arriba a la izquierda, suave; abajo a la derecha, oscuro
        put(x, y, I > 0.35 ? R.shade : I > -0.1 ? R.deep : R.outline)
        continue
      }
      const v = (I * 0.5 + 0.5) * 3.1 + 0.15 + (bayer(x, y) - 0.5) * 0.42
      const lv = Math.max(0, Math.min(3, Math.floor(v)))
      let col = [R.deep, R.shade, R.base, R.light][lv]
      if (spec && I > 0.93) col = R.high
      put(x, y, col)
    }
  }
  return inside
}

// ---------- Paletas ----------

const BASE = {
  coral: '#E8845E',
  opus: '#8E6CF2',
  sonnet: '#F4B03E',
  haiku: '#F2A7B6',
  fable: '#5C9EF0',
  mixto: '#86C84A',
  fantasma: '#E6EAF6',
}
export const PALETTES = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, ramp(v)]))

const INK = '#1B1530'
const WHITE = '#FFFFFF'
const CHEEK = '#FF8FA3'
const GOLD = ramp('#F7C744')
const CREAM = ramp('#F3E6C4')

export function paletteFor(pet, mood) {
  const key = pet.stage === 'adulto' || pet.stage === 'leyenda' ? pet.form || 'mixto' : 'coral'
  let base = BASE[key] || BASE.coral
  if (pet.variant === 'grunon') base = desaturate(base, 0.45)
  if (mood === 'enfermo') base = mix(desaturate(base, 0.4), '#9CC48A', 0.35)
  const R = ramp(base)
  if (pet.variant === 'brillante' || pet.stage === 'leyenda') {
    R.light = mix(R.light, '#FFFFFF', 0.15)
    R.high = '#FFFFFF'
  }
  return R
}

// ---------- Tamaños por etapa ----------

export const BODY = {
  bebe: { rx: 6.6, ry: 5.8, eye: 2, eyeDx: 2.6, eyeDy: -0.6, feet: false, arms: false, sprout: true },
  nino: { rx: 7.8, ry: 6.8, eye: 2, eyeDx: 3, eyeDy: -1, feet: true, arms: true },
  teen: { rx: 8.8, ry: 7.6, eye: 3, eyeDx: 3.4, eyeDy: -1.4, feet: true, arms: true, ears: true },
  adulto: { rx: 9.8, ry: 8.4, eye: 3, eyeDx: 3.8, eyeDy: -1.8, feet: true, arms: true },
  leyenda: { rx: 10.2, ry: 8.8, eye: 3, eyeDx: 4, eyeDy: -1.9, feet: true, arms: true },
}
export const petHeight = (stage) => {
  const b = BODY[stage]
  return b ? Math.ceil(b.ry * 2) + 2 : 18
}

// ---------- Cara ----------

const OPEN_EYES = ['normal', 'trabajando', 'hambriento', 'fuego', 'triste', 'sucio', 'cansado']

// Ojos con plantilla: k tinta, W brillo, b reflejo azulado
const EYES = {
  2: ['Wk', 'kk', 'kb'],
  3: ['.kk.', 'kWkk', 'kkkk', '.kb.'],
}
const EYES_BIG = {
  2: ['Wk', 'kW', 'kb'],
  3: ['.kk.', 'kWWk', 'kWkk', '.kb.'],
}
const eyeW = (size) => EYES[size][0].length

function eye(c, x, y, size, look, { big = false, lid = 0, R }) {
  const rows = (big ? EYES_BIG : EYES)[size]
  c.stamp(x + look, y, rows, { k: INK, W: WHITE, b: '#8C9BFF' })
  // Párpado caído (sueño, desgana)
  for (let j = 0; j < lid; j++) for (let i = -1; i <= rows[0].length; i++) c.set(x + i + look, y + j, j === lid - 1 ? R.deep : R.base)
}

function arc(c, x, y, w, color, up = true) {
  // ^ o ‿ de w píxeles
  for (let i = 0; i < w; i++) {
    const mid = Math.abs(i - (w - 1) / 2) < 0.6
    c.set(x + i, y + (mid ? (up ? -1 : 1) : 0) + (up ? 0 : 0), color)
  }
}

function face(c, cx, cy, b, mood, frame, R, opts) {
  const s = b.eye
  const ew = eyeW(s)
  const lx = Math.round(cx - b.eyeDx - ew / 2), rx = Math.round(cx + b.eyeDx - ew / 2 + 1)
  const ey = Math.round(cy + b.eyeDy - s / 2)
  const blink = OPEN_EYES.includes(mood) && frame % 26 >= 24
  const look = opts.look || 0
  const my = ey + EYES[s].length + 1
  const mx = Math.round(cx)

  // Mejillas con trama
  if (!['dormido', 'enfermo', 'fuego'].includes(mood)) {
    for (const x0 of [lx - 2, rx + ew]) for (let i = 0; i < 2; i++) c.blend(x0 + i, ey + EYES[s].length - (s > 2 ? 1 : 0), CHEEK, 0.8)
  }

  if (blink || mood === 'dormido') {
    for (const x0 of [lx, rx]) arc(c, x0, ey + EYES[s].length - 2, ew, INK, false)
  } else if (mood === 'feliz') {
    for (const x0 of [lx, rx]) arc(c, x0, ey + 1, ew, INK, true)
  } else if (mood === 'enfermo') {
    for (const x0 of [lx, rx]) {
      c.stamp(x0, ey, ew > 2 ? ['k..k', '.kk.', 'k..k'] : ['k.k', '.k.', 'k.k'], { k: INK })
    }
  } else {
    const lid = mood === 'cansado' ? 2 : mood === 'sucio' ? 1 : 0
    for (const x0 of [lx, rx]) eye(c, x0, ey, s, look, { big: mood === 'hambriento', lid, R })
    if (mood === 'fuego' || opts.grumpy) {
      // Cejas enfadadas
      c.set(lx - 1, ey - 2, INK); c.set(lx, ey - 2, INK); c.set(lx + 1, ey - 1, INK)
      c.set(rx + ew, ey - 2, INK); c.set(rx + ew - 1, ey - 2, INK); c.set(rx + ew - 2, ey - 1, INK)
    }
    if (mood === 'triste') {
      c.set(lx + 1, ey - 2, INK); c.set(lx, ey - 1, INK)
      c.set(rx + ew - 2, ey - 2, INK); c.set(rx + ew - 1, ey - 1, INK)
      const k = frame % 8
      c.set(lx, ey + EYES[s].length + (k >> 1), '#8FD0FF')
      if (k < 4) c.set(rx + ew - 1, ey + EYES[s].length + 1 + k, '#8FD0FF')
    }
  }

  // Boca
  switch (mood) {
    case 'feliz':
      c.rect(mx - 1, my, 3, 2, INK)
      c.set(mx, my + 1, '#F2557A')
      c.set(mx - 2, my, INK); c.set(mx + 2, my, INK)
      break
    case 'hambriento':
      c.rect(mx - 1, my, 3, 2, INK)
      if (frame % 6 < 4) c.set(mx + 1, my + 2 + ((frame % 6) >> 1), '#A8E0FF')
      break
    case 'dormido':
      c.set(mx, my, frame % 8 < 4 ? INK : R.deep)
      break
    case 'cansado':
      if (frame % 20 < 6) c.rect(mx - 1, my, 2, 2, INK) // bostezo
      else c.set(mx, my, INK)
      break
    case 'triste':
    case 'enfermo':
      c.set(mx - 1, my + 1, INK); c.set(mx, my, INK); c.set(mx + 1, my + 1, INK)
      break
    case 'fuego':
      c.rect(mx - 2, my, 5, 2, INK)
      c.set(mx - 1, my, WHITE); c.set(mx + 1, my, WHITE); c.set(mx, my + 1, WHITE)
      break
    case 'trabajando':
    case 'sucio':
      c.rect(mx - 1, my, 2, 1, INK)
      break
    default:
      if (opts.grumpy) c.rect(mx - 1, my, 3, 1, INK)
      else { c.set(mx - 1, my, INK); c.set(mx, my + 1, INK); c.set(mx + 1, my, INK) } // ‿
  }
}

// ---------- Extremidades ----------

function limbs(c, cx, cy, b, mood, frame, R, opts, front) {
  const walking = opts.walking
  if (!front && b.feet) {
    const fy = Math.round(cy + b.ry) - 1
    const lift = walking ? (frame % 4 < 2 ? [1, 0] : [0, 1]) : [0, 0]
    shaded(c, cx - b.rx * 0.5, fy - lift[0], 2.6, 1.7, R, { n: 2, flat: 0, spec: false })
    shaded(c, cx + b.rx * 0.5, fy - lift[1], 2.6, 1.7, R, { n: 2, flat: 0, spec: false })
  }
  if (front && b.arms) {
    const ay = cy + b.ry * 0.2
    let up = 0, dx = 0
    if (mood === 'feliz') up = frame % 4 < 2 ? 4 : 3
    else if (mood === 'trabajando') { up = frame % 2 ? 1 : 0; dx = 1 }
    else if (walking) up = frame % 4 < 2 ? 1 : 0
    shaded(c, cx - b.rx - 0.4 + dx, ay - up, 1.8, 1.5, R, { n: 2, flat: 0, spec: false })
    shaded(c, cx + b.rx + 0.4 - dx, ay - (mood === 'feliz' ? 7 - up : up), 1.8, 1.5, R, { n: 2, flat: 0, spec: false })
  }
}

// ---------- Accesorios de cada forma ----------

function horn(c, x, y, h, dir) {
  // Cuerno curvado hacia fuera, con su rampa crema (h: 4 o 5)
  const rows = h >= 5 ? ['H...', 'hH..', '.hH.', '.hhH', '.shh'] : ['H..', 'hH.', '.hH', '.sh']
  const pal = { H: CREAM.high, h: CREAM.base, s: CREAM.shade }
  const w = rows[0].length
  rows.forEach((row, j) => {
    ;[...row].forEach((ch, i) => {
      if (pal[ch]) c.set(dir < 0 ? x - (w - 1) + i : x + (w - 1) - i, y - rows.length + 1 + j, pal[ch])
    })
  })
}

function extras(c, form, cx, cy, b, R, frame, back) {
  const top = Math.round(cy - b.ry)
  const L = cx - b.rx, Rr = cx + b.rx
  if (form === 'opus') {
    if (back) {
      // Alas de murciélago con nervios, que aletean
      const flap = frame % 6 < 3 ? 0 : 1
      const wing = (side) => {
        const x0 = side < 0 ? L + 1 : Rr - 1
        for (let j = 0; j < 7; j++) {
          const len = [3, 5, 6, 6, 5, 3, 2][j]
          for (let i = 0; i < len; i++) {
            const x = x0 + side * (i + 1), y = cy - 5 + j - flap * (i > 2 ? 1 : 0)
            const rib = i === len - 1 || (j === 0 && i > 0)
            c.set(x, y, rib ? R.outline : i % 3 === 2 ? R.deep : mix(R.shade, '#C9B6FF', 0.25))
          }
        }
      }
      wing(-1)
      wing(1)
      // Cola con púa
      const tx = Math.round(Rr) - 1, ty = Math.round(cy + b.ry * 0.5)
      c.stamp(tx, ty - 3, ['....s', '...bs', '..bb.', 'bbb..'], { b: R.shade, s: CREAM.base })
      return
    }
    horn(c, Math.round(cx - b.rx * 0.45), top + 1, 5, -1)
    horn(c, Math.round(cx + b.rx * 0.45), top + 1, 5, 1)
    // Escamas en la tripa
    for (let i = -2; i <= 2; i += 2) c.blend(Math.round(cx + i), Math.round(cy + b.ry * 0.55), R.shade, 0.6)
  } else if (form === 'sonnet') {
    if (back) {
      // Cola de plumas
      c.stamp(Math.round(Rr) - 1, Math.round(cy) + 1, ['.ff', 'fff.', '.fhh', '..h'], { f: R.shade, h: '#E2553C' })
      return
    }
    // Cresta de tres plumas en degradado
    const cr = ['#E2553C', '#F07A3A', '#F7A23B']
    for (let k = 0; k < 3; k++) {
      const x = Math.round(cx) - 1 + k, hgt = [3, 4, 3][k]
      for (let j = 0; j < hgt; j++) c.set(x + (j > 1 ? k - 1 : 0), top - j, cr[Math.min(2, j)])
    }
    // Pico
    const by = Math.round(cy + b.eyeDy + b.eye + 0.5)
    c.stamp(Math.round(cx) - 1, by, ['ooo', '.d.'], { o: '#F7A23B', d: '#C2662A' })
    // Notas que flotan
    if (frame % 10 < 7) {
      const ny = top - 2 - ((frame >> 1) % 4)
      c.stamp(Math.round(Rr) + 2, ny, ['.nn', '.n.', 'nn.'], { n: '#FFE7A8' })
    }
  } else if (form === 'haiku') {
    if (back) {
      // Branquias de ajolote, tres a cada lado
      const gc = ['#E5577A', '#F27C9A', '#E5577A']
      for (let k = 0; k < 3; k++) {
        const y = Math.round(cy - b.ry * 0.55) + k * 2
        const wav = (frame + k) % 6 < 3 ? 0 : 1
        for (let i = 0; i < 3; i++) {
          c.set(Math.round(L) - i, y - (i === 2 ? wav : 0), gc[k])
          c.set(Math.round(Rr) + i, y - (i === 2 ? wav : 0), gc[k])
        }
      }
      return
    }
    // Manchas de koi en naranja
    const spots = [[-1, -7], [0, -7], [1, -7], [0, -6], [-8, 2], [-8, 3], [-7, 3], [8, 0], [8, 1], [7, 1]]
    for (const [dx, dy] of spots) c.blend(Math.round(cx + dx * b.rx / 9.8), Math.round(cy + dy * b.ry / 8.4), '#F07A3A', 0.8)
    const by = top - 2 - (frame % 8)
    if (by > 0) { c.set(Math.round(Rr) + 1, by, '#CFF6FF'); c.set(Math.round(Rr) + 3, by - 3, '#CFF6FF') }
  } else if (form === 'fable') {
    if (back) return
    // Sombrero de mago con ala, banda y estrella
    const hx = Math.round(cx), hy = top + 1
    const H = ramp('#3E2C86')
    for (let j = 0; j < 8; j++) {
      const w = Math.max(1, 9 - j - (j > 4 ? 1 : 0))
      const lean = j > 4 ? j - 4 : 0
      for (let i = 0; i < w; i++) c.set(hx - Math.floor(w / 2) + i + lean, hy - j, i === 0 ? H.light : i === w - 1 ? H.deep : H.base)
    }
    for (let i = -6; i <= 6; i++) c.set(hx + i, hy + 1, i < -4 ? H.light : H.shade)
    for (let i = -4; i <= 4; i++) c.set(hx + i, hy, GOLD.base)
    const tw = frame % 8 < 4
    c.stamp(hx - 1, hy - 4, ['.y.', 'yYy', '.y.'], { y: GOLD.base, Y: tw ? WHITE : GOLD.high })
    if (frame % 12 < 6) c.set(Math.round(Rr) + 2, top - 3, GOLD.high)
  } else if (form === 'mixto') {
    if (back) {
      c.stamp(Math.round(Rr), Math.round(cy) - 2, ['ff', 'fff', 'ff'], { f: '#4BB8C9' })
      return
    }
    horn(c, Math.round(cx - b.rx * 0.4), top + 1, 5, -1)
    c.stamp(Math.round(cx) + 2, top + 2, ['h.h', 'hhh', '.h.'], { h: '#F2557A' })
  }
}

function crown(c, cx, y) {
  c.stamp(cx - 4, y, ['y..y..y', 'yy.y.yy', 'yyyyyyy', 'ybyryby'], { y: GOLD.base, b: '#5BC0F2', r: '#F2557A' })
  c.set(cx - 4, y, GOLD.high); c.set(cx - 1, y, GOLD.high); c.set(cx + 2, y, GOLD.high)
  for (let i = 0; i < 7; i++) c.set(cx - 4 + i, y + 3, i % 2 ? GOLD.shade : c.get(cx - 4 + i, y + 3))
}

// ---------- La mascota ----------

// x, y: centro del cuerpo. opts: { frame, look (-1..1), walking, dir }
export function drawPet(c, pet, mood, { x, y, frame = 0, look = 0, walking = false } = {}) {
  if (pet.stage === 'huevo') return drawEgg(c, pet, x, y, frame)
  if (mood === 'nube' || pet.stage === 'nube') return drawGhost(c, x, y, frame)
  const b = BODY[pet.stage] || BODY.bebe
  const R = paletteFor(pet, mood)
  const form = pet.stage === 'adulto' || pet.stage === 'leyenda' ? pet.form || 'mixto' : null
  // Respirar y rebotar al andar (estirar y aplastar)
  const breathe = mood === 'dormido' ? (frame % 10 < 5 ? 0.25 : -0.15) : frame % 12 < 6 ? 0.15 : -0.1
  const hop = walking ? (frame % 4 === 1 || frame % 4 === 3 ? -1 : 0) : mood === 'feliz' ? (frame % 6 < 3 ? -1 : 0) : 0
  const sq = walking && hop === 0 ? 0.3 : 0
  const rx = b.rx + sq * 0.6, ry = b.ry - sq + breathe
  const cx = x, cy = y + hop + (b.ry - ry)
  const bb = { ...b, rx, ry }
  const opts = { look, walking, grumpy: pet.variant === 'grunon' }

  if (pet.stage === 'leyenda') {
    for (let a = 0; a < 20; a++) {
      if ((a + frame) % 4) continue
      const ang = (a / 20) * Math.PI * 2 + frame * 0.05
      c.set(cx + Math.cos(ang) * (rx + 4), cy + Math.sin(ang) * (ry + 3), a % 8 === 0 ? WHITE : GOLD.high)
    }
  }
  if (form) extras(c, form, cx, cy, bb, R, frame, true)
  limbs(c, cx, cy, bb, mood, frame, R, opts, false)
  if (b.ears) {
    // Orejitas puntiagudas
    const top = Math.round(cy - ry)
    for (const side of [-1, 1]) {
      const ex = Math.round(cx + side * rx * 0.55)
      c.stamp(ex - 2, top - 2, ['.oo.', 'oiio', 'oooo'], { o: R.shade, i: CHEEK })
    }
  }
  shaded(c, cx, cy, rx, ry, R)
  // Tripa más clara
  shaded(c, cx, cy + ry * 0.6, rx * 0.46, ry * 0.26, { ...R, outline: R.light, deep: R.light, shade: R.light, base: mix(R.light, '#FFFFFF', 0.1), light: mix(R.light, '#FFFFFF', 0.2) }, { outline: false, spec: false })
  if (b.sprout) {
    // Brote en la cabeza del bebé
    const sx = Math.round(cx), sy = Math.round(cy - ry)
    c.stamp(sx - 2, sy - 3, ['ll.LL', '.lgL.', '..g..'], { l: '#7BD389', L: '#4FAF62', g: '#3D8A4E' })
  }
  face(c, cx, cy, bb, mood, frame, R, opts)
  limbs(c, cx, cy, bb, mood, frame, R, opts, true)
  if (form) extras(c, form, cx, cy, bb, R, frame, false)
  if (pet.stage === 'leyenda') crown(c, Math.round(cx), Math.round(cy - ry) - 4 - (form === 'fable' ? 7 : form === 'opus' ? 1 : 0))
  if ((pet.variant === 'brillante' || pet.stage === 'leyenda') && frame % 8 < 4) {
    const sx = Math.round(cx + rx + 1), sy = Math.round(cy - ry + 1)
    c.stamp(sx - 1, sy - 1, ['.w.', 'www', '.w.'], { w: WHITE })
  }
  return { top: cy - ry - (form === 'fable' ? 9 : form === 'opus' || form === 'sonnet' ? 4 : b.sprout || b.ears ? 3 : 0), bottom: cy + ry + 1, left: cx - rx - 2, right: cx + rx + 2, cx, cy }
}

function drawEgg(c, pet, x, y, frame) {
  const wob = frame % 14 === 0 ? -1 : frame % 14 === 7 ? 1 : 0
  const E = ramp('#F7EEDC')
  const S = ramp('#E8845E')
  const inside = shaded(c, x + wob * 0.5, y, 6.4, 8.2, E, { n: 2, flat: 0.05 })
  // Manchas coral grandes, con su luz
  const spots = [[-3, -4, 2.2], [3, -1, 2.6], [-2, 4, 2], [3, 5, 1.2], [1, -7, 1.1]]
  for (const [dx, dy, r] of spots) {
    for (let j = -3; j <= 3; j++) {
      for (let i = -3; i <= 3; i++) {
        const px = Math.round(x + wob * 0.5 + dx + i), py = Math.round(y + dy + j)
        if (i * i + j * j > r * r || !inside(px + 0.5, py + 0.5)) continue
        const cur = c.get(px, py)
        if (cur && cur !== E.outline && cur !== E.shade && cur !== E.deep) c.set(px, py, i + j < -1 ? S.light : S.base)
        else if (cur === E.shade || cur === E.deep) c.set(px, py, S.shade)
      }
    }
  }
  // Grieta en zigzag cuando ya ha comido algo
  if (pet.xp > 0) {
    const zz = [0, -1, 0, 1, 0, -1, 0, 1, 0]
    zz.forEach((d, i) => c.set(Math.round(x) - 4 + i, Math.round(y) - 3 + d, E.outline))
  }
  return { top: y - 9, bottom: y + 9, left: x - 7, right: x + 7, cx: x, cy: y }
}

function drawGhost(c, x, y, frame) {
  const fy = y - 2 + (frame % 10 < 5 ? 0 : -1)
  const G = PALETTES.fantasma
  shaded(c, x, fy, 7, 6.5, G, { alpha: 0.9 })
  for (let j = 0; j < 5; j++) {
    for (let i = -7; i <= 7; i++) {
      const wave = (i + 7 + (frame >> 1)) % 4 < 2 ? 0 : 1
      if (j < 4 + wave) c.blend(x + i, fy + 1 + j, i < -5 ? G.shade : i > 5 ? G.deep : G.base, 0.9)
    }
  }
  c.rect(Math.round(x) - 3, Math.round(fy) - 1, 2, 3, INK)
  c.rect(Math.round(x) + 2, Math.round(fy) - 1, 2, 3, INK)
  c.set(Math.round(x) - 3, Math.round(fy) - 1, WHITE); c.set(Math.round(x) + 2, Math.round(fy) - 1, WHITE)
  c.rect(Math.round(x), Math.round(fy) + 3, 1, 1, INK)
  // Aureola
  for (let i = -4; i <= 4; i++) {
    c.set(Math.round(x) + i, Math.round(fy) - 10, Math.abs(i) === 4 ? GOLD.shade : GOLD.base)
    if (Math.abs(i) < 4) c.set(Math.round(x) + i, Math.round(fy) - 9 + (Math.abs(i) < 3 ? 0 : -1), Math.abs(i) < 3 ? GOLD.shade : null)
  }
  c.set(Math.round(x) - 2, Math.round(fy) - 10, GOLD.high)
  return { top: fy - 11, bottom: fy + 6, left: x - 8, right: x + 8, cx: x, cy: fy }
}

// ---------- Efectos alrededor (compartidos por la habitación y el widget) ----------

const GLYPH_Z = [['zzz', '..z', '.z.', 'zzz'], ['zz', '.z', 'zz']]

// Dibuja la mascota recordando qué píxeles son suyos (para poner cosas detrás)
function petWithMask(c, pet, mood, opts) {
  const before = c.px.map((r) => r.slice())
  const box = drawPet(c, pet, mood, opts)
  const mask = (x, y) => c.px[y]?.[x] !== before[y]?.[x]
  return { box, mask }
}

function fireBehind(c, box, frame, floorY, mask) {
  const F = ['#FFF3A0', '#FFC23A', '#FF7A2A', '#E2402A']
  const w = Math.round(box.right - box.left) + 6
  const h0 = Math.round(box.bottom - box.top)
  for (let i = 0; i < w; i++) {
    const fx = Math.round(box.left) - 3 + i
    const edge = Math.min(i, w - 1 - i)
    const h = Math.round(h0 * (0.35 + 0.5 * Math.min(1, edge / 4)) + ((i * 7 + frame * 3) % 5) - 2)
    for (let j = 0; j < h; j++) {
      const y = floorY - j
      if (mask(fx, y)) continue
      const t = j / h
      if (t > 0.85 && (i + frame) % 2) continue
      c.set(fx, y, F[t < 0.25 ? 3 : t < 0.5 ? 2 : t < 0.8 ? 1 : 0])
    }
  }
}

function moodFx(c, mood, box, frame, floorY) {
  if (mood === 'dormido') {
    const k = frame % 15
    const zx = Math.round(box.right) + 1, zy = Math.round(box.top) - 1 - Math.floor(k / 3)
    if (zy > 0) c.stamp(zx, zy, GLYPH_Z[0], { z: '#DCE4FF' })
    if (zy > 5 && k > 6) c.stamp(zx + 4, zy - 4, GLYPH_Z[1], { z: '#AEB9E6' })
  }
  if ((mood === 'cansado' || mood === 'fuego') && frame % 8 < 6) {
    const k = (frame % 8) >> 1
    c.stamp(Math.round(box.right) - 1, Math.round(box.top) + 2 + k, ['.d', 'dD', '.d'], { d: '#8FD0FF', D: '#D6F0FF' })
  }
  if (mood === 'enfermo') {
    // Termómetro y burbujita verde
    const tx = Math.round(box.right) - 2, ty = Math.round(box.top) + 3
    c.stamp(tx, ty, ['.g.', 'gwg', 'gwg', 'gwg', 'grg', '.r.'], { g: '#B8C4D8', w: '#FFFFFF', r: '#E0526A' })
    if (frame % 10 < 6) c.set(Math.round(box.left) + 1, Math.round(box.top) - (frame % 10 >> 1), '#B7E59A')
  }
  if (mood === 'feliz' && frame % 12 < 8) {
    const hy = Math.round(box.top) - 2 - ((frame % 12) >> 2)
    if (hy > 0) c.stamp(Math.round(box.left) - 3, hy, ['h.h', 'hhh', '.h.'], { h: '#FF6F91' })
  }
  if (mood === 'sucio') {
    // Moscas que dan vueltas
    for (let k = 0; k < 2; k++) {
      const a = frame * 0.6 + k * 3
      c.set(Math.round((box.left + box.right) / 2 + Math.cos(a) * 9), Math.round(box.top + 2 + Math.sin(a * 1.3) * 3), '#2A2A2A')
    }
  }
}

function poop(c, x, y, frame, i) {
  const P = ramp('#8A5A33')
  c.stamp(x, y, ['...a..', '..aba.', '.abbba', 'aabbbaa'.slice(0, 6), 'adddda'], { a: P.deep, b: P.base, d: P.shade })
  c.set(x + 3, y + 1, P.high)
  if ((frame + i * 2) % 8 < 4) c.set(x + 2 + ((frame >> 1) % 3), y - 2 - ((frame >> 2) % 2), '#A9C27F')
}

function laptop(c, x, floorY, frame) {
  const L = ramp('#5A6178')
  c.rect(x, floorY - 6, 10, 6, L.deep)
  c.rect(x + 1, floorY - 5, 8, 4, '#121A28')
  const code = ['#8FD3FF', '#F4B03E', '#9BE38F', '#C59BFF']
  for (let i = 0; i < 4; i++) {
    const len = ((frame + i * 3) % 7) + 1
    c.rect(x + 2 + (i % 2), floorY - 5 + i, Math.min(6 - (i % 2), len), 1, code[i])
  }
  c.rect(x - 2, floorY, 13, 1, L.base)
  c.rect(x - 2, floorY, 2, 1, L.light)
}

// ---------- La habitación (vista de terminal) ----------

function skyAt(hour) {
  if (hour >= 7 && hour < 18) return { top: '#5DB6F2', bottom: '#BDE6FF', kind: 'dia' }
  if (hour >= 18 && hour < 21) return { top: '#5B4A9E', bottom: '#FF9E6B', kind: 'tarde' }
  if (hour >= 5 && hour < 7) return { top: '#4E5FA8', bottom: '#FFC59E', kind: 'alba' }
  return { top: '#0E1330', bottom: '#27306A', kind: 'noche' }
}

export function drawScene(pet, mood, { w = 48, h = 36, frame = 0, wander = true, now = Date.now() } = {}) {
  const lightsOff = mood === 'dormido'
  const c = new Canvas(w, h, null)
  const floorY = h - 6
  const hour = new Date(now).getHours()

  // Pared con papel pintado de rombos sutiles
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < w; x++) {
      const t = y / floorY
      let col = mix('#3A3352', '#2C2742', t)
      if ((x + y * 2) % 8 === 0 && y % 4 === 0) col = mix(col, '#4A4266', 0.7)
      c.set(x, y, col)
    }
  }
  // Rodapié
  c.rect(0, floorY - 1, w, 1, '#4B3A5A')
  // Ventana con el cielo de tu hora real
  const wx = 2, wy = 2, ww = 11, wh = 9
  const sky = skyAt(hour)
  for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) c.set(wx + x, wy + y, mix(sky.top, sky.bottom, y / wh))
  if (sky.kind === 'dia') {
    c.stamp(wx + 1, wy + 1, ['.ww.', 'wwww'], { w: '#FFFFFF' })
    c.stamp(wx + 8, wy + 1, ['yy', 'yy'], { y: '#FFE27A' })
  } else if (sky.kind === 'noche') {
    for (let i = 0; i < 6; i++) if ((i + (frame >> 2)) % 5) c.set(wx + 1 + ((i * 4) % 10), wy + 1 + ((i * 3) % 7), i % 3 ? '#E7ECFF' : '#FFF3B0')
    c.stamp(wx + 7, wy + 1, ['.mm', 'm..', '.mm'], { m: '#FFF3B0' })
  } else c.stamp(wx + 3, wy + wh - 3, ['.ooo.', 'ooooo', 'ooooo'], { o: '#FFB36B' })
  // Marco de madera con cruz
  const WOOD = ramp('#9B6B4A')
  for (let x = -1; x <= ww; x++) { c.set(wx + x, wy - 1, WOOD.light); c.set(wx + x, wy + wh, WOOD.shade) }
  for (let y = -1; y <= wh; y++) { c.set(wx - 1, wy + y, WOOD.light); c.set(wx + ww, wy + y, WOOD.shade) }
  for (let y = 0; y < wh; y++) c.set(wx + Math.floor(ww / 2), wy + y, WOOD.base)
  for (let x = 0; x < ww; x++) c.set(wx + x, wy + Math.floor(wh / 2), WOOD.base)
  c.rect(wx - 2, wy + wh + 1, ww + 4, 1, WOOD.deep)
  // Cuadro en la pared de la derecha: montañas
  const px = w - 9, py = 3
  c.rect(px - 1, py - 1, 8, 7, WOOD.shade)
  c.rect(px, py, 6, 5, '#2E5E7E')
  c.stamp(px, py + 1, ['...w..', '..mmm.', '.mmmmm', 'gggggg'], { w: '#FFFFFF', m: '#6C7FA6', g: '#4E9A62' })

  // Suelo de tablas con brillo y vetas
  const FL = ramp('#A8744E')
  for (let y = floorY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const row = y - floorY
      let col = row === 0 ? FL.light : bayer(x, y) < (row / 6) * 0.9 ? FL.shade : FL.base
      if ((x + (row % 2) * 7) % 14 === 0) col = FL.deep
      c.set(x, y, col)
    }
  }
  // Luz de la ventana en el suelo (de día)
  if (sky.kind === 'dia' || sky.kind === 'tarde') {
    for (let y = floorY; y < h; y++) for (let x = 0; x < 12; x++) {
      const xx = wx + 4 + x + (y - floorY) * 2
      if (xx < w && bayer(xx, y) < 0.55) c.blend(xx, y, sky.kind === 'dia' ? '#FFF2C8' : '#FFB98A', 0.18)
    }
  }
  // Alfombra
  const rugX = Math.round(w / 2), rugY = floorY + 3
  for (let y = -2; y <= 2; y++) for (let x = -13; x <= 13; x++) {
    if ((x / 13.5) ** 2 + (y / 2.6) ** 2 > 1) continue
    const ring = (x / 13.5) ** 2 + (y / 2.6) ** 2 > 0.62
    c.set(rugX + x, rugY + y, ring ? '#B5523F' : (x + y) % 4 === 0 ? '#E07A55' : '#C9654A')
  }
  // Planta en maceta
  const PL = ramp('#5DAA68')
  const pot = ramp('#C2683F')
  const plx = w - 8
  c.stamp(plx, floorY - 11, ['..l.l..', '.lLlLl.', 'lLlllLl', '.llLll.', '..lll..', '...g...'], { l: PL.base, L: PL.light, g: PL.deep })
  c.stamp(plx + 1, floorY - 5, ['ppppp', 'pPppp', '.ppp.', '.ppp.', '.ddd.'], { p: pot.base, P: pot.light, d: pot.deep })
  // Cuenco de comida: se vacía con el hambre
  const bx = 3, byy = floorY + 1
  const B = ramp('#6C8CD5')
  const fill = pet.stats ? Math.round((pet.stats.hambre / 100) * 3) : 2
  if (fill > 0) for (let i = 0; i < fill; i++) c.rect(bx + 1, byy + 1 - i, 7, 1, i === fill - 1 ? '#F4C06B' : '#D99A47')
  c.stamp(bx, byy + 1, ['bbbbbbbbb', '.bBBBBBb.', '..bbbbb..'], { b: B.shade, B: B.base })

  // Posición del bicho: pasea si está despierto y tranquilo
  const still = ['dormido', 'trabajando', 'enfermo', 'huevo', 'nube', 'cansado'].includes(mood) || !wander
  const span = Math.max(0, w / 2 - 15)
  const tt = frame / 12
  const off = still ? 0 : Math.round(Math.sin(tt) * span)
  const walking = !still && Math.abs(Math.cos(tt)) > 0.25
  const look = still ? (mood === 'trabajando' ? 1 : 0) : Math.sign(Math.cos(tt))
  const b = BODY[pet.stage] || { ry: 8.2 }
  const cx = Math.round(w / 2 + off - (mood === 'trabajando' ? 5 : 0))
  const cy = floorY + 1 - Math.ceil(b.ry ?? 8.2) - (b.feet ? 1 : 0) - (pet.stage === 'huevo' ? 0 : 0)
  // Sombra
  for (let x = -6; x <= 6; x++) c.blend(cx + x, floorY + 1, '#000000', Math.abs(x) > 4 ? 0.12 : 0.25)

  for (let i = 0; i < pet.poops; i++) poop(c, w - 16 - i * 7, floorY - 3, frame, i)
  const { box, mask } = petWithMask(c, pet, mood, { x: cx, y: cy, frame, walking, look })
  if (mood === 'fuego') fireBehind(c, box, frame, floorY, mask)
  if (mood === 'trabajando') laptop(c, Math.round(box.right) + 1, floorY, frame)
  moodFx(c, mood, box, frame, floorY)

  if (lightsOff) {
    // Luz apagada: penumbra azul, la mascota algo menos para que se vea
    c.map((col, x, y) => {
      if (x >= wx && x < wx + ww && y >= wy && y < wy + wh) return col
      return mix(solid(col), '#0B0F24', mask(x, y) ? 0.28 : 0.55)
    })
  }
  return c
}

// ---------- El bicho suelto (widget de escritorio) ----------

export const CRITTER_W = 56
export const CRITTER_H = 46

export function drawCritter(pet, mood, frame = 0, { walking = false, look = 0 } = {}) {
  const c = new Canvas(CRITTER_W, CRITTER_H, null)
  const b = BODY[pet.stage] || { ry: 8.2, rx: 6.4 }
  const floorY = CRITTER_H - 2
  const cx = Math.round(CRITTER_W / 2) - (mood === 'trabajando' ? 5 : 0)
  const cy = floorY + 1 - Math.ceil(b.ry ?? 8.2) - (b.feet ? 1 : 0)
  for (let x = -7; x <= 7; x++) c.blend(cx + x, floorY + 1, '#000000', Math.abs(x) > 5 ? 0.12 : 0.28)
  for (let i = 0; i < Math.min(pet.poops, 2); i++) poop(c, i ? 1 : CRITTER_W - 8, floorY - 4, frame, i)
  const { box, mask } = petWithMask(c, pet, mood, { x: cx, y: cy, frame, walking, look })
  if (mood === 'fuego') fireBehind(c, box, frame, floorY, mask)
  if (mood === 'trabajando') laptop(c, Math.round(box.right) + 1, floorY, frame)
  moodFx(c, mood, box, frame, floorY)
  return { canvas: c, box }
}

export function drawMini(pet, mood, frame = 0) {
  return drawCritter(pet, mood, frame).canvas
}
