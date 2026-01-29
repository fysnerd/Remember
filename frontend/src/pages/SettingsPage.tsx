import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, ExternalLink, User, Link2, CreditCard, Sparkles, RefreshCw, Cookie, AlertCircle, Monitor } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface OAuthStatus {
  youtube: { platform: string; lastSyncAt: string | null; createdAt: string } | null;
  spotify: { platform: string; lastSyncAt: string | null; createdAt: string } | null;
  tiktok: { platform: string; lastSyncAt: string | null; createdAt: string } | null;
}

interface TikTokCookies {
  sessionid: string;
  sessionid_ss?: string;
  sid_tt?: string;
  uid_tt?: string;
  msToken?: string;
  tt_chain_token?: string;
  [key: string]: string | undefined;
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [tiktokCookiesInput, setTiktokCookiesInput] = useState('');
  const [tiktokManualMode, setTiktokManualMode] = useState(false);

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

  const connectTikTok = useMutation({
    mutationFn: (cookies?: TikTokCookies) => api.post('/oauth/tiktok/connect', cookies || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
      setShowTikTokModal(false);
      setTiktokCookiesInput('');
      setTiktokManualMode(false);
    },
  });

  // Auto connect - launches browser automatically
  const handleTikTokAutoConnect = () => {
    setShowTikTokModal(true);
    connectTikTok.mutate(undefined);
  };

  const disconnectTikTok = useMutation({
    mutationFn: () => api.delete('/oauth/tiktok/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
    },
  });

  const syncTikTok = useMutation({
    mutationFn: () => api.post('/oauth/tiktok/sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
    },
  });

