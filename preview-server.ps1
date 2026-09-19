# 클못 사이트 미리보기용 작은 웹서버.
# 윈도우에 기본으로 들어 있는 파워셸만 쓴다 — 따로 설치할 것이 없다.
# 직접 실행하지 말고 "미리보기.bat" 을 더블클릭할 것.
#
# 왜 필요한가: index.html 을 그냥 더블클릭하면 브라우저가 content 폴더 읽기를 막는다.
# 이 서버를 거치면 인터넷에 올린 것과 똑같은 상태로 볼 수 있다.

param([int]$Port = 8123)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.csv'  = 'text/csv; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.jpg'  = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.png'  = 'image/png';  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'; '.ico' = 'image/x-icon'
}

# 포트가 이미 쓰이고 있으면 다음 번호로 옮겨 본다
$listener = $null
for ($p = $Port; $p -lt ($Port + 10); $p++) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $l.Start(); $listener = $l; $Port = $p; break
  } catch { }
}
if (-not $listener) {
  Write-Host ''
  Write-Host '  [!] 서버를 켤 수 없습니다. 창을 모두 닫고 다시 해보세요.'
  Read-Host '  엔터를 누르면 닫힙니다'
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host '  ----------------------------------------------'
Write-Host "   미리보기 주소 :  $url"
Write-Host '  ----------------------------------------------'
Write-Host ''
Write-Host '   * 브라우저가 자동으로 열립니다.'
Write-Host '   * 파일을 고친 뒤에는 브라우저에서 새로고침(F5) 하세요.'
Write-Host '   * 다 보셨으면 이 검은 창을 그냥 닫으시면 됩니다.'
Write-Host ''
Start-Process $url

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $ns = $client.GetStream()
    $sr = New-Object System.IO.StreamReader($ns, [System.Text.Encoding]::UTF8)

    $req = $sr.ReadLine()
    if (-not $req) { $client.Close(); continue }
    while ($sr.Peek() -ge 0) { if ($sr.ReadLine() -eq '') { break } }   # 헤더는 흘려보낸다

    $path = ($req -split ' ')[1]
    if ($path -match '^(.*?)\?') { $path = $Matches[1] }        # ?id=... 는 떼어낸다
    $path = [System.Uri]::UnescapeDataString($path)             # 한글 폴더 이름 복원
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

    $rel = $path.TrimStart('/') -replace '/', '\'
    $file = Join-Path $root $rel

    # 폴더 밖으로 나가는 요청은 막는다
    $full = [System.IO.Path]::GetFullPath($file)
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) { $full = '' }

    if ($full -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $types[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $status = '200 OK'
    } else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('not found')
      $ct = 'text/plain; charset=utf-8'
      $status = '404 Not Found'
    }

    $head = "HTTP/1.1 $status`r`n" +
            "Content-Type: $ct`r`n" +
            "Content-Length: $($bytes.Length)`r`n" +
            "Cache-Control: no-store`r`n" +
            "Connection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $ns.Write($hb, 0, $hb.Length)
    if ($bytes.Length -gt 0) { $ns.Write($bytes, 0, $bytes.Length) }
    $ns.Flush()
  } catch {
    # 브라우저가 연결을 먼저 끊는 일은 흔하다. 서버는 계속 돈다.
  } finally {
    if ($client) { $client.Close() }
  }
}
