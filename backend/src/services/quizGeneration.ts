// Quiz Generation Service - Uses LLM to generate quiz questions from transcripts
import { prisma } from '../config/database.js';
import { ContentStatus, QuizType } from '@prisma/client';
import { getLLMClient, generateText } from './llm.js';
import pLimit from 'p-limit';
import { llmLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';
import { sendPushToUser } from './pushNotifications.js';
import { cloneFromDonor } from './contentDedup.js';
import { getPromptLocale } from './promptLocale.js';
import { formatDateForUser } from '../utils/formatLocale.js';
import { normalizeLanguage } from '../utils/language.js';

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
  creatorContext?: string;
  contextCues?: string[];
}

// Maximum tokens to send to LLM (roughly 4 chars per token)
const MAX_TRANSCRIPT_CHARS = 12000;

/**
 * Compute target number of quiz questions based on transcript length.
 * Longer content → more questions to cover breadth of material.
 */
function computeTargetQuestionCount(transcriptLength: number): number {
  if (transcriptLength <= 2_000) return 3;   // Reel Instagram, TikTok court
  if (transcriptLength <= 8_000) return 5;   // Video YouTube standard (5-10 min)
  if (transcriptLength <= 30_000) return 7;  // Video moyenne (10-30 min)
  if (transcriptLength <= 80_000) return 10; // Podcast/video longue (30-60 min)
  return 15;                                  // Podcast 1h+
}

/**
 * Distribute a target question count across N chunks.
 * Max 5 questions per chunk (LLM quality degrades beyond that).
 * Returns an array where index i = number of questions for chunk i.
 */
