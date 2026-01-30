import { useQuery } from '@tanstack/react-query';
import { Flame, BookOpen, TrendingUp, Target, Calendar, Clock, Award, Zap } from 'lucide-react';
import { api } from '../lib/api';

interface ReviewStats {
  dueToday: number;
  reviewDue: number;
  newDue: number;
  totalCards: number;
  currentStreak: number;
  longestStreak: number;
  reviewsLast7Days: number;
}

interface ContentStats {
  total: number;
  byPlatform: {
    platform: string;
    count: number;
  }[];
  byStatus: {
    status: string;
    count: number;
  }[];
}

export function StatsPage() {
  const { data: reviewStats } = useQuery<ReviewStats>({
    queryKey: ['review-stats'],
    queryFn: async () => {
      const res = await api.get<ReviewStats>('/reviews/stats');
      return res.data;
    },
  });

  const { data: contentStats } = useQuery<ContentStats>({
    queryKey: ['content-stats'],
    queryFn: async () => {
      const res = await api.get<ContentStats>('/content/stats');
      return res.data;
    },
  });

  // Calculate retention (estimate based on streak)
  const retentionRate = reviewStats?.currentStreak
    ? Math.min(95, 70 + reviewStats.currentStreak * 2)
    : 70;

  // Get platform colors
  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'YOUTUBE':
        return 'bg-[#FF0000]';
      case 'SPOTIFY':
        return 'bg-[#1DB954]';
      case 'TIKTOK':
        return 'bg-[#00f2ea]';
      case 'INSTAGRAM':
        return 'bg-[#FD1D1D]';
      default:
        return 'bg-void-300';
    }
  };

  const totalContent = contentStats?.byPlatform.reduce((acc, p) => acc + p.count, 0) || 0;

  return (
    <div className="min-h-screen p-8">
      {/* Ambient effects */}
      <div className="fixed top-20 right-20 w-72 h-72 bg-amber/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 left-80 w-48 h-48 bg-sage/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl font-display text-cream mb-2">Tes progrès</h1>
          <p className="text-cream-dark">
            Statistiques de ton apprentissage
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: Flame,
              value: reviewStats?.currentStreak || 0,
              label: 'Jours de streak',
              color: 'from-amber/20 to-amber/5',
              iconColor: 'text-amber',
              suffix: ' 🔥',
              delay: 'stagger-1',
            },
            {
              icon: BookOpen,
              value: reviewStats?.totalCards || 0,
              label: 'Cartes apprises',
              color: 'from-sage/20 to-sage/5',
              iconColor: 'text-sage',
              delay: 'stagger-2',
            },
            {
              icon: Target,
              value: `${retentionRate}%`,
              label: 'Rétention estimée',
              color: 'from-info/20 to-info/5',
              iconColor: 'text-info',
              delay: 'stagger-3',
            },
            {
              icon: TrendingUp,
              value: reviewStats?.longestStreak || 0,
              label: 'Meilleur streak',
              color: 'from-rust/20 to-rust/5',
              iconColor: 'text-rust',
              delay: 'stagger-4',
            },
          ].map(({ icon: Icon, value, label, color, iconColor, suffix, delay }) => (
            <div
              key={label}
              className={`stat-card animate-slide-up ${delay}`}
            >
              <div className={`stat-icon bg-gradient-to-br ${color}`}>
                <Icon size={24} className={iconColor} />
              </div>
              <div>
                <p className="text-3xl font-display text-cream">
                  {value}{suffix}
                </p>
                <p className="text-sm text-cream-dark">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Weekly Activity & Due Today */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Activity This Week */}
          <div className="card animate-slide-up stagger-5">
            <div className="flex items-center gap-2 mb-6">
              <Calendar size={20} className="text-amber" />
              <h3 className="text-lg font-display text-cream">Activité cette semaine</h3>
            </div>

            <div className="flex items-end justify-between gap-2 h-32 px-2">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => {
                // Mock activity data - in production, this would come from the API
                const mockActivity = [3, 5, 8, 12, 4, 7, reviewStats?.reviewsLast7Days ? Math.floor(reviewStats.reviewsLast7Days / 7) : 2];
                const maxActivity = Math.max(...mockActivity, 1);
                const height = (mockActivity[idx] / maxActivity) * 100;

                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-void-200 rounded-t-lg relative" style={{ height: '80px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-gradient-to-t from-amber to-amber/60 rounded-t-lg transition-all duration-500"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-xs text-cream-dark">{day}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-void-200 flex justify-between text-sm">
              <span className="text-cream-dark">Total cette semaine</span>
              <span className="text-cream font-medium">{reviewStats?.reviewsLast7Days || 0} révisions</span>
            </div>
          </div>

          {/* Due Today */}
          <div className="card animate-slide-up stagger-6">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={20} className="text-sage" />
              <h3 className="text-lg font-display text-cream">Aujourd'hui</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-void-100 border border-void-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber/20 flex items-center justify-center">
                    <Zap size={20} className="text-amber" />
                  </div>
                  <div>
                    <p className="text-cream font-medium">Cartes à réviser</p>
                    <p className="text-xs text-cream-dark">Révisions dues maintenant</p>
                  </div>
                </div>
                <span className="text-2xl font-display text-amber">{reviewStats?.reviewDue || 0}</span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-void-100 border border-void-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sage/20 flex items-center justify-center">
                    <BookOpen size={20} className="text-sage" />
                  </div>
                  <div>
                    <p className="text-cream font-medium">Nouvelles cartes</p>
                    <p className="text-xs text-cream-dark">Prêtes à apprendre</p>
                  </div>
                </div>
                <span className="text-2xl font-display text-sage">{reviewStats?.newDue || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="card animate-slide-up stagger-7">
          <div className="flex items-center gap-2 mb-6">
            <Award size={20} className="text-cream-muted" />
            <h3 className="text-lg font-display text-cream">Répartition par plateforme</h3>
          </div>

          {contentStats?.byPlatform && contentStats.byPlatform.length > 0 ? (
            <div className="space-y-4">
              {contentStats.byPlatform.map((platform) => {
                const percentage = totalContent > 0
                  ? Math.round((platform.count / totalContent) * 100)
                  : 0;

                return (
                  <div key={platform.platform} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cream">{platform.platform}</span>
                      <span className="text-cream-dark">{platform.count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-void-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getPlatformColor(platform.platform)} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-cream-dark text-center py-8">
              Aucun contenu pour le moment. Connecte tes plateformes dans les paramètres.
            </p>
          )}

          <div className="mt-6 pt-4 border-t border-void-200 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-cream-dark">Contenu total</span>
              <p className="text-xl font-display text-cream">{totalContent}</p>
            </div>
            <div>
              <span className="text-cream-dark">Meilleur streak</span>
              <p className="text-xl font-display text-cream">{reviewStats?.longestStreak || 0} jours</p>
            </div>
          </div>
        </div>

        {/* Motivational Section */}
        {reviewStats?.currentStreak && reviewStats.currentStreak > 0 && (
          <div className="mt-8 card-glow animate-slide-up text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber to-amber-dark flex items-center justify-center">
              <Flame size={32} className="text-void" />
            </div>
            <h3 className="text-2xl font-display text-cream mb-2">
              {reviewStats.currentStreak >= 30
                ? 'Incroyable !'
                : reviewStats.currentStreak >= 7
                ? 'Continue comme ça !'
                : 'Bon début !'}
            </h3>
            <p className="text-cream-muted">
              {reviewStats.currentStreak >= 30
                ? `Tu as ${reviewStats.currentStreak} jours de streak. Tu es sur une lancée incroyable !`
                : reviewStats.currentStreak >= 7
                ? `${reviewStats.currentStreak} jours consécutifs. Tu construis une habitude solide.`
                : `${reviewStats.currentStreak} jour${reviewStats.currentStreak > 1 ? 's' : ''} de streak. Chaque jour compte !`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
