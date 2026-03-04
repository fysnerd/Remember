/**
 * Component Playground - Dev only
 * Navigate to /playground on web to see all components in isolation.
 *
 * Each section documents: component name, role, and visible states.
 */

import { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, Input, Card, Badge } from '../components/ui';
import { Skeleton } from '../components/ui/Skeleton';
import { Toast } from '../components/ui/Toast';
import { SelectChip } from '../components/onboarding/SelectChip';
import { SelectCard } from '../components/onboarding/SelectCard';
import { SocialAuthButton } from '../components/onboarding/SocialAuthButton';
import { OnboardingProgressBar } from '../components/onboarding/OnboardingProgressBar';
import { EmptyState } from '../components/EmptyState';
import { GlassCard } from '../components/glass/GlassCard';
import { GlassButton } from '../components/glass/GlassButton';
// ALONE components
import { GreetingHeader } from '../components/home/GreetingHeader';
import { QuizRecommendationCard } from '../components/home/QuizRecommendationCard';
import { DailyVictoryScreen } from '../components/home/DailyVictoryScreen';
import { SourcePills } from '../components/content/SourcePills';
import { TriageModeToggle } from '../components/content/TriageModeToggle';
import { SwipeCard } from '../components/content/SwipeCard';
import type { SwipeCardRef } from '../components/content/SwipeCard';
import { SwipeableContentCard } from '../components/content/SwipeableContentCard';
import { SessionCard } from '../components/reviews/SessionCard';
import { DigestClosure } from '../components/digest/DigestClosure';
import type { QuizRecommendation, DailyProgress } from '../types/content';
import type { QuizSessionItem } from '../hooks';
import { colors, spacing } from '../theme';

// ─── Section with doc ───

