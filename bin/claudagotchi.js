#!/usr/bin/env node
// Punto de entrada. Sin dependencias: solo Node 18+.
import { DATA_DIR } from '../src/paths.js'
import { initLocale, refresh, newEgg, rename, saveConfig } from '../src/store.js'
import { LOCALES, setLocale, t } from '../src/i18n/index.js'

const [cmd, ...args] = process.argv.slice(2)
initLocale()

async function main() {
  switch (cmd) {
    case undefined:
    case 'abrir':
    case 'open': {
      if (!process.stdout.isTTY) return console.log(t('cli.noTTY'))
      const { startTui } = await import('../src/tui.js')
      return startTui()
    }
    case 'demo': {
      const { startTui } = await import('../src/tui.js')
      const { demoIterator } = await import('../src/demo.js')
      return startTui({ demo: demoIterator() })
    }
    case 'foto':
    case 'snapshot': {
      // Un fotograma de la interfaz, para compartir o para probar sin terminal interactiva
      const { renderFrame } = await import('../src/tui.js')
      const W = Number(args[0]) || process.stdout.columns || 110
      const H = Number(args[1]) || process.stdout.rows || 32
      let data
      if (args.includes('--demo')) {
        const { demoFrame } = await import('../src/demo.js')
        data = demoFrame(Number(args[args.indexOf('--demo') + 1]) || 0)
      } else data = await refresh()
      const tab = args.includes('--uso') ? 1 : args.includes('--logros') ? 2 : args.includes('--album') ? 3 : 0
      return console.log(renderFrame({ tab, frame: 3, data, flash: null, happyUntil: 0, game: null, help: args.includes('--ayuda') }, W, H).replace(/\x1b\[K/g, ''))
    }
    case 'statusline': {
      const { runStatusline } = await import('../src/statusline.js')
      return runStatusline()
    }
    case 'estado':
    case 'status': {
      const { renderStatusline } = await import('../src/statusline.js')
      const data = await refresh()
      return console.log(renderStatusline({ ...data, width: process.stdout.columns || 140 }))
    }
    case 'instalar':
    case 'install': {
      const { install } = await import('../src/install.js')
      await refresh({ allowNetwork: false })
      return console.log(install())
    }
    case 'desinstalar':
    case 'uninstall': {
      const { uninstall } = await import('../src/install.js')
      return console.log(uninstall())
    }
    case 'nombre':
    case 'name': {
      if (!args.length) return console.log(t('cli.ayuda', { dir: DATA_DIR, langs: Object.keys(LOCALES).join(', ') }))
      const p = rename(args.join(' '))
      return console.log(p ? t('cli.renombrado', { name: p.name }) : t('cli.sinMascota'))
    }
    case 'nuevo':
    case 'new': {
      const p = newEgg(args.join(' ') || null)
      return console.log(p.events.at(-1)?.text || '')
    }
    case 'idioma':
    case 'lang': {
      const lang = setLocale(args[0])
      saveConfig({ lang })
      return console.log(t('cli.idioma', { lang }))
    }
    default:
      console.log(t('cli.ayuda', { dir: DATA_DIR, langs: Object.keys(LOCALES).join(', ') }))
  }
}

main().catch((e) => {
  if (cmd === 'statusline') {
    // La statusline nunca debe romper Claude Code: si algo falla, una línea discreta
    process.stdout.write('🥚 claudagotchi\n')
    return
  }
  console.error(e)
  process.exit(1)
})
