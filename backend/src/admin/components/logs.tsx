import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, H2, Text, Loader } from '@adminjs/design-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogLine {
  id: number;
  source: 'stdout' | 'stderr';
  raw: string;
  level: string;
  msg: string;
  component: string;
  time: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LINES = 2000;

const LEVEL_COLORS: Record<string, { bg: string; fg: string }> = {
  trace: { bg: '#1c1c1c', fg: '#6b7280' },
  debug: { bg: '#1e293b', fg: '#94a3b8' },
  info:  { bg: '#0c2d48', fg: '#60a5fa' },
  warn:  { bg: '#422006', fg: '#fb923c' },
  error: { bg: '#450a0a', fg: '#f87171' },
  fatal: { bg: '#7f1d1d', fg: '#fca5a5' },
};

const ALL_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LogViewer: React.FC = () => {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set(ALL_LEVELS));
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // ---- SSE Connection ----
  useEffect(() => {
    const es = new EventSource('/admin/api/logs-sse');

    es.addEventListener('backfill', (e: MessageEvent) => {
      try {
        const backfill: LogLine[] = JSON.parse(e.data);
        setLines(backfill.slice(-MAX_LINES));
        setLoading(false);
        setConnected(true);
      } catch {
        setLoading(false);
      }
    });

    es.addEventListener('log', (e: MessageEvent) => {
      try {
        const line: LogLine = JSON.parse(e.data);
        setLines((prev) => {
          const next = [...prev, line];
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
        });
      } catch {
        // ignore
      }
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // ---- Auto-scroll ----
  useEffect(() => {
    if (autoScroll && !userScrolledUp.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUp.current = !atBottom;
    if (atBottom) setAutoScroll(true);
  }, []);

  // ---- Filtering ----
  const filteredLines = lines.filter((line) => {
    if (!activeLevels.has(line.level)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        line.msg.toLowerCase().includes(q) ||
        line.component.toLowerCase().includes(q) ||
        line.raw.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ---- Toggle level ----
  const toggleLevel = (level: string) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  // ---- Clear ----
  const clearLines = () => setLines([]);

  // ---- Render ----
  return (
    <Box p="xl" style={{ backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      {/* Header */}
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <H2 style={{ margin: 0 }}>Live Console</H2>
          <Box
            as="span"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: connected ? '#22c55e' : '#ef4444',
            }}
          />
          <Text style={{ color: '#6b7280', fontSize: 13 }}>
            {connected ? 'Connected' : 'Disconnected'} — {filteredLines.length} lines
          </Text>
        </Box>
      </Box>

      {/* Controls bar */}
      <Box
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: '10px 16px',
          backgroundColor: '#1e293b',
          borderRadius: '8px 8px 0 0',
        }}
      >
        {/* Level toggles */}
        {ALL_LEVELS.map((level) => {
          const colors = LEVEL_COLORS[level];
          const active = activeLevels.has(level);
          return (
            <Box
              key={level}
              as="button"
              onClick={() => toggleLevel(level)}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                cursor: 'pointer',
                backgroundColor: active ? colors.bg : 'transparent',
                color: active ? colors.fg : '#475569',
                opacity: active ? 1 : 0.5,
              }}
            >
              {level}
            </Box>
          );
        })}

        {/* Separator */}
        <Box style={{ width: 1, height: 20, backgroundColor: '#334155', margin: '0 4px' }} />

        {/* Search input */}
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px',
            maxWidth: 300,
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid #334155',
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            fontSize: 12,
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />

        {/* Auto-scroll toggle */}
        <Box
          as="button"
          onClick={() => {
            setAutoScroll(!autoScroll);
            userScrolledUp.current = autoScroll;
            if (!autoScroll && containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            border: '1px solid #334155',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            backgroundColor: autoScroll ? '#1e40af' : 'transparent',
            color: autoScroll ? '#93c5fd' : '#64748b',
          }}
        >
          Auto-scroll {autoScroll ? 'ON' : 'OFF'}
        </Box>

        {/* Clear */}
        <Box
          as="button"
          onClick={clearLines}
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            border: '1px solid #334155',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: '#64748b',
          }}
        >
          Clear
        </Box>
      </Box>

      {/* Terminal body */}
      {loading ? (
        <Box style={{ display: 'flex', justifyContent: 'center', padding: 60, backgroundColor: '#0d1117', borderRadius: '0 0 8px 8px' }}>
          <Loader />
        </Box>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            backgroundColor: '#0d1117',
            borderRadius: '0 0 8px 8px',
            padding: '8px 0',
            height: 'calc(100vh - 240px)',
            overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            fontSize: 12,
            lineHeight: '20px',
          }}
        >
          {filteredLines.length === 0 ? (
            <Box style={{ padding: '40px 16px', textAlign: 'center' }}>
              <Text style={{ color: '#4b5563' }}>
                {lines.length === 0 ? 'Waiting for logs...' : 'No lines match current filters.'}
              </Text>
            </Box>
          ) : (
            filteredLines.map((line) => {
              const colors = LEVEL_COLORS[line.level] || LEVEL_COLORS.info;
              return (
                <div
                  key={line.id}
                  style={{
                    display: 'flex',
                    padding: '1px 12px',
                    borderLeft: `3px solid ${colors.fg}`,
                    backgroundColor: line.level === 'error' || line.level === 'fatal' ? 'rgba(239,68,68,0.06)' : 'transparent',
                  }}
                >
                  {/* Timestamp */}
                  <span style={{ color: '#4b5563', marginRight: 10, flexShrink: 0 }}>
                    {formatTime(line.time)}
                  </span>

                  {/* Level badge */}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 44,
                      textAlign: 'center',
                      color: colors.fg,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: 10,
                      marginRight: 8,
                      flexShrink: 0,
                    }}
                  >
                    {line.level}
                  </span>

                  {/* Component */}
                  {line.component && (
                    <span style={{ color: '#4ade80', marginRight: 8, flexShrink: 0 }}>
                      [{line.component}]
                    </span>
                  )}

                  {/* Message */}
                  <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>
                    {line.msg}
                  </span>
                </div>
              );
            })
          )}

          {/* Resume auto-scroll button (shown when user scrolled up) */}
          {!autoScroll && (
            <div
              style={{
                position: 'sticky',
                bottom: 8,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <button
                onClick={() => {
                  setAutoScroll(true);
                  userScrolledUp.current = false;
                  if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                  }
                }}
                style={{
                  pointerEvents: 'auto',
                  padding: '6px 16px',
                  borderRadius: 20,
                  border: 'none',
                  backgroundColor: '#1e40af',
                  color: '#93c5fd',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                ↓ Resume auto-scroll
              </button>
            </div>
          )}
        </div>
      )}
    </Box>
  );
};

export default LogViewer;
