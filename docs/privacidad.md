# Privacidad / Privacy policy

*English below.*

## Castellano

Claudagotchi no tiene servidores propios, no tiene telemetría y no recoge datos tuyos. Todo lo que guarda está en tu equipo, en `~/.claudagotchi/` (en Windows, `C:\Users\<tú>\.claudagotchi\`).

Solo se conecta a estos sitios, y cada conexión se puede desactivar:

| A dónde | Para qué | Qué envía | Cómo desactivarlo |
|---|---|---|---|
| `api.anthropic.com` y `platform.claude.com` (Anthropic) | Leer el % de uso de tu cuenta de Claude | Tu token de sesión de Claude (el de Claude Code o el que conectes en la mascota) | ⚙ → 'Consultar mi % a Anthropic', o `claudagotchi desconectar` |
| `api.github.com` y `github.com` (GitHub) | Saber si hay versión nueva y descargarla | Nada tuyo: una petición normal | ⚙ → 'Buscar versiones nuevas' |
| `geocoding-api.open-meteo.com` y `api.open-meteo.com` (Open-Meteo) | El tiempo real del escenario | El nombre de la ciudad que escribas y sus coordenadas | Solo funciona si pones una ciudad; bórrala en ⚙ |

Lee tus registros locales de Claude Code (`~/.claude/projects`) para contar tokens, pero nunca los envía a ningún sitio.

Políticas de privacidad de esos servicios: [Anthropic](https://www.anthropic.com/legal/privacy), [GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement), [Open-Meteo](https://open-meteo.com/en/terms#privacy).

## English

Claudagotchi has no servers of its own, no telemetry and collects no data about you. Everything it stores stays on your machine, in `~/.claudagotchi/`.

It only connects to the services above (Anthropic for your usage %, GitHub for update checks, Open-Meteo for the weather if you set a city). Each one can be turned off in the ⚙ settings tab. Your local Claude Code logs are read to count tokens but are never sent anywhere.
