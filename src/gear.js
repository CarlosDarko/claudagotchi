// Pixel art de los accesorios (se colocan según la forma de cada criatura) y de
// las decoraciones del escenario.
import { ramp, mix } from './sprites.js'

const K = '#1E1B2E'
const W = '#FFFFFF'

// Estampa centrada en cx, con la fila de abajo en `bottom`
function hat(c, rows, pal, cx, bottom, dx = 0) {
  const w = rows[0].length
  c.stamp(Math.round(cx - w / 2) + dx, bottom - rows.length + 1, rows, pal)
}

// ---------- Accesorios ----------
// A: anclajes que calcula drawPet { cx, cy, rx, ry, top, ey, lx, rx2, ew, eh, my, neckY, hx, hy }

const HEAD = {
  gorra: (c, A) => hat(c, ['..bbbbb...', '.bBBWBBb..', 'bbbbbbbbbbb'], { b: '#3A6FD8', B: '#5B8FF0', W }, A.cx, A.top + 1, 1),
  'gorro-lana': (c, A) => hat(c, ['...w...', '..www..', '.rRRRr.', 'rRrRrRr', 'yyyyyyy'], { r: '#C93A3A', R: '#F25C5C', y: '#F2E6D0', w: W }, A.cx, A.top + 1),
  lazo: (c, A) => hat(c, ['pp.pp', 'pPrPp', 'pp.pp'], { p: '#E25C8C', P: '#FF9CC0', r: '#B8325F' }, A.cx + A.rx * 0.45, A.top + 2),
  'corona-flores': (c, A) => hat(c, ['f.y.p.f.y', 'ggggggggg'], { f: '#FF6F91', y: '#FFE27A', p: '#B48CF0', g: '#5DAA68' }, A.cx, A.top + 1),
  chistera: (c, A) => hat(c, ['.kkkkk.', '.kKKKk.', '.kKKKk.', '.rrrrr.', 'kkkkkkk'], { k: K, K: '#3A3550', r: '#C93A3A' }, A.cx, A.top + 1),
  vaquero: (c, A) => hat(c, ['...bbb...', '..bBBBb..', '..rrrrr..', 'bbbbbbbbb', '.b.....b.'], { b: '#8A5A33', B: '#B07A4A', r: '#5A3A22' }, A.cx, A.top + 2),
  vikingo: (c, A) => hat(c, ['w.......w', 'ww.ggg.ww', '.wgGGGgw.', '..ggggg..'], { w: '#F3E6C4', g: '#8E98A8', G: '#C8CDD8' }, A.cx, A.top + 1),
  'orejas-gato': (c, A) => {
    for (const s of [-1, 1]) hat(c, ['k..', 'kk.', 'kpk'].map((r) => (s > 0 ? [...r].reverse().join('') : r)), { k: '#3A3550', p: '#FF9CC0' }, A.cx + s * A.rx * 0.5, A.top + 1)
  },
  boina: (c, A) => hat(c, ['...k...', '.rrrrr.', 'rRRRRRr', '.rrrrr.'], { k: '#5A1A22', r: '#8E2A35', R: '#B5404F' }, A.cx - 1, A.top + 1),
  birrete: (c, A) => hat(c, ['kkkkkkkkk', '.kkkKkkky', '..kkkkk.y', '........y'], { k: K, K: '#3A3550', y: '#F2C230' }, A.cx, A.top + 2),
  tiara: (c, A) => hat(c, ['.y.b.y.', 'yyyyyyy'], { y: '#F2C230', b: '#5BC0F2' }, A.cx, A.top + 1),
  paja: (c, A) => hat(c, ['..yyyyy..', '..yYYYy..', '..rrrrr..', 'yyyyyyyyy'], { y: '#D9B45A', Y: '#F2D88A', r: '#C93A3A' }, A.cx, A.top + 1),
  helice: (c, A, f) => hat(c, [f % 2 ? '.rr.bb.' : 'rrr.bbb', '...k...', '.yyyyy.', 'yRyRyRy'], { r: '#F25C5C', b: '#5BC0F2', k: K, y: '#F2C230', R: '#F25C5C' }, A.cx, A.top + 1),
  aureola: (c, A, f) => hat(c, ['.yyyyy.', 'y.....y', '.yyyyy.'], { y: f % 6 < 3 ? '#FFD23F' : '#FFE27A' }, A.cx, A.top - 2),
  chef: (c, A) => hat(c, ['.wwwww.', 'wWwWwWw', 'wwwwwww', '.wwwww.', '.ggggg.'], { w: W, W: '#E6E6EE', g: '#D0D0DA' }, A.cx, A.top + 1),
  pirata: (c, A) => hat(c, ['..kkkkk..', '.kkkwkkk.', 'kkkkkkkkk'], { k: K, w: W }, A.cx, A.top + 1),
  antenas: (c, A, f) => hat(c, f % 4 < 2 ? ['p...p', '.k.k.', '.k.k.'] : ['.p.p.', '.k.k.', '.k.k.'], { p: '#FF6F91', k: '#3A3550' }, A.cx, A.top),
  'papa-noel': (c, A) => hat(c, ['......w', '...rrr.', '..rRRr.', '.rRRRrr', 'wwwwwww'], { r: '#C93A3A', R: '#F25C5C', w: W }, A.cx, A.top + 1),
  'cuernos-reno': (c, A) => hat(c, ['b.b.....b.b', '.bb.....bb.', '..b.....b..'], { b: '#8A5A33' }, A.cx, A.top + 1),
  fiesta: (c, A) => hat(c, ['...y...', '..pPp..', '..PpP..', '.pPpPp.'], { p: '#5BC0F2', P: '#F2668B', y: '#FFE27A' }, A.cx, A.top + 1),
  'casco-espacial': (c, A) => {
    // Cúpula de cristal alrededor de la cabeza
    const r = Math.max(A.rx, A.ry) + 2
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const d = Math.hypot(i / (A.rx + 2), j / (A.ry + 2))
      const x = Math.round(A.cx + i), y = Math.round(A.cy - 1 + j)
      if (d <= 1 && d > 0.9) c.set(x, y, '#C8E8FF')
      else if (d < 0.9 && i < -2 && j < -2 && (i + j) % 5 === 0) c.blend(x, y, '#FFFFFF', 0.5)
    }
    hat(c, ['gggggggggggg'], { g: '#8E98A8' }, A.cx, Math.round(A.cy + A.ry * 0.75))
  },
}

