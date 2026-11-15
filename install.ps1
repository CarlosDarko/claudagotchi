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
Write-Host ''
Write-Host 'Listo. Tu mascota ya vive en la barra de abajo de Claude Code.' -ForegroundColor Green
Write-Host 'Para verla en grande, abre una terminal nueva y escribe: claudagotchi'
if (-not $env:CLAUDAGOTCHI_NO_OPEN) { Start-Sleep -Seconds 1; & $exe }
