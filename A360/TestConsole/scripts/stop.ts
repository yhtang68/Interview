/**
 * Stops TestConsole listeners only after verifying that their processes belong to this project.
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface Listener {
  port: number;
  processId: number;
  commandLine: string | null;
}

const PORTS = [4310, 5173];
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const normalizeWindowsPath = (value: string) => value.replaceAll('/', '\\').toLowerCase();

export function isTestConsoleProcess(commandLine: string | null, root: string) {
  if (!commandLine) return false;
  const command = normalizeWindowsPath(commandLine);
  const normalizedRoot = normalizeWindowsPath(resolve(root));
  if (!command.includes(`${normalizedRoot}\\`)) return false;
  return (
    command.includes('server\\index.ts') ||
    (command.includes('\\node_modules\\') && command.includes('\\vite\\bin\\vite.js'))
  );
}

const runPowerShell = (script: string) =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();

const listeners = (): Listener[] => {
  const ports = PORTS.join(',');
  const output = runPowerShell(`
    $items = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.LocalPort -in @(${ports}) } |
      ForEach-Object {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"
        [PSCustomObject]@{
          port = $_.LocalPort
          processId = $_.OwningProcess
          commandLine = $owner.CommandLine
        }
      })
    [PSCustomObject]@{ items = $items } | ConvertTo-Json -Compress -Depth 3
  `);
  return (JSON.parse(output) as { items: Listener[] }).items;
};

const wait = (milliseconds: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export async function stopTestConsole() {
  if (process.platform !== 'win32') {
    throw new Error('npm run stop currently supports the Windows TestConsole environment only.');
  }
  const active = listeners();
  if (!active.length) {
    console.log('TestConsole is already stopped; ports 4310 and 5173 are free.');
    return;
  }
  const unknown = active.filter((listener) => !isTestConsoleProcess(listener.commandLine, projectRoot));
  if (unknown.length) {
    const targets = unknown.map(({ port, processId }) => `port ${port} (PID ${processId})`).join(', ');
    throw new Error(`Refusing to stop unrecognized process on ${targets}.`);
  }
  const processIds = [...new Set(active.map(({ processId }) => processId))];
  runPowerShell(`Stop-Process -Id @(${processIds.join(',')}) -Force -ErrorAction Stop`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!listeners().length) {
      console.log(`Stopped TestConsole API and UI; ports ${PORTS.join(' and ')} are free.`);
      return;
    }
    await wait(100);
  }
  throw new Error('TestConsole processes were stopped, but one or more ports are still in use.');
}

const invokedDirectly =
  Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  try {
    await stopTestConsole();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