const FACE = {
  'gafas-sol': (c, A) => {
    for (const x of [A.lx - 1, A.rx2 - 1]) c.stamp(x, A.ey, ['kkkkk'.slice(0, A.ew + 2), 'kWkkk'.slice(0, A.ew + 2), 'kkkkk'.slice(0, A.ew + 2)], { k: K, W: '#5A6178' })
    for (let x = A.lx + A.ew + 1; x < A.rx2 - 1; x++) c.set(x, A.ey, K)
  },
  'gafas-redondas': (c, A) => {
    for (const x of [A.lx - 1, A.rx2 - 1]) c.stamp(x, A.ey - 1, ['.kkk.', 'k...k', 'k...k', '.kkk.'], { k: K })
    for (let x = A.lx + A.ew + 1; x < A.rx2 - 1; x++) c.set(x, A.ey, K)
  },
  monoculo: (c, A) => {
    c.stamp(A.rx2 - 1, A.ey - 1, ['.yyy.', 'y...y', 'y...y', '.yyy.'], { y: '#F2C230' })
    for (let j = 0; j < 4; j++) c.set(A.rx2 + 3, A.ey + 3 + j, '#F2C230')
  },
  bigote: (c, A) => hat(c, ['k.....k', 'kk.k.kk', '.kkkkk.'], { k: '#3A2A20' }, A.cx, A.my - 1),
  antifaz: (c, A) => {
    for (let y = A.ey; y < A.ey + 3; y++) for (let x = A.lx - 2; x <= A.rx2 + A.ew + 1; x++) {
      const cur = c.get(x, y)
      if (cur !== '#1B1530' && cur !== W && cur !== '#8C9BFF') c.set(x, y, '#3A3550')
    }
  },
  parche: (c, A) => {
    c.stamp(A.rx2 - 1, A.ey - 1, ['kkkk', 'kkkk', 'kkkk', '.kk.'].map((r) => r.slice(0, A.ew + 2)), { k: K })
    for (let x = A.lx - 2; x < A.rx2; x++) c.set(x, A.ey - 1 - (x < A.cx ? 1 : 0), K)
  },
  'gafas-3d': (c, A) => {
    c.stamp(A.lx - 1, A.ey, ['wwwww'.slice(0, A.ew + 2), 'wrrrw'.slice(0, A.ew + 1) + 'w', 'wwwww'.slice(0, A.ew + 2)], { w: W, r: '#F25C5C' })
    c.stamp(A.rx2 - 1, A.ey, ['wwwww'.slice(0, A.ew + 2), 'wbbbw'.slice(0, A.ew + 1) + 'w', 'wwwww'.slice(0, A.ew + 2)], { w: W, b: '#5BD8F2' })
    for (let x = A.lx + A.ew + 1; x < A.rx2 - 1; x++) c.set(x, A.ey, W)
  },
  'nariz-payaso': (c, A) => hat(c, ['.r.', 'rWr', '.r.'], { r: '#F25C5C', W }, A.cx, A.my - 1),
  pegatinas: (c, A) => {
    for (const x of [A.lx - 3, A.rx2 + A.ew]) c.stamp(x, A.ey + A.eh, ['p.p', 'ppp', '.p.'], { p: '#FF6F91' })
  },
}

