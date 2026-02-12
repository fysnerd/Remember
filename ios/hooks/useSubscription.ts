/**
 * Hook for subscription/plan status (freemium)
 */

import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface SubscriptionStatus {
  plan: 'FREE' | 'PRO';
  isTrialing: boolean;
  trialEndsAt: string | null;
  hasActiveSubscription: boolean;
}

export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ['subscription', 'status'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/subscription/status');
        return data;
      } catch {
        // Default to FREE if endpoint doesn't exist yet
        return { plan: 'FREE', isTrialing: false, trialEndsAt: null, hasActiveSubscription: false };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
