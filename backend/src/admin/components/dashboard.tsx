import React, { useEffect, useState, useCallback } from 'react';
import { ApiClient } from 'adminjs';
import { Box, H2, H4, H5, Text, Badge, ValueGroup, MessageBox, Loader } from '@adminjs/design-system';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LastRun {
  jobName: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  duration: number | null;
  error: string | null;
}

interface RecentError {
  id: string;
  jobName: string;
  error: string | null;
  startedAt: string;
  duration: number | null;
  triggerSource: string;
}

interface ContentByPlatform {
  platform: string;
  _count: number;
}

interface TimelineEntry {
  id: string;
  jobName: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  duration: number | null;
}

interface SuccessRate {
  jobName: string;
  total: number;
  successes: number;
}

interface DashboardData {
  lastRuns: LastRun[];
  recentErrors: RecentError[];
  stats: {
    userCount: number;
    contentByPlatform: ContentByPlatform[];
    quizCount: number;
    reviewCount: number;
  };
  timeline: TimelineEntry[];
  successRates: SuccessRate[];
  generatedAt: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

function statusVariant(status: string): 'success' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'danger';
    case 'RUNNING': return 'info';
    default: return 'default';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'SUCCESS': return '#dcfce7';
    case 'FAILED': return '#fee2e2';
    case 'RUNNING': return '#dbeafe';
    default: return '#f3f4f6';
  }
}

function statusFg(status: string): string {
  switch (status) {
    case 'SUCCESS': return '#166534';
    case 'FAILED': return '#991b1b';
    case 'RUNNING': return '#1e40af';
    default: return '#374151';
  }
}

const JOB_SHORT: Record<string, string> = {
  'youtube-sync': 'YT Sync',
  'spotify-sync': 'Spot Sync',
  'tiktok-sync': 'TT Sync',
  'instagram-sync': 'IG Sync',
  'youtube-transcription': 'YT Trans',
  'podcast-transcription': 'Pod Trans',
  'tiktok-transcription': 'TT Trans',
  'instagram-transcription': 'IG Trans',
  'quiz-generation': 'Quiz Gen',
  'reminder': 'Reminder',
  'auto-tagging': 'Tagging',
};

function shortJobName(name: string): string {
  return JOB_SHORT[name] || name;
}

// ---------------------------------------------------------------------------
// Sub-components (inline -- no separate files)
// ---------------------------------------------------------------------------

/** Simple inline badge using Box */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <Box
    as="span"
    style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: statusBg(status),
      color: statusFg(status),
    }}
  >
    {status}
  </Box>
);

/** SSE connection indicator dot */
const SseDot: React.FC<{ connected: boolean }> = ({ connected }) => (
  <Box
    as="span"
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: connected ? '#22c55e' : '#ef4444',
      marginRight: 6,
    }}
  />
);

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------