const NECK = {
  pajarita: (c, A) => hat(c, ['bb.bb', 'bbBbb', 'bb.bb'], { b: '#3A6FD8', B: '#24408A' }, A.cx, A.neckY + 1),
  perlas: (c, A) => {
    for (let i = -4; i <= 4; i++) if (i % 2 === 0) c.set(Math.round(A.cx + i), A.neckY + Math.round((i * i) / 10), W)
  },
  'bufanda-roja': (c, A) => {
    for (let i = -5; i <= 5; i++) c.set(Math.round(A.cx) + i, A.neckY, i % 2 ? '#C93A3A' : '#F25C5C')
    c.stamp(Math.round(A.cx) - 4, A.neckY + 1, ['rr', 'rr', 'r.'], { r: '#C93A3A' })
  },
  medalla: (c, A) => {
    c.set(Math.round(A.cx) - 1, A.neckY, '#C93A3A'), c.set(Math.round(A.cx) + 1, A.neckY, '#3A6FD8')
    hat(c, ['.yy.', 'yYyy', '.yy.'], { y: '#F2C230', Y: '#FFE27A' }, A.cx + 0.5, A.neckY + 3)
  },
  corbata: (c, A) => hat(c, ['rrr', '.r.', '.r.', 'rRr', '.r.'], { r: '#C93A3A', R: '#F25C5C' }, A.cx + 0.5, A.neckY + 4),
  panuelo: (c, A) => hat(c, ['bbbbbbb', '.bBbBb.', '..bbb..', '...b...'], { b: '#3A6FD8', B: '#FFFFFF' }, A.cx + 0.5, A.neckY + 3),
  cascabel: (c, A) => {
    for (let i = -4; i <= 4; i++) c.set(Math.round(A.cx) + i, A.neckY, '#C93A3A')
    hat(c, ['.y.', 'yYy', '.k.'], { y: '#F2C230', Y: '#FFE27A', k: K }, A.cx + 0.5, A.neckY + 3)
  },
  lei: (c, A) => {
    const cols = ['#FF6F91', '#FFE27A', '#B48CF0', '#5BC0F2']
    for (let i = -5; i <= 5; i++) c.set(Math.round(A.cx + i), A.neckY + Math.round((i * i) / 14), cols[(i + 10) % 4])
  },
}

