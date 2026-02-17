// Quiz Generation Service - Uses LLM to generate quiz questions from transcripts
import { prisma } from '../config/database.js';
import { ContentStatus, QuizType } from '@prisma/client';
import { getLLMClient, generateText } from './llm.js';
import pLimit from 'p-limit';
import { llmLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'quiz-generation' });

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizGenerationResult {
  questions: GeneratedQuestion[];
  isEducational: boolean;
  rejectionReason?: string;
}

// Maximum tokens to send to LLM (roughly 4 chars per token)
const MAX_TRANSCRIPT_CHARS = 12000;

/** Map platform enum to content type and display label */
function getContentTypeAndLabel(platform: string): { type: 'video' | 'podcast' | 'tiktok' | 'reel'; label: string } {
  switch (platform) {
    case 'YOUTUBE':   return { type: 'video', label: 'YouTube' };
    case 'TIKTOK':    return { type: 'tiktok', label: 'TikTok' };
    case 'INSTAGRAM': return { type: 'reel', label: 'Instagram' };
    case 'SPOTIFY':
    default:          return { type: 'podcast', label: 'Spotify' };
  }
}

/** Resolve creator name from Content fields, returns null if none available */
function getCreatorName(content: {
  channelName?: string | null;
  authorUsername?: string | null;
  showName?: string | null;
}): string | null {
  return content.channelName || content.authorUsername || content.showName || null;
}

/** Build self-referential context string for quiz prompt injection */
function buildCreatorContext(
  platformLabel: string,
  creatorName: string | null,
  capturedAt?: Date | null
): string {
  const platformRef =
    platformLabel === 'TikTok' ? 'video TikTok' :
    platformLabel === 'Instagram' ? 'reel Instagram' :
    platformLabel === 'YouTube' ? 'video YouTube' :
    'podcast Spotify';

  const creatorRef = creatorName ? ` de ${creatorName}` : '';

  const temporalRef = capturedAt
    ? ` (contenu que tu as ${platformLabel === 'Spotify' ? 'ecoute' : 'regarde'} le ${capturedAt.toLocaleDateString('fr-FR')})`
    : '';

  return `cette ${platformRef}${creatorRef}${temporalRef}`;
}

/**
 * Chunk a long transcript into manageable pieces
 */
