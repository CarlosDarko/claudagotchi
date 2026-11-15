// Más pixel art: iconos de acción, medallas de logros y el escenario del widget.
import { Canvas, ramp, mix } from './sprites.js'

// ---------- Iconos de acción (12x12) ----------

const ICONS = {
  comer: {
    rows: ['............', '....bbbb....', '...bBBBBb...', '..bBMMMMBb..', '..bMMMMMMb..', '..bMMMMMDb..', '...bMMMDb...', '....bbDw....', '.......ww...', '......wWWw..', '.......Ww...', '............'],
    pal: { b: '#7A3E22', B: '#C96A3A', M: '#A9532C', D: '#8A4226', w: '#E9E2D2', W: '#FFFFFF' },
  },
  chuche: {
    rows: ['............', '............', '.pp......pp.', '.pPp.cc.pPp.', '..ppcCCcpp..', '...cCWCCc...', '...cCCCCc...', '..ppcCCcpp..', '.pPp.cc.pPp.', '.pp......pp.', '............', '............'],
    pal: { p: '#E25C8C', P: '#FF9CC0', c: '#C9356B', C: '#FF6FA0', W: '#FFFFFF' },
  },
  jugar: {
    rows: ['............', '....rrrr....', '..rRRwwBBb..', '..RRwwwBBb..', '.yRRwwwBBbb.', '.yyRwwwBbbb.', '.yyywwwbbbb.', '.yyywwwbbb..', '..yyywwbbb..', '...yyyybb...', '............', '............'],
    pal: { r: '#C93A3A', R: '#F25C5C', w: '#FFFFFF', B: '#5BC0F2', b: '#3A8FD0', y: '#F2C230' },
  },
  limpiar: {
    rows: ['.......o....', '.....o.Oo...', '......o.....', '..yyyyyyy...', '.yYYYyYYyy..', '.yYyYYYyYy..', '.yYYYYyYYy..', '.yYyYYYYYy..', '.ggggggggg..', '.gGGGGGGGg..', '..ggggggg...', '............'],
    pal: { y: '#C9A030', Y: '#F2D45A', g: '#3D8A4E', G: '#5DAA68', o: '#9FD8FF', O: '#FFFFFF' },
  },
  medicina: {
    rows: ['............', '.......rrr..', '......rRRrr.', '.....rRWRRr.', '....rRRRRr..', '...wwrRRr...', '..wWWwrr....', '.wWWWWw.....', '.wWWWw......', '..www.......', '............', '............'],
    pal: { r: '#C93A3A', R: '#F25C5C', w: '#C8CDD8', W: '#FFFFFF' },
  },
  mimo: {
    rows: ['............', '..rrr..rrr..', '.rRRRrrRRRr.', '.rRWRRRRRRr.', '.rRRRRRRRRr.', '.rRRRRRRRRr.', '..rRRRRRRr..', '...rRRRRr...', '....rRRr....', '.....rr.....', '............', '............'],
    pal: { r: '#C9355B', R: '#FF6F91', W: '#FFFFFF' },
  },
  luz: {
    rows: ['....yyyy....', '...yYYYYy...', '..yYWYYYYy..', '..yYWYYYYy..', '..yYYYYYYy..', '...yYYYYy...', '....yYYy....', '....gggg....', '....GGGG....', '....gggg....', '.....gg.....', '............'],
    pal: { y: '#C99A1E', Y: '#FFE27A', W: '#FFFFFF', g: '#6C7489', G: '#9AA3B8' },
  },
  luna: {
    rows: ['............', '.....mmm....', '....mMMm....', '...mMMm.....', '...mMm......', '...mMm......', '...mMMm.....', '....mMMmm...', '.....mmmm...', '............', '..s......s..', '............'],
    pal: { m: '#B8A55A', M: '#FFF3B0', s: '#FFFFFF' },
  },
  escenario: {
    rows: ['....gggg....', '..gGGGGGGg..', '.gGGgGGGGGg.', '.gGGGGGgGGg.', '..gGGGGGGg..', '....gwwg....', '.....tt.....', '.....tt.....', '.ffFfffFfff.', 'FFFFFFFFFFFF', 'dddddddddddd', '............'],
    pal: { g: '#3D8A4E', G: '#6CC27A', w: '#2F6B3C', t: '#8A5A33', f: '#5DAA68', F: '#7BD389', d: '#8A5A33' },
  },
}