const HAND = {
  globo: (c, A, f) => {
    const bx = A.hx + 2, by = A.hy - 14 - (f % 6 < 3 ? 0 : 1)
    for (let y = by + 5; y < A.hy; y++) c.set(bx + ((y >> 1) % 2 ? 0 : 1) - 1, y, '#C8CDD8')
    c.stamp(bx - 2, by, ['.rrr.', 'rWRrr', 'rRrrr', 'rrrrr', '.rrr.', '..r..'], { r: '#E2404F', R: '#F27080', W })
  },
  varita: (c, A, f) => {
    for (let i = 0; i < 5; i++) c.set(A.hx + i, A.hy - i, '#5A3A22')
    c.stamp(A.hx + 3, A.hy - 8, ['.y.', 'yWy', '.y.'], { y: '#FFD23F', W: f % 4 < 2 ? W : '#FFD23F' })
  },
  espada: (c, A) => {
    for (let i = 0; i < 7; i++) c.set(A.hx + 1, A.hy - 2 - i, i === 6 ? '#C9A27A' : '#D9B48C')
    c.rect(A.hx - 1, A.hy - 2, 5, 1, '#8A5A33')
  },
  cafe: (c, A, f) => {
    c.stamp(A.hx, A.hy - 3, ['wwwk', 'wcwk', 'www.'], { w: W, c: '#6B3A22', k: '#C8CDD8' })
    if (f % 6 < 4) c.set(A.hx + 1 + (f % 2), A.hy - 5 - ((f >> 1) % 2), '#E6E6EE')
  },
  piruleta: (c, A) => {
    for (let i = 0; i < 4; i++) c.set(A.hx + 1, A.hy - 1 - i, W)
    c.stamp(A.hx - 1, A.hy - 9, ['.pp.', 'pPyp', 'pyPp', '.pp.'], { p: '#F2668B', P: '#FFFFFF', y: '#FFE27A' })
  },
  paraguas: (c, A) => {
    const top = A.top - 4
    for (let y = top; y < A.hy; y++) c.set(A.hx, y, '#3A3550')
    for (let j = 0; j < 3; j++) for (let i = -(4 + j * 2); i <= 4 + j * 2; i++) c.set(A.hx + i, top - 2 + j, (Math.floor((i + 20) / 3) % 2 ? '#F25C5C' : '#FFFFFF'))
  },
  bandera: (c, A, f) => {
    for (let i = 0; i < 10; i++) c.set(A.hx + 1, A.hy - i, '#8A5A33')
    c.stamp(A.hx + 2, A.hy - 10 + (f % 4 < 2 ? 0 : 1), ['oooooo', 'oowwoo', 'owwwwo', 'oowwoo'], { o: '#E07A55', w: '#FFF3E8' })
  },
}

// Objetos de actividades (no se venden): leer y regar
HAND.libro = (c, A) => c.stamp(A.hx - 3, A.hy - 4, ['rrrrr', 'rpppr', 'rpkpr', 'rpppr', 'rrrrr'], { r: '#3A6FD8', p: '#F3E6C4', k: '#8E98A8' })
HAND.regadera = (c, A, f) => {
  c.stamp(A.hx - 1, A.hy - 4, ['.ggg..', 'gGGGgg', 'gGGGg.', 'ggggg.'], { g: '#4A9A6A', G: '#6CC27A' })
  if (f % 4 < 3) c.set(A.hx + 6, A.hy - 2 + (f % 4), '#8FD3FF'), c.set(A.hx + 7, A.hy + (f % 4), '#8FD3FF')
}

const BACK = {
  mochila: (c, A) => c.stamp(Math.round(A.cx - A.rx) - 3, Math.round(A.cy) - 3, ['.bbb', 'bBBb', 'bBBb', 'bbbb', 'bbbb'], { b: '#8A5A33', B: '#B07A4A' }),
  capa: (c, A, f) => {
    const wave = f % 6 < 3 ? 0 : 1
    for (let j = 0; j < A.ry * 2; j++) {
      const w = A.rx + 2 + Math.floor(j / 3)
      for (let i = -w; i <= w; i++) {
        if (Math.abs(i) < A.rx - 1 && j < A.ry * 1.6) continue
        c.set(Math.round(A.cx) + i + (j > A.ry ? wave : 0), Math.round(A.cy - A.ry * 0.5) + j, Math.abs(i) > w - 2 ? '#8E2A35' : '#C93A3A')
      }
    }
  },
  'alas-hada': (c, A, f) => {
    const flap = f % 4 < 2 ? 0 : 1
    for (const s of [-1, 1]) for (let j = -5; j <= 4; j++) for (let i = 1; i <= 7 - Math.abs(j) / 2 + flap; i++) {
      c.blend(Math.round(A.cx + s * (A.rx - 1 + i)), Math.round(A.cy - 3 + j), i > 5 - Math.abs(j) / 2 ? '#8FD3FF' : '#D6F0FF', 0.75)
    }
  },
  'alas-angel': (c, A, f) => {
    const flap = f % 6 < 3 ? 0 : 1
    for (const s of [-1, 1]) for (let j = 0; j < 7; j++) {
      const len = [5, 7, 8, 8, 7, 5, 3][j]
      for (let i = 0; i < len; i++) c.set(Math.round(A.cx + s * (A.rx + i)), Math.round(A.cy - 5 + j - (i > 3 ? flap : 0)), i === len - 1 || j === 6 ? '#C8CDD8' : W)
    }
  },
}

