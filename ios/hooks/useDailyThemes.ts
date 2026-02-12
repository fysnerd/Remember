// TODO: Replace with GET /api/themes/daily when Phase 15 ships

/**
 * Daily themes hook -- stub wrapping useThemes()
 *
 * Returns the top 3 themes sorted by dueCards descending (most urgent first),
 * with updatedAt as tiebreaker. Will be replaced by a dedicated backend
 * endpoint in Phase 15 that does smart daily rotation.
 */

import { useMemo } from 'react';
import { useThemes } from './useThemes';

export function useDailyThemes() {
  const { data: themes, isLoading, error } = useThemes();

  const dailyThemes = useMemo(() => {
    if (!themes) return undefined;

    return [...themes]
      .sort((a, b) => {
        // Primary: dueCards descending (most urgent first)
        const dueDiff = (b.dueCards ?? 0) - (a.dueCards ?? 0);
        if (dueDiff !== 0) return dueDiff;

        // Tiebreaker: updatedAt descending (most recently active first)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 3);
  }, [themes]);

  return { data: dailyThemes, isLoading, error };
}
