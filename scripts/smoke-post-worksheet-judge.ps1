param()
# Post a simulated worksheet judging instruction to /api/sonoma
$ErrorActionPreference = 'Stop'
try {
  $instr = 'Worksheet judging (provided): Question number: 2 of 10. Question asked: "What is 3 + 4?" 3) If correct (not final): output the items in order: reaction, cue, encouragement, next question as final. The second sentence must be exactly: "Here''s the next worksheet question." NEXT_WORKSHEET_QUESTION: What is 5 + 2?'
  $obj = [ordered]@{
    instruction = $instr
    innertext   = '7'
  }
  $body = $obj | ConvertTo-Json -Depth 5 -Compress
  try {
    $res = Invoke-WebRequest -Uri 'http://localhost:3001/api/sonoma' -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
    Write-Output $res.StatusCode
    # Parse JSON and print only the reply (avoid huge base64 audio)
    try {
      $json = $res.Content | ConvertFrom-Json -ErrorAction Stop
      if ($null -ne $json.reply) { Write-Output $json.reply } else { Write-Output $res.Content }
    } catch {
      Write-Output $res.Content
    }
  } catch {
    if ($_.Exception.Response) {
      Write-Output ([int]$_.Exception.Response.StatusCode)
      try { $sr = New-Object IO.StreamReader $_.Exception.Response.GetResponseStream(); $txt = $sr.ReadToEnd(); $sr.Close(); Write-Output $txt } catch {}
    } else {
      Write-Output 'ERR'
    }
  }
} catch {
  Write-Output 'ERR'
  exit 1
}
