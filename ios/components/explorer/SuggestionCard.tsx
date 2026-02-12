/**
 * Suggestion card component for AI-powered content discovery
 * Placeholder for Phase 15 data integration
 */

// TODO: Wire to GET /api/themes/suggestions in Phase 15

import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';

interface SuggestionCardProps {
  title: string;
  description?: string;
  onPress?: () => void;
}

export function SuggestionCard({ title, description, onPress }: SuggestionCardProps) {
  return (
    <GlassCard padding="md" onPress={onPress}>
      <Text variant="body" weight="medium">
        {title}
      </Text>
      {description && (
        <Text variant="caption" color="secondary" style={{ marginTop: 4 }}>
          {description}
        </Text>
      )}
    </GlassCard>
  );
}
