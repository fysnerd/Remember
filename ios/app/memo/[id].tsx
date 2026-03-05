/**
 * Memo Screen - AI-generated memo as a swipable card carousel
 * Inspired by Eimi: two-zone cards, side-peek carousel, counter+arrow nav
 */

import { View, FlatList, ScrollView, Dimensions, StyleSheet, Linking } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { useCallback, useRef, useState, useMemo as useReactMemo } from 'react';
import { Text, Button } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { useMemo, useContent } from '../../hooks';
import { colors, spacing, borderRadius, fonts, shadows } from '../../theme';
import { haptics } from '../../lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 56; // 28px peek each side
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

// --- Types ---

type CardType = 'essential' | 'concept' | 'connections' | 'mnemonic';

interface IdeaCard {
  type: CardType;
  title: string;
  body: string;
}

const CARD_TYPE_CONFIG: Record<CardType, { label: string }> = {
  essential: { label: 'Idée principale' },
  concept: { label: 'Concept' },
  connections: { label: 'Liens & applications' },
  mnemonic: { label: 'Astuce mémo' },
};

// --- Markdown styles (body zone) ---

const bodyMarkdownStyles = {
  body: {
    color: 'rgba(8, 8, 34, 0.7)',
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 26,
  },
  heading1: {
    color: '#080822',
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  heading2: {
    color: '#080822',
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  heading3: {
    color: '#080822',
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  paragraph: {
    marginBottom: spacing.md,
    lineHeight: 26,
  },
  strong: {
    fontFamily: fonts.semibold,
    color: '#080822',
  },
  em: {
    fontStyle: 'italic' as const,
  },
  link: {
    color: '#080822',
    textDecorationLine: 'underline' as const,
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
  ordered_list: {
    marginBottom: spacing.md,
  },
  list_item: {
    marginBottom: spacing.xs,
  },
  bullet_list_icon: {
    color: '#080822',
    marginRight: spacing.sm,
  },
  ordered_list_icon: {
    color: '#080822',
  },
  blockquote: {
    backgroundColor: 'rgba(8, 8, 34, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(8, 8, 34, 0.3)',
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  code_inline: {
    backgroundColor: 'rgba(8, 8, 34, 0.08)',
    color: '#080822',
    fontFamily: fonts.medium,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hr: {
    backgroundColor: 'rgba(8, 8, 34, 0.15)',
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
};

const essentialBodyStyles = {
  ...bodyMarkdownStyles,
  body: {
    ...bodyMarkdownStyles.body,
    color: '#080822',
    fontSize: 17,
    lineHeight: 28,
  },
};

// --- Parsing ---

function splitConcepts(markdown: string): { title: string; body: string }[] {
  const results: { title: string; body: string }[] = [];
  const parts = markdown.split(/\n(?=- \*\*)/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const titleMatch = trimmed.match(/^- \*\*(.+?)\*\*/);
    if (titleMatch) {
      const title = titleMatch[1].replace(/:$/, '').trim();
      const afterTitle = trimmed.slice(trimmed.indexOf('**', trimmed.indexOf('**') + 2) + 2).trim();
      const body = afterTitle.replace(/^[:\s-]+/, '').trim();
      results.push({ title, body });
    } else {
      results.push({ title: '', body: trimmed });
    }
  }

  return results;
}

function parseMemoCards(markdown: string): IdeaCard[] {
  const clean = markdown.replace(/\n-{3,}\n/g, '\n\n');
  const lines = clean.split('\n');
  const cards: IdeaCard[] = [];

  type SectionType = 'intro' | 'main-idea' | 'concepts' | 'connections' | 'mnemonic';
  let currentType: SectionType = 'intro';
  let currentLines: string[] = [];
  const sections: { type: SectionType; content: string }[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    let detected: SectionType | null = null;

    if (lower.includes('idée principale')) detected = 'main-idea';
    else if (lower.includes('concepts clé') || lower.includes('concept clé')) detected = 'concepts';
    else if (lower.includes('connexion') && (lower.includes('**') || /^\s*\d+\./.test(lower))) detected = 'connections';
    else if (lower.includes('astuce mnémotechnique') || lower.includes('astuce mémo')) detected = 'mnemonic';

    if (detected) {
      const content = currentLines.join('\n').trim();
      if (content && currentType !== 'intro') {
        sections.push({ type: currentType, content });
      }
      currentType = detected;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  const lastContent = currentLines.join('\n').trim();
  if (lastContent && currentType !== 'intro') {
    sections.push({ type: currentType, content: lastContent });
  }

  for (const section of sections) {
    switch (section.type) {
      case 'main-idea':
        cards.push({
          type: 'essential',
          title: 'Idée principale',
          body: section.content,
        });
        break;

      case 'concepts': {
        const concepts = splitConcepts(section.content);
        if (concepts.length > 0) {
          for (const c of concepts) {
            cards.push({
              type: 'concept',
              title: c.title || 'Concept',
              body: c.body,
            });
          }
        } else {
          cards.push({
            type: 'concept',
            title: 'Concepts clés',
            body: section.content,
          });
        }
        break;
      }

      case 'connections':
        cards.push({
          type: 'connections',
          title: 'Liens & applications',
          body: section.content,
        });
        break;

      case 'mnemonic':
        cards.push({
          type: 'mnemonic',
          title: 'Astuce mémo',
          body: section.content,
        });
        break;
    }
  }

  if (cards.length === 0) {
    cards.push({
      type: 'essential',
      title: 'Résumé',
      body: clean.trim(),
    });
  }

  return cards;
}

// --- Components ---

function CardView({ card }: { card: IdeaCard }) {
  const mdStyles = card.type === 'essential' ? essentialBodyStyles : bodyMarkdownStyles;
  const typeConfig = CARD_TYPE_CONFIG[card.type];

  return (
    <View style={[styles.cardWrapper, shadows.md]}>
      <ScrollView
        style={styles.card}
        contentContainerStyle={styles.cardContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Text style={styles.cardTypeLabel}>{typeConfig.label}</Text>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {card.title}
        </Text>
        <Markdown style={mdStyles}>{card.body}</Markdown>
      </ScrollView>
    </View>
  );
}

function PaginationDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

// --- Main Screen ---

export default function MemoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: memo, isLoading: memoLoading, error: memoError, refetch } = useMemo(id!);
  const { data: content } = useContent(id!);
  const cards = useReactMemo(
    () => (memo ? parseMemoCards(memo.content) : []),
    [memo],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const lastIndex = useRef(-1);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const idx = viewableItems[0]?.index;
      if (idx != null && idx !== lastIndex.current) {
        lastIndex.current = idx;
        setCurrentIndex(idx);
        haptics.selection();
      }
    },
    [],
  );

  const viewabilityConfig = useReactMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    [],
  );

  const handleWatchVideo = () => {
    if (content?.url) Linking.openURL(content.url);
  };

  const handleRedoQuiz = () => {
    router.push({ pathname: '/quiz/[id]' as any, params: { id: id! } });
  };

  const headerOptions = { title: '', headerBackTitle: 'Retour', headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text };

  if (memoLoading) return (<><Stack.Screen options={headerOptions} /><LoadingScreen /></>);

  if (memoError || !memo) {
    return (<><Stack.Screen options={headerOptions} /><ErrorState message="Mémo introuvable" onRetry={refetch} hasHeader /></>);
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <View style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}>
        {/* Header — centered title, themes hidden for now */}
        {content && (
          <View style={styles.header}>
            <Text style={styles.title}>{content.title}</Text>
          </View>
        )}

        {/* Carousel with side peek */}
        <View style={styles.carouselZone}>
          <FlatList
            data={cards}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => <CardView card={item} />}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SIDE_PADDING - CARD_GAP / 2 }}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
          {cards.length > 1 && (
            <PaginationDots total={cards.length} current={currentIndex} />
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {content?.url && (
            <Button variant="secondary" fullWidth onPress={handleWatchVideo}>
              Consulter le contenu
            </Button>
          )}
          {content && (content.quizCount ?? 0) > 0 && (
            <Button variant="primary" fullWidth onPress={handleRedoQuiz}>
              Refaire le quiz
            </Button>
          )}
        </View>

      </View>
    </>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    letterSpacing: -0.5,
  },
  themes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  themeChipLabel: {
    color: colors.text,
    fontSize: 13,
  },

  // Carousel
  carouselZone: {
    flex: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    flex: 1,
    marginHorizontal: CARD_GAP / 2,
    borderRadius: borderRadius.xl,
    borderCurve: 'continuous',
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.accent,
  },
  cardContent: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  cardTypeLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(8, 8, 34, 0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    color: '#080822',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },

  // Pagination dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 20,
    borderRadius: 3,
  },

  // Actions
  actions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },

});
