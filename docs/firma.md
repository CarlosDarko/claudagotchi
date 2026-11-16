# Code signing policy / Política de firma de código

*English below.*

## Castellano

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

Los instaladores de Windows de Claudagotchi se firman gracias a [SignPath.io](https://about.signpath.io), con un certificado de [SignPath Foundation](https://signpath.org), que firma gratis proyectos de código abierto.

- **Qué se firma**: solo lo que compila GitHub Actions a partir de este repositorio público (`.github/workflows/release.yml`). Nunca se firma nada compilado a mano.
- **Quién decide**: los cambios entran en la rama `main` del repositorio. Cada versión publicada se firma después de que el responsable la apruebe en SignPath.
- **Equipo**:
  - Autor y aprobador de las firmas: [@CarlosDarko](https://github.com/CarlosDarko)
  - Revisores: [@CarlosDarko](https://github.com/CarlosDarko)
- **Cuentas**: las cuentas con permiso para publicar usan verificación en dos pasos.
- **Privacidad**: [política de privacidad](privacidad.md). No tiene telemetría y cada conexión se puede desactivar.

## English

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

- **What is signed**: only artifacts built by GitHub Actions from this public repository (`.github/workflows/release.yml`). Nothing built locally is ever signed.
- **Process**: changes land on the `main` branch of this repository. Each release is signed after the maintainer approves the signing request in SignPath.
- **Team roles**:
  - Committer and approver: [@CarlosDarko](https://github.com/CarlosDarko)
  - Reviewer: [@CarlosDarko](https://github.com/CarlosDarko)
- **Accounts**: accounts with release permissions use multi-factor authentication.
- **Privacy**: see the [privacy policy](privacidad.md). This program does not transfer any information to networked systems except the Anthropic usage API, the GitHub release check and, only if you set a city, the Open-Meteo weather API. Each can be turned off. No telemetry.
