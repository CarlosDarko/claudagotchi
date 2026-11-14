import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scan, emptyIndex, ingest, lastDays, sumBy, burnRate, toolKind } from '../src/logs.js'
import { dayKey } from '../src/util.js'

const now = Date.now()
const line = (o) => `${JSON.stringify(o)}\n`
const asst = (id, ts, usage, extra = {}) => ({
  type: 'assistant', timestamp: new Date(ts).toISOString(), requestId: `r${id}`, cwd: '/home/ana/proyecto-x',
  message: { id: `m${id}`, model: 'claude-opus-5-5', usage, content: [{ type: 'tool_use', name: 'Edit' }] }, ...extra,
})

test('suma tokens, separa la comida de la caché y no cuenta duplicados', () => {
  const idx = emptyIndex()
  const seen = new Set()
  const u = { input_tokens: 10, output_tokens: 90, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 }
  ingest(idx, asst(1, now - 1000, u), 'f', seen)
  ingest(idx, asst(1, now - 1000, u), 'f', seen) // repetido por streaming
  ingest(idx, asst(2, now - 500, u), 'f', seen)
  const d = idx.days[dayKey(now - 500)]
  assert.equal(d.tokens, 2 * 1200)
  assert.equal(d.food, 2 * 200)
  assert.equal(d.models.opus, 2400)
  assert.equal(d.projects['proyecto-x'], 2400)
  assert.equal(idx.totals.models.opus, 400)
  assert.equal(idx.lastTool, 'Edit')
  assert.equal(toolKind(idx.lastTool), 'editando')
})

test('escaneo incremental: solo lee lo nuevo y espera a las líneas completas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-'))
  fs.mkdirSync(path.join(dir, '-home-ana-proyecto-x'))
  const f = path.join(dir, '-home-ana-proyecto-x', 's.jsonl')
  const u = { input_tokens: 0, output_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
  fs.writeFileSync(f, line(asst(1, now - 60_000, u)) + line({ type: 'user', timestamp: new Date(now - 30_000).toISOString() }))
  let idx = scan({ dir, save: false, now })
  assert.equal(idx.totals.tokens, 1000)
  assert.equal(idx.lastActivity, now - 30_000)
  // Línea a medio escribir: no se cuenta todavía
  const half = line(asst(2, now - 10_000, u))
  fs.appendFileSync(f, half.slice(0, 40))
  idx = scan({ dir, index: idx, save: false, now })
  assert.equal(idx.totals.tokens, 1000)
  fs.appendFileSync(f, half.slice(40))
  idx = scan({ dir, index: idx, save: false, now })
  assert.equal(idx.totals.tokens, 2000)
  assert.ok(burnRate(idx, now, 5) > 0)
})

test('consultas de días y rankings', () => {
  const idx = emptyIndex()
  idx.days[dayKey(now)] = { tokens: 5, models: { opus: 3, haiku: 2 }, projects: {} }
  const days = lastDays(idx, 7, now)
  assert.equal(days.length, 7)
  assert.equal(days[6].tokens, 5)
  assert.deepEqual(sumBy(days, 'models'), [['opus', 3], ['haiku', 2]])
})