const Card: React.FC<{ children: React.ReactNode; title?: string; mb?: string }> = ({ children, title, mb }) => (
  <Box
    variant="white"
    style={{
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      padding: 24,
      marginBottom: mb ? undefined : 24,
    }}
    mb={mb || 'xl'}
  >
    {title && <H4 style={{ marginTop: 0, marginBottom: 16 }}>{title}</H4>}
    {children}
  </Box>
);

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [filterJob, setFilterJob] = useState<string | null>(null);
  const [timelineLimit, setTimelineLimit] = useState(25);

  const api = new ApiClient();

  const fetchData = useCallback(() => {
    api.getDashboard().then((res: any) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  // Initial data load
  useEffect(() => {
    fetchData();
  }, []);

  // DASH-07: SSE real-time updates with debounced refresh
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const es = new EventSource('/admin/api/sse');

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    es.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (['job_started', 'job_completed', 'job_failed'].includes(update.type)) {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => fetchData(), 2000);
        }
      } catch {
        // Ignore parse errors (heartbeat comments)
      }
    };

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      es.close();
    };
  }, []);

  // ---------- Loading state ----------

  if (loading) {
    return (
      <Box p="xl" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box p="xl">
        <MessageBox variant="danger" message="Failed to load dashboard data. Refresh the page to try again." />
      </Box>
    );
  }

  // ---------- Derived data ----------

  const totalContent = data.stats.contentByPlatform.reduce((sum, p) => sum + p._count, 0);

  const chartData = data.successRates.map((r) => ({
    name: shortJobName(r.jobName),
    rate: r.total > 0 ? Math.round((r.successes / r.total) * 100) : 0,
  }));

  const filteredErrors = filterJob
    ? data.recentErrors.filter((e) => e.jobName === filterJob)
    : data.recentErrors;

  const errorJobNames = [...new Set(data.recentErrors.map((e) => e.jobName))];

  // Group timeline by date
  const timelineVisible = data.timeline.slice(0, timelineLimit);

  function dateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ---------- Render ----------

  return (
    <Box variant="grey" p="xl">

      {/* ============================================================ */}
      {/* SECTION 1: Header (DASH-01)                                  */}
      {/* ============================================================ */}
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Box>
          <H2 style={{ margin: 0 }}>Ankora System Health</H2>
          <Text style={{ color: '#6b7280', marginTop: 4 }}>
            <SseDot connected={sseConnected} />
            Last updated: {timeAgo(data.generatedAt)}
          </Text>
        </Box>
        <Box
          as="button"
          onClick={() => { setLoading(true); fetchData(); }}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Refresh
        </Box>
      </Box>

      {data.error && (
        <MessageBox variant="danger" message={data.error} style={{ marginBottom: 24 }} />
      )}

      {/* ============================================================ */}
      {/* SECTION 2: Stats Cards (DASH-04)                             */}
      {/* ============================================================ */}
      <Card>
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <Box style={{ flex: '1 1 160px', minWidth: 160 }}>
            <ValueGroup label="Users" value={String(data.stats.userCount)} />
          </Box>
          <Box style={{ flex: '1 1 160px', minWidth: 160 }}>
            <ValueGroup label="Total Content" value={String(totalContent)} />
          </Box>
          <Box style={{ flex: '1 1 160px', minWidth: 160 }}>
            <ValueGroup label="Quizzes" value={String(data.stats.quizCount)} />
          </Box>
          <Box style={{ flex: '1 1 160px', minWidth: 160 }}>
            <ValueGroup label="Reviews" value={String(data.stats.reviewCount)} />
          </Box>
        </Box>

        {/* Per-platform breakdown */}
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          {data.stats.contentByPlatform.map((p) => (
            <Text key={p.platform} style={{ fontSize: 13, color: '#6b7280' }}>
              {p.platform}: <strong>{p._count}</strong>
            </Text>
          ))}
        </Box>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 3: Sync Status (DASH-02)                             */}
      {/* ============================================================ */}
      <Card title="Sync Status">
        {data.lastRuns.length === 0 ? (
          <Text style={{ color: '#9ca3af' }}>No job executions recorded yet.</Text>
        ) : (
          <Box as="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <Box as="thead">
              <Box as="tr" style={{ borderBottom: '2px solid #e5e7eb' }}>
                <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Job</Box>
                <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Status</Box>
                <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Trigger</Box>
                <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Last Run</Box>
                <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Duration</Box>
              </Box>
            </Box>
            <Box as="tbody">
              {data.lastRuns.map((run) => (
                <Box as="tr" key={run.jobName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <Box as="td" style={{ padding: '8px 12px', fontWeight: 500 }}>
                    {run.jobName}
                    {run.error && (
                      <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{run.error.substring(0, 80)}</Text>
                    )}
                  </Box>
                  <Box as="td" style={{ padding: '8px 12px' }}>
                    <StatusBadge status={run.status} />
                  </Box>
                  <Box as="td" style={{ padding: '8px 12px', color: '#6b7280' }}>{run.triggerSource}</Box>
                  <Box as="td" style={{ padding: '8px 12px', color: '#6b7280' }}>{timeAgo(run.startedAt)}</Box>
                  <Box as="td" style={{ padding: '8px 12px', color: '#6b7280' }}>{formatDuration(run.duration)}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION 4: Error Log (DASH-03)                               */}
      {/* ============================================================ */}
      <Card title="Recent Errors (24h)">
        {data.recentErrors.length === 0 ? (
          <MessageBox variant="success" message="No errors in the last 24 hours" />
        ) : (
          <>
            <Text style={{ marginBottom: 12, color: '#6b7280', fontSize: 13 }}>
              {data.recentErrors.length} error{data.recentErrors.length !== 1 ? 's' : ''} in the last 24 hours
            </Text>

            {/* Job filter buttons */}
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Box
                as="button"
                onClick={() => setFilterJob(null)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: '1px solid #d1d5db',
                  backgroundColor: filterJob === null ? '#3b82f6' : '#fff',
                  color: filterJob === null ? '#fff' : '#374151',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                All
              </Box>
              {errorJobNames.map((name) => (
                <Box
                  as="button"
                  key={name}
                  onClick={() => setFilterJob(filterJob === name ? null : name)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 16,
                    border: '1px solid #d1d5db',
                    backgroundColor: filterJob === name ? '#3b82f6' : '#fff',
                    color: filterJob === name ? '#fff' : '#374151',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {shortJobName(name)}
                </Box>
              ))}
            </Box>

            {/* Error list */}
            <Box as="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <Box as="thead">
                <Box as="tr" style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Job</Box>
                  <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Error</Box>
                  <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Time</Box>
                  <Box as="th" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Duration</Box>
                </Box>
              </Box>
              <Box as="tbody">
                {filteredErrors.map((e) => (
                  <Box as="tr" key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <Box as="td" style={{ padding: '8px 12px', fontWeight: 500 }}>{shortJobName(e.jobName)}</Box>
                    <Box as="td" style={{ padding: '8px 12px', color: '#ef4444', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.error || 'Unknown error'}
                    </Box>
                    <Box as="td" style={{ padding: '8px 12px', color: '#6b7280' }}>{timeAgo(e.startedAt)}</Box>
                    <Box as="td" style={{ padding: '8px 12px', color: '#6b7280' }}>{formatDuration(e.duration)}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION 5: Success Rate Chart (DASH-06)                      */}
      {/* ============================================================ */}
      <Card title="Success Rates (Last 7 Days)">
        {chartData.length === 0 ? (
          <Text style={{ color: '#9ca3af' }}>No job execution data for the last 7 days.</Text>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Success Rate']} />
              <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION 6: Timeline (DASH-05)                                */}
      {/* ============================================================ */}
      <Card title="Job Execution Timeline">
        {data.timeline.length === 0 ? (
          <Text style={{ color: '#9ca3af' }}>No job executions recorded yet.</Text>
        ) : (
          <>
            {(() => {
              let lastDate = '';
              return timelineVisible.map((entry) => {
                const dl = dateLabel(entry.startedAt);
                const showDate = dl !== lastDate;
                lastDate = dl;
                return (
                  <React.Fragment key={entry.id}>
                    {showDate && (
                      <H5 style={{ margin: '16px 0 8px 0', color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {dl}
                      </H5>
                    )}
                    <Box
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '6px 0',
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: 13,
                      }}
                    >
                      <StatusBadge status={entry.status} />
                      <Text style={{ fontWeight: 500, minWidth: 160 }}>{entry.jobName}</Text>
                      <Text style={{ color: '#9ca3af', minWidth: 80 }}>{entry.triggerSource}</Text>
                      <Text style={{ color: '#6b7280', minWidth: 70 }}>{timeAgo(entry.startedAt)}</Text>
                      <Text style={{ color: '#6b7280' }}>{formatDuration(entry.duration)}</Text>
                    </Box>
                  </React.Fragment>
                );
              });
            })()}

            {data.timeline.length > timelineLimit && (
              <Box
                as="button"
                onClick={() => setTimelineLimit(timelineLimit + 25)}
                style={{
                  display: 'block',
                  margin: '16px auto 0',
                  padding: '6px 20px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#3b82f6',
                }}
              >
                Show more ({data.timeline.length - timelineLimit} remaining)
              </Box>
            )}
          </>
        )}
      </Card>

    </Box>
  );
};

export default Dashboard;