function chunkTranscript(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Fetch existing quiz questions for a content to avoid repetitions
 */
async function fetchExistingQuestions(contentId: string): Promise<string[]> {
  const existingQuizzes = await prisma.quiz.findMany({
    where: { contentId },
    select: { question: true },
  });
  return existingQuizzes.map(q => q.question);
}

/**
 * Generate quiz questions from transcript using configured LLM
 */
export async function generateQuizFromTranscript(
  transcript: string,
  contentTitle: string,
  _contentType: 'video' | 'podcast' | 'tiktok' | 'reel',
  contentMetadata: {
    creatorName: string | null;
    platformLabel: string;
    capturedAt?: Date | null;
  },
  existingQuestions: string[] = []
): Promise<QuizGenerationResult> {
  const llm = getLLMClient();

  const creatorContext = buildCreatorContext(
    contentMetadata.platformLabel,
    contentMetadata.creatorName,
    contentMetadata.capturedAt
  );

  // Chunk transcript if too long
  const chunks = chunkTranscript(transcript, MAX_TRANSCRIPT_CHARS);

  // Use first chunk for quality assessment, all chunks for questions
  const assessmentChunk = chunks[0];

  // Assess content topics (very permissive - almost all content can have quiz questions)
  const assessmentPrompt = `Analyse cette transcription de ${creatorContext} et identifie les sujets principaux abordés.

Titre: "${contentTitle}"

Extrait de la transcription:
"""
${assessmentChunk.substring(0, 3000)}
"""

Sois TRÈS permissif. TOUT contenu contenant des idées, concepts, histoires, opinions, conseils ou informations peut servir à générer des questions de quiz.

Rejette UNIQUEMENT si le contenu est de la musique pure, du silence, ou complètement inintelligible.

Pour chaque sujet identifié, précise le niveau de complexité (basique, intermédiaire, avancé).

Réponds en JSON uniquement:
{
  "isEducational": true,
  "reason": "Brève description du contenu",
  "mainTopics": ["sujet1", "sujet2", "sujet3"],
  "complexity": "basique|intermédiaire|avancé",
  "contentStyle": "explicatif|narratif|conversationnel|argumentatif"
}`;

  const assessmentResponse = await llmLimiter(() => llm.chatCompletion({
    messages: [
      {
        role: 'system',
        content: 'Tu es un analyste de contenu pédagogique. Sois très permissif - la plupart des contenus peuvent générer des questions de quiz intéressantes. Identifie précisément les sujets et le niveau de complexité. Réponds uniquement en JSON valide.',
      },
      {
        role: 'user',
        content: assessmentPrompt,
      },
    ],
    temperature: 0.2,
    jsonMode: true,
  }));

  const assessment = JSON.parse(assessmentResponse.content || '{ "isEducational": true, "mainTopics": [] }');

  // Almost never reject - only if explicitly marked as not educational AND has a strong reason
  if (assessment.isEducational === false && assessment.reason?.toLowerCase().includes('unintelligible')) {
    return {
      questions: [],
      isEducational: false,
      rejectionReason: assessment.reason || 'Content not suitable for quiz',
    };
  }

  // Build anti-repetition block
  const antiRepetitionBlock = existingQuestions.length > 0
    ? `\nQUESTIONS DEJA POSEES (NE PAS repeter ni reformuler ces questions) :\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : '';

  // Generate questions from the transcript
  const allQuestions: GeneratedQuestion[] = [];

  // Process each chunk (max 2 chunks to keep costs reasonable)
  for (let i = 0; i < Math.min(chunks.length, 2); i++) {
    const chunk = chunks[i];
    const questionsNeeded = i === 0 ? 3 : 2; // 3 from first chunk, 2 from second

    const questionPrompt = `Genere ${questionsNeeded} questions de quiz a choix multiples basees sur ce contenu.

Titre: "${contentTitle}"
Sujets principaux: ${assessment.mainTopics?.join(', ') || 'Culture generale'}
Style du contenu: ${assessment.contentStyle || 'explicatif'}

Contenu source:
"""
${chunk}
"""
${antiRepetitionBlock}
OBJECTIF PEDAGOGIQUE:
Les questions doivent tester les CONNAISSANCES ACQUISES par l'utilisateur (concepts, faits, mecanismes, applications).
L'utilisateur doit pouvoir repondre grace a ce qu'il a APPRIS, pas en se souvenant des mots exacts du contenu.

FORMULATION DES QUESTIONS - CONTEXTUALISATION OBLIGATOIRE:
- Chaque question DOIT mentionner la source: "${creatorContext}"
- CORRECT: "Dans ${creatorContext}, quel concept est explique concernant [sujet] ?"
- CORRECT: "Selon ${creatorContext}, pourquoi [phenomene] se produit-il ?"
- CORRECT: "D'apres ${creatorContext}, comment fonctionne [mecanisme] ?"
- CORRECT: "Quelle est la difference entre X et Y, telle que presentee dans ${creatorContext} ?"
- INTERDIT: "Quel terme est utilise pour...", "Quelle expression est employee..."
- INTERDIT: Toute reference a la transcription en tant que telle
- La question doit rester une question de CONNAISSANCE, pas de memorisation de mots

PRINCIPES PEDAGOGIQUES (taxonomie de Bloom) - Varie les niveaux cognitifs:
- Comprendre: "Qu'est-ce que [concept] ?" / "Quel est le lien entre X et Y ?"
- Appliquer: "Dans quelle situation utiliserait-on [concept] ?" / "Comment appliquer [idee] a [contexte] ?"
- Analyser: "Pourquoi [fait] est-il important ?" / "Quelle est la cause principale de [phenomene] ?"

VARIATION OBLIGATOIRE:
- Chaque question doit aborder un ANGLE DIFFERENT (pas deux questions sur le meme sous-concept)
- Varier les niveaux de difficulte (au moins 2 niveaux differents)
- Varier les types: definition, mecanisme, application, comparaison, cause-effet

REGLES POUR LES DISTRACTEURS (options incorrectes):
- Chaque distracteur doit etre PLAUSIBLE (pas absurde ni evident)
- Utiliser des erreurs de comprehension courantes comme distracteurs
- Les distracteurs ne doivent PAS etre partiellement corrects
- Eviter les patterns previsibles (option la plus longue = correcte, etc.)
- Varier la position de la bonne reponse (pas toujours A ou B)

REGLES POUR LES QUESTIONS:
1. Chaque question teste UN concept precis
2. La question doit etre impossible a repondre correctement sans avoir compris le sujet
3. 4 options exactement (A, B, C, D), une seule correcte
4. L'explication doit dire POURQUOI la bonne reponse est correcte ET pourquoi les autres ne le sont pas (1-2 phrases)
5. Tout en FRANCAIS

Reponds uniquement en JSON:
{
  "questions": [
    {
      "question": "Question claire et specifique ?",
      "options": ["A) Option", "B) Option", "C) Option", "D) Option"],
      "correctAnswer": "A",
      "explanation": "Explication: pourquoi c'est correct et pourquoi les autres options ne le sont pas.",
      "bloomLevel": "comprendre|appliquer|analyser"
    }
  ]
}`;

    try {
      const questionResponse = await llmLimiter(() => llm.chatCompletion({
        messages: [
          {
            role: 'system',
            content: `Tu es un concepteur pedagogique expert en creation de quiz. Tu crees des questions qui testent les CONNAISSANCES REELLES acquises, comme dans un examen universitaire ou un manuel scolaire.

REGLE DE CONTEXTUALISATION: Chaque question DOIT mentionner le createur et la plateforme source pour creer un effet auto-referentiel. Utilise "${creatorContext}" comme reference dans chaque question. Les questions testent des CONNAISSANCES REELLES mais ancrees dans le contexte de consommation de l'utilisateur.

Principes scientifiques:
- Testing effect: les questions renforcent la memorisation mieux que la relecture
- Desirable difficulties: un niveau de difficulte optimal stimule l'apprentissage
- Elaborative interrogation: demander "pourquoi" et "comment" ancre les connaissances
- Transfer learning: les questions doivent permettre d'appliquer les connaissances dans d'autres contextes

Genere des questions en FRANCAIS qui testent la comprehension profonde et l'acquisition de connaissances. Reponds uniquement en JSON valide.`,
          },
          {
            role: 'user',
            content: questionPrompt,
          },
        ],
        temperature: 0.7,
        jsonMode: true,
      }));

      const result = JSON.parse(questionResponse.content || '{"questions": []}');

      if (result.questions && Array.isArray(result.questions)) {
        allQuestions.push(...result.questions);
      }
    } catch (error) {
      log.error({ err: error, chunkIndex: i }, 'Error generating questions from chunk');
    }
  }

  return {
    questions: allQuestions,
    isEducational: true,
  };
}

