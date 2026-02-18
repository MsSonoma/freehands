param(
  [Parameter(Mandatory=$true)][string]$Prompt,
  [string]$Profile = "MsSonoma",
  [string]$Out = "sidekick_pack.md",
  [string]$JournalOut = "sidekick_rounds.jsonl",
  [string]$Project = "freehands",
  [string]$CohereHome = "$env:USERPROFILE\.coherence_apps\ms_sonoma",
  [switch]$AutoIngest,
  [switch]$AutoGapNote,
  [int]$MinAnchorHits = 1,
  [string]$AuditLog = "cohere-recon-audit.jsonl"
)

$ErrorActionPreference = 'Stop'

function Normalize([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s.ToLowerInvariant())
}

function Get-AnchorsFromPrompt([string]$p) {
  $text = ""
  if ($null -ne $p) { $text = $p }
  $anchors = New-Object System.Collections.Generic.List[string]

  # 1) Paths / routes / globs that start with '/'
  foreach ($m in [Regex]::Matches($text, "(?<![A-Za-z0-9])(/[A-Za-z0-9_\-\.\[\]\*\/]+)")) {
    $v = $m.Groups[1].Value
    if ($v.Length -ge 4) { $anchors.Add($v) }
  }

  # 2) src/... style
  foreach ($m in [Regex]::Matches($text, "(?<![A-Za-z0-9])(src/[A-Za-z0-9_\-\.\[\]\*\/]+)")) {
    $v = $m.Groups[1].Value
    if ($v.Length -ge 6) { $anchors.Add($v) }
  }

  # 3) api/... style
  foreach ($m in [Regex]::Matches($text, "(?<![A-Za-z0-9])(api/[A-Za-z0-9_\-\.\[\]\*\/]+)")) {
    $v = $m.Groups[1].Value
    if ($v.Length -ge 6) { $anchors.Add($v) }
  }

  # 4) Backticked literals (often component names or exact strings)
  foreach ($m in [Regex]::Matches($text, '`([^`]{3,80})`')) {
    $v = $m.Groups[1].Value.Trim()
    if ($v.Length -ge 3) { $anchors.Add($v) }
  }

  # De-dupe, keep stable order
  $seen = @{}
  $uniq = New-Object System.Collections.Generic.List[string]
  foreach ($a in $anchors) {
    $k = Normalize $a
    if (-not $seen.ContainsKey($k)) {
      $seen[$k] = $true
      $uniq.Add($a)
    }
  }
  return ,$uniq
}

function Guess-IngestTargets([System.Collections.Generic.List[string]]$anchors) {
  $targets = New-Object System.Collections.Generic.List[string]

  $add = {
    param([string]$t)
    if ([string]::IsNullOrWhiteSpace($t)) { return }
    if (-not $targets.Contains($t)) { $targets.Add($t) }
  }

  foreach ($a in $anchors) {
    $aa = $a.Trim()

    # Route → app folder heuristic
    if ($aa -match "^/facilitator(/|$)") { & $add "src/app/facilitator" }
    if ($aa -match "^/api(/|$)") { & $add "src/app/api" }

    # src/... provided
    if ($aa -match "^src/") {
      $path = $aa
      # If a file glob / deep path, ingest the top two segments as a directory (src/app, src/lib, etc.)
      $parts = $path.Split('/')
      if ($parts.Length -ge 3) {
        & $add ("{0}/{1}/{2}" -f $parts[0], $parts[1], $parts[2])
      } elseif ($parts.Length -ge 2) {
        & $add ("{0}/{1}" -f $parts[0], $parts[1])
      } else {
        & $add $path
      }
    }

    if ($aa -match "^docs/brain") { & $add "docs/brain" }
  }

  return ,$targets
}

# Ensure isolated Cohere home is set for the invoked commands
if (-not [string]::IsNullOrWhiteSpace($CohereHome)) {
  $env:COHERE_HOME = $CohereHome
}

Write-Host "[cohere-recon] Running Sidekick recon..." -ForegroundColor Cyan
py -m cohere sk r -a $Profile -t $Prompt --out $Out --journal-out $JournalOut | Out-Null

if (-not (Test-Path $Out)) {
  throw "Expected pack output '$Out' was not created."
}

$packText = Get-Content -Path $Out -Raw -ErrorAction Stop
$anchors = Get-AnchorsFromPrompt $Prompt

# Sidekick packs embed the full prompt near the top. To avoid counting
# prompt-self-matches as evidence, search within the Ranked Evidence section.
$searchText = $packText
$rankedIdx = $packText.IndexOf("## Ranked Evidence", [StringComparison]::OrdinalIgnoreCase)
if ($rankedIdx -ge 0) {
  $searchText = $packText.Substring($rankedIdx)
}

