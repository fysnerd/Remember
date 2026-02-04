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
}

// Clean option text - remove leading "A) ", "B) ", etc. if present
const cleanOptionText = (text: string) => {
  return text.replace(/^[A-D]\)\s*/, '');
};

export function QuestionCard({
  question,
  options,
  selectedId,
  onSelect,
  disabled = false,
  correctId,
}: QuestionCardProps) {
  console.log('[QuestionCard] Render with selectedId:', selectedId);

  return (
    <View>
      <Text variant="h3" style={styles.question}>
        {question}
      </Text>
      <View style={styles.options}>
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          const isCorrect = correctId === option.id;
          const isWrong = correctId && isSelected && !isCorrect;

          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => {
                if (!disabled) {
                  onSelect(option.id);
                }
              }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 12,
                minHeight: 56,
                backgroundColor: isCorrect && correctId
                  ? '#DCFCE7'
                  : isWrong
                  ? '#FEE2E2'
                  : isSelected
                  ? '#E5E5E5'
                  : '#F5F5F5',
                borderWidth: isSelected ? 2 : 1,
                borderColor: isCorrect && correctId
                  ? '#16A34A'
                  : isWrong
                  ? '#DC2626'
                  : isSelected
                  ? '#000000'
                  : '#E0E0E0',
              }}
            >
              <Text variant="body" weight="medium" color="secondary" style={{ width: 28 }}>
                {option.id})
              </Text>
              <Text
                variant="body"
                weight={isSelected ? 'bold' : 'regular'}
                style={{ flex: 1 }}
              >
                {cleanOptionText(option.text)}
              </Text>
              {isSelected && !correctId && (
                <Text variant="body" weight="bold"> ✓</Text>
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
    marginBottom: 24,
  },
  options: {
    gap: 12,
  },
});
