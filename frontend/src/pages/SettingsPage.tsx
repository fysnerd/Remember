import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface PlatformConnection {
  platform: string;
  lastSyncAt: string | null;
  createdAt: string;
  sourceType: string | null;
}

interface OAuthStatus {
  youtube: PlatformConnection | null;
  spotify: PlatformConnection | null;
  tiktok: PlatformConnection | null;
  instagram: PlatformConnection | null;
}

const SOURCE_TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  YOUTUBE: [
    { value: 'YOUTUBE_LIKES', label: 'Liked videos' },
    { value: 'YOUTUBE_WATCH_LATER', label: 'Watch Later playlist' },
  ],
  SPOTIFY: [
    { value: 'SPOTIFY_SAVED', label: 'Saved episodes' },
    { value: 'SPOTIFY_RECENT', label: 'Recently played' },
  ],
  INSTAGRAM: [
    { value: 'INSTAGRAM_BOTH', label: 'Saved & Liked reels' },
    { value: 'INSTAGRAM_SAVED', label: 'Saved reels only' },
    { value: 'INSTAGRAM_LIKED', label: 'Liked reels only' },
  ],
};

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [tiktokCookiesInput, setTiktokCookiesInput] = useState('');
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [instagramCookiesInput, setInstagramCookiesInput] = useState('');

  useEffect(() => {
    const youtube = searchParams.get('youtube');
    const spotify = searchParams.get('spotify');
    if (youtube === 'connected' || spotify === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-status'] }),
  });

  const disconnectSpotify = useMutation({
    mutationFn: () => api.delete('/oauth/spotify/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-status'] }),
  });

  const connectTikTok = useMutation({
    mutationFn: (cookies?: Record<string, string>) => api.post('/oauth/tiktok/connect', cookies || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
      setShowTikTokModal(false);
      setTiktokCookiesInput('');
    },
  });

  const disconnectTikTok = useMutation({
    mutationFn: () => api.delete('/oauth/tiktok/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-status'] }),
  });

  const syncTikTok = useMutation({
    mutationFn: () => api.post('/oauth/tiktok/sync'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-status'] }),
  });

  const connectInstagram = useMutation({
    mutationFn: (cookies?: Record<string, string>) => api.post('/oauth/instagram/connect', cookies || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
      setShowInstagramModal(false);
      setInstagramCookiesInput('');
    },
  });

  const disconnectInstagram = useMutation({
    mutationFn: () => api.delete('/oauth/instagram/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-status'] }),
  });

  const syncInstagram = useMutation({
    mutationFn: () => api.post('/oauth/instagram/sync'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-status'] }),
  });

  const updateSourceType = useMutation({
    mutationFn: ({ platform, sourceType }: { platform: string; sourceType: string }) =>
      api.put(`/oauth/${platform.toLowerCase()}/source`, { sourceType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-status'] }),
  });

  const parseCookies = (input: string): Record<string, string> | null => {
    try {
      const parsed = JSON.parse(input);
      if (parsed.sessionid) return parsed;
    } catch {
      const cookies: Record<string, string> = {};
      const lines = input.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
          cookies[key.trim()] = valueParts.join('=').trim();
        }
      }
      if (cookies.sessionid) return cookies;
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Paramètres</h1>
          <p className="text-sm text-gray-500">Configurez vos préférences</p>
        </div>

        {/* Profile */}
        <section className="border border-gray-200 rounded-lg p-4 mb-4">
          <h2 className="text-base font-medium text-gray-900 mb-4">Profil</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nom</label>
              <input type="text" defaultValue={user?.name || ''} className="input max-w-xs" placeholder="Votre nom" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input type="email" value={user?.email || ''} className="input max-w-xs bg-gray-50" disabled />
            </div>
          </div>
        </section>

        {/* Connected Sources */}
        <section className="border border-gray-200 rounded-lg p-4 mb-4">
          <h2 className="text-base font-medium text-gray-900 mb-4">Sources connectées</h2>

          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* YouTube */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">YouTube</p>
                  <p className="text-xs text-gray-500">
                    {oauthStatus?.youtube ? `Connecté le ${formatDate(oauthStatus.youtube.createdAt)}` : 'Non connecté'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {oauthStatus?.youtube ? (
                    <>
                      <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> Connecté</span>
                      <button onClick={() => disconnectYouTube.mutate()} className="p-1 text-gray-400 hover:text-red-500"><X size={16} /></button>
                    </>
                  ) : (
                    <button onClick={connectYouTube} className="btn-primary text-xs">Connecter</button>
                  )}
                </div>
              </div>
              {oauthStatus?.youtube && (
                <div className="ml-3 flex items-center gap-2">
                  <label className="text-xs text-gray-500">Source :</label>
                  <select
                    value={oauthStatus.youtube.sourceType || 'YOUTUBE_LIKES'}
                    onChange={(e) => updateSourceType.mutate({ platform: 'YOUTUBE', sourceType: e.target.value })}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    {SOURCE_TYPE_OPTIONS.YOUTUBE.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Spotify */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">Spotify</p>
                  <p className="text-xs text-gray-500">
                    {oauthStatus?.spotify ? `Connecté le ${formatDate(oauthStatus.spotify.createdAt)}` : 'Non connecté'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {oauthStatus?.spotify ? (
                    <>
                      <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> Connecté</span>
                      <button onClick={() => disconnectSpotify.mutate()} className="p-1 text-gray-400 hover:text-red-500"><X size={16} /></button>
                    </>
                  ) : (
                    <button onClick={connectSpotify} className="btn-primary text-xs">Connecter</button>
                  )}
                </div>
              </div>
              {oauthStatus?.spotify && (
                <div className="ml-3 flex items-center gap-2">
                  <label className="text-xs text-gray-500">Source :</label>
                  <select
                    value={oauthStatus.spotify.sourceType || 'SPOTIFY_SAVED'}
                    onChange={(e) => updateSourceType.mutate({ platform: 'SPOTIFY', sourceType: e.target.value })}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    {SOURCE_TYPE_OPTIONS.SPOTIFY.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* TikTok */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">TikTok</p>
                  <p className="text-xs text-gray-500">
                    {oauthStatus?.tiktok
                      ? oauthStatus.tiktok.lastSyncAt ? `Sync: ${formatDate(oauthStatus.tiktok.lastSyncAt)}` : `Connecté le ${formatDate(oauthStatus.tiktok.createdAt)}`
                      : 'Non connecté'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {oauthStatus?.tiktok ? (
                    <>
                      <button onClick={() => syncTikTok.mutate()} disabled={syncTikTok.isPending} className="p-1 text-gray-400 hover:text-gray-600">
                        <RefreshCw size={16} className={syncTikTok.isPending ? 'animate-spin' : ''} />
                      </button>
                      <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> Connecté</span>
                      <button onClick={() => disconnectTikTok.mutate()} className="p-1 text-gray-400 hover:text-red-500"><X size={16} /></button>
                    </>
                  ) : (
                    <button onClick={() => { setShowTikTokModal(true); connectTikTok.mutate(undefined); }} className="btn-primary text-xs">Connecter</button>
                  )}
                </div>
              </div>

              {/* Instagram */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">Instagram</p>
                  <p className="text-xs text-gray-500">
                    {oauthStatus?.instagram
                      ? oauthStatus.instagram.lastSyncAt ? `Sync: ${formatDate(oauthStatus.instagram.lastSyncAt)}` : `Connecté le ${formatDate(oauthStatus.instagram.createdAt)}`
                      : 'Non connecté'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {oauthStatus?.instagram ? (
                    <>
                      <button onClick={() => syncInstagram.mutate()} disabled={syncInstagram.isPending} className="p-1 text-gray-400 hover:text-gray-600">
                        <RefreshCw size={16} className={syncInstagram.isPending ? 'animate-spin' : ''} />
                      </button>
                      <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> Connecté</span>
                      <button onClick={() => disconnectInstagram.mutate()} className="p-1 text-gray-400 hover:text-red-500"><X size={16} /></button>
                    </>
                  ) : (
                    <button onClick={() => { setShowInstagramModal(true); connectInstagram.mutate(undefined); }} className="btn-primary text-xs">Connecter</button>
                  )}
                </div>
              </div>
              {oauthStatus?.instagram && (
                <div className="ml-3 flex items-center gap-2">
                  <label className="text-xs text-gray-500">Source :</label>
                  <select
                    value={oauthStatus.instagram.sourceType || 'INSTAGRAM_BOTH'}
                    onChange={(e) => updateSourceType.mutate({ platform: 'INSTAGRAM', sourceType: e.target.value })}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    {SOURCE_TYPE_OPTIONS.INSTAGRAM.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Subscription */}
        <section className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-base font-medium text-gray-900 mb-4">Abonnement</h2>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <p className="font-medium text-gray-900">{user?.plan === 'PRO' ? 'Plan Pro' : 'Essai gratuit'}</p>
              {user?.trialEndsAt && user.plan === 'FREE' && (
                <p className="text-xs text-gray-500">Fin de l'essai : {formatDate(user.trialEndsAt)}</p>
              )}
            </div>
            {user?.plan === 'FREE' && (
              <button className="btn-primary text-xs">Passer à Pro</button>
            )}
          </div>
        </section>
      </div>

      {/* TikTok Modal */}
      {showTikTokModal && (
        <div className="modal-backdrop" onClick={() => !connectTikTok.isPending && setShowTikTokModal(false)}>
          <div className="modal-content max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Connexion TikTok</h3>
              {!connectTikTok.isPending && (
                <button onClick={() => setShowTikTokModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
              )}
            </div>
            {connectTikTok.isPending ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600">Fenêtre de navigateur ouverte...</p>
                <p className="text-xs text-gray-500 mt-1">Connectez-vous à TikTok dans la fenêtre</p>
              </div>
            ) : connectTikTok.isError ? (
              <div className="text-center py-4">
                <p className="text-sm text-red-600 mb-3">Échec de la connexion</p>
                <div className="space-y-2">
                  <textarea
                    value={tiktokCookiesInput}
                    onChange={(e) => setTiktokCookiesInput(e.target.value)}
                    placeholder='{"sessionid": "..."}'
                    className="input h-20 text-xs font-mono"
                  />
                  <button
                    onClick={() => { const c = parseCookies(tiktokCookiesInput); if (c) connectTikTok.mutate(c); }}
                    disabled={!parseCookies(tiktokCookiesInput)}
                    className="btn-primary w-full text-sm"
                  >
                    Connexion manuelle
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Instagram Modal */}
      {showInstagramModal && (
        <div className="modal-backdrop" onClick={() => !connectInstagram.isPending && setShowInstagramModal(false)}>
          <div className="modal-content max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Connexion Instagram</h3>
              {!connectInstagram.isPending && (
                <button onClick={() => setShowInstagramModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
              )}
            </div>
            {connectInstagram.isPending ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600">Fenêtre de navigateur ouverte...</p>
                <p className="text-xs text-gray-500 mt-1">Connectez-vous à Instagram dans la fenêtre</p>
              </div>
            ) : connectInstagram.isError ? (
              <div className="text-center py-4">
                <p className="text-sm text-red-600 mb-3">Échec de la connexion</p>
                <div className="space-y-2">
                  <textarea
                    value={instagramCookiesInput}
                    onChange={(e) => setInstagramCookiesInput(e.target.value)}
                    placeholder='{"sessionid": "..."}'
                    className="input h-20 text-xs font-mono"
                  />
                  <button
                    onClick={() => { const c = parseCookies(instagramCookiesInput); if (c) connectInstagram.mutate(c); }}
                    disabled={!parseCookies(instagramCookiesInput)}
                    className="btn-primary w-full text-sm"
                  >
                    Connexion manuelle
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