export function drawIcon(name) {
  const ic = ICONS[name] || ICONS.mimo
  const c = new Canvas(12, 12, null)
  c.stamp(0, 0, ic.rows, ic.pal)
  return c
}
export const ICON_NAMES = Object.keys(ICONS)

// ---------- Medallas de logros (16x16) ----------

const G = {
  egg: ['..###..', '.#####.', '.#####.', '#######', '#######', '#######', '.#####.'],
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  heart: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  cookie: ['.#####.', '###.###', '#######', '##.####', '#######', '####.##', '.#####.'],
  leaf: ['....###', '..#####', '.######', '.#####.', '.####..', '#.#....', '#......'],
  bolt: ['...###.', '..###..', '.###...', '######.', '...###.', '..###..', '.##....'],
  crown: ['#..#..#', '##.#.##', '#######', '#######', '.......', '#######', '.......'],
  coin: ['.#####.', '##.#.##', '##.####', '###.###', '####.##', '##.#.##', '.#####.'],
  trophy: ['#######', '#.###.#', '#.###.#', '.#####.', '..###..', '...#...', '.#####.'],
  calendar: ['.#.#.#.', '#######', '#.....#', '#.#.#.#', '#.....#', '#.#.#.#', '#######'],
  sun: ['#..#..#', '.#####.', '.#####.', '#######', '.#####.', '.#####.', '#..#..#'],
  moon: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'],
  hammer: ['######.', '######.', '..#....', '..#....', '..#....', '..#....', '..#....'],
  magnifier: ['.###...', '#...#..', '#...#..', '#...#..', '.####..', '....##.', '.....##'],
  terminal: ['#######', '#.....#', '#.#...#', '#..#..#', '#.#.###', '#.....#', '#######'],
  globe: ['.#####.', '#.#.#.#', '#######', '#.#.#.#', '#######', '#.#.#.#', '.#####.'],
  note: ['...###.', '...#.##', '...#...', '...#...', '.###...', '####...', '.##....'],
  chat: ['######.', '#######', '#######', '######.', '.#.....', '#......', '.......'],
  broom: ['.....##', '....##.', '...##..', '..##...', '.####..', '#####..', '####...'],
  chef: ['.##.##.', '#######', '#######', '.#####.', '.#####.', '.#####.', '.#####.'],
  ball: ['.#####.', '##...##', '#.....#', '#######', '#.....#', '##...##', '.#####.'],
  pill: ['....##.', '...####', '..#####', '.#####.', '#####..', '####...', '.##....'],
  flame: ['...#...', '..##...', '..###.#', '.######', '#######', '#######', '.#####.'],
  grid: ['##.##.#', '##.##.#', '.......', '##.##.#', '##.##.#', '.......', '##.##.#'],
  tree: ['..###..', '.#####.', '#######', '.#####.', '...#...', '...#...', '.#####.'],
  lotus: ['...#...', '..###..', '#.###.#', '##.#.##', '.#####.', '..###..', '#######'],
}

