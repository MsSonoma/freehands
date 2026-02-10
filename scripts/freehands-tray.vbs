' Freehands tray launcher (no terminal)
' Double-click this .vbs or make a desktop shortcut to it.

Option Explicit

Dim shell, fso, repoRoot, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
repoRoot = fso.GetAbsolutePathName(fso.GetParentFolderName(WScript.ScriptFullName) & "\..")

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File " & Chr(34) & repoRoot & "\scripts\freehands-tray.ps1" & Chr(34)

shell.Run cmd, 0, False
