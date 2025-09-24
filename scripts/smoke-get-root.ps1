param()
$ErrorActionPreference = 'Stop'
try {
  $res = Invoke-WebRequest -Uri 'http://localhost:3001/' -UseBasicParsing
  Write-Output $res.StatusCode
} catch {
  if ($_.Exception.Response) {
    Write-Output ([int]$_.Exception.Response.StatusCode)
  } else {
    Write-Output 'ERR'
  }
  exit 1
}
