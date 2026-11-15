// Captura el widget en el navegador sobre un escritorio simulado (para revisar el diseño).
// Uso: node tools/widget-preview.cjs <mock.json> <salida.png> [hover]
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
;(async () => {
  const [mockFile, out, mode] = process.argv.slice(2)
  const mock = JSON.parse(fs.readFileSync(mockFile, 'utf8'))
  const http = require('node:http')
  const root = path.resolve(__dirname, '../widget/dist')
  const srv = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]))
    fs.readFile(f, (e, d) => {
      if (e) return res.writeHead(404).end()
      res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }).end(d)
    })
  }).listen(0)
  const port = srv.address().port
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 760, height: 470 }, deviceScaleFactor: 2 })
  await p.addInitScript((m) => { window.__MOCK__ = m }, mock)
  await p.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.background = 'linear-gradient(160deg,#1d3b5c 0%,#5a4a7a 55%,#c0766a 100%)'
    })
  })
  p.on('pageerror', (e) => console.error('ERROR', e.message))
  await p.goto(`http://127.0.0.1:${port}/index.html`)
  await p.waitForTimeout(1500)
  if (mode === 'hover') {
    const st = await p.evaluate(() => ({ x: window.__claudagotchi.x }))
    await p.mouse.move(st.x, 470 - 25)
    await p.waitForTimeout(700)
  }
  await p.screenshot({ path: out })
  await b.close()
  srv.close()
})()
