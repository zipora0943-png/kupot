# Quick uploader for an already-built APK + manifest update.
# Run from anywhere — paths are resolved relative to this script.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\upload-apk.ps1
#
# Prompts for admin credentials, logs in to /api/auth/login, then uploads
# the APK at android/app/build/outputs/apk/debug/app-debug.apk together
# with version + notes from package.json.

$ErrorActionPreference = 'Stop'

$Server = 'http://178.105.96.70:3000'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $ScriptDir '..')
$ApkPath = Join-Path $Root 'android\app\build\outputs\apk\debug\app-debug.apk'
$PkgPath = Join-Path $Root 'package.json'

if (-not (Test-Path $ApkPath)) {
  Write-Host "✖ APK not found at $ApkPath" -ForegroundColor Red
  Write-Host "  Run 'npm run release -- --skip-upload' first." -ForegroundColor Yellow
  exit 1
}

$pkg = Get-Content $PkgPath -Raw | ConvertFrom-Json
$version = $pkg.version
Write-Host "→ Server : $Server"
Write-Host "→ Version: $version"
Write-Host "→ APK    : $ApkPath  ($([math]::Round((Get-Item $ApkPath).Length/1MB,2)) MB)"
Write-Host ""

# ── 1. Login ─────────────────────────────────────────────────────
$user = Read-Host 'Admin username'
$secPass = Read-Host 'Admin password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
$pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

$loginBody = @{ username = $user; password = $pass } | ConvertTo-Json
try {
  $loginRes = Invoke-RestMethod -Method Post -Uri "$Server/api/auth/login" `
              -Body $loginBody -ContentType 'application/json'
} catch {
  Write-Host "✖ Login failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
$token = $loginRes.token
if (-not $token) { Write-Host '✖ No token in response' -ForegroundColor Red; exit 1 }
Write-Host '✓ Logged in.' -ForegroundColor Green

# ── 2. Upload APK (multipart) ───────────────────────────────────
Write-Host ''
Write-Host 'Uploading APK...'

# Build multipart body manually — Invoke-RestMethod -Form is finicky on
# older PowerShell; raw HttpClient is reliable.
Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization =
  New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $token)

$form  = New-Object System.Net.Http.MultipartFormDataContent

$fileStream  = [System.IO.File]::OpenRead($ApkPath)
$fileContent = New-Object System.Net.Http.StreamContent($fileStream)
$fileContent.Headers.ContentType =
  New-Object System.Net.Http.Headers.MediaTypeHeaderValue('application/vnd.android.package-archive')
$form.Add($fileContent, 'apk', 'app-debug.apk')

$form.Add((New-Object System.Net.Http.StringContent($version)), 'version')
$notes = 'Google Maps view + city-locked geocoding (tasks 61-63)'
$form.Add((New-Object System.Net.Http.StringContent($notes)),   'release_notes')

try {
  $response = $client.PostAsync("$Server/api/version/collector", $form).GetAwaiter().GetResult()
  $body     = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) {
    Write-Host "✖ Upload failed ($($response.StatusCode)):" -ForegroundColor Red
    Write-Host $body
    exit 1
  }
  Write-Host '✓ Upload succeeded.' -ForegroundColor Green
  Write-Host $body
}
finally {
  $fileStream.Dispose()
  $client.Dispose()
}

Write-Host ''
Write-Host "✔ Version $version is live. Devices on older versions will see the update banner within a minute." -ForegroundColor Green
