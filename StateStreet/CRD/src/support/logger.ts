type LogLevel = 'info' | 'warning' | 'error';

const color = {
    info: '\u001b[90m',
    warning: '\u001b[33m',
    error: '\u001b[31m',
    reset: '\u001b[39m',
};

export function log(message: string, level: LogLevel = 'info'): void {
    console.log(`      ${color[level]}${message}${color.reset}`);
}
