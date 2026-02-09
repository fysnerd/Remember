import { pinoHttp } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../config/logger.js';

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req: IncomingMessage) => req.url === '/health',
  },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (_req: IncomingMessage, _res: ServerResponse, err: Error) => {
    return `Request failed: ${err.message}`;
  },
});
