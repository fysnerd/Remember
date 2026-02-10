import type { Request, Response } from 'express';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'dashboard-sse' });

// Connected SSE clients (in-memory per PM2 worker -- acceptable for 1-2 admin connections)
const clients = new Set<Response>();

export function sseHandler(req: Request, res: Response) {
  // SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  clients.add(res);
  log.info({ clientCount: clients.size }, 'SSE client connected');

  // Heartbeat every 30s to keep connection alive through Caddy
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    log.info({ clientCount: clients.size }, 'SSE client disconnected');
  });
}

/**
 * Broadcast a job lifecycle event to all connected SSE clients.
 * Called from jobExecutionTracker when jobs start, succeed, or fail.
 */
export function broadcastJobEvent(event: {
  type: 'job_started' | 'job_completed' | 'job_failed';
  jobName: string;
  status: string;
  triggerSource: string;
  duration?: number;
  error?: string;
}) {
  const payload = { ...event, timestamp: new Date().toISOString() };
  const message = `data: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      // Client disconnected but close event hasn't fired yet
      clients.delete(client);
    }
  }
}
