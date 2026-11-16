# Envía Claudagotchi a winget (el catálogo oficial de Windows). Se ejecuta una vez,
# en Windows, desde PowerShell:
#   irm https://raw.githubusercontent.com/CarlosDarko/claudagotchi/main/winget/enviar.ps1 | iex
# Te pedirá iniciar sesión en GitHub en el navegador para abrir la propuesta.
$ErrorActionPreference = 'Stop'
$version = '0.5.10'
$base = "https://raw.githubusercontent.com/CarlosDarko/claudagotchi/main/winget/manifests/c/CarlosDarko/Claudagotchi/$version"
$dir = Join-Path $env:TEMP "claudagotchi-winget\$version"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
foreach ($f in 'CarlosDarko.Claudagotchi.yaml', 'CarlosDarko.Claudagotchi.installer.yaml', 'CarlosDarko.Claudagotchi.locale.en-US.yaml', 'CarlosDarko.Claudagotchi.locale.es-ES.yaml') {
  Invoke-WebRequest "$base/$f" -OutFile (Join-Path $dir $f) -UseBasicParsing
}
if (-not (Get-Command wingetcreate -ErrorAction SilentlyContinue)) {
  Write-Host 'Instalando la herramienta oficial de Microsoft (wingetcreate)...'
  winget install --id Microsoft.WingetCreate -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
Write-Host 'Comprobando los ficheros...'
winget validate --manifest $dir
Write-Host 'Enviando la propuesta a Microsoft (se abrirá GitHub en el navegador)...'
wingetcreate submit $dir
