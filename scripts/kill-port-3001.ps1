param(
  [int]$Port = 3001
)
$ErrorActionPreference = 'SilentlyContinue'
Get-NetTCPConnection -LocalPort $Port -State Listen | ForEach-Object {
  try { Stop-Process -Id $_.OwningProcess -Force } catch {}
}
