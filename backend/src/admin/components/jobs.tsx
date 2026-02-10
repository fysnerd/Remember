import React, { useEffect, useState, useCallback } from 'react';
import { Box, H2, H4, H5, Text, Loader, MessageBox } from '@adminjs/design-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobStats {
  total: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDuration: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  lastRun: string | null;
}

interface Execution {
  id: string;
  jobName: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  itemsProcessed: number | null;
  error: string | null;
}

interface JobEntry {
  jobName: string;
  stats: JobStats;
  executions: Execution[];
}

interface JobsData {
  jobs: JobEntry[];
  rangeHours: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_GROUPS: Record<string, { label: string; color: string; jobs: string[] }> = {
  youtube:    { label: 'YouTube',    color: '#ef4444', jobs: ['youtube-sync', 'youtube-transcription'] },
  spotify:    { label: 'Spotify',    color: '#22c55e', jobs: ['spotify-sync', 'podcast-transcription'] },
  tiktok:     { label: 'TikTok',     color: '#06b6d4', jobs: ['tiktok-sync', 'tiktok-transcription'] },
  instagram:  { label: 'Instagram',  color: '#d946ef', jobs: ['instagram-sync', 'instagram-transcription'] },
  processing: { label: 'Processing', color: '#f59e0b', jobs: ['quiz-generation', 'auto-tagging', 'reminder', 'cleanup-job-executions'] },
};

const JOB_LABELS: Record<string, string> = {
  'youtube-sync':            'Sync',
  'youtube-transcription':   'Transcription',
  'spotify-sync':            'Sync',
  'podcast-transcription':   'Podcast Transcription',
  'tiktok-sync':             'Sync',
  'tiktok-transcription':    'Transcription',
  'instagram-sync':          'Sync',
  'instagram-transcription': 'Transcription',
  'quiz-generation':         'Quiz Generation',
  'auto-tagging':            'Auto-Tagging',
  'reminder':                'Reminder',
  'cleanup-job-executions':  'Cleanup',
};

const RANGE_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '3d',  hours: 72 },
  { label: '7d',  hours: 168 },
  { label: '30d', hours: 720 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}

function statusBg(status: string): string {
  switch (status) {
    case 'SUCCESS': return '#dcfce7';
    case 'FAILED':  return '#fee2e2';
    case 'RUNNING': return '#dbeafe';
    default:        return '#f3f4f6';
  }
}

function statusFg(status: string): string {
  switch (status) {
    case 'SUCCESS': return '#166534';
    case 'FAILED':  return '#991b1b';
    case 'RUNNING': return '#1e40af';
    default:        return '#374151';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: statusBg(status),
      color: statusFg(status),
    }}
  >
    {status}
  </span>
);

