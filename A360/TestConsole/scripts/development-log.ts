/**
 * Formats and persists timestamped TestConsole development-process output.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

export const formatLocalTimestamp = (date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

export const developmentLogPath = (
  date = new Date(),
  localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
): string =>
  path.join(
    localAppData,
    'A360',
    'PATH',
    'TestConsole',
    'logs',
    `test-console-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.log`,
  );

export const stripTerminalControls = (text: string): string =>
  text
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');

export const formatDevelopmentMessage = (
  source: 'DEV' | 'API' | 'UI',
  message: string,
  date = new Date(),
): string => `[${formatLocalTimestamp(date)}] [${source}] ${message}\n`;

export class DevelopmentLog {
  constructor(readonly filePath = developmentLogPath()) {
    mkdirSync(path.dirname(filePath), { recursive: true });
  }

  append(text: string): void {
    appendFileSync(this.filePath, stripTerminalControls(text), 'utf8');
  }
}