// Convierte la salida ANSI de "claudagotchi foto" en HTML, para generar capturas.
// Uso: node bin/claudagotchi.js foto 110 32 --demo 6 | node tools/ansi2html.js > out.html
const xterm = (n) => {
  if (n < 16) return ['#000', '#c00', '#0c0', '#cc0', '#00c', '#c0c', '#0cc', '#ccc', '#555', '#f55', '#5f5', '#ff5', '#55f', '#f5f', '#5ff', '#fff'][n]
  if (n >= 232) { const v = 8 + (n - 232) * 10; return `rgb(${v},${v},${v})` }
  n -= 16
  const c = [0, 95, 135, 175, 215, 255]
  return `rgb(${c[Math.floor(n / 36)]},${c[Math.floor(n / 6) % 6]},${c[n % 6]})`
}
let input = ''
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  let fg = null, bg = null, b = false, dim = false
  let html = ''
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  for (const part of input.split(/(\x1b\[[0-9;]*m)/)) {
    const m = part.match(/^\x1b\[([0-9;]*)m$/)
    if (!m) {
      if (!part) continue
      const style = [fg && `color:${fg}`, bg && `background:${bg}`, b && 'font-weight:bold', dim && 'opacity:.6'].filter(Boolean).join(';')
      html += style ? `<span style="${style}">${esc(part)}</span>` : esc(part)
      continue
    }
    const codes = (m[1] || '0').split(';').map(Number)
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i]
      if (c === 0) { fg = bg = null; b = dim = false }
      else if (c === 1) b = true
      else if (c === 2) dim = true
      else if (c === 22) b = dim = false
      else if (c === 39) fg = null
      else if (c === 49) bg = null
      else if (c === 38 || c === 48) {
        let col
        if (codes[i + 1] === 2) { col = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`; i += 4 }
        else { col = xterm(codes[i + 2]); i += 2 }
        if (c === 38) fg = col
        else bg = col
      }
    }
  }
  process.stdout.write(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1b1a24"><pre style="margin:0;padding:14px 16px;color:#e8e6f0;font:15px/1.2 'DejaVu Sans Mono',Menlo,monospace">${html}</pre></body>`)
})
