Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$logPath = Join-Path $env:TEMP 'freehands-tray.log'
function Write-Log([string]$message) {
  try {
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $logPath -Value ("[$ts] $message")
  } catch {}
}

try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
} catch {
  Write-Log ('Add-Type failed: ' + $_.Exception.Message)
  throw
}

try {

function Get-RepoRoot {
  $scriptDir = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $scriptDir '..')).Path
}

$repoRoot = Get-RepoRoot
$iconPath = Join-Path $repoRoot 'public\ms-sonoma.ico'
$killScript = Join-Path $repoRoot 'scripts\kill-port-3001.ps1'

Write-Log ('Starting tray. RepoRoot=' + $repoRoot)
Write-Log ('IconPath=' + $iconPath)

$devProcess = $null

function Show-Note([string]$title, [string]$text) {
  try {
    $notify.BalloonTipTitle = $title
    $notify.BalloonTipText = $text
    $notify.ShowBalloonTip(3000)
  } catch {}
}

function Invoke-Npm([string[]]$args) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'cmd.exe'
  $psi.Arguments = '/c ' + ('npm ' + ($args -join ' '))
  $psi.WorkingDirectory = $repoRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $out = $p.StandardOutput.ReadToEnd()
  $err = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  if ($p.ExitCode -ne 0) {
    throw "npm $($args -join ' ') failed ($($p.ExitCode)): $err"
  }

  return $out
}

function Stop-Server {
  try {
    if (Test-Path $killScript) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File $killScript | Out-Null
    }
  } catch {}

  try {
    if ($devProcess -and -not $devProcess.HasExited) {
      $devProcess.Kill()
    }
  } catch {}

  $script:devProcess = $null
  $notify.Text = 'Freehands (stopped)'
}

function Start-Server {
  Stop-Server

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'cmd.exe'
  $psi.Arguments = '/c npm run dev'
  $psi.WorkingDirectory = $repoRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $p.EnableRaisingEvents = $true

  $null = Register-ObjectEvent -InputObject $p -EventName Exited -Action {
    $notify.Text = 'Freehands (stopped)'
    Show-Note 'Freehands' 'Dev server exited.'
  }

  [void]$p.Start()
  $script:devProcess = $p
  $notify.Text = 'Freehands (running on :3001)'
}

function Clean-And-Restart {
  Stop-Server
  Show-Note 'Freehands' 'Cleaning build caches...'
  try {
    Invoke-Npm @('run','-s','clean') | Out-Null
  } catch {
    Show-Note 'Freehands' ('Clean failed: ' + $_.Exception.Message)
  }
  Start-Server
}

function Restart-Server {
  Stop-Server
  Start-Server
}

function Open-Browser {
  try { Start-Process 'http://localhost:3001' } catch {}
}

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Visible = $true
$notify.Text = 'Freehands (stopped)'

Write-Log 'NotifyIcon created and set Visible=true'

if (Test-Path $iconPath) {
  try { $notify.Icon = New-Object System.Drawing.Icon($iconPath) } catch {}
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$miOpen = New-Object System.Windows.Forms.ToolStripMenuItem('Open http://localhost:3001')
$miOpen.add_Click({ Open-Browser })

$miStart = New-Object System.Windows.Forms.ToolStripMenuItem('Start server')
$miStart.add_Click({
  try { Start-Server; Show-Note 'Freehands' 'Dev server starting on :3001' } catch { Show-Note 'Freehands' $_.Exception.Message }
})

$miRestart = New-Object System.Windows.Forms.ToolStripMenuItem('Restart server')
$miRestart.add_Click({
  try { Restart-Server; Show-Note 'Freehands' 'Dev server restarted' } catch { Show-Note 'Freehands' $_.Exception.Message }
})

$miCleanRestart = New-Object System.Windows.Forms.ToolStripMenuItem('Clean + Restart')
$miCleanRestart.add_Click({
  try { Clean-And-Restart; Show-Note 'Freehands' 'Clean + restart triggered' } catch { Show-Note 'Freehands' $_.Exception.Message }
})

$miStop = New-Object System.Windows.Forms.ToolStripMenuItem('Stop server')
$miStop.add_Click({
  try { Stop-Server; Show-Note 'Freehands' 'Dev server stopped' } catch { Show-Note 'Freehands' $_.Exception.Message }
})

$miExit = New-Object System.Windows.Forms.ToolStripMenuItem('Exit tray (and stop server)')
$miExit.add_Click({
  try { Stop-Server } catch {}
  $notify.Visible = $false
  $notify.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

[void]$menu.Items.Add($miOpen)
[void]$menu.Items.Add('-')
[void]$menu.Items.Add($miStart)
[void]$menu.Items.Add($miRestart)
[void]$menu.Items.Add($miCleanRestart)
[void]$menu.Items.Add($miStop)
[void]$menu.Items.Add('-')
[void]$menu.Items.Add($miExit)

$notify.ContextMenuStrip = $menu
$notify.add_DoubleClick({ Open-Browser })

Show-Note 'Freehands' 'Tray ready. Starting dev server on :3001...'
Write-Log 'Auto-starting dev server'

try {
  Start-Server
  Show-Note 'Freehands' 'Dev server starting on :3001'
  Write-Log 'Dev server start triggered'
} catch {
  Write-Log ('Dev server start failed: ' + $_.Exception.Message)
  Show-Note 'Freehands' ('Start failed. See log: ' + $logPath)
}

Write-Log 'Tray ready; entering message loop'

[System.Windows.Forms.Application]::Run()

} catch {
  try {
    Write-Log ('FATAL: ' + $_.Exception.Message)
    Write-Log ($_.Exception.ToString())
  } catch {}

  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      "Freehands tray failed to start.\n\nLog: $logPath\n\nError: $($_.Exception.Message)",
      'Freehands Tray',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {}

  throw
}