// Cada logro: su dibujo y su metal (b bronce, s plata, g oro)
export const MEDALS = {
  eclosion: ['egg', 'b'], 'primer-bocado': ['cookie', 'b'], nino: ['leaf', 'b'], teen: ['bolt', 's'], adulto: ['star', 's'], leyenda: ['crown', 'g'],
  millon: ['coin', 'b'], 'cien-millones': ['trophy', 's'], 'mil-millones': ['trophy', 'g'], 'racha-7': ['calendar', 'b'], 'racha-30': ['calendar', 'g'], finde: ['sun', 's'],
  'manos-a-la-obra': ['hammer', 's'], explorador: ['magnifier', 's'], hacker: ['terminal', 's'], sabio: ['globe', 's'], director: ['note', 's'], politoglota: ['chat', 's'],
  limpito: ['broom', 'b'], chef: ['chef', 'b'], achuchable: ['heart', 'b'], jugon: ['ball', 'b'], zen: ['lotus', 's'], superviviente: ['pill', 's'], 'dia-perfecto': ['sun', 'g'],
  noctambulo: ['moon', 'b'], madrugador: ['sun', 'b'], 'al-limite': ['flame', 'b'], fenix: ['flame', 'g'],
  'coleccion-3': ['grid', 's'], 'coleccion-10': ['grid', 'g'], reencarnacion: ['egg', 's'], dinastia: ['tree', 's'],
}
const METAL = { b: '#CD8A4E', s: '#B9C6D8', g: '#F4C53D' }
const RIBBON = { b: ['#B5523F', '#E07A55'], s: ['#4A5BB0', '#7A8CE0'], g: ['#8E44C9', '#B67CF2'] }

export function drawMedal(id, unlocked = true) {
  const c = new Canvas(16, 16, null)
  const [glyph, tier] = MEDALS[id] || ['star', 'b']
  const R = unlocked ? ramp(METAL[tier]) : ramp('#55526B')
  const [r1, r2] = unlocked ? RIBBON[tier] : ['#3A3850', '#45425C']
  // Cinta
  for (let j = 0; j < 5; j++) {
    c.set(4 + Math.floor(j / 2), j, r1)
    c.set(5 + Math.floor(j / 2), j, r2)
    c.set(11 - Math.floor(j / 2), j, r1)
    c.set(10 - Math.floor(j / 2), j, r2)
  }
  // Disco sombreado
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 13; x++) {
      const dx = x - 6, dy = y - 5
      const d = (dx * dx) / 36 + (dy * dy) / 30
      if (d > 1) continue
      const edge = d > 0.78
      const light = dx + dy < -3
      c.set(1 + x + 1, 4 + y + 1, edge ? (dx + dy > 0 ? R.deep : R.shade) : light ? R.light : R.base)
    }
  }
  // Dibujo
  const ink = unlocked ? mix(R.deep, '#2A1A0A', 0.35) : '#2E2C40'
  G[glyph].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && c.set(4 + i + 1, 6 + j + 1, ink)))
  if (unlocked) c.set(4, 7, '#FFFFFF')
  return c
}

// ---------- Escenario del widget ----------
// Un trocito de mundo donde vive la mascota: hierba, flores, su casita con el
// tejado coral y la chispa de Claude, el cuenco (se vacía con el hambre), el
// árbol de tokens (un fruto por bocado) y una farola que se enciende de noche.

export const YARD_H = 48 // alto en píxeles de dibujo
export const GROUND = 6 // grosor del suelo

const GRASS = ramp('#6CC27A')
const DIRT = ramp('#9B6A44')

function ground(c, x0, x1, H, rounded) {
  for (let x = x0; x <= x1; x++) {
    const fromEdge = Math.min(x - x0, x1 - x)
    const lift = rounded ? Math.max(0, 3 - fromEdge) : 0
    for (let y = H - GROUND + lift; y < H; y++) {
      const row = y - (H - GROUND + lift)
      let col
      if (row === 0) col = GRASS.light
      else if (row === 1) col = (x + y) % 5 === 0 ? GRASS.light : GRASS.base
      else if (row === 2) col = (x * 7) % 9 === 0 ? GRASS.base : DIRT.light
      else col = (x * 13 + y * 7) % 11 === 0 ? DIRT.light : row > 4 ? DIRT.shade : DIRT.base
      c.set(x, y, col)
    }
    // Briznas
    if ((x * 37) % 7 === 0 && fromEdge > 2) c.set(x, H - GROUND - 1 + lift, GRASS.base)
    if ((x * 53) % 11 === 0 && fromEdge > 2) c.set(x, H - GROUND - 2 + lift, GRASS.light)
  }
}