const StatBox: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <Box style={{ flex: '1 1 120px', minWidth: 100, textAlign: 'center', padding: '8px 4px' }}>
    <Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
      {label}
    </Text>
    <Text style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{value}</Text>
    {sub && <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</Text>}
  </Box>
);

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <Box
    variant="white"
    style={{
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      padding: 20,
      marginBottom: 20,
      ...style,
    }}
  >
    {children}
  </Box>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const Jobs: React.FC = () => {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeHours, setRangeHours] = useState(72);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const fetchData = useCallback((range: number) => {
    setLoading(true);
    fetch(`/admin/api/jobs?range=${range}`)
      .then((r) => r.json())
      .then((d: JobsData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData(rangeHours);
  }, [rangeHours]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(() => fetchData(rangeHours), 30000);
    return () => clearInterval(iv);
  }, [rangeHours]);

  if (loading && !data) {
    return (
      <Box p="xl" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader />
      </Box>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <Box p="xl">
        <H2 style={{ marginBottom: 16 }}>Job Executions</H2>
        <MessageBox variant="info" message="No job executions found in the selected time range." />
      </Box>
    );
  }

  // Group jobs by platform
  const jobsByPlatform: Record<string, JobEntry[]> = {};
  for (const [key, group] of Object.entries(PLATFORM_GROUPS)) {
    const matched = data.jobs.filter((j) => group.jobs.includes(j.jobName));
    if (matched.length > 0) jobsByPlatform[key] = matched;
  }
  // Catch any jobs not in a known group
  const knownJobs = new Set(Object.values(PLATFORM_GROUPS).flatMap((g) => g.jobs));
  const unknownJobs = data.jobs.filter((j) => !knownJobs.has(j.jobName));
  if (unknownJobs.length > 0) jobsByPlatform['other'] = unknownJobs;

  const platformKeys = selectedPlatform
    ? [selectedPlatform]
    : Object.keys(jobsByPlatform);

  return (
    <Box variant="grey" p="xl">
      {/* Header */}
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <H2 style={{ margin: 0 }}>Job Executions</H2>

        <Box style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Time range selector */}
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              onClick={() => setRangeHours(opt.hours)}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                backgroundColor: rangeHours === opt.hours ? '#3b82f6' : '#fff',
                color: rangeHours === opt.hours ? '#fff' : '#374151',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {opt.label}
            </button>
          ))}

          {/* Refresh */}
          <button
            onClick={() => fetchData(rangeHours)}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </Box>
      </Box>

      {/* Platform filter tabs */}
      <Box style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedPlatform(null)}
          style={{
            padding: '6px 16px',
            borderRadius: 20,
            border: '2px solid',
            borderColor: selectedPlatform === null ? '#3b82f6' : '#e5e7eb',
            backgroundColor: selectedPlatform === null ? '#eff6ff' : '#fff',
            color: selectedPlatform === null ? '#1d4ed8' : '#374151',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          All Platforms
        </button>
        {Object.entries(PLATFORM_GROUPS).map(([key, group]) => {
          if (!jobsByPlatform[key]) return null;
          const totalRuns = jobsByPlatform[key].reduce((sum, j) => sum + j.stats.total, 0);
          return (
            <button
              key={key}
              onClick={() => setSelectedPlatform(selectedPlatform === key ? null : key)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: '2px solid',
                borderColor: selectedPlatform === key ? group.color : '#e5e7eb',
                backgroundColor: selectedPlatform === key ? `${group.color}15` : '#fff',
                color: selectedPlatform === key ? group.color : '#374151',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {group.label}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>{totalRuns}</span>
            </button>
          );
        })}
      </Box>

      {/* Per-platform sections */}
      {platformKeys.map((platformKey) => {
        const jobs = jobsByPlatform[platformKey];
        if (!jobs) return null;
        const group = PLATFORM_GROUPS[platformKey] || { label: 'Other', color: '#6b7280' };

        return (
          <Box key={platformKey} style={{ marginBottom: 28 }}>
            {/* Platform header */}
            <Box style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Box
                style={{
                  width: 4,
                  height: 24,
                  borderRadius: 2,
                  backgroundColor: group.color,
                }}
              />
              <H4 style={{ margin: 0 }}>{group.label}</H4>
              <Text style={{ fontSize: 12, color: '#9ca3af' }}>
                {jobs.reduce((s, j) => s + j.stats.total, 0)} runs in {rangeHours < 48 ? `${rangeHours}h` : `${Math.round(rangeHours / 24)}d`}
              </Text>
            </Box>

            {/* Job cards */}
            {jobs.map((job) => {
              const label = JOB_LABELS[job.jobName] || job.jobName;
              const isExpanded = expandedJob === job.jobName;

              return (
                <Card key={job.jobName}>
                  {/* Job header + stats */}
                  <Box
                    as="button"
                    onClick={() => setExpandedJob(isExpanded ? null : job.jobName)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                    }}
                  >
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{label}</Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{job.jobName}</Text>
                    </Box>
                    <Text style={{ fontSize: 18, color: '#9ca3af', fontWeight: 300 }}>
                      {isExpanded ? '−' : '+'}
                    </Text>
                  </Box>

                  {/* Stats row */}
                  <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                    <StatBox label="Runs" value={String(job.stats.total)} />
                    <StatBox
                      label="Success"
                      value={`${job.stats.successRate}%`}
                      sub={`${job.stats.successes} / ${job.stats.total}`}
                    />
                    <StatBox
                      label="Failures"
                      value={String(job.stats.failures)}
                    />
                    <StatBox
                      label="Avg Duration"
                      value={formatDuration(job.stats.avgDuration)}
                    />
                    <StatBox
                      label="Min / Max"
                      value={`${formatDuration(job.stats.minDuration)} / ${formatDuration(job.stats.maxDuration)}`}
                    />
                    <StatBox
                      label="Last Run"
                      value={timeAgo(job.stats.lastRun)}
                    />
                  </Box>

                  {/* Expanded: execution history */}
                  {isExpanded && (
                    <Box style={{ marginTop: 16 }}>
                      <H5 style={{ margin: '0 0 10px 0', color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Execution History ({job.executions.length})
                      </H5>

                      {job.executions.length === 0 ? (
                        <Text style={{ color: '#9ca3af', fontSize: 13 }}>No executions in this time range.</Text>
                      ) : (
                        <Box style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Started</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Duration</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Trigger</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Items</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {job.executions.map((exec) => (
                                <tr key={exec.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '6px 10px' }}>
                                    <StatusBadge status={exec.status} />
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                                    {formatTime(exec.startedAt)}
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#374151', fontFamily: 'monospace' }}>
                                    {formatDuration(exec.duration)}
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#6b7280' }}>
                                    {exec.triggerSource}
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#374151' }}>
                                    {exec.itemsProcessed ?? '-'}
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#ef4444', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {exec.error || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </Box>
                      )}
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};

export default Jobs;
