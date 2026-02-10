import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'log-tailer' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogLine {
  id: number;
  source: 'stdout' | 'stderr';
  raw: string;
  level: string;
  msg: string;
  component: string;
  time: string;
}

type Listener = (line: LogLine) => void;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PM2_LOG_DIR = path.join(process.env.HOME || '/root', '.pm2', 'logs');
const OUT_PATTERN = /^remember-api-out-\d+\.log$/;
const ERR_PATTERN = /^remember-api-error-\d+\.log$/;
const RING_SIZE = 500;
const BACKFILL_BYTES = 64 * 1024; // 64KB for initial backfill

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const ring: LogLine[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const offsets = new Map<string, number>();
let started = false;

// ---------------------------------------------------------------------------
// Pino level mapping
// ---------------------------------------------------------------------------

const PINO_LEVELS: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

function parsePinoLevel(level: unknown): string {
  if (typeof level === 'number') return PINO_LEVELS[level] || 'info';
  if (typeof level === 'string') return level;
  return 'info';
}

// ---------------------------------------------------------------------------
// Parse a single log line
// ---------------------------------------------------------------------------

function parseLine(raw: string, source: 'stdout' | 'stderr'): LogLine {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { id: nextId++, source, raw: trimmed, level: 'info', msg: '', component: '', time: new Date().toISOString() };
  }

  try {
    const obj = JSON.parse(trimmed);
    return {
      id: nextId++,
      source,
      raw: trimmed,
      level: parsePinoLevel(obj.level),
      msg: obj.msg || obj.message || trimmed,
      component: obj.component || '',
      time: obj.time || new Date().toISOString(),
    };
  } catch {
    // Not JSON — wrap as raw text
    return {
      id: nextId++,
      source,
      raw: trimmed,
      level: source === 'stderr' ? 'error' : 'info',
      msg: trimmed,
      component: '',
      time: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Push to ring + notify
// ---------------------------------------------------------------------------

function push(line: LogLine) {
  ring.push(line);
  if (ring.length > RING_SIZE) ring.shift();
  for (const fn of listeners) {
    try {
      fn(line);
    } catch {
      // ignore listener errors
    }
  }
}

// ---------------------------------------------------------------------------
// Read new bytes from a log file since last known offset
// ---------------------------------------------------------------------------

async function readNewBytes(filePath: string, source: 'stdout' | 'stderr') {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return; // file gone
  }

  const prevOffset = offsets.get(filePath) ?? stat.size; // on first watch, skip existing
  if (stat.size <= prevOffset) {
    // File was truncated (log rotation) — reset
    if (stat.size < prevOffset) {
      offsets.set(filePath, 0);
      return readNewBytes(filePath, source);
    }
    return;
  }

  const stream = fs.createReadStream(filePath, { start: prevOffset, encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) push(parseLine(line, source));
  }

  offsets.set(filePath, stat.size);
}

// ---------------------------------------------------------------------------
// Seed ring buffer by reading tail of existing log files
// ---------------------------------------------------------------------------

function seedBackfill() {
  const files = discoverLogFiles();
  for (const { filePath, source } of files) {
    try {
      const stat = fs.statSync(filePath);
      const start = Math.max(0, stat.size - BACKFILL_BYTES);
      const buf = Buffer.alloc(stat.size - start);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buf, 0, buf.length, start);
      fs.closeSync(fd);

      const text = buf.toString('utf-8');
      const lines = text.split('\n');
      // If we started mid-line, skip the first partial line
      const startIdx = start > 0 ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        if (lines[i].trim()) push(parseLine(lines[i], source));
      }
      offsets.set(filePath, stat.size);
    } catch {
      // skip unreadable files
    }
  }
}

// ---------------------------------------------------------------------------
// Discover PM2 log files
// ---------------------------------------------------------------------------

function discoverLogFiles(): Array<{ filePath: string; source: 'stdout' | 'stderr' }> {
  const results: Array<{ filePath: string; source: 'stdout' | 'stderr' }> = [];
  try {
    const entries = fs.readdirSync(PM2_LOG_DIR);
    for (const entry of entries) {
      if (OUT_PATTERN.test(entry)) {
        results.push({ filePath: path.join(PM2_LOG_DIR, entry), source: 'stdout' });
      } else if (ERR_PATTERN.test(entry)) {
        results.push({ filePath: path.join(PM2_LOG_DIR, entry), source: 'stderr' });
      }
    }
  } catch {
    log.warn({ dir: PM2_LOG_DIR }, 'PM2 log directory not found — log tailing disabled');
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startTailing() {
  if (started) return;
  started = true;

  const files = discoverLogFiles();
  if (files.length === 0) {
    log.warn('No PM2 log files found — log tailer running but idle');
    // Still watch the directory for new files
  }

  // Seed backfill from existing files
  seedBackfill();

  // Watch each file
  for (const { filePath, source } of files) {
    try {
      fs.watch(filePath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          readNewBytes(filePath, source).catch(() => {});
        }
      });
    } catch {
      log.warn({ filePath }, 'Could not watch log file');
    }
  }

  // Also watch directory for new log files (rotation, new cluster workers)
  try {
    fs.watch(PM2_LOG_DIR, { persistent: false }, (_eventType, filename) => {
      if (!filename) return;
      const isOut = OUT_PATTERN.test(filename);
      const isErr = ERR_PATTERN.test(filename);
      if (!isOut && !isErr) return;

      const filePath = path.join(PM2_LOG_DIR, filename);
      if (offsets.has(filePath)) return; // already watching

      const source = isOut ? 'stdout' : 'stderr';
      offsets.set(filePath, 0);
      try {
        fs.watch(filePath, { persistent: false }, (evt) => {
          if (evt === 'change') {
            readNewBytes(filePath, source).catch(() => {});
          }
        });
        log.info({ filePath }, 'Started watching new log file');
      } catch {
        // ignore
      }
    });
  } catch {
    // directory watch failed — not critical
  }

  log.info({ fileCount: files.length, dir: PM2_LOG_DIR }, 'Log tailer started');
}

export function getBackfill(count = 100): LogLine[] {
  return ring.slice(-count);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
