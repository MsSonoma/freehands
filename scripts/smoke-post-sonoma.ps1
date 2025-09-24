param()
# Build JSON body safely in PowerShell and POST to /api/sonoma
$ErrorActionPreference = 'Stop'
try {
  $obj = [ordered]@{
    instruction = 'teaching'
    innertext   = ''
    session     = @{ phase = 'discussion' }
  }
  $body = $obj | ConvertTo-Json -Depth 5 -Compress
  try {
    $res = Invoke-WebRequest -Uri 'http://localhost:3001/api/sonoma' -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
    Write-Output $res.StatusCode
  } catch {
    if ($_.Exception.Response) {
      Write-Output ([int]$_.Exception.Response.StatusCode)
    } else {
      Write-Output 'ERR'
    }
  }
} catch {
  Write-Output 'ERR'
  exit 1
}