function flower(c, x, y, col) {
  c.set(x, y + 1, GRASS.shade)
  c.set(x, y + 2, GRASS.shade)
  c.set(x - 1, y, col)
  c.set(x + 1, y, col)
  c.set(x, y - 1, col)
  c.set(x, y, '#FFE27A')
}

function house(c, x, base, night) {
  const W = ramp('#E9D8BC'), Roof = ramp('#E07A55'), Wd = ramp('#9B6B4A')
  const WW = 23, WH = 13
  // Paredes con tablones
  for (let y = 0; y < WH; y++) {
    for (let i = 0; i < WW; i++) {
      let col = i === 0 ? W.light : i === WW - 1 ? W.shade : y === WH - 1 ? W.shade : W.base
      if (y % 4 === 3 && i > 0 && i < WW - 1) col = mix(W.base, W.shade, 0.5)
      c.set(x + i, base - WH + y, col)
    }
  }
  // Tejado a dos aguas con alero
  const mid = Math.floor(WW / 2)
  for (let j = 0; j < 10; j++) {
    const half = mid + 2 - j
    for (let i = -half; i <= half; i++) {
      const col = j === 0 ? Roof.deep : i < -half + 2 ? Roof.light : i > half - 2 ? Roof.shade : (i + j) % 4 === 0 ? mix(Roof.base, Roof.shade, 0.4) : Roof.base
      c.set(x + mid + i, base - WH - 1 - j, col)
    }
  }
  // Chispa de Claude en el tejado
  c.stamp(x + mid - 2, base - WH - 9, ['..w..', '.wcw.', 'wcccw', '.wcw.', '..w..'], { w: '#FFF3E8', c: '#E07A55' })
  // Chimenea
  c.rect(x + WW - 6, base - WH - 9, 3, 5, Wd.base)
  c.rect(x + WW - 6, base - WH - 9, 3, 1, Wd.light)
  // Puerta redonda con pomo
  c.stamp(x + 3, base - 9, ['.ddd.', 'dDDDd', 'dDDDd', 'dDDDd', 'dDDKd', 'dDDDd', 'dDDDd', 'dDDDd', 'ddddd'], { d: Wd.deep, D: Wd.base, K: '#F2C230' })
  // Ventanas
  for (const wx of [x + 11, x + 17]) {
    c.stamp(wx, base - 10, ['ffff', 'fwwf', 'fwwf', 'ffff'], { f: Wd.shade, w: night ? '#FFD86B' : '#8FD3FF' })
    if (!night) c.set(wx + 1, base - 9, '#FFFFFF')
    else for (let k = 0; k < 4; k++) c.blend(wx + k, base - 5, '#FFD86B', 0.25)
  }
}

function bowl(c, x, base, fill) {
  const B = ramp('#6C8CD5')
  const n = Math.round(Math.max(0, Math.min(1, fill)) * 3)
  for (let i = 0; i < n; i++) c.rect(x + 1, base - 2 - i, 6, 1, i === n - 1 ? '#F4C06B' : '#D99A47')
  c.stamp(x, base - 2, ['bBBBBBBb', '.bbbbbb.'], { b: B.shade, B: B.base })
}

// Árbol de tokens: un fruto naranja (una chispa) por cada bocado que te queda
function tokenTree(c, x, base, fruit, frame) {
  const L = ramp('#4FAF62'), T = ramp('#8A5A33')
  for (let y = 0; y < 11; y++) c.set(x, base - 1 - y, y % 3 ? T.base : T.light), c.set(x + 1, base - 1 - y, T.shade)
  c.set(x - 1, base - 1, T.shade), c.set(x + 2, base - 1, T.shade)
  const cx = x + 1, cy = base - 19
  for (let j = -9; j <= 9; j++) {
    for (let i = -11; i <= 11; i++) {
      const d = (i * i) / 121 + (j * j) / 81
      if (d > 1) continue
      const light = i + j < -4
      c.set(cx + i, cy + j, d > 0.8 ? L.shade : light ? L.light : (i * 3 + j * 5) % 7 === 0 ? L.shade : L.base)
    }
  }
  const spots = [[-6, -3], [4, -4], [-1, 1], [7, 1], [-4, 4], [1, -6], [8, -2], [-8, 1], [3, 4], [-3, -6], [5, 5], [-7, -1]]
  for (let k = 0; k < Math.min(fruit, spots.length); k++) {
    const [dx, dy] = spots[k]
    const tw = (frame + k) % 10 < 2
    c.set(cx + dx, cy + dy, tw ? '#FFF3E8' : '#F2914E')
    c.set(cx + dx + 1, cy + dy, '#E07A55')
  }
}

