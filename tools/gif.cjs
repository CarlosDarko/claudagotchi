// Graba un GIF del widget (paseo, chispas de Claude y tarjeta) para el README.
// Uso: node tools/gif.cjs widget/dist/mock.json docs/img/claudagotchi.gif
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { execFileSync } = require('node:child_process')
;(async () => {
  const [mockFile, out] = process.argv.slice(2)
  const root = path.resolve(__dirname, '../widget/dist')
  const srv = http.createServer((q, r) => fs.readFile(path.join(root, q.url), (e, d) => (e ? r.writeHead(404).end() : r.writeHead(200, { 'Content-Type': q.url.endsWith('.js') ? 'text/javascript' : 'text/html' }).end(d)))).listen(0)
  const W = 900, H = 330
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await p.addInitScript((m) => { window.__MOCK__ = m }, JSON.parse(fs.readFileSync(mockFile, 'utf8')))
  await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.background = 'linear-gradient(160deg,#1d3b5c 0%,#5a4a7a 55%,#c0766a 100%)' }))
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`)
  await p.waitForTimeout(1200)
  await p.evaluate(() => { const S = window.__claudagotchi; S.x = 800; S.target = 560; S.idleUntil = 0 })
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gif-'))
  let n = 0
  const shot = async () => p.screenshot({ path: path.join(dir, `f${String(n++).padStart(3, '0')}.png`) })
  for (let i = 0; i < 22; i++) { await shot(); await p.waitForTimeout(110) }
  await p.evaluate(() => window.__claudagotchiSparks(180000))
  for (let i = 0; i < 26; i++) { await shot(); await p.waitForTimeout(110) }
  await p.evaluate(() => { window.__claudagotchiFx.hearts(); window.__claudagotchi.happyUntil = Date.now() + 3000; window.__claudagotchiFx.say('✻ ¡Gracias por los tokens!', false, 4000) })
  for (let i = 0; i < 20; i++) { await shot(); await p.waitForTimeout(110) }
  await b.close()
  srv.close()
  execFileSync('convert', ['-delay', '11', '-loop', '0', path.join(dir, 'f*.png'), '-layers', 'Optimize', '-colors', '128', out])
  console.log(out, fs.statSync(out).size)
})()
