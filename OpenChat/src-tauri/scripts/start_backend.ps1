# Starts FastAPI backend in background and waits for health check
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\start_backend.ps1

$ErrorActionPreference = "Stop"

# Resolve repo root (three levels up from src-tauri/scripts)
$repoRoot = Resolve-Path "$PSScriptRoot\..\..\.."
Set-Location $repoRoot

# Prefer local venv if available
$venvActivate = Join-Path $repoRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    . $venvActivate
}

# Ensure uvicorn is available (installed via pyproject)
# Start backend in background on 127.0.0.1:8000
$backendCmd = "python -m uvicorn fastapi_server:app --host 127.0.0.1 --port 8000 --reload"

# Start the process detached and capture PID
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = "powershell.exe"
$startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command `$env:PAGER='cat'; $backendCmd"
$startInfo.WorkingDirectory = $repoRoot
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$null = [System.Diagnostics.Process]::Start($startInfo)

# Wait for health endpoint to become available
$healthUrl = "http://127.0.0.1:8000/health"
$maxAttempts = 50
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
    exit 1
}

Write-Host "Backend is ready at $healthUrl"
exit 0
