param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Logs = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

$BackendOut = Join-Path $Logs "backend.log"
$BackendErr = Join-Path $Logs "backend.err.log"
$FrontendOut = Join-Path $Logs "frontend.log"
$FrontendErr = Join-Path $Logs "frontend.err.log"

foreach ($LogPath in @($BackendOut, $BackendErr, $FrontendOut, $FrontendErr)) {
  if (Test-Path $LogPath) {
    Clear-Content -Path $LogPath -ErrorAction SilentlyContinue
  }
}

function Stop-PortListener {
  param([int]$Port)

  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $OwnerId = $_.OwningProcess
    if ($OwnerId -and $OwnerId -ne $PID) {
      Stop-Process -Id $OwnerId -Force -ErrorAction SilentlyContinue
    }
  }
}

Get-Process | Where-Object {
  try {
    $_.Path -and $_.Path.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)
  } catch {
    $false
  }
} | Stop-Process -Force -ErrorAction SilentlyContinue

Stop-PortListener -Port $BackendPort
Stop-PortListener -Port $FrontendPort
Start-Sleep -Milliseconds 500

$Backend = Start-Process -FilePath "F:/python/python.exe" `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$BackendPort") `
  -WorkingDirectory (Join-Path $Root "backend") `
  -RedirectStandardOutput $BackendOut `
  -RedirectStandardError $BackendErr `
  -WindowStyle Hidden `
  -PassThru

$Frontend = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--", "--host", "0.0.0.0", "--port", "$FrontendPort") `
  -WorkingDirectory (Join-Path $Root "frontend") `
  -RedirectStandardOutput $FrontendOut `
  -RedirectStandardError $FrontendErr `
  -WindowStyle Hidden `
  -PassThru

Write-Host "Backend PID: $($Backend.Id)  http://localhost:$BackendPort"
Write-Host "Frontend PID: $($Frontend.Id)  http://localhost:$FrontendPort"
Write-Host "Backend log: $BackendOut"
Write-Host "Frontend log: $FrontendOut"
