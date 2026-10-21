# ─────────────────────────────────────────────────────────────
#  Date Buffet 발표용 AI 공유 시작
#  터미널에서:  powershell -ExecutionPolicy Bypass -File .\ai-gateway\start-demo.ps1
#
#  1) Ollama가 켜져 있는지 확인
#  2) AI 문지기(소개팅 설명만 통과) 실행  → http://localhost:8787
#  3) Cloudflare 임시 터널 실행           → https://xxxx.trycloudflare.com
#  4) 다른 사람에게 보낼 "공유 링크" 출력
#  이 창을 닫거나 Ctrl + C 를 누르면 문지기와 터널이 함께 꺼져요.
#
#  ※ 이 파일은 한글이 깨지지 않도록 'UTF-8 (BOM)'으로 저장해야 해요.
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$site = 'https://sally5o2i.github.io/date-buffet-llm/'
$port = 8787

function Stop-Here([string]$msg) {
  Write-Host ''
  Write-Host "❌ $msg" -ForegroundColor Red
  Write-Host ''
  exit 1
}

Write-Host ''
Write-Host '=== Date Buffet 발표용 AI 공유 ===' -ForegroundColor Magenta
Write-Host ''

# 1) Ollama 확인
try {
  $v = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 3
  Write-Host "✅ Ollama 실행 중 (v$($v.version))"
} catch {
  Stop-Here 'Ollama가 꺼져 있어요. Ollama를 먼저 실행한 뒤 다시 시도해 주세요.'
}

# 2) cloudflared(터널 프로그램) 찾기 — 설치 직후 PATH가 아직 안 바뀐 창에서도 찾을 수 있게
$cf = $null
$cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cmd) { $cf = $cmd.Source }
if (-not $cf) {
  $candidates = @(
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
  )
  $pathDirs = ([Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')) -split ';'
  foreach ($d in $pathDirs) { if ($d) { $candidates += (Join-Path $d 'cloudflared.exe') } }
  foreach ($p in $candidates) {
    if ($p -and (Test-Path $p)) { $cf = $p; break }
  }
}
if (-not $cf) {
  Write-Host ''
  Write-Host '❌ cloudflared(터널 프로그램)가 설치돼 있지 않아요.' -ForegroundColor Red
  Write-Host '   아래 명령을 실행해 설치한 뒤, 이 스크립트를 다시 실행해 주세요:' -ForegroundColor Red
  Write-Host ''
  Write-Host '   winget install --id Cloudflare.cloudflared' -ForegroundColor Yellow
  Write-Host ''
  exit 1
}
Write-Host "✅ 터널 프로그램 확인: $cf"

# 3) 문지기 포트가 이미 쓰이고 있으면 (지난번에 덜 꺼진 문지기) 정리
$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($c in @($busy)) {
  if (-not $c) { continue }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"
  if ($proc.CommandLine -like '*ai-gateway*server.ts*') {
    Stop-Process -Id $proc.ProcessId -Force
    Write-Host '   (지난번에 켜 둔 문지기를 정리했어요)'
  } else {
    Stop-Here "포트 $port 를 다른 프로그램이 쓰고 있어요: $($proc.Name)"
  }
}

$tsx = Join-Path $root 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsx)) {
  Write-Host '패키지를 설치하는 중… (처음 한 번만)'
  npm ci --no-audit --no-fund | Out-Null
}

$gw = $null
$tunnel = $null
try {
  # 문지기 실행
  $gw = Start-Process -FilePath 'node' -ArgumentList "`"$tsx`"", 'ai-gateway/server.ts' -PassThru -NoNewWindow
  Start-Sleep -Seconds 3
  if ($gw.HasExited) { throw '문지기 서버를 시작하지 못했어요.' }

  # 터널 실행 (주소는 실행할 때마다 새로 생겨요)
  $log = Join-Path $env:TEMP 'date-buffet-tunnel.log'
  if (Test-Path $log) { Remove-Item $log -Force }
  $tunnel = Start-Process -FilePath $cf -ArgumentList 'tunnel', '--no-autoupdate', '--url', "http://localhost:$port" -RedirectStandardError $log -PassThru -WindowStyle Hidden

  Write-Host '⏳ 인터넷 주소를 만드는 중… (10초 정도)'
  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Milliseconds 500
    if ($tunnel.HasExited) { break }
    if (Test-Path $log) {
      $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value }
    }
  }
  if (-not $url) { throw "터널 주소를 받지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요. (기록: $log)" }

  $share = "$site`?ai=$url"
  Write-Host ''
  Write-Host '✅ 준비 완료! 아래 링크를 발표 화면이나 QR로 공유하세요:' -ForegroundColor Green
  Write-Host ''
  Write-Host "   $share" -ForegroundColor Cyan
  Write-Host ''
  try { Set-Clipboard -Value $share; Write-Host '   (클립보드에 복사했어요)' } catch {}
  Write-Host ''
  Write-Host '이 창을 켜 두는 동안만 AI 설명이 동작해요. 끝내려면 Ctrl + C'
  Write-Host ''
  Wait-Process -Id $tunnel.Id
} catch {
  Write-Host ''
  Write-Host "❌ $_" -ForegroundColor Red
} finally {
  foreach ($p in @($tunnel, $gw)) {
    if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
  Write-Host '문지기와 터널을 껐어요.'
}