  const parseTikTokCookies = (input: string): TikTokCookies | null => {
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(input);
      if (parsed.sessionid) return parsed;
    } catch {
      // Try parsing as key=value format
      const cookies: Record<string, string> = {};
      const lines = input.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
          cookies[key.trim()] = valueParts.join('=').trim();
        }
      }
      if (cookies.sessionid) return cookies as TikTokCookies;
    }
    return null;
  };

  const handleTikTokConnect = () => {
    const cookies = parseTikTokCookies(tiktokCookiesInput);
    if (cookies) {
      connectTikTok.mutate(cookies);
    }
  };

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

              {/* TikTok */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-void-50 border border-void-200 hover:border-void-300 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00f2ea]/20 to-[#ff0050]/20 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ea]/10 to-[#ff0050]/10 animate-pulse" />
                    <svg className="w-6 h-6 relative z-10" viewBox="0 0 24 24" fill="none">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" fill="url(#tiktok-gradient)"/>
                      <defs>
                        <linearGradient id="tiktok-gradient" x1="5" y1="2" x2="19" y2="20" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#00f2ea"/>
                          <stop offset="1" stopColor="#ff0050"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-cream">TikTok</h3>
                    <p className="text-sm text-cream-dark">
                      {oauthStatus?.tiktok
                        ? oauthStatus.tiktok.lastSyncAt
                          ? `Last sync: ${formatDate(oauthStatus.tiktok.lastSyncAt)}`
                          : `Connected since ${formatDate(oauthStatus.tiktok.createdAt)}`
                        : 'Sync liked videos (even private)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {oauthStatus?.tiktok ? (
                    <>
                      <button
                        onClick={() => syncTikTok.mutate()}
                        disabled={syncTikTok.isPending}
                        className="p-2 text-cream-dark hover:text-[#00f2ea] hover:bg-[#00f2ea]/10 rounded-lg transition-colors"
                        title="Sync Now"
                      >
                        <RefreshCw size={18} className={syncTikTok.isPending ? 'animate-spin' : ''} />
                      </button>
                      <span className="flex items-center gap-1.5 text-sage text-sm bg-sage/10 px-3 py-1.5 rounded-lg border border-sage/20">
                        <Check size={14} /> Connected
                      </span>
                      <button
                        onClick={() => disconnectTikTok.mutate()}
                        disabled={disconnectTikTok.isPending}
                        className="p-2 text-cream-dark hover:text-rust hover:bg-rust/10 rounded-lg transition-colors"
                        title="Disconnect"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleTikTokAutoConnect}
                      disabled={connectTikTok.isPending}
                      className="text-sm flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00f2ea] to-[#ff0050] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-70"
                    >
                      {connectTikTok.isPending ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink size={14} /> Connect
                        </>
                      )}
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

      {/* TikTok Connection Modal */}
      {showTikTokModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-void/80 backdrop-blur-sm"
            onClick={() => !connectTikTok.isPending && setShowTikTokModal(false)}
          />
          <div className="relative w-full max-w-lg bg-void-100 border border-void-200 rounded-2xl shadow-2xl animate-fade-in">
            {/* Header with gradient */}
            <div className="relative overflow-hidden rounded-t-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00f2ea]/20 to-[#ff0050]/20" />
              <div className="relative p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00f2ea] to-[#ff0050] flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-display text-cream">Connect TikTok</h3>
                  <p className="text-cream-dark text-sm">
                    {connectTikTok.isPending ? 'Browser window opened...' : 'Automatic authentication'}
                  </p>
                </div>
                {!connectTikTok.isPending && (
                  <button
                    onClick={() => setShowTikTokModal(false)}
                    className="absolute top-4 right-4 p-2 text-cream-dark hover:text-cream rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {connectTikTok.isPending && !tiktokManualMode ? (
                /* Auto mode - browser is open */
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#00f2ea]/20 to-[#ff0050]/20 flex items-center justify-center">
                    <Monitor size={40} className="text-[#00f2ea] animate-pulse" />
                  </div>
                  <h4 className="text-cream font-medium text-lg mb-2">Browser window opened</h4>
                  <p className="text-cream-dark text-sm mb-6">
                    Log in to TikTok in the browser window that just opened.<br/>
                    We'll automatically capture your session when you're logged in.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-cream-muted text-sm">
                    <RefreshCw size={16} className="animate-spin text-[#00f2ea]" />
                    Waiting for login...
                  </div>
                </div>
              ) : connectTikTok.isError ? (
                /* Error state */
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rust/20 flex items-center justify-center">
                    <AlertCircle size={32} className="text-rust" />
                  </div>
                  <h4 className="text-cream font-medium mb-2">Connection failed</h4>
                  <p className="text-cream-dark text-sm mb-6">
                    {(connectTikTok.error as any)?.response?.data?.message || 'Could not connect to TikTok. Try manual mode.'}
                  </p>
                  <button
                    onClick={() => setTiktokManualMode(true)}
                    className="text-[#00f2ea] hover:underline text-sm"
                  >
                    Switch to manual mode
                  </button>
                </div>
              ) : tiktokManualMode ? (
                /* Manual mode */
                <>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber/10 border border-amber/20">
                    <Cookie size={20} className="text-amber flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-cream font-medium mb-1">Manual mode</p>
                      <p className="text-cream-dark">
                        Paste your TikTok session cookies below.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-cream font-medium">How to get your cookies:</h4>
                    <ol className="space-y-2 text-sm text-cream-muted">
                      <li className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-void-200 text-cream text-xs flex items-center justify-center flex-shrink-0">1</span>
                        <span>Go to <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-[#00f2ea] hover:underline">tiktok.com</a> and log in</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-void-200 text-cream text-xs flex items-center justify-center flex-shrink-0">2</span>
                        <span>Press F12 → Application → Cookies → tiktok.com</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-void-200 text-cream text-xs flex items-center justify-center flex-shrink-0">3</span>
                        <span>Copy <code className="px-1.5 py-0.5 bg-void-200 rounded text-[#ff0050]">sessionid</code> value</span>
                      </li>
                    </ol>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">
                      Paste your cookies (JSON or key=value format)
                    </label>
                    <textarea
                      value={tiktokCookiesInput}
                      onChange={(e) => setTiktokCookiesInput(e.target.value)}
                      placeholder={`{"sessionid": "your_session_id_here"}\n\nor\n\nsessionid=your_session_id_here`}
                      className="w-full h-28 px-4 py-3 bg-void-50 border border-void-200 rounded-xl text-cream placeholder-cream-dark/50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00f2ea]/50 focus:border-transparent resize-none"
                    />
                    {tiktokCookiesInput && !parseTikTokCookies(tiktokCookiesInput) && (
                      <p className="mt-2 text-sm text-rust flex items-center gap-1">
                        <AlertCircle size={14} /> Invalid format. Make sure sessionid is included.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setTiktokManualMode(false);
                        setShowTikTokModal(false);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl border border-void-200 text-cream-muted hover:bg-void-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleTikTokConnect}
                      disabled={!parseTikTokCookies(tiktokCookiesInput) || connectTikTok.isPending}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#00f2ea] to-[#ff0050] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Check size={16} />
                      Connect TikTok
                    </button>
                  </div>
                </>
              ) : (
                /* Initial state - choose mode */
                <>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-[#00f2ea]/10 border border-[#00f2ea]/20">
                    <Monitor size={20} className="text-[#00f2ea] flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-cream font-medium mb-1">Automatic connection</p>
                      <p className="text-cream-dark">
                        A browser window will open for you to log in to TikTok.
                        Your session will be captured automatically.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowTikTokModal(false)}
                      className="flex-1 px-4 py-3 rounded-xl border border-void-200 text-cream-muted hover:bg-void-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => connectTikTok.mutate(undefined)}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#00f2ea] to-[#ff0050] text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={16} />
                      Open Browser
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => setTiktokManualMode(true)}
                      className="text-cream-dark hover:text-cream text-sm transition-colors"
                    >
                      Or enter cookies manually →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
