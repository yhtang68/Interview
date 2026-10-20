/**
 * Runs the API and Vite development servers with catalog progress and clean shutdown output.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';

import concurrently, { type Command, Logger } from 'concurrently';

import {
  DevelopmentLog,
  formatDevelopmentMessage,
} from './development-log.js';
import { TerminalSpinner, terminalSpinnerStyle } from './terminal-spinner.js';

let shuttingDown = false;
const defaults = JSON.parse(readFileSync(new URL('../config/defaults.json', import.meta.url), 'utf8')) as {
  developmentConfig?: { terminalSpinnerStyle?: string };
};
const spinnerStyle = terminalSpinnerStyle(defaults.developmentConfig?.terminalSpinnerStyle);
const catalogSpinner = new TerminalSpinner(process.stdout, spinnerStyle);
const developmentLog = new DevelopmentLog();

const writeDevMessage = (message: string): void => {
  const line = formatDevelopmentMessage('DEV', message);
  process.stdout.write(line);
  developmentLog.append(line);
};

class DevLogger extends Logger {
  override logCommandEvent(text: string, command: Command) {
    if (shuttingDown) return;
    catalogSpinner.pause();
    super.logCommandEvent(text, command);
    catalogSpinner.resume();
  }

  override logCommandText(text: string, command: Command) {
    if (shuttingDown) return;
    catalogSpinner.pause();
    super.logCommandText(text, command);
    if (text.includes('Catalog indexed') || text.includes('Catalog indexing failed')) {
      catalogSpinner.stop();
    } else if (text.includes('Catalog indexing started')) {
      catalogSpinner.start('[API] Indexing Test Catalog...');
    } else {
      catalogSpinner.resume();
    }
  }

  override logGlobalEvent(text: string) {
    if (shuttingDown) return;
    catalogSpinner.pause();
    super.logGlobalEvent(text);
    catalogSpinner.resume();
  }
}

const beginShutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  catalogSpinner.stop();
  process.stdout.write('\n');
  writeDevMessage('Stopping Test Console...');
};

process.once('SIGINT', beginShutdown);
process.once('SIGTERM', beginShutdown);

const logger = new DevLogger({
  prefixFormat: '[{time}] [{name}]',
  timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
});
logger.output.subscribe(({ text }) => developmentLog.append(text));
writeDevMessage(`Starting Test Console. Log: ${developmentLog.filePath}`);

const { result } = concurrently(
  [
    {
      command: 'tsx watch server/index.ts',
      name: 'API',
      prefixColor: 'magenta',
    },
    {
      command: 'node scripts/wait-for-api.mjs && vite',
      name: 'UI',
      prefixColor: 'cyan',
    },
  ],
  {
    logger,
    killOthersOn: ['success', 'failure'],
  },
);

try {
  await result;
} catch {
  if (!shuttingDown) process.exitCode = 1;
} finally {
  catalogSpinner.stop();
}
