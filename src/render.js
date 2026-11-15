// Del lienzo de píxeles a texto de terminal. Cada carácter son dos píxeles en vertical
// (medio bloque ▀ ▄), así los píxeles salen cuadrados.
const ESC = '\x1b['
export const RESET = `${ESC}0m`

// Windows Terminal (WT_SESSION) y la consola moderna de Windows admiten color de 24 bits aunque no lo anuncien
export const TRUECOLOR = /truecolor|24bit/i.test(process.env.COLORTERM || '') || ['iTerm.app', 'vscode', 'WezTerm', 'ghostty', 'Hyper'].includes(process.env.TERM_PROGRAM) || !!process.env.WT_SESSION || process.platform === 'win32' || process.env.CLAUDAGOTCHI_TRUECOLOR === '1'
export const NO_COLOR = 'NO_COLOR' in process.env

function rgb(hex) {
  const n = parseInt(hex.slice(1, 7), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
function to256([r, g, b]) {
  if (r === g && g === b) return r < 8 ? 16 : r > 248 ? 231 : Math.round(((r - 8) / 247) * 24) + 232
  const q = (v) => Math.round((v / 255) * 5)
  return 16 + 36 * q(r) + 6 * q(g) + q(b)
}
export function fg(hex) {
  if (NO_COLOR || !hex) return ''
  const c = rgb(hex)
  return TRUECOLOR ? `${ESC}38;2;${c[0]};${c[1]};${c[2]}m` : `${ESC}38;5;${to256(c)}m`
}
export function bg(hex) {
  if (NO_COLOR || !hex) return ''
  const c = rgb(hex)
  return TRUECOLOR ? `${ESC}48;2;${c[0]};${c[1]};${c[2]}m` : `${ESC}48;5;${to256(c)}m`
}
export const bold = (s) => (NO_COLOR ? s : `${ESC}1m${s}${ESC}22m`)
export const dim = (s) => (NO_COLOR ? s : `${ESC}2m${s}${ESC}22m`)
export const paint = (hex, s) => (NO_COLOR ? s : `${fg(hex)}${s}${ESC}39m`)

// Lienzo -> líneas ANSI. `zoom` 2 duplica cada píxel en ambos ejes.
export function canvasToAnsi(canvas, zoom = 1) {
  const W = canvas.w * zoom, H = canvas.h * zoom
  const get = (x, y) => canvas.get(Math.floor(x / zoom), Math.floor(y / zoom))
  const lines = []
  for (let y = 0; y < H; y += 2) {
    let line = ''
    let last = ''
    for (let x = 0; x < W; x++) {
      const top = get(x, y), bot = y + 1 < H ? get(x, y + 1) : null
      let code, ch
      if (!top && !bot) { code = RESET; ch = ' ' }
      else if (top && !bot) { code = RESET + fg(top); ch = '▀' }
      else if (!top && bot) { code = RESET + fg(bot); ch = '▄' }
      else if (top === bot) { code = RESET + fg(top); ch = '█' }
      else { code = RESET + fg(top) + bg(bot); ch = '▀' }
      if (NO_COLOR) { line += !top && !bot ? ' ' : top && bot ? '█' : top ? '▀' : '▄'; continue }
      if (code !== last) { line += code; last = code }
      line += ch
    }
    lines.push(line + RESET)
  }
  return lines
}

// Lienzo -> SVG (para la documentación y la galería)
export function canvasToSvg(canvas, scale = 8, background = null) {
  const rects = []
  for (let y = 0; y < canvas.h; y++) {
    for (let x = 0; x < canvas.w; x++) {
      const c = canvas.get(x, y)
      if (c) rects.push(`<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`)
    }
  }
  const bgRect = background ? `<rect width="${canvas.w}" height="${canvas.h}" fill="${background}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.w} ${canvas.h}" width="${canvas.w * scale}" height="${canvas.h * scale}" shape-rendering="crispEdges">${bgRect}${rects.join('')}</svg>`
}

// Ancho visible de un texto con códigos ANSI y emojis. Los símbolos del rango
// 2600–27BF solo ocupan dos columnas si son emoji de serie o llevan el selector FE0F.
const WIDE_SYMBOLS = new Set([0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3, 0x25fd, 0x25fe, 0x2614, 0x2615, 0x267f, 0x2693, 0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26d4, 0x26ea, 0x26f2, 0x26f3, 0x26f5, 0x26fa, 0x26fd, 0x2705, 0x270a, 0x270b, 0x2728, 0x274c, 0x274e, 0x2753, 0x2754, 0x2755, 0x2757, 0x2795, 0x2796, 0x2797, 0x27b0, 0x27bf])
function charWidth(cp, next) {
  if (cp === 0xfe0f || cp === 0x200d || (cp >= 0x300 && cp < 0x370)) return 0
  if (cp >= 0x1f000) return 2
  if ((cp >= 0x2190 && cp <= 0x2bff) || (cp >= 0x2300 && cp <= 0x23ff)) return WIDE_SYMBOLS.has(cp) || (cp >= 0x2648 && cp <= 0x2653) || next === 0xfe0f ? 2 : 1
  if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xff00 && cp <= 0xff60)) return 2
  return 1
}
export function visibleWidth(s) {
  const cps = [...String(s).replace(/\x1b\[[0-9;]*m/g, '')].map((c) => c.codePointAt(0))
  let w = 0
  for (let i = 0; i < cps.length; i++) w += charWidth(cps[i], cps[i + 1])
  return w
}

export function padEnd(s, width) {
  const w = visibleWidth(s)
  return w >= width ? s : s + ' '.repeat(width - w)
}

export function truncate(s, width) {
  if (visibleWidth(s) <= width) return s
  let out = ''
  for (const ch of String(s).replace(/\x1b\[[0-9;]*m/g, '')) {
    if (visibleWidth(out + ch) > width - 1) break
    out += ch
  }
  return `${out}…`
}

// Barra fina: el mismo trazo lleno y vacío, solo cambia el color
export function bar(pct, width, color, empty = '#34324A') {
  const n = Math.round((Math.max(0, Math.min(100, pct ?? 0)) / 100) * width)
  return paint(color, '━'.repeat(n)) + paint(empty, '━'.repeat(Math.max(0, width - n)))
}

// Envuelve texto en líneas de como mucho `width` columnas
export function wrap(text, width) {
  const words = String(text).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur) cur = w
    else if (visibleWidth(`${cur} ${w}`) <= width) cur += ` ${w}`
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines
}
