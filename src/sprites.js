// Pixel art dibujado en código: nada de imágenes. Cada etapa, forma adulta y humor
// se compone a partir de piezas (cuerpo, ojos, boca, accesorios), así cualquier
// combinación sale sola y con animación.

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
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  // Elipse rellena con borde y un brillo arriba a la izquierda
  blob(cx, cy, rx, ry, fill, edge, light) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        if (d <= 1) this.set(x, y, d > 0.72 ? edge : fill)
      }
    }
    if (light) {
      this.set(cx - rx * 0.45, cy - ry * 0.5, light)
      this.set(cx - rx * 0.45 + 1, cy - ry * 0.5, light)
      this.set(cx - rx * 0.45, cy - ry * 0.5 + 1, light)
    }
  }
  // Mapa de caracteres a color: ['..x..', '.xxx.'] con { x: '#fff' }
  stamp(x, y, rows, palette) {
    rows.forEach((row, j) => {
      ;[...row].forEach((ch, i) => {
        if (palette[ch]) this.set(x + i, y + j, palette[ch])
      })
    })
  }
}

// ---------- Colores ----------

export const PALETTES = {
  coral: { fill: '#E07A55', edge: '#9A4A30', light: '#F6B497', cheek: '#F29C9C' },
  opus: { fill: '#8B6CF0', edge: '#4B2F9E', light: '#C3B2FF', cheek: '#E39BE0' },
  sonnet: { fill: '#F2A93B', edge: '#A0611A', light: '#FFD99A', cheek: '#F48A6A' },
  haiku: { fill: '#2BB8A6', edge: '#13695E', light: '#9BEBDF', cheek: '#7FD3F0' },
  fable: { fill: '#5B9DF2', edge: '#2A4F9A', light: '#B9D6FF', cheek: '#F59FC8' },
  mixto: { fill: '#8CC63F', edge: '#4D7A1C', light: '#CBEA9A', cheek: '#F2A3A3' },
  fantasma: { fill: '#E8ECF5', edge: '#9AA3B8', light: '#FFFFFF', cheek: '#C9D0E0' },
}
const INK = '#1E1B2E'
const WHITE = '#FFFFFF'
const POOP = ['#7A4B26', '#A06A3C']

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)))
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
function grey(hex, k = 0.55) {
  const n = parseInt(hex.slice(1), 16)
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255
  const l = 0.3 * r + 0.59 * g + 0.11 * b
  const mix = (v) => Math.round(v * (1 - k) + l * k)
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`
}

export function paletteFor(pet, mood) {
  let p = PALETTES[pet.stage === 'adulto' || pet.stage === 'leyenda' ? pet.form || 'mixto' : 'coral']
  if (pet.variant === 'brillante' || pet.stage === 'leyenda') p = { ...p, fill: shade(p.fill, 1.08), light: WHITE }
  if (pet.variant === 'grunon') p = { ...p, fill: grey(p.fill, 0.35), edge: grey(p.edge, 0.35) }
  if (mood === 'enfermo') p = { ...p, fill: grey(p.fill, 0.5), cheek: '#9CC48A' }
  return p
}

// ---------- Tamaños por etapa ----------

const BODY = {
  bebe: { rx: 5.2, ry: 4.4, eyeDx: 2, eyeDy: -0.8, feet: false },
  nino: { rx: 5.6, ry: 4.8, eyeDx: 2.2, eyeDy: -0.8, feet: true },
  teen: { rx: 6.4, ry: 5.6, eyeDx: 2.6, eyeDy: -1.2, feet: true, ears: true },
  adulto: { rx: 7.4, ry: 6.4, eyeDx: 3, eyeDy: -1.5, feet: true },
  leyenda: { rx: 7.8, ry: 6.8, eyeDx: 3.2, eyeDy: -1.6, feet: true },
}

// ---------- Piezas de la cara ----------

function eyes(c, cx, cy, b, mood, frame, pal) {
  const lx = Math.round(cx - b.eyeDx), rx = Math.round(cx + b.eyeDx), y = Math.round(cy + b.eyeDy)
  const blink = frame % 23 === 0 || frame % 23 === 1
  const both = (fn) => [lx, rx].forEach((x, i) => fn(x, i))
  switch (mood) {
    case 'dormido':
    case 'cansado':
      both((x) => { c.set(x - 1, y, INK); c.set(x, y, INK) })
      if (mood === 'cansado') both((x) => c.set(x, y + 1, INK))
      break
    case 'enfermo':
      both((x) => { c.set(x - 1, y - 1, INK); c.set(x, y, INK); c.set(x - 1, y + 1, INK); c.set(x + 1, y - 1, INK); c.set(x + 1, y + 1, INK) })
      break
    case 'feliz':
      both((x) => { c.set(x - 1, y, INK); c.set(x, y - 1, INK); c.set(x + 1, y, INK) })
      break
    case 'fuego':
      both((x, i) => { c.set(x, y, INK); c.set(x, y + 1, INK); c.set(i ? x + 1 : x - 1, y - 2, INK); c.set(x, y - 1, INK) })
      break
    case 'triste':
      both((x, i) => { c.set(x, y, INK); c.set(x, y + 1, INK); c.set(i ? x - 1 : x + 1, y - 1, INK) })
      if (frame % 6 < 4) c.set(lx, y + 2 + (frame % 6 < 2 ? 0 : 1), '#7CC3F7')
      break
    case 'hambriento':
      both((x) => { c.rect(x - 1, y - 1, 2, 3, INK); c.set(x - 1, y - 1, WHITE) })
      break
    default:
      if (blink) both((x) => { c.set(x - 1, y, INK); c.set(x, y, INK) })
      else both((x) => { c.rect(x - 1, y - 1, 2, 2, INK); c.set(x - 1, y - 1, WHITE) })
  }
  if (mood !== 'dormido' && mood !== 'enfermo' && pal.cheek) {
    c.set(lx - 2, y + 1, pal.cheek)
    c.set(rx + 2, y + 1, pal.cheek)
  }
}

function mouth(c, cx, cy, b, mood, frame, grumpy) {
  const y = Math.round(cy + b.eyeDy + 2.6), x = Math.round(cx)
  switch (mood) {
    case 'feliz':
      c.set(x - 1, y, INK); c.set(x, y + 1, INK); c.set(x + 1, y, INK)
      c.set(x, y, '#E0526A')
      break
    case 'trabajando':
      c.set(x, y, INK); c.set(x + 1, y, INK)
      break
    case 'hambriento':
      c.rect(x - 1, y, 3, 2, INK)
      if (frame % 4 < 2) c.set(x + 1, y + 2, '#9FD8FF')
      break
    case 'dormido':
      c.set(x, y, INK)
      break
    case 'triste':
    case 'enfermo':
    case 'cansado':
      c.set(x - 1, y + 1, INK); c.set(x, y, INK); c.set(x + 1, y + 1, INK)
      break
    case 'fuego':
      c.rect(x - 1, y, 3, 1, INK); c.set(x, y + 1, '#E0526A')
      break
    default:
      if (grumpy) { c.rect(x - 1, y, 3, 1, INK); break }
      c.set(x - 1, y, INK); c.set(x, y + 1, INK); c.set(x + 1, y, INK)
  }
}

// ---------- Accesorios de cada forma adulta ----------

function formExtras(c, form, cx, cy, b, pal, frame, back) {
  const top = Math.round(cy - b.ry)
  const L = Math.round(cx - b.rx), R = Math.round(cx + b.rx)
  if (form === 'opus') {
    // Opusaurio: cuernos, alas pequeñas y púas en la cola
    if (back) {
      const flap = frame % 4 < 2 ? 0 : 1
      c.stamp(L - 4, Math.round(cy) - 3 + flap, ['.ee', 'eff', 'efff', '.eff'], { e: pal.edge, f: pal.light })
      c.stamp(R + 1, Math.round(cy) - 3 + flap, ['ee.', 'ffe', 'fffe', 'ffe.'], { e: pal.edge, f: pal.light })
      return
    }
    c.stamp(Math.round(cx) - 4, top - 2, ['h.....h', 'hh...hh'].map((r) => r.padStart(9, '.')), { h: '#F4E3B5' })
  } else if (form === 'sonnet') {
    // Sonetín: cresta de pluma y notas que flotan
    if (back) return
    c.stamp(Math.round(cx) - 1, top - 3, ['.p', 'pp.', '.pp'], { p: '#E2553C' })
    if (frame % 8 < 5) c.stamp(R + 2, top + ((frame >> 1) % 3), ['.nn', '.n.', 'nn.'], { n: '#FFE7A8' })
  } else if (form === 'haiku') {
    // Haikoi: aletas y burbujas
    if (back) {
      c.stamp(L - 2, Math.round(cy) - 1, ['.f', 'ff', '.f'], { f: pal.edge })
      c.stamp(R + 1, Math.round(cy) - 1, ['f.', 'ff', 'f.'], { f: pal.edge })
      return
    }
    c.stamp(Math.round(cx) - 1, top - 1, ['fff'], { f: pal.edge })
    const by = top - 2 - (frame % 6)
    c.set(R + 1, by, '#BFF3FF'); c.set(R + 2, by - 2, '#BFF3FF')
  } else if (form === 'fable') {
    // Fabulín: sombrero de mago con estrella
    if (back) return
    c.stamp(Math.round(cx) - 4, top - 5, ['....hh...', '...hhhh..', '..hhshhh.', '.hhhhhhh.', 'bbbbbbbbb'], { h: '#3B2A7A', s: '#FFE45E', b: '#22184F' })
  } else if (form === 'mixto') {
    // Quimerilla: un cuerno y una aleta
    if (back) { c.stamp(R + 1, Math.round(cy) - 1, ['f.', 'ff', 'f.'], { f: pal.edge }); return }
    c.stamp(Math.round(cx) - 3, top - 2, ['h', 'hh'], { h: '#F4E3B5' })
  }
}

// ---------- La mascota completa ----------

export function drawPet(c, pet, mood, { x, y, frame = 0 }) {
  // x, y: centro del cuerpo
  if (pet.stage === 'huevo') return drawEgg(c, pet, x, y, frame)
  if (mood === 'nube') return drawGhost(c, pet, x, y, frame)
  const b = BODY[pet.stage] || BODY.bebe
  const pal = paletteFor(pet, mood)
  const bounce = mood === 'dormido' ? 0 : mood === 'feliz' ? (frame % 4 < 2 ? -1 : 0) : frame % 8 < 4 ? 0 : -0.5
  const squash = mood === 'dormido' ? 0.4 : 0
  const cx = x, cy = y + bounce + squash
  const form = pet.stage === 'adulto' || pet.stage === 'leyenda' ? pet.form : null

  if (pet.stage === 'leyenda') {
    // Aura dorada
    const r = b.rx + 3
    for (let a = 0; a < 24; a++) {
      if ((a + frame) % 3) continue
      const ang = (a / 24) * Math.PI * 2
      c.set(cx + Math.cos(ang) * r, cy + Math.sin(ang) * (b.ry + 2), '#FFE45E')
    }
  }
  if (form) formExtras(c, form, cx, cy, b, pal, frame, true)
  if (b.feet) {
    const fy = Math.round(cy + b.ry)
    const step = mood === 'trabajando' || mood === 'dormido' ? 0 : frame % 4 < 2 ? 0 : 1
    c.rect(Math.round(cx - b.rx * 0.55) - 1, fy - step, 3, 1 + step, pal.edge)
    c.rect(Math.round(cx + b.rx * 0.55) - 1, fy - (1 - step), 3, 1 + (1 - step), pal.edge)
  }
  if (b.ears) {
    const top = Math.round(cy - b.ry)
    c.stamp(Math.round(cx - b.rx * 0.6) - 1, top - 2, ['e.', 'ee'], { e: pal.edge })
    c.stamp(Math.round(cx + b.rx * 0.6), top - 2, ['.e', 'ee'], { e: pal.edge })
  }
  c.blob(cx, cy, b.rx, b.ry, pal.fill, pal.edge, pal.light)
  // Barriguita (solo en los grandes, en los pequeños ensucia la cara)
  if (b.rx >= 6) c.blob(cx, cy + b.ry * 0.55, b.rx * 0.42, b.ry * 0.28, pal.light, pal.light)
  eyes(c, cx, cy, b, mood, frame, pal)
  mouth(c, cx, cy, b, mood, frame, pet.variant === 'grunon')
  if (pet.variant === 'grunon' && !['dormido', 'enfermo'].includes(mood)) {
    const y0 = Math.round(cy + b.eyeDy - 2)
    c.set(cx - b.eyeDx - 1, y0, INK); c.set(cx - b.eyeDx, y0 + 0.4, INK)
    c.set(cx + b.eyeDx + 1, y0, INK); c.set(cx + b.eyeDx, y0 + 0.4, INK)
  }
  if (form) formExtras(c, form, cx, cy, b, pal, frame, false)
  if (pet.stage === 'leyenda') c.stamp(Math.round(cx) - 3, Math.round(cy - b.ry) - 3 - (form === 'fable' ? 4 : 0), ['y.y.y', 'yyyyy'], { y: '#FFD23F' })
  if (pet.variant === 'brillante' && frame % 6 < 3) c.set(cx + b.rx + 1, cy - b.ry, WHITE)
  return { top: cy - b.ry, bottom: cy + b.ry, left: cx - b.rx, right: cx + b.rx }
}

function drawEgg(c, pet, x, y, frame) {
  const wob = frame % 10 === 0 ? -1 : frame % 10 === 5 ? 1 : 0
  const cx = x + wob * 0.6
  c.blob(cx, y, 5, 6.5, '#FBF6EA', '#B9AE96', WHITE)
  const spots = { s: '#E07A55' }
  c.stamp(Math.round(cx) - 3, Math.round(y) - 2, ['s...', '....', '...s.', '.....', 's..s'], spots)
  c.stamp(Math.round(cx) + 1, Math.round(y) - 4, ['ss'], spots)
  if (pet.xp > 0 || frame % 30 > 20) c.stamp(Math.round(cx) - 1, Math.round(y) - 3, ['k.k', '.k.'], { k: '#8E846F' })
  return { top: y - 6.5, bottom: y + 6.5, left: cx - 5, right: cx + 5 }
}

function drawGhost(c, pet, x, y, frame) {
  const fy = y - 2 + (frame % 8 < 4 ? 0 : -1)
  const pal = PALETTES.fantasma
  c.blob(x, fy, 5.5, 5, pal.fill, pal.edge, pal.light)
  c.rect(Math.round(x) - 5, Math.round(fy), 11, 4, pal.fill)
  for (let i = 0; i < 11; i++) c.set(Math.round(x) - 5 + i, Math.round(fy) + 4 + ((i + (frame >> 1)) % 3 === 0 ? 1 : 0), pal.fill)
  c.rect(Math.round(x) - 2, Math.round(fy) - 1, 1, 2, INK)
  c.rect(Math.round(x) + 2, Math.round(fy) - 1, 1, 2, INK)
  c.set(Math.round(x), Math.round(fy) + 2, INK)
  c.stamp(Math.round(x) - 3, Math.round(fy) - 8, ['.yyyyy.', 'y.....y', '.yyyyy.'], { y: '#FFD23F' })
  return { top: fy - 8, bottom: fy + 5, left: x - 6, right: x + 6 }
}

// ---------- Escena: suelo, cacas, zZz, llamas, portátil, noche ----------

const GLYPH_Z = ['zzz', '..z', '.z.', 'z..', 'zzz']

export function drawScene(pet, mood, { w = 48, h = 26, frame = 0, wander = true } = {}) {
  const night = mood === 'dormido'
  const c = new Canvas(w, h, null)
  if (night) {
    c.rect(0, 0, w, h - 3, '#141A33')
    for (let i = 0; i < 14; i++) {
      const sx = (i * 37 + 11) % w, sy = (i * 13 + 3) % (h - 8)
      if ((i + (frame >> 2)) % 5) c.set(sx, sy, i % 3 ? '#C9D6FF' : '#FFF3B0')
    }
    c.stamp(w - 8, 2, ['.mm', 'm..', 'm..', '.mm'], { m: '#FFF3B0' })
  }
  // Suelo y una plantita
  c.rect(0, h - 3, w, 1, night ? '#3A3550' : '#C9A27A')
  c.stamp(2, h - 10, ['.l.l', 'll.l', '.lll', '..l.', '.pp.', 'pppp', '.pp.'], { l: night ? '#3E6B4A' : '#5DAA68', p: night ? '#6B4A3A' : '#B86B4B' })
  c.rect(0, h - 2, w, 2, night ? '#2A2540' : '#A57E58')

  // Posición: pasea si está despierto y tranquilo; quieto si trabaja o duerme
  const still = ['dormido', 'trabajando', 'enfermo', 'huevo', 'nube', 'cansado'].includes(mood) || !wander
  const span = Math.max(0, w / 2 - 14)
  const tt = frame / 10
  const off = still ? 0 : Math.round(Math.sin(tt) * span)
  const b = BODY[pet.stage] || { ry: 6.5 }
  const cx = Math.round(w / 2 + off - (pet.poops ? 4 : 0))
  const cy = h - 4 - Math.ceil(b.ry ?? 6.5) - (pet.stage === 'huevo' ? 0 : 1)

  // Cacas a la derecha
  for (let i = 0; i < pet.poops; i++) {
    const px = w - 7 - i * 6, py = h - 7
    c.stamp(px, py, ['..a..', '.aba.', 'aabaa', 'aaaaa'], { a: POOP[0], b: POOP[1] })
    if ((frame + i) % 6 < 3) c.set(px + 2 + ((frame >> 1) % 2), py - 2, '#9BB07A')
  }

  const box = drawPet(c, pet, mood, { x: cx, y: cy, frame })

  if (mood === 'trabajando') {
    // Portátil al lado, con líneas de código que van apareciendo
    const lx = Math.round(box.right) + 2, ly = h - 4
    c.rect(lx, ly - 6, 9, 6, '#3C4256')
    c.rect(lx + 1, ly - 5, 7, 4, '#16202E')
    const code = ['#8FD3FF', '#F2A93B', '#9BE38F']
    for (let i = 0; i < 3; i++) {
      const len = ((frame + i * 2) % 6) + 1
      c.rect(lx + 2, ly - 5 + i + (i > 0 ? 0 : 0), Math.min(5, len), 1, code[i])
    }
    c.rect(lx - 2, ly, 12, 1, '#5A6178')
  }
  if (mood === 'dormido') {
    const k = frame % 12
    const zx = Math.round(box.right) + 1, zy = Math.round(box.top) - 2 - (k >> 2)
    if (zy > 0) c.stamp(zx, zy, GLYPH_Z, { z: '#D7E0FF' })
  }
  if (mood === 'fuego') {
    const cols = ['#FF4D2E', '#FF9A2E', '#FFE45E']
    for (let i = 0; i < 9; i++) {
      const fx = Math.round(box.left) - 2 + i * ((box.right - box.left + 4) / 8)
      const hgt = 2 + ((i * 7 + frame) % 4)
      for (let j = 0; j < hgt; j++) c.set(fx, Math.round(box.bottom) + 1 - j, cols[Math.min(2, j)])
    }
  }
  if (mood === 'cansado' || mood === 'fuego') {
    if (frame % 6 < 4) c.stamp(Math.round(box.right), Math.round(box.top) + 1 + (frame % 6 >> 1), ['.d', 'dd'], { d: '#7CC3F7' })
  }
  if (mood === 'enfermo') c.stamp(Math.round(box.right) - 1, Math.round(box.top) - 1, ['ww', 'wr', 'ww'], { w: WHITE, r: '#E0526A' })
  if (mood === 'feliz' && frame % 10 < 5) c.stamp(Math.round(box.left) - 3, Math.round(box.top) - 2, ['h.h', 'hhh', '.h.'], { h: '#F2557A' })
  return c
}

// Icono mini (8x8) para la barra de estado o la cabecera
export function drawMini(pet, mood, frame = 0) {
  const c = new Canvas(16, 16, null)
  drawPet(c, { ...pet, stage: pet.stage === 'huevo' || !pet.alive ? pet.stage : 'bebe' }, mood, { x: 8, y: 9, frame })
  return c
}