function distributeQuestionsAcrossChunks(target: number, chunkCount: number): number[] {
  const MAX_PER_CHUNK = 5;
  const usableChunks = Math.min(chunkCount, Math.ceil(target / MAX_PER_CHUNK));
  const distribution: number[] = [];
  let remaining = target;

  for (let i = 0; i < usableChunks; i++) {
    const chunksLeft = usableChunks - i;
    const perChunk = Math.min(MAX_PER_CHUNK, Math.ceil(remaining / chunksLeft));
    distribution.push(perChunk);
    remaining -= perChunk;
  }

  return distribution;
}

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
  capturedAt?: Date | null,
  language: string = 'fr'
): string {
  const locale = getPromptLocale(language);
  const platformRef = locale.platformRef(platformLabel);

  const creatorRef = creatorName
    ? (language === 'en' ? ` by ${creatorName}` : ` de ${creatorName}`)
    : '';

  const verb = platformLabel === 'Spotify' ? locale.listened : locale.watched;

  const temporalRef = capturedAt
    ? (language === 'en'
        ? ` (content you ${verb} on ${formatDateForUser(capturedAt, language)})`
        : ` (contenu que tu as ${verb} le ${formatDateForUser(capturedAt, language)})`)
    : '';

  return locale.contentRef(platformRef, creatorRef, temporalRef);
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
  existingQuestions: string[] = [],
  targetQuestionCount?: number,
  language: string = 'fr'
): Promise<QuizGenerationResult> {
  const llm = getLLMClient();
  const locale = getPromptLocale(language);

  const creatorContext = buildCreatorContext(
    contentMetadata.platformLabel,
    contentMetadata.creatorName,
    contentMetadata.capturedAt,
    language
  );

  // Chunk transcript if too long
  const chunks = chunkTranscript(transcript, MAX_TRANSCRIPT_CHARS);

  // Use first chunk for quality assessment, all chunks for questions
  const assessmentChunk = chunks[0];

  // Assess content topics and filter doomscrolling content
  const assessmentPrompt = locale.assessmentUserPrompt(creatorContext, contentTitle, assessmentChunk.substring(0, 3000));

  const assessmentResponse = await llmLimiter(() => llm.chatCompletion({
    messages: [
      {
        role: 'system',
        content: locale.assessmentSystemPrompt,
      },
      {
        role: 'user',
        content: assessmentPrompt,
      },
    ],
    temperature: 0.2,
    jsonMode: true,
  }));

  const assessment = JSON.parse(assessmentResponse.content || '{ "isEducational": true, "isDoomscrolling": false, "mainTopics": [], "contextCues": [] }');

  // Reject if not educational OR if pure doomscrolling content
  if (assessment.isEducational === false || assessment.isDoomscrolling === true) {
    return {
      questions: [],
      isEducational: false,
      rejectionReason: assessment.reason || 'Content not suitable for quiz',
      creatorContext,
      contextCues: assessment.contextCues || [],
    };
  }

  // Generate questions from the transcript
  const allQuestions: GeneratedQuestion[] = [];

  // Adaptive distribution: compute how many questions per chunk
  const target = targetQuestionCount ?? 5; // fallback to legacy default
  const distribution = distributeQuestionsAcrossChunks(target, chunks.length);

  log.info(
    { target, chunkCount: chunks.length, distribution, transcriptLength: transcript.length },
    'Adaptive question distribution computed'
  );

  // Accumulate all question texts (existing + newly generated) for inter-chunk anti-repetition
  const allGeneratedQuestionTexts: string[] = [...existingQuestions];

  // Extract context cues for self-reference effect
  const contextCues = assessment.contextCues || [];
  const contextCuesStr = contextCues.length > 0 ? contextCues.join(', ') : (language === 'en' ? 'no context cues available' : 'aucun indice contextuel disponible');

  for (let i = 0; i < distribution.length; i++) {
    const chunk = chunks[i];
    const questionsNeeded = distribution[i];

    // Track if this is the first question batch (for anchoring vs fluidity)
    const isFirstBatch = allQuestions.length === 0;

    // Build anti-repetition block dynamically (includes questions from previous chunks)
    const dynamicAntiRepetitionBlock = allGeneratedQuestionTexts.length > 0
      ? `\n${language === 'en' ? 'QUESTIONS ALREADY ASKED (DO NOT repeat or rephrase these questions)' : 'QUESTIONS DEJA POSEES (NE PAS repeter ni reformuler ces questions)'}:\n${allGeneratedQuestionTexts.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}\n`
      : '';

    const questionPrompt = locale.quizUserPrompt({
      questionsNeeded,
      contentTitle,
      mainTopics: assessment.mainTopics?.join(', ') || '',
      contentStyle: assessment.contentStyle || '',
      isFirstBatch,
      chunk,
      antiRepetitionBlock: dynamicAntiRepetitionBlock,
    });

    try {
      const questionResponse = await llmLimiter(() => llm.chatCompletion({
        messages: [
          {
            role: 'system',
            content: locale.quizSystemPrompt(creatorContext, contextCuesStr),
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
        // Cap to requested count per chunk (LLM may overshoot)
        const cappedQuestions = result.questions.slice(0, questionsNeeded);
        allQuestions.push(...cappedQuestions);
        // Accumulate for inter-chunk anti-repetition
        for (const q of cappedQuestions) {
          allGeneratedQuestionTexts.push(q.question);
        }
      }
    } catch (error) {
      log.error({ err: error, chunkIndex: i }, 'Error generating questions from chunk');
    }
  }

  // Final deduplication: remove exact duplicate questions
  const seen = new Set<string>();
  const dedupedQuestions = allQuestions.filter(q => {
    const normalized = q.question.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // Cap to target total
  const finalQuestions = dedupedQuestions.slice(0, target);

  if (finalQuestions.length < allQuestions.length) {
    log.info(
      { original: allQuestions.length, deduped: dedupedQuestions.length, final: finalQuestions.length, target },
      'Questions trimmed after dedup and cap'
    );
  }

  return {
    questions: finalQuestions,
    isEducational: true,
    creatorContext,
    contextCues: assessment.contextCues || [],
  };
}

/**
 * Generate study carousel from transcript (carousel format for mobile)
 */
export async function generateMemoFromTranscript(
  transcript: string,
  contentTitle: string,
  tags: string[],
  creatorContext?: string,
  contextCues?: string[],
  language: string = 'fr'
): Promise<string> {
  const locale = getPromptLocale(language);
  const transcriptText = transcript.slice(0, 8000);
  const tagsStr = tags.length > 0 ? tags.join(', ') : '';
  const contextCuesStr = contextCues && contextCues.length > 0 ? contextCues.join(', ') : (language === 'en' ? 'no context cues available' : 'aucun indice contextuel disponible');
  const creatorCtx = creatorContext || (language === 'en' ? 'this content' : 'ce contenu');

  const systemPrompt = locale.memoSystemPrompt(creatorCtx);
  const userPrompt = locale.memoUserPrompt({ contentTitle, creatorCtx, contextCuesStr, tagsStr, transcriptText });

  return generateText(userPrompt, { system: systemPrompt, temperature: 0.5 });
}

/**
 * Generate a cognitive synopsis from transcription + description (curiosity gap trigger)
 */
export async function generateSynopsis(
  transcript: string,
  description: string | null,
  contentTitle: string,
  creatorContext?: string,
  contextCues?: string[],
  language: string = 'fr'
): Promise<string> {
  const locale = getPromptLocale(language);
  const transcriptText = transcript.slice(0, 6000);
  const descriptionText = description?.slice(0, 500) || '';
  const creatorCtx = creatorContext || (language === 'en' ? 'this content' : 'ce contenu');
  const contextCuesStr = contextCues && contextCues.length > 0 ? contextCues.join(', ') : (language === 'en' ? 'no context cues available' : 'aucun indice contextuel disponible');

  const systemPrompt = locale.synopsisSystemPrompt(creatorCtx);
  const userPrompt = locale.synopsisUserPrompt({ contentTitle, creatorCtx, contextCuesStr, descriptionText, transcriptText });

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
  maxQuestions: number = 5,
  language: string = 'fr'
): Promise<SynthesisGenerationResult> {
  if (contentMemos.length < 2) {
    return { questions: [] };
  }

  try {
    const locale = getPromptLocale(language);
    const memosText = contentMemos
      .map((cm, i) => `[Source ${i + 1}: "${cm.title}"]\n${cm.memo.substring(0, 2000)}`)
      .join('\n\n---\n\n');

    const systemPrompt = locale.synthesisSystemPrompt;
    const userPrompt = locale.synthesisUserPrompt({ themeName, contentCount: contentMemos.length, memosText, maxQuestions });

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
export async function processContentQuiz(contentId: string, language: string = 'fr'): Promise<boolean> {
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

    const targetQuestions = computeTargetQuestionCount(content.transcript.text.length);
    log.info({ contentId, title: content.title, platform: content.platform, creator: creatorName, targetQuestions, transcriptLength: content.transcript.text.length }, 'Generating quiz');
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType,
      {
        creatorName,
        platformLabel,
        capturedAt: content.capturedAt,
      },
      [],
      targetQuestions,
      language
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

        // Create card for the user who owns this content (FSRS-5 defaults)
        await tx.card.create({
          data: {
            quizId: quiz.id,
            userId: content.userId,
            stability: 3.0,
            difficulty: 5.0,
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

    // Notify user that quiz is ready
    const titleShort = content.title.length > 50
      ? content.title.substring(0, 47) + '...'
      : content.title;
    const pushTitle = language === 'en' ? 'Quiz ready!' : 'Quiz pret !';
    const pushBody = language === 'en'
      ? `${result.questions.length} questions about "${titleShort}"`
      : `${result.questions.length} questions sur "${titleShort}"`;
    sendPushToUser(
      content.userId,
      pushTitle,
      pushBody,
      { screen: '/(tabs)', contentId: content.id }
    ).catch(() => {}); // fire-and-forget, don't block pipeline

    // Generate memo + synopsis in parallel (non-blocking, after quiz creation)
    const postProcessing: Promise<void>[] = [];

    // Memo (carousel) generation with context cues for self-reference effect
    postProcessing.push(
      (async () => {
        log.debug({ contentId, title: content.title }, 'Generating carousel memo');
        try {
          const tagNames = content.tags.map(t => t.name);
          const memo = await generateMemoFromTranscript(
            content.transcript!.text,
            content.title,
            tagNames,
            result.creatorContext,
            result.contextCues || [],
            language
          );
          await prisma.content.update({
            where: { id: contentId },
            data: { memo, memoGeneratedAt: new Date() },
          });
          log.info({ contentId }, 'Carousel memo generated and cached');
        } catch (memoError) {
          log.error({ err: memoError, contentId }, 'Carousel memo generation failed');
        }
      })()
    );

    // Synopsis (cognitive trigger) generation with context cues
    if (!content.synopsis) {
      postProcessing.push(
        (async () => {
          try {
            const synopsis = await generateSynopsis(
              content.transcript!.text,
              content.description,
              content.title,
              result.creatorContext,
              result.contextCues || [],
              language
            );
            await prisma.content.update({
              where: { id: contentId },
              data: { synopsis },
            });
            log.info({ contentId }, 'Cognitive synopsis generated');
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
export async function regenerateQuiz(contentId: string, language: string = 'fr'): Promise<boolean> {
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
    const targetQuestions = computeTargetQuestionCount(content.transcript.text.length);
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType,
      {
        creatorName,
        platformLabel,
        capturedAt: content.capturedAt,
      },
      previousQuestions,
      targetQuestions,
      language
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
          data: { quizId: quiz.id, userId: content.userId, stability: 3.0, difficulty: 5.0, nextReviewAt: regenNextReview },
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

  // Try dedup first: clone from donor if another user already has quiz for same content
  let cloned = 0;
  const remainingContent = [];
  for (const content of pendingContent) {
    const ok = await cloneFromDonor(content.id);
    if (ok) {
      cloned++;
    } else {
      remainingContent.push(content);
    }
  }
  if (cloned > 0) {
    log.info({ cloned }, 'Quiz generation: cloned from donors');
  }

  if (remainingContent.length === 0) {
    log.info({ cloned }, 'Quiz generation worker completed (all cloned)');
    return;
  }

  log.info({ count: remainingContent.length }, 'Processing pending content');

  // Look up user language for each content item
  const userIds = [...new Set(remainingContent.map(c => c.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, language: true },
  });
  const userLangMap = new Map(users.map(u => [u.id, normalizeLanguage(u.language)]));

  let success = 0;
  let failed = 0;

  const limit = pLimit(3); // Each quiz needs ~3 LLM calls (assessment + questions + memo)

  const results = await Promise.allSettled(
    remainingContent.map(content =>
      limit(() => processContentQuiz(content.id, userLangMap.get(content.userId) || 'fr'))
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

  // Look up user language for each content item
  const synopsisUserIds = [...new Set(contents.map(c => c.userId))];
  const synopsisUsers = await prisma.user.findMany({
    where: { id: { in: synopsisUserIds } },
    select: { id: true, language: true },
  });
  const synopsisUserLangMap = new Map(synopsisUsers.map(u => [u.id, normalizeLanguage(u.language)]));

  const limit = pLimit(3);
  let success = 0;

  await Promise.allSettled(
    contents.map(content =>
      limit(async () => {
        try {
          const lang = synopsisUserLangMap.get(content.userId) || 'fr';
          const synopsis = await generateSynopsis(
            content.transcript!.text,
            content.description,
            content.title,
            undefined,
            undefined,
            lang
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