/**
 * Generate study memo from transcript
 */
export async function generateMemoFromTranscript(
  transcript: string,
  contentTitle: string,
  tags: string[]
): Promise<string> {
  const transcriptText = transcript.slice(0, 8000); // Limit for LLM context
  const tagsStr = tags.length > 0 ? tags.join(', ') : '';

  const systemPrompt = `Tu es un expert en sciences cognitives spécialisé dans l'optimisation de la rétention mémorielle.

Tu crées des mémos d'étude basés sur ces principes scientifiques:
- Chunking: regrouper l'information en blocs cohérents (Miller, 1956)
- Elaborative interrogation: inclure des "pourquoi" pour ancrer les connaissances
- Dual coding: associer concepts abstraits à des exemples concrets
- Hierarchical organization: du plus important au moins important

Format du mémo:
1. IDÉE PRINCIPALE (1 phrase résumant l'essentiel)
2. CONCEPTS CLÉS (4-6 points, chacun = 1 idée + 1 détail/exemple)
3. CONNEXIONS (1-2 liens avec des connaissances générales ou d'autres domaines)

Contraintes:
- Maximum 250 mots
- Entièrement en français
- Bullet points avec tirets (-)
- Langage clair et direct, pas de jargon inutile
- Chaque point doit être auto-suffisant (compréhensible seul)`;

  const userPrompt = `Titre: ${contentTitle}
${tagsStr ? `Thèmes: ${tagsStr}` : ''}

Transcription:
${transcriptText}

Génère un mémo d'étude structuré optimisé pour la rétention à long terme.`;

  return generateText(userPrompt, { system: systemPrompt, temperature: 0.7 });
}

