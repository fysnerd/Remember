import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flame, PlayCircle, BookOpen, TrendingUp, ArrowRight, Zap, Clock, Inbox } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

interface ReviewStats {
  dueToday: number;
  totalCards: number;
  currentStreak: number;
  longestStreak: number;
}

interface OAuthStatus {
  youtube: { platform: string; lastSyncAt: string | null } | null;
  spotify: { platform: string; lastSyncAt: string | null } | null;
  tiktok: { platform: string; lastSyncAt: string | null } | null;
}

export function DashboardPage() {
  const { user, fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const { data: stats } = useQuery<ReviewStats>({
    queryKey: ['review-stats'],
    queryFn: async () => {
      const res = await api.get<ReviewStats>('/reviews/stats');
      return res.data;
    },
  });

  const { data: oauthStatus } = useQuery<OAuthStatus>({
    queryKey: ['oauth-status'],
    queryFn: async () => {
      const res = await api.get<OAuthStatus>('/oauth/status');
      return res.data;
    },
  });

  const { data: inboxData } = useQuery({
    queryKey: ['inbox-count'],
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/content/inbox/count');
      return res.data;
    },
  });

  const inboxCount = inboxData?.count || 0;
  const isConnected = oauthStatus?.youtube || oauthStatus?.spotify || oauthStatus?.tiktok;

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatLastSync = (date: string | null) => {
    if (!date) return 'Never synced';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen p-8">
      {/* Ambient glow */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-amber/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-64 w-64 h-64 bg-sage/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <p className="text-cream-muted mb-1">{getGreeting()},</p>
          <h1 className="text-4xl font-display text-cream mb-2">
            {user?.name || 'Scholar'}
          </h1>
          <p className="text-cream-dark">
            Your neural archive awaits. What will you remember today?
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: Flame,
              value: stats?.currentStreak || 0,
              label: 'Day streak',
              color: 'from-amber/20 to-amber/5',
              iconColor: 'text-amber',
              delay: 'stagger-1',
            },
            {
              icon: PlayCircle,
              value: stats?.dueToday || 0,
              label: 'Cards due',
              color: 'from-sage/20 to-sage/5',
              iconColor: 'text-sage',
              delay: 'stagger-2',
            },
            {
              icon: BookOpen,
              value: stats?.totalCards || 0,
              label: 'Total cards',
              color: 'from-cream/10 to-cream/5',
              iconColor: 'text-cream-muted',
              delay: 'stagger-3',
            },
            {
              icon: TrendingUp,
              value: stats?.longestStreak || 0,
              label: 'Best streak',
              color: 'from-rust/20 to-rust/5',
              iconColor: 'text-rust',
              delay: 'stagger-4',
            },
          ].map(({ icon: Icon, value, label, color, iconColor, delay }) => (
            <div
              key={label}
              className={`stat-card animate-slide-up ${delay}`}
            >
              <div className={`stat-icon bg-gradient-to-br ${color}`}>
                <Icon size={24} className={iconColor} />
              </div>
              <div>
                <p className="text-3xl font-display text-cream">{value}</p>
                <p className="text-sm text-cream-dark">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Inbox Prompt */}
        {inboxCount > 0 && (
          <Link
            to="/inbox"
            className="block mb-8 p-5 rounded-2xl bg-gradient-to-r from-amber/10 to-amber/5 border border-amber/20 hover:border-amber/40 transition-all animate-slide-up stagger-5 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber/20 flex items-center justify-center">
                  <Inbox size={24} className="text-amber" />
                </div>
                <div>
                  <h3 className="font-display text-cream text-lg">
                    {inboxCount} new {inboxCount === 1 ? 'item' : 'items'} to review
                  </h3>
                  <p className="text-cream-dark text-sm">
                    Triage your inbox to start learning
                  </p>
                </div>
              </div>
              <ArrowRight size={20} className="text-amber group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        )}

        {/* Main CTA */}
        {stats?.dueToday ? (
          <div className="card-glow mb-8 animate-slide-up stagger-5 overflow-hidden relative">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 10px,
                  rgba(212, 165, 116, 0.1) 10px,
                  rgba(212, 165, 116, 0.1) 20px
                )`
              }} />
            </div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-amber/20 flex items-center justify-center animate-pulse-glow">
                  <Zap size={32} className="text-amber" />
                </div>
                <div>
                  <h2 className="text-2xl font-display text-cream mb-1">
                    Time to train your memory
                  </h2>
                  <p className="text-cream-muted">
                    {stats.dueToday} card{stats.dueToday !== 1 ? 's' : ''} waiting for review
                  </p>
                </div>
              </div>
              <Link
                to="/review"
                className="btn-primary flex items-center gap-2 group"
              >
                Start Session
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="card mb-8 animate-slide-up stagger-5">
            <div className="flex items-center gap-4 text-center justify-center py-4">
              <div className="w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center">
                <Clock size={24} className="text-sage" />
              </div>
              <div className="text-left">
                <p className="text-cream font-medium">All caught up!</p>
                <p className="text-cream-dark text-sm">No cards due right now. Check back later.</p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        {!isConnected ? (
          <div className="card border-dashed border-amber/30 animate-slide-up">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-amber/10 flex items-center justify-center mx-auto mb-4">
                <Zap size={32} className="text-amber" />
              </div>
              <h3 className="text-xl font-display text-cream mb-2">
                Connect your sources
              </h3>
              <p className="text-cream-dark mb-6 max-w-md mx-auto">
                Link YouTube and Spotify to automatically capture content you want to remember.
              </p>
              <Link to="/settings" className="btn-primary inline-flex items-center gap-2">
                Connect Accounts
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="card animate-slide-up">
            <h3 className="text-lg font-display text-cream mb-4">Connected Sources</h3>
            <div className="space-y-3">
              {oauthStatus?.youtube && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-void-50 border border-void-200 hover:border-void-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#FF0000]/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#FF6B6B]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-cream">YouTube</span>
                      <p className="text-xs text-cream-dark">Liked videos & watch history</p>
                    </div>
                  </div>
                  <span className="text-sm text-cream-muted">
                    {formatLastSync(oauthStatus.youtube.lastSyncAt)}
                  </span>
                </div>
              )}
              {oauthStatus?.spotify && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-void-50 border border-void-200 hover:border-void-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1DB954]/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-cream">Spotify</span>
                      <p className="text-xs text-cream-dark">Played podcasts</p>
                    </div>
                  </div>
                  <span className="text-sm text-cream-muted">
                    {formatLastSync(oauthStatus.spotify.lastSyncAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
