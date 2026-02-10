import type { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { getBackfill, subscribe } from './logs.tailer.js';

const log = logger.child({ component: 'logs-sse' });

const clients = new Set<Response>();

export function logsSseHandler(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send backfill (last 100 lines)
  const backfill = getBackfill(100);
  res.write(`event: backfill\ndata: ${JSON.stringify(backfill)}\n\n`);

  clients.add(res);
  log.info({ clientCount: clients.size }, 'Logs SSE client connected');

  // Subscribe to live lines
  const unsubscribe = subscribe((line) => {
    try {
      res.write(`event: log\ndata: ${JSON.stringify(line)}\n\n`);
    } catch {
      clients.delete(res);
      unsubscribe();
    }
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      // cleanup will happen on close
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    unsubscribe();
    log.info({ clientCount: clients.size }, 'Logs SSE client disconnected');
  });
}
