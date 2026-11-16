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
      const { installHooks } = await import('../src/hooks.js')
      await refresh({ allowNetwork: false })
      installHooks()
      return console.log(`${install()}\n${t('cli.avisosSi')}`)
    }
    case 'desinstalar':
    case 'uninstall': {
      const { uninstall } = await import('../src/install.js')
      const { uninstallHooks } = await import('../src/hooks.js')
      uninstallHooks()
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
    case 'json': {
      // Para el widget de escritorio
      const { snapshot } = await import('../src/snapshot.js')
      const { getWeather, checkUpdate } = await import('../src/world.js')
      const [data, weather, update] = await Promise.all([refresh(), getWeather().catch(() => null), checkUpdate().catch(() => null)])
      return process.stdout.write(JSON.stringify(snapshot({ ...data, weather, update })))
    }
    case 'accion':
    case 'action': {
      const { doAction } = await import('../src/store.js')
      const { snapshot } = await import('../src/snapshot.js')
      const { getLimits } = await import('../src/account.js')
      const { scan } = await import('../src/logs.js')
      let res
      if (args[0] === 'nuevo') {
        newEgg()
        res = { ok: true, msg: '' }
      } else res = doAction(args[0], args[1] ?? null).res
      const index = scan()
      const { loadPet } = await import('../src/store.js')
      const limits = await getLimits({ allowNetwork: false })
      return process.stdout.write(JSON.stringify({ res, state: snapshot({ pet: loadPet(index), index, limits }) }))
    }
    case 'ciudad':
    case 'city': {
      const { setCity } = await import('../src/world.js')
      const c = await setCity(args.join(' ')).catch(() => null)
      return console.log(c ? t('cli.ciudad', { city: `${c.name} (${c.country})` }) : t('cli.ciudadNo'))
    }
    case 'widget-config': {
      // claudagotchi widget-config '{"scale":3}'
      const { loadConfig } = await import('../src/store.js')
      const cfg = loadConfig()
      saveConfig({ widget: { ...(cfg.widget || {}), ...JSON.parse(args[0] || '{}') } })
      return process.stdout.write(JSON.stringify(loadConfig().widget))
    }
    case 'hook': {
      // Lo llama Claude Code (Notification, Stop). Lee su JSON y guarda el aviso.
      const { handleHook } = await import('../src/hooks.js')
      let input = {}
      if (!process.stdin.isTTY) {
        const chunks = []
        for await (const c of process.stdin) chunks.push(c)
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch {}
      }
      return handleHook(args[0] || 'fin', input)
    }
    case 'avisos':
    case 'alerts': {
      const { installHooks, uninstallHooks } = await import('../src/hooks.js')
      const off = ['no', 'off'].includes(args[0])
      if (off) uninstallHooks()
      else installHooks()
      return console.log(off ? t('cli.avisosNo') : t('cli.avisosSi'))
    }
    case 'conectar':
    case 'login': {
      const { beginLogin, completeLogin } = await import('../src/account.js')
      const code = args.filter((a) => !a.startsWith('--')).join(' ')
      if (!code) {
        const url = beginLogin({ open: !args.includes('--no-abrir') })
        return console.log(args.includes('--url') ? url : t('cli.conectar', { url }))
      }
      const r = await completeLogin(code)
      return console.log(r.ok ? t('cli.conectado') : t('cli.noConectado', { error: r.error }))
    }
    case 'desconectar':
    case 'logout': {
      const { logout } = await import('../src/account.js')
      logout()
      return console.log(t('cli.desconectado'))
    }
    case 'diagnostico':
    case 'doctor': {
      const { diagnose } = await import('../src/account.js')
      return console.log(await diagnose())
    }
    case 'actualizar':
    case 'update': {
      // Vuelve a pasar el instalador: descarga la última versión y no toca la mascota
      const { spawnSync } = await import('node:child_process')
      const { REPO } = await import('../src/version.js')
      const base = `https://raw.githubusercontent.com/${REPO}/main`
      const env = { ...process.env, CLAUDAGOTCHI_NO_OPEN: '1' }
      const r = process.platform === 'win32'
        ? spawnSync('powershell', ['-NoProfile', '-Command', `irm ${base}/install.ps1 | iex`], { stdio: 'inherit', env })
        : spawnSync('bash', ['-c', `curl -fsSL ${base}/install.sh | bash`], { stdio: 'inherit', env })
      return process.exit(r.status ?? 1)
    }
    case 'version':
    case '--version':
    case '-v': {
      const { VERSION } = await import('../src/version.js')
      return console.log(`claudagotchi ${VERSION}`)
    }
    default:
      console.log(t('cli.ayuda', { dir: DATA_DIR, langs: Object.keys(LOCALES).join(', ') }))
  }
}

main().catch((e) => {
  if (cmd === 'statusline' || cmd === 'hook') {
    if (cmd === 'hook') return
    // La statusline nunca debe romper Claude Code: si algo falla, una línea discreta
    process.stdout.write('🥚 claudagotchi\n')
    return
  }
  console.error(e)
  process.exit(1)
})