/**
 * Generate a concise synopsis from transcription + description
 */
export async function generateSynopsis(
  transcript: string,
  description: string | null,
  contentTitle: string
): Promise<string> {
  const transcriptText = transcript.slice(0, 6000);
  const descriptionText = description?.slice(0, 500) || '';

  const systemPrompt = `Tu es un rédacteur expert. Tu génères des synopsis très concis (1-2 phrases courtes) qui résument ce qu'un utilisateur va apprendre.

Règles:
- Maximum 2 phrases COURTES (40 mots max au total)
- Parle du CONTENU et des CONNAISSANCES, pas de l'auteur ni du format
- Pas de "Cette vidéo parle de...", "Découvrez...", "L'auteur explique..."
- Style direct et factuel
- Entièrement en français`;

  const userPrompt = `Titre: "${contentTitle}"
${descriptionText ? `Description originale: "${descriptionText}"` : ''}

Transcription (extrait):
"""
${transcriptText}
"""

Génère un synopsis de 1-2 phrases courtes (40 mots max) résumant les connaissances clés.`;

  return generateText(userPrompt, { system: systemPrompt, temperature: 0.5 });
}

// ============================================================================
// Synthesis Question Generation (Cross-content)
// ============================================================================

interface SynthesisGenerationResult {
  questions: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    sourceIndices: number[];
  }[];
}

/**
 * Generate cross-content synthesis questions for a theme.
 * Requires 2+ content memos to create questions that connect ideas from different sources.
 */
export async function generateSynthesisQuestions(
  themeName: string,
  contentMemos: { id: string; title: string; memo: string }[],
  maxQuestions: number = 5
): Promise<SynthesisGenerationResult> {
  if (contentMemos.length < 2) {
    return { questions: [] };
  }

  try {
    const memosText = contentMemos
      .map((cm, i) => `[Source ${i + 1}: "${cm.title}"]\n${cm.memo.substring(0, 2000)}`)
      .join('\n\n---\n\n');

    const systemPrompt = `Tu es un concepteur pedagogique expert specialise dans les questions de SYNTHESE inter-contenus.

Regles:
- Chaque question DOIT necessiter la comprehension d'AU MOINS 2 sources differentes
- Les questions doivent relier, comparer ou connecter des idees provenant de sources distinctes
- Types de synthese: comparaison, cause-effet, generalisation, contradiction, complementarite
- 4 options (A-D), une seule correcte
- Les distracteurs doivent etre plausibles -- ils pourraient etre vrais si on ne connait qu'UNE seule source
- L'explication doit nommer les sources concernees
- Tout en FRANCAIS
- Reponds UNIQUEMENT en JSON valide`;

    const userPrompt = `Theme: "${themeName}"
Nombre de sources: ${contentMemos.length}

${memosText}

Genere ${maxQuestions} questions de synthese qui connectent les idees de plusieurs sources.

Format JSON attendu:
{
  "questions": [
    {
      "question": "Question de synthese claire ?",
      "options": ["A) Option", "B) Option", "C) Option", "D) Option"],
      "correctAnswer": "B",
      "explanation": "Explication mentionnant les sources...",
      "sourceIndices": [1, 3]
    }
  ]
}`;

    const response = await llmLimiter(() =>
      getLLMClient().chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        jsonMode: true,
      })
    );

    const parsed = JSON.parse(response.content || '{"questions": []}');

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      log.warn({ themeName }, 'Synthesis generation returned invalid format');
      return { questions: [] };
    }

    // Post-process: filter out questions where sourceIndices has fewer than 2 entries
    const validQuestions = parsed.questions.filter(
      (q: any) => Array.isArray(q.sourceIndices) && q.sourceIndices.length >= 2
    );

    log.info(
      { themeName, questionCount: validQuestions.length, contentCount: contentMemos.length },
      'Synthesis questions generated'
    );

    return { questions: validQuestions };
  } catch (error) {
    log.error({ err: error, themeName }, 'Error generating synthesis questions');
    return { questions: [] };
  }
}

/**
 * Process content to generate quiz questions and create cards
 */
