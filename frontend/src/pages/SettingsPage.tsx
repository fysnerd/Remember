import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, ExternalLink, User, Link2, CreditCard, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface OAuthStatus {
  youtube: { platform: string; lastSyncAt: string | null; createdAt: string } | null;
  spotify: { platform: string; lastSyncAt: string | null; createdAt: string } | null;
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Show toast on successful connection
  useEffect(() => {
    const youtube = searchParams.get('youtube');
    const spotify = searchParams.get('spotify');
    const error = searchParams.get('error');

    if (youtube === 'connected' || spotify === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
      setSearchParams({});
    }

    if (error) {
      console.error('OAuth error:', error);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, queryClient]);

  const { data: oauthStatus, isLoading } = useQuery<OAuthStatus>({
    queryKey: ['oauth-status'],
    queryFn: async () => {
      const res = await api.get<OAuthStatus>('/oauth/status');
      return res.data;
    },
  });

  const connectYouTube = async () => {
    const res = await api.get<{ authUrl: string }>('/oauth/youtube/connect');
    window.location.href = res.data.authUrl;
  };

  const connectSpotify = async () => {
    const res = await api.get<{ authUrl: string }>('/oauth/spotify/connect');
    window.location.href = res.data.authUrl;
  };

  const disconnectYouTube = useMutation({
    mutationFn: () => api.delete('/oauth/youtube/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
    },
  });

  const disconnectSpotify = useMutation({
    mutationFn: () => api.delete('/oauth/spotify/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen p-8">
      {/* Ambient glow */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-amber/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-4xl font-display text-cream mb-2">Settings</h1>
          <p className="text-cream-dark">Configure your neural archive preferences</p>
        </div>

        {/* Profile Section */}
        <section className="card mb-6 animate-slide-up stagger-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber/20 flex items-center justify-center">
              <User size={20} className="text-amber" />
            </div>
            <h2 className="text-xl font-display text-cream">Profile</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-cream-muted mb-2">
                Name
              </label>
              <input
                type="text"
                defaultValue={user?.name || ''}
                className="input max-w-sm"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cream-muted mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                className="input max-w-sm bg-void-50 cursor-not-allowed"
                disabled
              />
              <p className="text-xs text-cream-dark mt-1">Email cannot be changed</p>
            </div>
          </div>
        </section>

        {/* Connected Accounts */}
        <section className="card mb-6 animate-slide-up stagger-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-sage/20 flex items-center justify-center">
              <Link2 size={20} className="text-sage" />
            </div>
            <div>
              <h2 className="text-xl font-display text-cream">Connected Sources</h2>
            </div>
          </div>
          <p className="text-cream-dark text-sm mb-6 ml-13">
            Link your accounts to automatically capture content for your archive.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* YouTube */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-void-50 border border-void-200 hover:border-void-300 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FF0000]/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B6B]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-cream">YouTube</h3>
                    <p className="text-sm text-cream-dark">
                      {oauthStatus?.youtube
                        ? `Connected since ${formatDate(oauthStatus.youtube.createdAt)}`
                        : 'Sync liked videos & watch history'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {oauthStatus?.youtube ? (
                    <>
                      <span className="flex items-center gap-1.5 text-sage text-sm bg-sage/10 px-3 py-1.5 rounded-lg border border-sage/20">
                        <Check size={14} /> Connected
                      </span>
                      <button
                        onClick={() => disconnectYouTube.mutate()}
                        disabled={disconnectYouTube.isPending}
                        className="p-2 text-cream-dark hover:text-rust hover:bg-rust/10 rounded-lg transition-colors"
                        title="Disconnect"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <button onClick={connectYouTube} className="btn-primary text-sm flex items-center gap-2">
                      Connect <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Spotify */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-void-50 border border-void-200 hover:border-void-300 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#1DB954]/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-cream">Spotify</h3>
                    <p className="text-sm text-cream-dark">
                      {oauthStatus?.spotify
                        ? `Connected since ${formatDate(oauthStatus.spotify.createdAt)}`
                        : 'Sync podcast listening history'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {oauthStatus?.spotify ? (
                    <>
                      <span className="flex items-center gap-1.5 text-sage text-sm bg-sage/10 px-3 py-1.5 rounded-lg border border-sage/20">
                        <Check size={14} /> Connected
                      </span>
                      <button
                        onClick={() => disconnectSpotify.mutate()}
                        disabled={disconnectSpotify.isPending}
                        className="p-2 text-cream-dark hover:text-rust hover:bg-rust/10 rounded-lg transition-colors"
                        title="Disconnect"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <button onClick={connectSpotify} className="btn-primary text-sm flex items-center gap-2">
                      Connect <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Subscription */}
        <section className="card animate-slide-up stagger-3">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber/20 flex items-center justify-center">
              <CreditCard size={20} className="text-amber" />
            </div>
            <h2 className="text-xl font-display text-cream">Subscription</h2>
          </div>

          <div className="flex items-center justify-between p-5 rounded-xl bg-void-50 border border-void-200">
            <div className="flex items-center gap-4">
              {user?.plan === 'PRO' ? (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber to-amber-dark flex items-center justify-center">
                  <Sparkles size={24} className="text-void" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-void-200 flex items-center justify-center">
                  <Sparkles size={24} className="text-cream-dark" />
                </div>
              )}
              <div>
                <p className="font-medium text-cream">
                  {user?.plan === 'PRO' ? 'Pro Plan' : 'Free Trial'}
                </p>
                {user?.trialEndsAt && user.plan === 'FREE' && (
                  <p className="text-sm text-cream-dark">
                    Trial ends: {formatDate(user.trialEndsAt)}
                  </p>
                )}
                {user?.plan === 'PRO' && (
                  <p className="text-sm text-sage">Unlimited access to all features</p>
                )}
              </div>
            </div>
            {user?.plan === 'FREE' && (
              <button className="btn-primary flex items-center gap-2">
                <Sparkles size={16} />
                Upgrade to Pro
              </button>
            )}
          </div>

          {user?.plan === 'FREE' && (
            <div className="mt-6 p-5 rounded-xl border border-amber/20 bg-amber/5">
              <h4 className="font-medium text-cream mb-3">Pro benefits include:</h4>
              <ul className="space-y-2">
                {[
                  'Unlimited content syncing',
                  'Advanced quiz customization',
                  'Priority AI processing',
                  'Export your knowledge base',
                  'Early access to new features',
                ].map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm text-cream-muted">
                    <Check size={14} className="text-amber" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
