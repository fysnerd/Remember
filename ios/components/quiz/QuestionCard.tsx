/**
 * Quiz question card with options
 */

import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface Option {
  id: string;
  text: string;
}

interface QuestionCardProps {
  question: string;
  options: Option[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  correctId?: string;
  isSynthesis?: boolean;
}

// Clean option text - remove leading "A) ", "B) ", etc. if present
const cleanOptionText = (text: string) => {
  return text.replace(/^[A-D]\)\s*/, '');
};

const getOptionStyle = (isCorrect: boolean, isWrong: boolean, isSelected: boolean, hasResult: boolean) => ({
  backgroundColor: isCorrect && hasResult
    ? 'rgba(34, 197, 94, 0.15)'
    : isWrong
    ? 'rgba(239, 68, 68, 0.15)'
    : isSelected
    ? colors.surfaceElevated
    : colors.surface,
  borderColor: isCorrect && hasResult
    ? colors.success
    : isWrong
    ? colors.error
    : isSelected
    ? colors.text
    : colors.border,
});

export function QuestionCard({
  question,
  options,
  selectedId,
  onSelect,
  disabled = false,
  correctId,
  isSynthesis = false,
}: QuestionCardProps) {
  return (
    <View>
      {isSynthesis && (
        <View style={styles.synthesisBadge}>
          <Text variant="caption" weight="medium" style={styles.synthesisBadgeText}>
            Synthese
          </Text>
        </View>
      )}
      <Text variant="h3" style={styles.question}>
        {question}
      </Text>
      <View style={styles.options}>
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          const isCorrect = correctId === option.id;
          const isWrong = !!(correctId && isSelected && !isCorrect);
          const optionColors = getOptionStyle(isCorrect, isWrong, isSelected, !!correctId);

          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => {
                if (!disabled) {
                  onSelect(option.id);
                }
              }}
              activeOpacity={0.7}
              style={[
                styles.option,
                { borderWidth: isSelected ? 2 : 1 },
                optionColors,
              ]}
            >
              <Text variant="body" weight="medium" color="secondary" style={styles.optionLabel}>
                {option.id})
              </Text>
              <Text
                variant="body"
                weight={isSelected ? 'bold' : 'regular'}
                style={styles.optionText}
              >
                {cleanOptionText(option.text)}
              </Text>
              {isSelected && !correctId && (
                <Check size={18} color={colors.text} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  question: {
    marginBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: 56,
  },
  optionLabel: {
    width: 28,
  },
  optionText: {
    flex: 1,
  },
  synthesisBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  synthesisBadgeText: {
    color: colors.background,
    fontSize: 12,
  },
});