export async function processContentQuiz(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      transcript: true,
      quizzes: true,
      tags: true, // Include tags for memo generation
    },
  });

  if (!content) {
    log.error({ contentId }, 'Content not found');
    return false;
  }

  // Check if already has quizzes
  if (content.quizzes.length > 0) {
    log.debug({ contentId }, 'Content already has quizzes');
    return true;
  }

  // Must have transcript
  if (!content.transcript) {
    log.debug({ contentId }, 'Content has no transcript, skipping');
    return false;
  }

  // Update status to generating
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.GENERATING },
  });

  try {
    const { type: contentType, label: platformLabel } = getContentTypeAndLabel(content.platform);
    const creatorName = getCreatorName(content);

    log.info({ contentId, title: content.title, platform: content.platform, creator: creatorName }, 'Generating quiz');
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType,
      {
        creatorName,
        platformLabel,
        capturedAt: content.capturedAt,
      }
    );

    if (!result.isEducational) {
      log.warn({ contentId, reason: result.rejectionReason }, 'Content not educational');
      // Still mark as ready, but with no quizzes
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
      return true;
    }

    if (result.questions.length === 0) {
      log.warn({ contentId }, 'No questions generated');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
      return true;
    }

    // Create quizzes and cards in transaction
    await prisma.$transaction(async (tx) => {
      // SRS-01: First review in 24h
      const cardNextReview = new Date();
      cardNextReview.setDate(cardNextReview.getDate() + 1);

      for (const q of result.questions) {
        // Create quiz
        const quiz = await tx.quiz.create({
          data: {
            contentId: content.id,
            question: q.question,
            type: QuizType.MULTIPLE_CHOICE,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          },
        });

        // Create card for the user who owns this content
        await tx.card.create({
          data: {
            quizId: quiz.id,
            userId: content.userId,
            nextReviewAt: cardNextReview,
          },
        });
      }

      // Update content status
      await tx.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
    });

    // Generate memo + synopsis in parallel (non-blocking, after quiz creation)
    const postProcessing: Promise<void>[] = [];

    // Memo generation
    postProcessing.push(
      (async () => {
        log.debug({ contentId, title: content.title }, 'Generating memo');
        try {
          const tagNames = content.tags.map(t => t.name);
          const memo = await generateMemoFromTranscript(
            content.transcript!.text,
            content.title,
            tagNames
          );
          await prisma.transcript.update({
            where: { id: content.transcript!.id },
            data: {
              segments: {
                ...(content.transcript!.segments as object || {}),
                memo,
                memoGeneratedAt: new Date().toISOString(),
              },
            },
          });
          log.info({ contentId }, 'Memo generated and cached');
        } catch (memoError) {
          log.error({ err: memoError, contentId }, 'Memo generation failed');
        }
      })()
    );

    // Synopsis generation
    if (!content.synopsis) {
      postProcessing.push(
        (async () => {
          try {
            const synopsis = await generateSynopsis(
              content.transcript!.text,
              content.description,
              content.title
            );
            await prisma.content.update({
              where: { id: contentId },
              data: { synopsis },
            });
            log.info({ contentId }, 'Synopsis generated');
          } catch (synopsisError) {
            log.error({ err: synopsisError, contentId }, 'Synopsis generation failed');
          }
        })()
      );
    }

    await Promise.allSettled(postProcessing);

    log.info({ contentId, questionCount: result.questions.length, title: content.title }, 'Quiz generation completed');
    return true;

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTransient = /429|rate.limit|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|503|502|socket hang up/i.test(errorMsg);

    if (isTransient) {
      // Revert to SELECTED so the cron worker retries on next run
      log.warn({ err: error, contentId }, 'Transient error during quiz generation, will retry');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.SELECTED },
      });
    } else {
      log.error({ err: error, contentId }, 'Permanent error generating quiz');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.FAILED },
      });
    }
    return false;
  }
}

/**
 * Regenerate quiz for content (user requested)
 */