function lamp(c, x, base, night, frame) {
  const P = ramp('#5A6178')
  for (let y = 0; y < 20; y++) c.set(x, base - 1 - y, y % 4 ? P.base : P.light)
  c.rect(x - 1, base - 2, 3, 2, P.deep)
  c.stamp(x - 2, base - 24, ['.ppp.', 'pLLLp', 'pLLLp', 'pLLLp', '.ppp.'], { p: P.deep, L: night ? '#FFE27A' : '#C9D3E6' })
  if (night) {
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const d = Math.hypot(i, j)
      if (d < 6.5 && d > 2) c.blend(x + i, base - 22 + j, '#FFE27A', 0.16 * (1 - d / 6.5))
    }
    // Luciérnagas
    for (let k = 0; k < 3; k++) if ((frame + k * 3) % 8 < 5) c.set(x - 10 + k * 9 + (frame % 3), base - 8 - ((frame + k) % 6), '#D8FF8A')
  }
}

function fence(c, x0, x1, base) {
  const F = ramp('#C9A27A')
  for (let x = x0; x <= x1; x++) {
    if ((x - x0) % 5 === 0) for (let y = 0; y < 6; y++) c.set(x, base - 1 - y, y === 5 ? F.light : F.base)
    c.set(x, base - 3, F.shade)
    c.set(x, base - 5, F.base)
  }
}

// mode: 'isla' (un trozo alrededor de su casa) o 'completo' (todo el ancho)
// home: x del centro de la isla. Devuelve el lienzo y los límites por los que puede pasear.
export function drawYard(width, { mode = 'isla', home = width - 80, hunger = 70, bocados = 0, now = Date.now(), frame = 0 } = {}) {
  const H = YARD_H
  const c = new Canvas(width, H, null)
  const hour = new Date(now).getHours()
  const night = hour >= 21 || hour < 7
  const base = H - GROUND
  let x0, x1
  if (mode === 'completo') {
    x0 = 0
    x1 = width - 1
  } else {
    x0 = Math.max(0, Math.round(home - 78))
    x1 = Math.min(width - 1, x0 + 156)
    x0 = Math.max(0, x1 - 156)
  }
  ground(c, x0, x1, H, mode !== 'completo')
  // Decorado repetido a lo ancho (solo en modo completo)
  if (mode === 'completo') {
    for (let x = 30; x < width - 30; x += 97) {
      if (Math.abs(x - home) < 90) continue
      const k = Math.floor(x / 97) % 3
      if (k === 0) fence(c, x, x + 15, base)
      else if (k === 1) flower(c, x, base - 3, '#F2668B'), flower(c, x + 4, base - 2, '#B48CF0')
      else flower(c, x, base - 2, '#5BC0F2')
    }
  }
  // El hogar: casa a la izquierda, árbol de tokens y farola a la derecha
  const hx = Math.round(home)
  house(c, hx - 72, base, night)
  bowl(c, hx - 45, base, hunger / 100)
  tokenTree(c, hx + 44, base, bocados, frame)
  lamp(c, hx + 66, base, night, frame)
  flower(c, hx - 34, base - 3, '#F2668B')
  flower(c, hx - 30, base - 2, '#FFE27A')
  flower(c, hx + 28, base - 3, '#B48CF0')
  flower(c, hx + 58, base - 2, '#5BC0F2')
  return { canvas: c, walk: [x0 + 10, x1 - 10], night }
}