function Section({ title, role, states, children }: {
  title: string;
  role: string;
  states?: string[];
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text variant="label" color="secondary" weight="semibold" style={s.sectionTitle}>
        {title.toUpperCase()}
      </Text>
      <View style={s.docBlock}>
        <Text variant="caption" color="muted">{role}</Text>
        {states && states.length > 0 && (
          <Text variant="caption" color="muted" style={s.statesText}>
            {'States: ' + states.join(' · ')}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function Row({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return <View style={[s.row, wrap && { flexWrap: 'wrap' }]}>{children}</View>;
}

// ─── Mock data ───

const MOCK_DAILY_PROGRESS: DailyProgress = { completed: 2, total: 3, allDone: false };

const MOCK_CONTENT_REC: QuizRecommendation = {
  id: 'rec-1',
  type: 'content',
  title: 'La neuroscience de la mémoire',
  subtitle: 'Veritasium',
  thumbnailUrl: null,
  emoji: null,
  color: null,
  questionCount: 5,
  dueCount: 5,
  platform: 'youtube',
  channelName: 'Veritasium',
  capturedAt: new Date().toISOString(),
  reason: 'Due today',
  completed: false,
};

const MOCK_THEME_REC: QuizRecommendation = {
  id: 'rec-2',
  type: 'theme',
  title: 'Intelligence Artificielle',
  subtitle: '12 contenus',
  thumbnailUrl: null,
  emoji: '🤖',
  color: '#6366F1',
  questionCount: 8,
  dueCount: 8,
  platform: null,
  channelName: null,
  capturedAt: null,
  reason: 'New theme',
  completed: false,
};

const MOCK_COMPLETED_REC: QuizRecommendation = {
  ...MOCK_CONTENT_REC,
  id: 'rec-3',
  completed: true,
  title: 'Quiz terminé',
  subtitle: 'ScienceEtonnante',
};

const MOCK_SESSION: QuizSessionItem = {
  id: 'sess-1',
  completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  totalCount: 10,
  correctCount: 8,
  accuracy: 80,
  hasMemo: true,
  contents: [
    { id: 'c1', title: 'La plasticité synaptique', platform: 'youtube', thumbnailUrl: null, channelName: 'ScienceEtonnante' },
    { id: 'c2', title: 'Deep Work', platform: 'spotify', thumbnailUrl: null, channelName: 'Huberman Lab' },
  ],
  themes: [{ id: 't1', name: 'Neurosciences', emoji: '🧠' }],
};

const MOCK_SESSION_LOW: QuizSessionItem = {
  id: 'sess-2',
  completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  totalCount: 8,
  correctCount: 3,
  accuracy: 38,
  hasMemo: false,
  contents: [
    { id: 'c3', title: 'TikTok mémoire de travail', platform: 'tiktok', thumbnailUrl: null, channelName: '@neuro.tips' },
  ],
  themes: [],
};

// ─── Main ───

export default function PlaygroundScreen() {
  const [inputVal, setInputVal] = useState('');
  const [inputErr, setInputErr] = useState('');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [selectedCard, setSelectedCard] = useState('');
  const [progressStep, setProgressStep] = useState(3);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [selectedSource, setSelectedSource] = useState<'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram'>('all');
  const [showVictory, setShowVictory] = useState(false);
  const [showDigestClosure, setShowDigestClosure] = useState(false);
  const [greetingStreak, setGreetingStreak] = useState(7);
  const swipeRef = useRef<SwipeCardRef>(null);

  const toggleChip = (label: string) =>
    setChips((prev) => ({ ...prev, [label]: !prev[label] }));

  const noop = () => {};
  const logAction = (action: string) => () => Alert.alert('Action', action);

  // Full-screen overlays
  if (showVictory) {
    return (
      <View style={s.container}>
        <DailyVictoryScreen streak={5} />
        <View style={s.overlayClose}>
          <Button size="sm" variant="secondary" onPress={() => setShowVictory(false)}>Fermer</Button>
        </View>
      </View>
    );
  }

  if (showDigestClosure) {
    return (
      <DigestClosure
        score={7}
        total={10}
        bestStreak={4}
        durationMs={185000}
        onClose={() => setShowDigestClosure(false)}
      />
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Toast
        message={`This is a ${toastType} toast`}
        type={toastType}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <Text variant="h1" style={s.pageTitle}>Playground</Text>
        <Text variant="caption" color="secondary">Tous les composants Ankora, documentés et interactifs</Text>

        {/* ════════════════════════════════════════════════════════════
            SHARED PRIMITIVES — réutilisés dans plusieurs écrans
            ════════════════════════════════════════════════════════════ */}

        <View style={s.divider} />
        <Text variant="h2" style={{ marginTop: spacing.lg }}>Primitives partagées</Text>
        <Text variant="caption" color="secondary">Réutilisées dans plusieurs écrans</Text>

        {/* ─── TEXT ─── */}
        <Section
          title="Text"
          role="Composant typographique de base. Wraps React Native Text avec les fonts Geist et le système de couleurs Ankora."
          states={['h1', 'h2', 'h3', 'body', 'caption', 'label', 'primary', 'secondary', 'muted', 'regular', 'medium', 'semibold', 'bold']}
        >
          <Text variant="h1">Heading 1 (28px bold)</Text>
          <Text variant="h2">Heading 2 (24px bold)</Text>
          <Text variant="h3">Heading 3 (20px semi)</Text>
          <Text variant="body">Body (16px regular)</Text>
          <Text variant="caption">Caption (14px regular)</Text>
          <Text variant="label">Label (12px medium)</Text>
          <View style={{ height: 8 }} />
          <Text variant="body" color="primary">color=primary</Text>
          <Text variant="body" color="secondary">color=secondary</Text>
          <Text variant="body" color="muted">color=muted</Text>
          <View style={{ height: 8 }} />
          <Text variant="body" weight="regular">weight=regular</Text>
          <Text variant="body" weight="medium">weight=medium</Text>
          <Text variant="body" weight="semibold">weight=semibold</Text>
          <Text variant="body" weight="bold">weight=bold</Text>
        </Section>

        {/* ─── BUTTON ─── */}
        <Section
          title="Button"
          role="Bouton d'action principal. Gère les variantes visuelles, tailles, états loading/disabled et mode full-width."
          states={['primary', 'secondary', 'outline', 'ghost', 'sm', 'md', 'lg', 'fullWidth', 'loading', 'disabled']}
        >
          <Row>
            <Button variant="primary" onPress={noop}>Primary</Button>
            <Button variant="secondary" onPress={noop}>Secondary</Button>
          </Row>
          <Row>
            <Button variant="outline" onPress={noop}>Outline</Button>
            <Button variant="ghost" onPress={noop}>Ghost</Button>
          </Row>
          <Row>
            <Button size="sm" onPress={noop}>Small</Button>
            <Button size="md" onPress={noop}>Medium</Button>
            <Button size="lg" onPress={noop}>Large</Button>
          </Row>
          <Button variant="primary" fullWidth onPress={noop}>Full Width</Button>
          <Row>
            <Button variant="primary" loading onPress={noop}>Loading</Button>
            <Button variant="primary" disabled onPress={noop}>Disabled</Button>
          </Row>
        </Section>

        {/* ─── GLASS BUTTON ─── */}
        <Section
          title="GlassButton"
          role="Bouton avec effet glassmorphism. Variante accent pour les CTA importants, glass pour les actions secondaires."
          states={['glass', 'accent', 'sm', 'md', 'lg', 'fullWidth']}
        >
          <Row>
            <GlassButton variant="glass" onPress={noop}>Glass</GlassButton>
            <GlassButton variant="accent" onPress={noop}>Accent</GlassButton>
          </Row>
          <GlassButton variant="accent" fullWidth onPress={noop}>Full Width Accent</GlassButton>
          <Row>
            <GlassButton size="sm" onPress={noop}>Sm</GlassButton>
            <GlassButton size="md" onPress={noop}>Md</GlassButton>
            <GlassButton size="lg" onPress={noop}>Lg</GlassButton>
          </Row>
        </Section>

        {/* ─── INPUT ─── */}
        <Section
          title="Input"
          role="Champ de saisie avec label, placeholder, gestion d'erreur et mode mot de passe."
          states={['default', 'error', 'secureTextEntry']}
        >
          <Input
            label="Default Input"
            placeholder="Type something..."
            value={inputVal}
            onChangeText={setInputVal}
          />
          <Input
            label="With Error"
            placeholder="Wrong value"
            value={inputErr}
            onChangeText={setInputErr}
            error="This field is required"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value=""
            onChangeText={noop}
            secureTextEntry
          />
        </Section>

        {/* ─── CARD ─── */}
        <Section
          title="Card"
          role="Conteneur avec fond surface, border-radius et padding variable. Peut être pressable."
          states={['padding=sm', 'padding=md', 'padding=lg', 'pressable']}
        >
          <Card>
            <Text variant="body">Default card (padding=md)</Text>
          </Card>
          <Card padding="lg">
            <Text variant="body">Card padding=lg</Text>
            <Text variant="caption" color="secondary">With more content inside</Text>
          </Card>
          <Card padding="sm" onPress={noop}>
            <Text variant="body">Pressable card (padding=sm)</Text>
          </Card>
        </Section>

        {/* ─── GLASS CARD ─── */}
        <Section
          title="GlassCard"
          role="Carte avec effet glassmorphism (fond semi-transparent + bordure lumineuse). Base de nombreuses cards dans l'app."
          states={['default', 'pressable', 'padding=sm/md/lg']}
        >
          <GlassCard>
            <Text variant="body">Glass card default</Text>
          </GlassCard>
          <GlassCard padding="lg" onPress={noop}>
            <Text variant="body">Glass card pressable (lg)</Text>
            <Text variant="caption" color="secondary">Tap me</Text>
          </GlassCard>
        </Section>

        {/* ─── BADGE ─── */}
        <Section
          title="Badge"
          role="Pastille numérique pour notifications, compteurs. Tronque à 99+. Utilisé sur les tabs, cards, etc."
          states={['default', 'error', 'success', 'sm', 'md', 'overflow (99+)']}
        >
          <Row>
            <View style={s.badgeDemo}>
              <Text variant="caption" color="secondary">default</Text>
              <Badge count={3} color="default" />
            </View>
            <View style={s.badgeDemo}>
              <Text variant="caption" color="secondary">error</Text>
              <Badge count={12} color="error" />
            </View>
            <View style={s.badgeDemo}>
              <Text variant="caption" color="secondary">success</Text>
              <Badge count={99} color="success" />
            </View>
            <View style={s.badgeDemo}>
              <Text variant="caption" color="secondary">99+</Text>
              <Badge count={150} />
            </View>
          </Row>
          <Row>
            <View style={s.badgeDemo}>
              <Text variant="caption" color="secondary">sm</Text>
              <Badge count={5} size="sm" />
            </View>
            <View style={s.badgeDemo}>
              <Text variant="caption" color="secondary">md</Text>
              <Badge count={5} size="md" />
            </View>
          </Row>
        </Section>

        {/* ─── SKELETON ─── */}
        <Section
          title="Skeleton"
          role="Placeholder de chargement animé (shimmer). Remplace le contenu en attente de fetch."
          states={['text', 'rect', 'circle']}
        >
          <Skeleton width="100%" height={16} variant="text" />
          <Skeleton width="60%" height={16} variant="text" />
          <View style={{ height: 8 }} />
          <Skeleton width="100%" height={80} variant="rect" />
          <View style={{ height: 8 }} />
          <Row>
            <Skeleton height={40} variant="circle" />
            <Skeleton height={40} variant="circle" />
            <Skeleton height={40} variant="circle" />
          </Row>
        </Section>

        {/* ─── TOAST ─── */}
        <Section
          title="Toast"
          role="Notification temporaire en haut d'écran. Auto-dismiss après quelques secondes."
          states={['success', 'error', 'info']}
        >
          <Row>
            <Button size="sm" variant="secondary" onPress={() => { setToastType('success'); setToastVisible(true); }}>
              Success
            </Button>
            <Button size="sm" variant="secondary" onPress={() => { setToastType('error'); setToastVisible(true); }}>
              Error
            </Button>
            <Button size="sm" variant="secondary" onPress={() => { setToastType('info'); setToastVisible(true); }}>
              Info
            </Button>
          </Row>
        </Section>

        {/* ─── EMPTY STATE ─── */}
        <Section
          title="EmptyState"
          role="Écran vide affiché quand une liste n'a aucun contenu. Message personnalisable."
          states={['hasHeader', 'sans header']}
        >
          <View style={{ height: 200 }}>
            <EmptyState message="Rien ici pour le moment" hasHeader />
          </View>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            ONBOARDING — composants du flow d'inscription
            ════════════════════════════════════════════════════════════ */}

        <View style={s.divider} />
        <Text variant="h2" style={{ marginTop: spacing.lg }}>Onboarding</Text>
        <Text variant="caption" color="secondary">Composants du flow d'inscription</Text>

        {/* ─── SELECT CHIP ─── */}
        <Section
          title="SelectChip"
          role="Chip multi-sélection pour les intérêts. L'utilisateur tape pour toggler on/off."
          states={['selected', 'unselected']}
        >
          <Row wrap>
            {['Science', 'Tech', 'Business', 'Health', 'Culture', 'Sport'].map((label) => (
              <SelectChip
                key={label}
                label={label}
                selected={!!chips[label]}
                onPress={() => toggleChip(label)}
              />
            ))}
          </Row>
        </Section>

        {/* ─── SELECT CARD ─── */}
        <Section
          title="SelectCard"
          role="Carte de sélection unique avec emoji, label et description. Pour les choix d'objectifs."
          states={['selected', 'unselected']}
        >
          {[
            { emoji: '🧠', label: 'Apprendre', description: 'Retenir ce que je regarde' },
            { emoji: '📚', label: 'Organiser', description: 'Classer mon contenu' },
            { emoji: '🎯', label: 'Progresser', description: 'Suivre mes progrès' },
          ].map((item) => (
            <SelectCard
              key={item.label}
              emoji={item.emoji}
              label={item.label}
              description={item.description}
              selected={selectedCard === item.label}
              onPress={() => setSelectedCard(item.label)}
            />
          ))}
        </Section>

        {/* ─── SOCIAL AUTH BUTTON ─── */}
        <Section
          title="SocialAuthButton"
          role="Bouton de connexion sociale. Affiche le logo du provider et un texte adapté."
          states={['apple', 'google', 'email', 'loading']}
        >
          <SocialAuthButton provider="apple" onPress={noop} />
          <SocialAuthButton provider="google" onPress={noop} />
          <SocialAuthButton provider="email" onPress={noop} />
          <SocialAuthButton provider="apple" onPress={noop} loading />
        </Section>

        {/* ─── ONBOARDING PROGRESS BAR ─── */}
        <Section
          title="OnboardingProgressBar"
          role="Barre de progression segmentée (10 étapes). Indique la position dans le flow d'onboarding."
          states={['step 1-10']}
        >
          <OnboardingProgressBar step={progressStep} />
          <Row>
            {[1, 3, 5, 7, 10].map((step) => (
              <Button
                key={step}
                size="sm"
                variant={progressStep === step ? 'primary' : 'ghost'}
                onPress={() => setProgressStep(step)}
              >
                {String(step)}
              </Button>
            ))}
          </Row>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SCREEN-SPECIFIC — composants utilisés dans un seul écran
            ════════════════════════════════════════════════════════════ */}

        <View style={s.divider} />
        <Text variant="h2" style={{ marginTop: spacing.lg }}>Screen-specific</Text>
        <Text variant="caption" color="secondary">Composants utilisés dans un seul écran</Text>

        {/* ─── GREETING HEADER ─── */}
        <Section
          title="GreetingHeader"
          role="En-tête de la Home. Affiche le prénom, un message selon l'heure (Bonjour/Bon après-midi/Bonsoir), le streak et la progression quotidienne."
          states={['avec streak', 'sans streak (0)', 'progress dots (completed/total)', 'allDone']}
        >
          <GreetingHeader userName="Antoine" />
          <Row>
            {[0, 3, 7, 30].map((v) => (
              <Button
                key={v}
                size="sm"
                variant={greetingStreak === v ? 'primary' : 'ghost'}
                onPress={() => setGreetingStreak(v)}
              >
                {v === 0 ? 'No streak' : `${v}j`}
              </Button>
            ))}
          </Row>
        </Section>

        {/* ─── QUIZ RECOMMENDATION CARD ─── */}
        <Section
          title="QuizRecommendationCard"
          role="Carte de recommandation de quiz sur la Home. Deux modes : contenu (thumbnail) ou thème (emoji). Opacité réduite + check quand terminé."
          states={['type=content', 'type=theme', 'completed']}
        >
          <QuizRecommendationCard
            recommendation={MOCK_CONTENT_REC}
            onPress={logAction('Content rec pressed')}
          />
          <QuizRecommendationCard
            recommendation={MOCK_THEME_REC}
            onPress={logAction('Theme rec pressed')}
          />
          <QuizRecommendationCard
            recommendation={MOCK_COMPLETED_REC}
            onPress={logAction('Completed rec pressed')}
          />
        </Section>

        {/* ─── DAILY VICTORY SCREEN ─── */}
        <Section
          title="DailyVictoryScreen"
          role="Écran de célébration plein-page affiché quand tous les quiz du jour sont terminés (allDone). Animation FadeInDown."
          states={['avec streak', 'sans streak']}
        >
          <Button size="sm" variant="secondary" onPress={() => setShowVictory(true)}>
            Afficher
          </Button>
        </Section>

        {/* ─── SOURCE PILLS ─── */}
        <Section
          title="SourcePills"
          role="Filtre horizontal par plateforme dans la Library. Scroll horizontal. Se masque automatiquement si moins de 3 sources."
          states={['all', 'youtube', 'spotify', 'tiktok', 'instagram']}
        >
          <SourcePills
            selectedSource={selectedSource}
            onSourceChange={setSelectedSource}
          />
          <Text variant="caption" color="muted">
            Sélectionné : {selectedSource}
          </Text>
        </Section>

        {/* ─── TRIAGE MODE TOGGLE ─── */}
        <Section
          title="TriageModeToggle"
          role="Pill d'accès au mode triage dans la Library. Affiche le nombre de nouveaux contenus. Se masque si inboxCount=0."
          states={['count normal', 'count > 99 (99+)', 'count = 0 (masqué)']}
        >
          <Row>
            <TriageModeToggle inboxCount={12} onPress={logAction('Triage opened')} />
          </Row>
          <Row>
            <TriageModeToggle inboxCount={150} onPress={logAction('Triage opened (150)')} />
          </Row>
          <Text variant="caption" color="muted">inboxCount=0 : ne rend rien</Text>
          <TriageModeToggle inboxCount={0} onPress={noop} />
        </Section>

        {/* ─── SWIPE CARD ─── */}
        <Section
          title="SwipeCard"
          role="Conteneur gestuel swipeable (pan X). Seuil à 35% ou 500px/s. Retour haptic au seuil et au commit. Contrôle impératif via ref."
          states={['idle', 'dragging', 'swipe-left (archive)', 'swipe-right (learn)', 'disabled']}
        >
          <View style={{ height: 120 }}>
            <SwipeCard
              ref={swipeRef}
              onSwipeLeft={logAction('Swiped LEFT (archive)')}
              onSwipeRight={logAction('Swiped RIGHT (learn)')}
            >
              <View style={s.swipeDemo}>
                <Text variant="body" weight="semibold">Swipe me!</Text>
                <Text variant="caption" color="secondary">← Archive | Learn →</Text>
              </View>
            </SwipeCard>
          </View>
          <Row>
            <Button size="sm" variant="outline" onPress={() => swipeRef.current?.swipeLeft()}>
              ← Archive
            </Button>
            <Button size="sm" variant="primary" onPress={() => swipeRef.current?.swipeRight()}>
              Learn →
            </Button>
          </Row>
        </Section>

        {/* ─── SWIPEABLE CONTENT CARD ─── */}
        <Section
          title="SwipeableContentCard"
          role="ContentCard wrappée dans un Swipeable. Swipe gauche = action supprimer (rouge). Utilisé dans la page thème pour retirer un contenu."
          states={['idle', 'swiped (delete visible)', 'selected', 'selectionMode']}
        >
          <SwipeableContentCard
            id="demo-1"
            title="La plasticité synaptique expliquée"
            source="youtube"
            channelName="ScienceEtonnante"
            duration={743}
            onPress={logAction('Card pressed')}
            onDelete={logAction('Card deleted')}
          />
          <SwipeableContentCard
            id="demo-2"
            title="Deep Work — les secrets de la concentration"
            source="spotify"
            channelName="Huberman Lab"
            duration={3600}
            onPress={logAction('Card pressed')}
            onDelete={logAction('Card deleted')}
          />
        </Section>

        {/* ─── SESSION CARD ─── */}
        <Section
          title="SessionCard"
          role="Carte de session de quiz complétée dans l'onglet Révisions. Affiche thumbnails empilées, nombre de questions, date relative et badge d'accuracy coloré."
          states={['accuracy >= 80% (vert)', 'accuracy >= 50% (orange)', 'accuracy < 50% (rouge)']}
        >
          <SessionCard
            session={MOCK_SESSION}
            onPress={logAction('Session pressed (80%)')}
          />
          <SessionCard
            session={MOCK_SESSION_LOW}
            onPress={logAction('Session pressed (38%)')}
          />
        </Section>

        {/* ─── DIGEST CLOSURE ─── */}
        <Section
          title="DigestClosure"
          role="Écran de résultats plein-page après un Digest (quiz enchaîné). Affiche score, meilleur streak et durée. Bouton retour."
          states={['score élevé', 'score moyen', 'score faible']}
        >
          <Button size="sm" variant="secondary" onPress={() => setShowDigestClosure(true)}>
            Afficher (7/10, streak 4, 3m05s)
          </Button>
        </Section>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  pageTitle: {
    marginBottom: spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    letterSpacing: 1.5,
    marginBottom: 0,
  },
  docBlock: {
    marginBottom: spacing.xs,
  },
  statesText: {
    marginTop: 2,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  badgeDemo: {
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xl,
  },
  swipeDemo: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  overlayClose: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
});
