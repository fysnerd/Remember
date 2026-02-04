import { useQuery } from '@tanstack/react-query';
import { Flame, BookOpen, TrendingUp, Target, Loader2 } from 'lucide-react';
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
  const { data: reviewStats, isLoading: isLoadingReview } = useQuery<ReviewStats>({
    queryKey: ['review-stats'],
    queryFn: async () => {
      const res = await api.get<ReviewStats>('/reviews/stats');
      return res.data;
    },
  });

  const { data: contentStats, isLoading: isLoadingContent } = useQuery<ContentStats>({
    queryKey: ['content-stats'],
    queryFn: async () => {
      const res = await api.get<ContentStats>('/content/stats');
      return res.data;
    },
  });

  const retentionRate = reviewStats?.currentStreak
    ? Math.min(95, 70 + reviewStats.currentStreak * 2)
    : 70;

  const totalContent = contentStats?.byPlatform.reduce((acc, p) => acc + p.count, 0) || 0;

  if (isLoadingReview || isLoadingContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Tes progrès</h1>
          <p className="text-sm text-gray-500">Statistiques de ton apprentissage</p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={18} className="text-orange-500" />
              <span className="text-xs text-gray-500">Streak</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{reviewStats?.currentStreak || 0}</p>
            <p className="text-xs text-gray-500">jours</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={18} className="text-green-600" />
              <span className="text-xs text-gray-500">Cartes</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{reviewStats?.totalCards || 0}</p>
            <p className="text-xs text-gray-500">apprises</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-blue-600" />
              <span className="text-xs text-gray-500">Rétention</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{retentionRate}%</p>
            <p className="text-xs text-gray-500">estimée</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-purple-600" />
              <span className="text-xs text-gray-500">Record</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{reviewStats?.longestStreak || 0}</p>
            <p className="text-xs text-gray-500">jours</p>
          </div>
        </div>

        {/* Today & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Today */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Aujourd'hui</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">À réviser</span>
                <span className="text-lg font-semibold text-gray-900">{reviewStats?.reviewDue || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Nouvelles cartes</span>
                <span className="text-lg font-semibold text-gray-900">{reviewStats?.newDue || 0}</span>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Activité cette semaine</h3>
            <div className="flex items-end justify-between gap-2 h-20">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => {
                const mockActivity = [3, 5, 8, 12, 4, 7, reviewStats?.reviewsLast7Days ? Math.floor(reviewStats.reviewsLast7Days / 7) : 2];
                const maxActivity = Math.max(...mockActivity, 1);
                const height = (mockActivity[idx] / maxActivity) * 100;

                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '50px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-gray-900 rounded-t"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">{day}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-500">Total</span>
              <span className="font-medium text-gray-900">{reviewStats?.reviewsLast7Days || 0} révisions</span>
            </div>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Répartition par plateforme</h3>

          {contentStats?.byPlatform && contentStats.byPlatform.length > 0 ? (
            <div className="space-y-3">
              {contentStats.byPlatform.map((platform) => {
                const percentage = totalContent > 0
                  ? Math.round((platform.count / totalContent) * 100)
                  : 0;

                return (
                  <div key={platform.platform} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{platform.platform}</span>
                      <span className="text-gray-500">{platform.count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">
              Aucun contenu. Connecte tes plateformes dans les paramètres.
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Contenu total</span>
              <p className="text-lg font-semibold text-gray-900">{totalContent}</p>
            </div>
            <div>
              <span className="text-gray-500">Meilleur streak</span>
              <p className="text-lg font-semibold text-gray-900">{reviewStats?.longestStreak || 0} jours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
