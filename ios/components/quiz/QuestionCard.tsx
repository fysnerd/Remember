/**
 * Quiz question card with options
 */

import { View, TouchableOpacity, StyleSheet } from 'react-native';
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
  current?: number;
  total?: number;
}

// Clean option text - remove leading "A) ", "B) ", etc. if present
const cleanOptionText = (text: string) => {
  return text.replace(/^[A-D]\)\s*/, '');
};

const getOptionStyle = (isCorrect: boolean, isWrong: boolean, isSelected: boolean, hasResult: boolean) => ({
  backgroundColor: isCorrect && hasResult
    ? 'rgba(34, 197, 94, 0.12)'
    : isWrong
    ? 'rgba(239, 68, 68, 0.12)'
    : isSelected
    ? 'rgba(181, 165, 254, 0.08)'
    : colors.surface,
  borderColor: isCorrect && hasResult
    ? colors.success
    : isWrong
    ? colors.error
    : isSelected
    ? colors.accent
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
  current,
  total,
}: QuestionCardProps) {
  return (
    <View>
      {current != null && total != null && (
        <Text variant="caption" color="secondary" style={styles.counter}>
          Question {current}/{total}
        </Text>
      )}
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
                optionColors,
              ]}
            >
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <Text
                variant="body"
                weight="medium"
                style={styles.optionText}
              >
                {cleanOptionText(option.text)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    marginBottom: spacing.sm,
  },
  question: {
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm + 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    minHeight: 56,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  optionText: {
    flex: 1,
    lineHeight: 22,
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
