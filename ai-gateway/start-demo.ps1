# ─────────────────────────────────────────────────────────────
#  Date Buffet 발표용 AI 공유 시작
#  우클릭 → "PowerShell에서 실행"  또는  터미널에서:  .\ai-gateway\start-demo.ps1
#
#  1) Ollama가 켜져 있는지 확인
#  2) AI 문지기(소개팅 설명만 통과) 실행  → http://localhost:8787
#  3) Cloudflare 임시 터널 실행           → https://xxxx.trycloudflare.com
#  4) 다른 사람에게 보낼 "공유 링크" 출력
#  이 창을 닫거나 Ctrl + C 를 누르면 문지기와 터널이 함께 꺼져요.
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$site = 'https://sally5o2i.github.io/date-buffet-llm/'

Write-Host "`n=== Date Buffet 발표용 AI 공유 ===`n" -ForegroundColor Magenta

# 1) Ollama 확인
try {
  $v = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 3
  Write-Host "✅ Ollama 실행 중 (v$($v.version))"
} catch {
  Write-Host "❌ Ollama가 꺼져 있어요. Ollama를 먼저 실행한 뒤 다시 시도해 주세요." -ForegroundColor Red
  Read-Host '엔터를 누르면 닫혀요'; exit 1
}

# cloudflared 찾기
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  foreach ($p in "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe") {
    if (Test-Path $p) { $cf = $p }
  }
}
if (-not $cf) {
  Write-Host "❌ cloudflared(터널 프로그램)가 없어요. 아래 명령으로 설치한 뒤 창을 새로 열어 주세요:" -ForegroundColor Red
  Write-Host "   winget install --id Cloudflare.cloudflared" -ForegroundColor Yellow
  Read-Host '엔터를 누르면 닫혀요'; exit 1
}

# 2) 문지기 실행
$tsx = Join-Path $root 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsx)) { Write-Host '패키지를 설치하는 중… (처음 한 번만)'; npm ci --no-audit --no-fund | Out-Null }
$gw = Start-Process -FilePath 'node' -ArgumentList "`"$tsx`"", 'ai-gateway/server.ts' -PassThru -NoNewWindow
Start-Sleep -Seconds 3

# 3) 터널 실행 (주소는 실행할 때마다 새로 생겨요)
$log = Join-Path $env:TEMP 'date-buffet-tunnel.log'
if (Test-Path $log) { Remove-Item $log }
$tunnel = Start-Process -FilePath $cf -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:8787' -RedirectStandardError $log -PassThru -WindowStyle Hidden

$url = $null
for ($i = 0; $i -lt 40 -and -not $url; $i++) {
  Start-Sleep -Milliseconds 750
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}

try {
  if (-not $url) { throw '터널 주소를 받지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요.' }
  $share = "${site}?ai=$url"
  Write-Host "`n✅ 준비 완료!  아래 링크를 발표 화면이나 QR로 공유하세요:`n" -ForegroundColor Green
  Write-Host "   $share`n" -ForegroundColor Cyan
  try { Set-Clipboard -Value $share; Write-Host '   (클립보드에 복사했어요)' } catch {}
  Write-Host "`n이 창을 켜 두는 동안만 AI 설명이 동작해요. 끝내려면 Ctrl + C`n"
  Wait-Process -Id $tunnel.Id
} catch {
  Write-Host "❌ $_" -ForegroundColor Red
} finally {
  foreach ($p in @($tunnel, $gw)) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
  Write-Host '문지기와 터널을 껐어요.'
}
