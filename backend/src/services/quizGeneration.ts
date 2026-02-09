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
 * Generate quiz questions from transcript using configured LLM
 */
export async function generateQuizFromTranscript(
  transcript: string,
  contentTitle: string,
  contentType: 'video' | 'podcast'
): Promise<QuizGenerationResult> {
  const llm = getLLMClient();

  // Chunk transcript if too long
  const chunks = chunkTranscript(transcript, MAX_TRANSCRIPT_CHARS);

  // Use first chunk for quality assessment, all chunks for questions
  const assessmentChunk = chunks[0];

  // Assess content topics (very permissive - almost all content can have quiz questions)
  const assessmentPrompt = `Analyze this ${contentType} transcript and identify the main topics discussed.

Title: "${contentTitle}"

Transcript excerpt:
"""
${assessmentChunk.substring(0, 3000)}
"""

Be VERY permissive. ANY content that contains ideas, concepts, stories, opinions, advice, or information can be used for quiz questions. This includes:
- Educational/informative content
- Philosophical discussions
- Spiritual/personal development
- Entertainment with ideas
- Interviews and conversations
- Stories and narratives
- Opinion pieces

Only reject content that is purely music, pure silence, or completely unintelligible.

Respond with JSON only:
{
  "isEducational": true,
  "reason": "Brief description of what the content is about",
  "mainTopics": ["topic1", "topic2", "topic3"]
}`;

  const assessmentResponse = await llmLimiter(() => llm.chatCompletion({
    messages: [
      {
        role: 'system',
        content: 'You are a content analyst. Be very permissive - most content can generate interesting quiz questions. Respond only with valid JSON.',
      },
      {
        role: 'user',
        content: assessmentPrompt,
      },
    ],
    temperature: 0.3,
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

  // Generate questions from the transcript
  const allQuestions: GeneratedQuestion[] = [];

  // Process each chunk (max 2 chunks to keep costs reasonable)
  for (let i = 0; i < Math.min(chunks.length, 2); i++) {
    const chunk = chunks[i];
    const questionsNeeded = i === 0 ? 3 : 2; // 3 from first chunk, 2 from second

    const questionPrompt = `Génère ${questionsNeeded} questions de quiz à choix multiples de haute qualité basées sur cette transcription de ${contentType === 'video' ? 'vidéo' : 'podcast'}.

IMPORTANT: Génère tout le contenu EN FRANÇAIS (questions, options, explications).

Titre: "${contentTitle}"
Sujets principaux: ${assessment.mainTopics?.join(', ') || 'Culture générale'}

Transcription:
"""
${chunk}
"""

Exigences:
1. Les questions doivent tester la compréhension de faits ou concepts spécifiques de la transcription
2. Chaque question doit avoir exactement 4 options (A, B, C, D)
3. Une seule option doit être correcte
4. Inclure une brève explication pour la réponse correcte
5. Les questions doivent être éducatives et aider à renforcer l'apprentissage
6. Éviter les questions triviales ou celles qui peuvent être répondues sans comprendre le contenu
7. TOUTES les questions, options et explications DOIVENT être en FRANÇAIS

Réponds uniquement avec du JSON:
{
  "questions": [
    {
      "question": "Question claire et spécifique en français ?",
      "options": ["A) Première option", "B) Deuxième option", "C) Troisième option", "D) Quatrième option"],
      "correctAnswer": "A",
      "explanation": "Brève explication en français de pourquoi c'est correct"
    }
  ]
}`;

    try {
      const questionResponse = await llmLimiter(() => llm.chatCompletion({
        messages: [
          {
            role: 'system',
            content: 'Tu es un éducateur expert créant des questions de quiz. Génère des questions claires et éducatives en FRANÇAIS qui testent la compréhension. Réponds uniquement avec du JSON valide.',
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

  const systemPrompt = `Tu es un assistant d'apprentissage expert. Génère un mémo d'étude concis et actionnable à partir de la transcription fournie.
Le mémo doit:
- Résumer les 5-7 concepts clés à retenir
- Être structuré avec des bullet points
- Être pratique et mémorisable
- Faire maximum 200 mots
- Être entièrement en français`;

  const userPrompt = `Titre: ${contentTitle}
${tagsStr ? `Thèmes: ${tagsStr}` : ''}

Transcription:
${transcriptText}

Génère un mémo d'étude optimisé pour la rétention avec les points clés.`;

  return generateText(userPrompt, { system: systemPrompt, temperature: 0.7 });
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
    const contentType = content.platform === 'YOUTUBE' ? 'video' : 'podcast';

    log.info({ contentId, title: content.title }, 'Generating quiz');
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType
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
            // Default SM-2 values already set in schema
          },
        });
      }

      // Update content status
      await tx.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
    });

    // Generate memo in parallel (non-blocking, after quiz creation)
    log.debug({ contentId, title: content.title }, 'Generating memo');
    try {
      const tagNames = content.tags.map(t => t.name);
      const memo = await generateMemoFromTranscript(
        content.transcript!.text,
        content.title,
        tagNames
      );

      // Cache memo in transcript segments
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
      // Don't fail the whole process if memo generation fails
      log.error({ err: memoError, contentId }, 'Memo generation failed');
    }

    log.info({ contentId, questionCount: result.questions.length, title: content.title }, 'Quiz generation completed');
    return true;

  } catch (error) {
    log.error({ err: error, contentId }, 'Error generating quiz');
    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.FAILED },
    });
    return false;
  }
}

/**
 * Regenerate quiz for content (user requested)
 */
export async function regenerateQuiz(contentId: string): Promise<boolean> {
  // Delete existing quizzes and cards
  await prisma.quiz.deleteMany({
    where: { contentId },
  });

  // Process again
  return processContentQuiz(contentId);
}

/**
 * Background worker to process pending quiz generation
 */
export async function runQuizGenerationWorker(): Promise<void> {
  log.info('Quiz generation worker starting');

  // Get content items with transcripts that need quiz generation
  const pendingContent = await prisma.content.findMany({
    where: {
      status: ContentStatus.SELECTED,
      transcript: { isNot: null },
      quizzes: { none: {} },
    },
    take: 5, // Process 5 at a time
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