export async function regenerateQuiz(contentId: string): Promise<boolean> {
  // Fetch existing questions BEFORE deleting for anti-repetition
  const previousQuestions = await fetchExistingQuestions(contentId);

  log.info(
    { contentId, previousQuestionCount: previousQuestions.length },
    'Regenerating quiz with anti-repetition context'
  );

  // Delete existing quizzes and cards
  await prisma.quiz.deleteMany({
    where: { contentId },
  });

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true, quizzes: true, tags: true },
  });

  if (!content || !content.transcript) {
    log.error({ contentId }, 'Content or transcript not found for regeneration');
    return false;
  }

  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.GENERATING },
  });

  try {
    const { type: contentType, label: platformLabel } = getContentTypeAndLabel(content.platform);
    const creatorName = getCreatorName(content);
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType,
      {
        creatorName,
        platformLabel,
        capturedAt: content.capturedAt,
      },
      previousQuestions
    );

    if (!result.isEducational || result.questions.length === 0) {
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
      return true;
    }

    await prisma.$transaction(async (tx) => {
      // SRS-01: First review in 24h
      const regenNextReview = new Date();
      regenNextReview.setDate(regenNextReview.getDate() + 1);

      for (const q of result.questions) {
        const quiz = await tx.quiz.create({
          data: {
            contentId: content.id,
            question: q.question,
            type: QuizType.MULTIPLE_CHOICE,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          },
        });
        await tx.card.create({
          data: { quizId: quiz.id, userId: content.userId, nextReviewAt: regenNextReview },
        });
      }
      await tx.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
    });

    log.info({ contentId, questionCount: result.questions.length }, 'Quiz regeneration completed');
    return true;
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTransient = /429|rate.limit|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|503|502|socket hang up/i.test(errorMsg);
    if (isTransient) {
      await prisma.content.update({ where: { id: contentId }, data: { status: ContentStatus.SELECTED } });
    } else {
      await prisma.content.update({ where: { id: contentId }, data: { status: ContentStatus.FAILED } });
    }
    return false;
  }
}

/**
 * Background worker to process pending quiz generation
 */
export async function runQuizGenerationWorker(): Promise<void> {
  log.info('Quiz generation worker starting');

  // Recovery: unstick items stuck in GENERATING for >10 minutes (e.g. after PM2 restart)
  const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const stuckItems = await prisma.content.updateMany({
    where: {
      status: ContentStatus.GENERATING,
      updatedAt: { lt: stuckCutoff },
    },
    data: { status: ContentStatus.SELECTED },
  });
  if (stuckItems.count > 0) {
    log.warn({ count: stuckItems.count }, 'Reset stuck GENERATING items back to SELECTED');
  }

  // Get content items with transcripts that need quiz generation (SELECTED only)
  // INBOX content is pre-transcribed but must wait for user triage before quiz gen
  const pendingContent = await prisma.content.findMany({
    where: {
      status: ContentStatus.SELECTED,
      transcript: { isNot: null },
      quizzes: { none: {} },
    },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });

  if (pendingContent.length === 0) {
    log.debug('No pending content for quiz generation');
    return;
  }

  log.info({ count: pendingContent.length }, 'Processing pending content');

  let success = 0;
  let failed = 0;

  const limit = pLimit(3); // Each quiz needs ~3 LLM calls (assessment + questions + memo)

  const results = await Promise.allSettled(
    pendingContent.map(content =>
      limit(() => processContentQuiz(content.id))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      success++;
    } else {
      failed++;
    }
  }

  log.info({ success, failed }, 'Quiz generation worker completed');
}

/**
 * Backfill synopsis for existing content that has transcript but no synopsis
 */
export async function runSynopsisBackfill(): Promise<void> {
  log.info('Synopsis backfill starting');

  const contents = await prisma.content.findMany({
    where: {
      synopsis: null,
      transcript: { isNot: null },
    },
    include: { transcript: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  if (contents.length === 0) {
    log.debug('No content needs synopsis backfill');
    return;
  }

  log.info({ count: contents.length }, 'Backfilling synopsis');

  const limit = pLimit(3);
  let success = 0;

  await Promise.allSettled(
    contents.map(content =>
      limit(async () => {
        try {
          const synopsis = await generateSynopsis(
            content.transcript!.text,
            content.description,
            content.title
          );
          await prisma.content.update({
            where: { id: content.id },
            data: { synopsis },
          });
          success++;
        } catch (err) {
          log.error({ err, contentId: content.id }, 'Synopsis backfill failed for content');
        }
      })
    )
  );

  log.info({ success, total: contents.length }, 'Synopsis backfill completed');
}