const BY_SLOT = { cabeza: HEAD, cara: FACE, cuello: NECK, mano: HAND, espalda: BACK }

// layer: 'back' (detrás del cuerpo) o 'front'
export function drawGear(c, gear, A, frame, layer) {
  if (!gear) return
  if (layer === 'back') {
    if (gear.espalda) BACK[gear.espalda]?.(c, A, frame)
    return
  }
  for (const slot of ['cuello', 'cara', 'cabeza', 'mano']) {
    const id = gear[slot]
    if (id) BY_SLOT[slot][id]?.(c, A, frame)
  }
}

export const hasGear = (id) => Object.values(BY_SLOT).some((m) => m[id])

// ---------- Decoraciones del escenario ----------
// x: borde izquierdo, base: altura del suelo. env: { night, frame, season }

// Se crea al primer uso (sprites.js y gear.js se importan entre sí)
let PALS = null
const PAL = new Proxy({}, {
  get: (_, k) => {
    PALS ??= { wood: ramp('#9B6B4A'), stone: ramp('#9AA3B8'), leaf: ramp('#4FAF62'), red: ramp('#D9474F'), water: ramp('#5BA8E0') }
    return PALS[k]
  },
})

const DRAW = {
  banco: (c, x, b) => c.stamp(x, b - 7, ['wwwwwwwwwwwwwwww', 'WWWWWWWWWWWWWWWW', '................', 'wwwwwwwwwwwwwwww', 'WWWWWWWWWWWWWWWW', '.d............d.', '.d............d.'], { w: PAL.wood.light, W: PAL.wood.base, d: PAL.wood.deep }),
  buzon: (c, x, b) => c.stamp(x, b - 11, ['.rrrrr', 'rRRRRr', 'rRRRRr', 'rrrrrr', '..f...', '..d...', '..d...', '..d...', '..d...', '..d...', '..d...'], { r: PAL.red.base, R: PAL.red.light, f: '#F2C230', d: PAL.wood.deep }),
  pozo: (c, x, b) => c.stamp(x, b - 16, ['...rrrrrrrrrr...', '..rrrrrrrrrrrr..', '...d........d...', '...d...dd...d...', '...d...ww...d...', '...d........d...', 'ssssssssssssssss', 'sSsSsSsSsSsSsSsS', 'ssssssssssssssss', 'sSsSsSsSsSsSsSsS', 'ssssssssssssssss', 'sSsSsSsSsSsSsSsS', 'ssssssssssssssss', 'sSsSsSsSsSsSsSsS', 'ssssssssssssssss', 'sSsSsSsSsSsSsSsS'], { r: PAL.red.base, d: PAL.wood.deep, w: '#9AA3B8', s: PAL.stone.base, S: PAL.stone.shade }),
  farolillos: (c, x, b, e) => {
    for (let i = 0; i < 26; i++) c.set(x + i, b - 18 + Math.round(Math.sin((i / 25) * Math.PI) * 4), '#5A5A6A')
    c.stamp(x, b - 18, ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'], { d: PAL.wood.deep })
    c.stamp(x + 25, b - 18, ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'], { d: PAL.wood.deep })
    const cols = ['#F25C5C', '#FFD23F', '#5BC0F2', '#B48CF0']
    for (let k = 0; k < 4; k++) {
      const lx = x + 4 + k * 6, ly = b - 15 + Math.round(Math.sin(((4 + k * 6) / 25) * Math.PI) * 4)
      c.stamp(lx, ly, ['.l.', 'lLl', 'lLl', '.l.'], { l: cols[k], L: e.night ? '#FFF3B0' : mix(cols[k], '#FFFFFF', 0.4) })
      if (e.night) c.blend(lx + 1, ly + 5, '#FFE27A', 0.25)
    }
  },
  banderines: (c, x, b) => {
    for (let i = 0; i < 30; i++) c.set(x + i, b - 20 + Math.round(Math.sin((i / 29) * Math.PI) * 3), '#5A5A6A')
    const cols = ['#F25C5C', '#FFD23F', '#5BC0F2', '#6CC27A', '#B48CF0']
    for (let k = 0; k < 6; k++) {
      const fx = x + 2 + k * 5, fy = b - 19 + Math.round(Math.sin(((2 + k * 5) / 29) * Math.PI) * 3)
      c.stamp(fx, fy, ['fff', '.f.'], { f: cols[k % 5] })
    }
    for (let y = b - 20; y < b; y++) c.set(x, y, PAL.wood.deep), c.set(x + 29, y, PAL.wood.deep)
  },
  estanque: (c, x, b, e) => {
    for (let j = 0; j < 4; j++) for (let i = 0; i < 26; i++) {
      const d = ((i - 12.5) / 13) ** 2 + ((j - 1) / 3) ** 2
      if (d > 1) continue
      c.set(x + i, b + j - 1, d > 0.7 ? PAL.stone.shade : (i + j + (e.frame >> 1)) % 7 === 0 ? PAL.water.high : PAL.water.base)
    }
    c.stamp(x + 6, b - 2, ['.g.', 'ggg'], { g: '#4FAF62' })
    c.stamp(x + 17, b - 1, ['ppp'], { p: '#FF9CC0' })
  },
  columpio: (c, x, b, e) => {
    c.stamp(x, b - 18, ['dddddddddddddddddd', '.d..............d.'], { d: PAL.wood.base })
    for (let y = b - 16; y < b; y++) c.set(x + 1 + Math.round((b - y) / 5), y, PAL.wood.deep), c.set(x + 16 - Math.round((b - y) / 5), y, PAL.wood.deep)
    const sw = Math.round(Math.sin(e.frame / 4) * 2)
    for (let y = b - 16; y < b - 5; y++) c.set(x + 6 + sw, y, '#C8CDD8'), c.set(x + 11 + sw, y, '#C8CDD8')
    c.rect(x + 5 + sw, b - 5, 8, 1, PAL.red.base)
  },
  'tienda-campana': (c, x, b) => {
    for (let j = 0; j < 12; j++) {
      const half = j
      for (let i = -half; i <= half; i++) c.set(x + 10 + i, b - 12 + j, i < 0 ? '#E07A55' : '#C25A3A')
    }
    c.stamp(x + 8, b - 6, ['.kk.', 'kkkk', 'kkkk', 'kkkk', 'kkkk', 'kkkk'], { k: '#5A2A1A' })
  },
  hoguera: (c, x, b, e) => {
    c.stamp(x, b - 2, ['dd.dd.dd..', '.dddddddd.'], { d: PAL.wood.deep })
    const F = ['#FFF3A0', '#FFC23A', '#FF7A2A', '#E2402A']
    for (let i = 0; i < 8; i++) {
      const h = 3 + ((i * 5 + e.frame * 3) % 5) - (i === 0 || i === 7 ? 2 : 0)
      for (let j = 0; j < h; j++) c.set(x + 1 + i, b - 3 - j, F[Math.min(3, Math.floor(((h - j) / h) * 3.9))])
    }
    if (e.night) for (let k = 0; k < 3; k++) c.blend(x - 2 + k * 6, b - 1, '#FFC23A', 0.25)
  },
  cartel: (c, x, b) => c.stamp(x, b - 11, ['wwwwwwwwwwwwww', 'wWWWWWWWWWWWWw', 'wWooWWWWWWWWWw', 'wWooWkkWkkWkWw', 'wWWWWWWWWWWWWw', 'wwwwwwwwwwwwww', '......dd......', '......dd......', '......dd......', '......dd......', '......dd......'], { w: PAL.wood.base, W: '#F3E6C4', o: '#E07A55', k: '#5A3A22', d: PAL.wood.deep }),
  espantapajaros: (c, x, b) => c.stamp(x, b - 18, ['...yyyyyy...', '..yyyyyyyy..', '....pppp....', '...pkppkp...', '...pppppp...', '....pppp....', 'bbbbbbbbbbbb', '.b.rrrrrr.b.', '...rRRRRr...', '...rrrrrr...', '....d..d....', '.....dd.....', '.....dd.....', '.....dd.....', '.....dd.....', '.....dd.....', '.....dd.....', '.....dd.....'], { y: '#D9B45A', p: '#F2D8B0', k: K, b: '#8A5A33', r: '#3A6FD8', R: '#5B8FF0', d: PAL.wood.deep }),
  girasoles: (c, x, b) => {
    for (const [dx, h] of [[2, 14], [7, 11]]) {
      for (let y = 0; y < h; y++) c.set(x + dx, b - 1 - y, '#4FAF62')
      c.stamp(x + dx - 2, b - h - 4, ['.yyy.', 'ybbby', 'ybbby', 'ybbby', '.yyy.'], { y: '#FFD23F', b: '#7A4E2C' })
      c.set(x + dx + 1, b - Math.round(h / 2), '#6CC27A')
    }
  },
  rosal: (c, x, b) => c.stamp(x, b - 8, ['..r..r..r...', '.gRggRgRgg..', 'ggggrggggRg.', 'gRgggggrgggg', 'ggggRgggggRg', 'ggrggggRgggg', '.gggggggggg.', '..gggggggg..'], { g: '#3D8A4E', r: '#E2404F', R: '#F27080' }),
  cactus: (c, x, b) => c.stamp(x, b - 12, ['...gg...', '..gGgg..', '..gGgg.g', 'g.gGgggg', 'ggggGg..', '..gGgg..', '..gggg..', '..gGgg..', '.pppppp.', '.pPpppp.', '..pppp..', '..pppp..'], { g: '#3D8A4E', G: '#6CC27A', p: '#C2683F', P: '#E0885A' }),
  cerezo: (c, x, b, e) => {
    for (let y = 0; y < 12; y++) c.set(x + 12, b - 1 - y, PAL.wood.base), c.set(x + 13, b - 1 - y, PAL.wood.shade)
    for (let j = -8; j <= 8; j++) for (let i = -13; i <= 13; i++) {
      const d = (i * i) / 169 + (j * j) / 64
      if (d > 1) continue
      c.set(x + 13 + i, b - 20 + j, d > 0.8 ? '#D9709A' : (i * 3 + j * 7) % 9 === 0 ? '#FFFFFF' : i + j < -5 ? '#FFC4DA' : '#F49AC0')
    }
    for (let k = 0; k < 3; k++) c.set(x + 4 + ((k * 9 + e.frame) % 22), b - 6 + ((e.frame + k * 3) % 6), '#FFC4DA')
  },
  pino: (c, x, b, e) => {
    for (let j = 0; j < 20; j++) {
      const half = Math.floor((j % 7) / 1.2) + Math.floor(j / 7) + 1
      for (let i = -half; i <= half; i++) c.set(x + 8 + i, b - 22 + j, i < 0 ? '#3E8A55' : '#2D6B42')
    }
    c.rect(x + 7, b - 3, 2, 3, PAL.wood.deep)
    if (e.season === 'invierno') for (let j = 0; j < 20; j += 7) for (let i = -2; i <= 2; i++) c.set(x + 8 + i, b - 22 + j, W)
  },
  carretilla: (c, x, b) => c.stamp(x, b - 7, ['rrrrrrrrrr....', 'rRRRRRRRRr....', '.rrrrrrrrdddd.', '..rrrrrr.....d', '...k..........', '..kKk.........', '...k..........'], { r: '#3A6FD8', R: '#5B8FF0', d: PAL.wood.deep, k: K, K: '#5A6178' }),
  estatua: (c, x, b) => c.stamp(x, b - 20, ['....oo....', '...oOOo...', '..oOooOo..', '..oOooOo..', '...oOOo...', '....oo....', '.....s....', '....sSs...', '...sSSSs..', '...sSSSs..', '...sSSSs..', '....sss...', '..ssssss..', '..sSSSSs..', '..ssssss..', '.ssssssss.', '.sSSSSSSs.', '.sSSSSSSs.', '.sSSSSSSs.', 'ssssssssss'], { o: '#E07A55', O: '#FF9A6B', s: PAL.stone.base, S: PAL.stone.light }),
  fuente: (c, x, b, e) => {
    c.stamp(x, b - 6, ['ssssssssssssssssss', 'sSwwwwwwwwwwwwwwSs', 'sSwWwwwwwwwwwWwwSs', 'ssssssssssssssssss', '.ssssssssssssssss.', '..ssssssssssssss..'], { s: PAL.stone.base, S: PAL.stone.light, w: PAL.water.base, W: PAL.water.high })
    c.rect(x + 8, b - 12, 2, 6, PAL.stone.base)
    for (let k = 0; k < 6; k++) {
      const t = ((e.frame + k * 2) % 8) / 8
      c.set(x + 9 + Math.round((k % 2 ? 1 : -1) * t * 6), b - 13 + Math.round(t * t * 8) - 2, '#BFE6FF')
    }
  },
  escritorio: (c, x, b, e) => {
    c.stamp(x, b - 10, ['dddddddddddddddddd', 'DDDDDDDDDDDDDDDDDD', '.d..............d.', '.d..............d.', '.d..............d.', '.d..............d.', '.d..............d.', '.d..............d.', '.d..............d.', '.d..............d.'], { d: PAL.wood.base, D: PAL.wood.shade })
    c.stamp(x + 4, b - 17, ['kkkkkkkkk', 'kbbbbbbbk', 'kbobbbbbk', 'kbbbbbbbk', 'kkkkkkkkk', '...kkk...', '..kkkkk..'], { k: '#3C4256', b: e.frame % 10 < 5 ? '#16202E' : '#1E2A3E', o: '#E07A55' })
  },
  setas: (c, x, b) => c.stamp(x, b - 6, ['.rrr.....', 'rWrRr.rr.', 'rrrrrrWRr', '..w..rrrr', '..w....w.', '..w....w.'], { r: '#D9474F', R: '#F27080', W, w: '#F3E6C4' }),
  calabaza: (c, x, b, e) => c.stamp(x, b - 8, ['....g.....', '..ooOoo...', '.oOoOoOo..', 'oOkOoOkOo.', 'oOoOoOoOo.', 'oOkkkkkOo.', '.oOoOoOo..', '..ooooo...'], { g: '#3D8A4E', o: '#E0702A', O: '#F2913E', k: e.night ? '#FFE27A' : '#5A2A1A' }),
  'arbol-navidad': (c, x, b, e) => {
    for (let j = 0; j < 18; j++) {
      const half = Math.floor((j % 6) * 0.9) + Math.floor(j / 6) + 1
      for (let i = -half; i <= half; i++) c.set(x + 8 + i, b - 21 + j, i < 0 ? '#3E8A55' : '#2D6B42')
    }
    c.rect(x + 7, b - 3, 2, 3, PAL.wood.deep)
    c.stamp(x + 7, b - 24, ['.y.', 'yyy', '.y.'], { y: '#FFD23F' })
    const cols = ['#F25C5C', '#FFD23F', '#5BC0F2', '#F2668B']
    for (let k = 0; k < 8; k++) if ((k + e.frame) % 3) c.set(x + 8 + ((k * 5) % 9) - 4, b - 18 + k * 2, cols[k % 4])
  },
  tarta: (c, x, b, e) => c.stamp(x, b - 9, ['....y.....', '....f.....', '...wcw....', '.pppppppp.', 'pPPPPPPPPp', 'pwpwpwpwpp', 'pPPPPPPPPp', 'pppppppppp', '.kkkkkkkk.'], { y: e.frame % 4 < 2 ? '#FFD23F' : '#FF9A2E', f: '#FFF3E8', w: W, c: '#F2668B', p: '#F49AC0', P: '#FFD0E2', k: '#C8CDD8' }),
  'muneco-nieve': (c, x, b) => c.stamp(x, b - 15, ['...kkkk.....', '..kkkkkk....', '.rrrrrrrr...', '...wwww.....', '..wkwwkw....', '..wwoooww...', '...wwww.....', '..rrrrrr....', '.wwwwwwww...', 'wwwwkwwwww..', 'wwwwwwwwww..', 'wwwwkwwwww..', 'wwwwwwwwww..', '.wwwwwwww...', '..wwwwww....'], { k: K, r: '#C93A3A', w: '#F4F7FF', o: '#F2913E' }),
}

export function drawDecor(c, id, x, base, env) {
  DRAW[id]?.(c, Math.round(x), base, env)
}
export const hasDecor = (id) => !!DRAW[id]
