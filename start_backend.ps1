# Starts FastAPI backend in background and waits for health check
# Location: project root (same dir as fastapi_server.py)
# Usage (manual): powershell -NoProfile -ExecutionPolicy Bypass -File .\start_backend.ps1

$ErrorActionPreference = "Stop"

# Ensure we're at the repository root
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

# Prefer local venv if available
$venvActivate = Join-Path $repoRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    . $venvActivate
}

# Start backend in background on 127.0.0.1:8000 using Start-Process (more robust)
$python = "python"
try {
    $pycmd = Get-Command python -ErrorAction Stop
    if ($pycmd -and $pycmd.Source) { $python = $pycmd.Source }
} catch { }

$outLog = Join-Path $repoRoot ".backend.out.log"
$errLog = Join-Path $repoRoot ".backend.err.log"
if (Test-Path $outLog) { Remove-Item $outLog -Force -ErrorAction SilentlyContinue }
if (Test-Path $errLog) { Remove-Item $errLog -Force -ErrorAction SilentlyContinue }

$uvicornArgs = @(
    "-m","uvicorn","fastapi_server:app",
    "--host","127.0.0.1",
    "--port","8000",
    "--reload"
)

Start-Process -FilePath $python -ArgumentList $uvicornArgs -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog

# Wait for health endpoint to become available
$healthUrl = "http://127.0.0.1:8000/health"
$maxAttempts = 120  # ~36s
$attempt = 0
$ready = $false

while (-not $ready -and $attempt -lt $maxAttempts) {
    Start-Sleep -Milliseconds 300
    try {
        $resp = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
        if ($resp.ok -eq $true) {
            $ready = $true
            break
        }
    }
    catch {
        # ignore until ready
    }
    $attempt++
}

if (-not $ready) {
    Write-Error "Backend health check did not become ready at $healthUrl"
    if (Test-Path $errLog) {
        Write-Host "---- backend stderr (tail) ----"
        Get-Content $errLog -Tail 100 | ForEach-Object { Write-Host $_ }
    }
    if (Test-Path $outLog) {
        Write-Host "---- backend stdout (tail) ----"
        Get-Content $outLog -Tail 50 | ForEach-Object { Write-Host $_ }
    }
    exit 1
}

Write-Host "Backend is ready at $healthUrl"
exit 0
