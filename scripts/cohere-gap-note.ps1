param(
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$Prompt,
  [string[]]$Anchors = @(),
  [string[]]$KeyFiles = @(),
  [string]$OutDir = "docs/reference/cohere/gaps"
)

$ErrorActionPreference = 'Stop'

function Get-Slug([string]$Text) {
  $t = ""
  if ($null -ne $Text) { $t = $Text }
  $t = $t.ToLowerInvariant().Trim()
  $t = [Regex]::Replace($t, '[^a-z0-9]+', '-')
  $t = $t.Trim('-')
  if ([string]::IsNullOrWhiteSpace($t)) { return 'note' }
  return $t
}

$utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd_HHmmss')
$slug = Get-Slug $Title

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$path = Join-Path $OutDir "${stamp}Z_${slug}.md"

$anchorsBlock = if ($Anchors.Count -gt 0) { ($Anchors | ForEach-Object { "- $_" }) -join "`n" } else { "- (add anchors: routes, exact UI labels, component names, API paths)" }
$keyFilesBlock = if ($KeyFiles.Count -gt 0) { ($KeyFiles | ForEach-Object { "- $_" }) -join "`n" } else { "- (add key files / entrypoints)" }

@" 
# Recon Gap Note: $Title

Date (UTC): $utc

## Recon prompt (exact)

$Prompt

## Anchors

$anchorsBlock

## What the user sees / can do

- 

## Key files / entrypoints

$keyFilesBlock

## Notes

- 

## Suggested next recon prompt

Where is <route/feature> implemented? Include the user-visible controls and the API/storage it reads/writes.
"@ | Set-Content -Path $path -Encoding UTF8

Write-Host "Wrote: $path"
Write-Host "Next: ingest it"
Write-Host "  `$env:COHERE_HOME = \"`$env:USERPROFILE\.coherence_apps\ms_sonoma\"; py -m cohere ingest $path --project freehands"
