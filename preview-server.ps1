# clemot local preview server (Windows).
#
# NOTE: this file is intentionally ASCII only.
# Windows PowerShell 5.1 reads a .ps1 without a BOM as ANSI (cp949 on Korean Windows),
# which garbles any Korean text in here. Korean messages live in the .bat instead.
#
# Do not run this directly - double click the .bat file next to it.

param([int]$Port = 8123)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.csv'  = 'text/csv; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.png'  = 'image/png'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

# Find a free port, starting at $Port.
$listener = $null
for ($p = $Port; $p -lt ($Port + 10); $p++) {
  try {
    $try = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $try.Start()
    $listener = $try
    $Port = $p
    break
  } catch { }
}
if ($null -eq $listener) {
  Write-Host ''
  Write-Host '  [ERROR] Could not start the preview server.'
  Read-Host '  Press Enter to close'
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host '  ----------------------------------------------'
Write-Host "    $url"
Write-Host '  ----------------------------------------------'
Write-Host ''
Start-Process $url

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 15000
    $ns = $client.GetStream()

    # Read the request head as raw bytes, stopping at the blank line.
    # (A StreamReader with Peek() can block here and the browser then gets nothing.)
    $buf = New-Object byte[] 4096
    $sb = New-Object System.Text.StringBuilder
    while ($true) {
      $n = $ns.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      [void]$sb.Append([System.Text.Encoding]::ASCII.GetString($buf, 0, $n))
      if ($sb.ToString().Contains("`r`n`r`n")) { break }
    }
    $head = $sb.ToString()
    if ($head.Length -eq 0) { $client.Close(); continue }

    $line = ($head -split "`r`n")[0]
    $path = ($line -split ' ')[1]
    if ($null -eq $path) { $path = '/' }
    if ($path.Contains('?')) { $path = $path.Substring(0, $path.IndexOf('?')) }
    $path = [System.Uri]::UnescapeDataString($path)     # restores Korean folder names
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

    $file = Join-Path $root ($path.TrimStart('/').Replace('/', '\'))

    $ok = $false
    try {
      $full = [System.IO.Path]::GetFullPath($file)
      $base = [System.IO.Path]::GetFullPath($root)
      if ($full.StartsWith($base) -and (Test-Path -LiteralPath $full -PathType Leaf)) { $ok = $true }
    } catch { }

    if ($ok) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $types[$ext]
      if ($null -eq $ct) { $ct = 'application/octet-stream' }
      $status = '200 OK'
    } else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('not found')
      $ct = 'text/plain; charset=utf-8'
      $status = '404 Not Found'
    }

    $resp = "HTTP/1.1 $status`r`n" +
            "Content-Type: $ct`r`n" +
            "Content-Length: $($bytes.Length)`r`n" +
            "Cache-Control: no-store`r`n" +
            "Connection: close`r`n`r`n"
    $rb = [System.Text.Encoding]::ASCII.GetBytes($resp)
    $ns.Write($rb, 0, $rb.Length)
    if ($bytes.Length -gt 0) { $ns.Write($bytes, 0, $bytes.Length) }
    $ns.Flush()
  } catch {
    # Browsers drop connections all the time; keep serving.
    # Anything unexpected is printed so it can be screenshotted.
    Write-Host ("  [warn] " + $_.Exception.Message)
  } finally {
    if ($null -ne $client) { $client.Close() }
  }
}
