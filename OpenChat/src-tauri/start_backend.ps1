# Starts FastAPI backend in background and waits for health check
# Location: OpenChat/src-tauri (Tauri runs beforeDevCommand here)
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\start_backend.ps1

$ErrorActionPreference = "Stop"

# Resolve repository root (two levels up from src-tauri -> OpenChat project root)
$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $repoRoot

# Delegate to root start script, which handles venv, logging and health check
& "$repoRoot\start_backend.ps1"
$code = $LASTEXITCODE
exit $code