# Sidekick can (sometimes) cite the pack output itself as ranked evidence.
# That creates false-positive anchor hits (the anchors appear simply because
# they're in the pack header). Strip evidence blocks for the current pack/journal.
$outName = [System.IO.Path]::GetFileName($Out)
$journalName = [System.IO.Path]::GetFileName($JournalOut)
if (-not [string]::IsNullOrWhiteSpace($outName)) {
  $searchText = [Regex]::Replace(
    $searchText,
    "(?ms)^###\\s+\\d+\\.\\s+" + [Regex]::Escape($outName) + "\\b.*?(?=^###\\s+\\d+\\.|\\z)",
    ""
  )
}
if (-not [string]::IsNullOrWhiteSpace($journalName)) {
  $searchText = [Regex]::Replace(
    $searchText,
    "(?ms)^###\\s+\\d+\\.\\s+" + [Regex]::Escape($journalName) + "\\b.*?(?=^###\\s+\\d+\\.|\\z)",
    ""
  )
}

# Strip prompt metadata blocks anywhere in the search text so we don't
# count self-referential hits (the prompt and its derived filter terms).
$searchText = [Regex]::Replace(
  $searchText,
  '(?ms)Prompt \(original\):\s*```text\s*.*?\s*```',
  ""
)
$searchText = [Regex]::Replace(
  $searchText,
  '(?ms)Filter terms used:\s*```text\s*.*?\s*```',
  ""
)
$searchText = [Regex]::Replace(
  $searchText,
  '(?ms)^##\s+Question\s*\r?\n.*?(?=^##\s+|\z)',
  ""
)

$anchorHits = 0
$hitAnchors = @()
foreach ($a in $anchors) {
  if ([string]::IsNullOrWhiteSpace($a)) { continue }
  if ($searchText.IndexOf($a, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
    $anchorHits += 1
    $hitAnchors += $a
  }
}

# Heuristic: if we extracted anchors and none (or too few) appear, treat as suspicious.
$suspicious = $false
if ($anchors.Count -gt 0 -and $anchorHits -lt [Math]::Max($MinAnchorHits, 1)) {
  $suspicious = $true
}

$ingested = @()
$gapNote = $null

if ($suspicious) {
  Write-Host "[cohere-recon] Pack looks suspicious (anchorHits=$anchorHits, anchors=$($anchors.Count))." -ForegroundColor Yellow

  if ($AutoIngest) {
    $targets = Guess-IngestTargets $anchors
    foreach ($t in $targets) {
      if (Test-Path $t) {
        Write-Host "[cohere-recon] Auto-ingesting: $t" -ForegroundColor Yellow
        py -m cohere ingest $t --project $Project --recursive | Out-Null
        $ingested += $t
      }
    }
  }

  if ($AutoGapNote) {
    try {
      $title = "Recon gap: " + ($anchors | Select-Object -First 1)
      if ([string]::IsNullOrWhiteSpace($title) -or $title.Length -lt 10) { $title = "Recon gap" }
      $anchorArgs = @()
      foreach ($a in ($anchors | Select-Object -First 10)) { $anchorArgs += $a }

      $cmd = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "scripts/cohere-gap-note.ps1",
        "-Title", $title,
        "-Prompt", $Prompt
      )
      if ($anchorArgs.Count -gt 0) {
        $cmd += "-Anchors"
        $cmd += $anchorArgs
      }

      $outText = & powershell @cmd
      # The gap note script prints: "Wrote: <path>" on the first line.
      $first = ($outText | Select-Object -First 1)
      if ($first -match "^Wrote:\s+(.+)$") {
        $gapNote = $Matches[1].Trim()
      }
    } catch {
      # Non-fatal
    }
  }
} else {
  Write-Host "[cohere-recon] Pack looks OK (anchorHits=$anchorHits, anchors=$($anchors.Count))." -ForegroundColor Green
}

# Append audit entry (repo-local) so it can be ingested/timeline’d
$utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$audit = [ordered]@{
  ts_utc = $utc
  profile = $Profile
  out = $Out
  journal = $JournalOut
  prompt = $Prompt
  anchors = @($anchors)
  anchorHits = $anchorHits
  hitAnchors = @($hitAnchors)
  suspicious = $suspicious
  autoIngest = [bool]$AutoIngest
  ingested = @($ingested)
  autoGapNote = [bool]$AutoGapNote
  gapNotePath = $gapNote
}

($audit | ConvertTo-Json -Depth 6 -Compress) + "`n" | Add-Content -Path $AuditLog -Encoding UTF8

if ($AutoIngest -and (Test-Path $AuditLog)) {
  py -m cohere ingest $AuditLog --project $Project | Out-Null
}

Write-Host "[cohere-recon] Done. suspicious=$suspicious anchorHits=$anchorHits" -ForegroundColor Cyan
if ($gapNote) { Write-Host "[cohere-recon] Gap note: $gapNote" -ForegroundColor Cyan }
