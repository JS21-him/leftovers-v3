type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, data?: unknown): void {
  if (!__DEV__) return;
  const prefix = `[${level.toUpperCase()}]`;
  if (data !== undefined) {
    // eslint-disable-next-line no-console
    console[level](`${prefix} ${message}`, data);
  } else {
    // eslint-disable-next-line no-console
    console[level](`${prefix} ${message}`);
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
};
