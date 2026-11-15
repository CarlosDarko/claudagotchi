# Instalar Claudagotchi (instrucciones para Claude Code)

Este fichero está escrito para que lo siga Claude Code cuando alguien le pide instalar Claudagotchi. Si eres una persona, también te sirve: son los mismos pasos.

Claudagotchi es una mascota tipo tamagotchi que vive en la barra de estado de Claude Code y en la terminal, y se alimenta del uso de Claude. Es de código abierto, con licencia MIT: https://github.com/CarlosDarko/claudagotchi

## Qué cambia en el ordenador

Antes de instalar, cuéntaselo al usuario en una o dos frases:

- Descarga un programa (unos 40 MB) en `~/.claudagotchi/bin` en macOS y Linux, o en `%LOCALAPPDATA%\Programs\claudagotchi` en Windows, y añade esa carpeta al PATH.
- Instala la mascota de escritorio, una ventanita transparente que pasea por encima de la barra de tareas y arranca con el ordenador (se puede quitar desde su icono junto al reloj). En Windows queda en `%LOCALAPPDATA%\Claudagotchi`, en macOS en `~/Applications/Claudagotchi.app` y en Linux en `~/.claudagotchi/bin/Claudagotchi.AppImage`. Si el usuario no la quiere, añade `CLAUDAGOTCHI_SIN_WIDGET=1` al comando del paso 1.
- Activa los avisos de Claude Code (hooks Notification y Stop en `~/.claude/settings.json`, sin tocar los que ya hubiera) para que la mascota avise cuando Claude necesita permiso o termina.
- Pone la mascota como barra de estado de Claude Code, en `~/.claude/settings.json` (clave `statusLine`). Si ya había otra, la guarda, y `claudagotchi desinstalar` la devuelve.
- Guarda los datos de la mascota en `~/.claudagotchi/`. Lee los logs de Claude Code de `~/.claude/projects` y no envía nada a ningún sitio, salvo la consulta del % de uso a la API de Anthropic con el login que Claude Code ya tiene.

## Pasos

1. **Instala.** No hace falta Node. Pon `CLAUDAGOTCHI_NO_OPEN=1` para que no intente abrir la interfaz animada, que necesita una terminal interactiva.

   En macOS o Linux:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/CarlosDarko/claudagotchi/main/install.sh | CLAUDAGOTCHI_NO_OPEN=1 bash
   ```

   En Windows (PowerShell):

   ```powershell
   $env:CLAUDAGOTCHI_NO_OPEN=1; irm https://raw.githubusercontent.com/CarlosDarko/claudagotchi/main/install.ps1 | iex
   ```

2. **Comprueba que funciona.** Debe imprimir una línea con un huevo 🥚 y un nombre:

   ```bash
   ~/.claudagotchi/bin/claudagotchi estado
   ```

   En Windows: `& "$env:LOCALAPPDATA\Programs\claudagotchi\claudagotchi.exe" estado`

3. **Cuéntale al usuario cómo seguir**, con estas ideas y en su idioma:
   - Su mascota ya está en su escritorio, en una islita con su casa, paseando por encima de la barra de tareas. Pasando el ratón por encima se ven sus necesidades y su % de uso, y con un clic se la cuida. Sus opciones (tamaño, mostrar el % siempre, arrancar con el ordenador) están en su icono junto al reloj.
   - También vive en la barra de abajo de Claude Code. Si no la ve, que cierre y vuelva a abrir Claude Code.
   - Ahora es un huevo y eclosiona en cuanto use Claude Code un poco. Come de los tokens que gasta programando.
   - Para verla en grande y cuidarla: abrir una terminal nueva y escribir `claudagotchi`. La primera vez sale una ayuda. Las teclas: `C` comer, `J` jugar, `L` limpiar, `M` medicina, `?` ayuda, `Q` salir.
   - Para ver todo lo que puede hacer sin esperar: `claudagotchi demo`.
   - Para actualizar: `claudagotchi actualizar`. Para quitarla de la barra: `claudagotchi desinstalar`.

## Si algo falla

- **La descarga falla** (por ejemplo, porque aún no hay una versión publicada): el instalador prueba solo con `npm` si Node está instalado. Si tampoco hay Node, dile al usuario que vuelva a probar en un rato o que instale Node desde nodejs.org.
- **`claudagotchi: command not found`** en la misma sesión: es normal, el PATH nuevo vale para las terminales que se abran después. Usa la ruta completa del paso 2.
- **Windows bloquea el script**: ejecuta antes `Set-ExecutionPolicy -Scope Process Bypass`.
