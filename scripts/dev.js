#!/usr/bin/env node
const { spawn } = require('child_process');

// Respect PORT if provided, default to 3001
const port = process.env.PORT || '3001';

// On Windows, spawn PowerShell to kill any existing listener on the port before starting
const isWin = process.platform === 'win32';

function killPort(p, cb) {
  if (!isWin) return cb();
  const ps = spawn('powershell', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', 'scripts/kill-port-3001.ps1', String(p)
  ], { stdio: 'inherit' });
  ps.on('exit', () => cb());
}

killPort(port, () => {
  // Spawn Next directly; use local next without installing
  const npx = isWin ? 'npx.cmd' : 'npx';
  const child = spawn(npx, ['--no-install', 'next', 'dev', '-p', String(port)], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) }
  });
  child.on('exit', (code) => process.exit(code));
});
