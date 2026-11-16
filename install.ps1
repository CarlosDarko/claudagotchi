# Instalador de Claudagotchi para Windows. No necesita Node.
#   irm https://raw.githubusercontent.com/CarlosDarko/claudagotchi/main/install.ps1 | iex
$ErrorActionPreference = 'Stop'
$repo = 'CarlosDarko/claudagotchi'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\claudagotchi'

Write-Host '🥚 Instalando Claudagotchi...' -ForegroundColor DarkYellow
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$zip = Join-Path $env:TEMP 'claudagotchi.zip'
Invoke-WebRequest "https://github.com/$repo/releases/latest/download/claudagotchi-windows-x64.zip" -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $dir -Force
Remove-Item $zip

# Que el comando 'claudagotchi' funcione en las terminales nuevas
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$dir*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$dir", 'User')
  $env:Path = "$env:Path;$dir"
}

$exe = Join-Path $dir 'claudagotchi.exe'
& $exe instalar

# La mascota de escritorio (pasea por encima de la barra de tareas)
$widget = $null
if (-not $env:CLAUDAGOTCHI_SIN_WIDGET) {
  Write-Host 'Instalando la mascota de escritorio...' -ForegroundColor DarkYellow
  $setup = Join-Path $env:TEMP 'Claudagotchi-setup.exe'
  try {
    Invoke-WebRequest "https://github.com/$repo/releases/latest/download/Claudagotchi-windows-x64-setup.exe" -OutFile $setup -UseBasicParsing
    Start-Process $setup -ArgumentList '/S' -Wait
    Remove-Item $setup -ErrorAction SilentlyContinue
    $app = Join-Path $env:LOCALAPPDATA 'Claudagotchi\claudagotchi-widget.exe'
    if (Test-Path $app) { $widget = $app; Start-Process $app }
  } catch { Write-Host "No he podido instalar la mascota de escritorio: $_" -ForegroundColor Yellow }
}

Write-Host ''
Write-Host "Qué ha cambiado: la barra de estado y los avisos (hooks) de Claude Code en ~/.claude/settings.json, el comando 'claudagotchi' en tu terminal y, con la mascota de escritorio, arrancar con el ordenador. Se quita todo con 'claudagotchi desinstalar' y desde su menú."
Write-Host "Privacidad: https://github.com/$repo/blob/main/docs/privacidad.md"
Write-Host ''
Write-Host 'Listo. Tu mascota ya vive en la barra de abajo de Claude Code.' -ForegroundColor Green
if ($widget) {
  Write-Host 'Y en tu escritorio: pasea por encima de la barra de tareas. Pasa el ratón por encima para verla, clic para cuidarla.'
  Write-Host 'Sus opciones están en el icono junto al reloj.'
}
Write-Host 'Para la vista completa en la terminal, abre una nueva y escribe: claudagotchi'
if (-not $widget -and -not $env:CLAUDAGOTCHI_NO_OPEN) { Start-Sleep -Seconds 1; & $exe }
