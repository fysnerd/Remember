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
  const assessmentPrompt = `Analyse cette transcription de ${contentType === 'video' ? 'vidéo' : 'podcast'} et identifie les sujets principaux abordés.

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

  // Generate questions from the transcript
  const allQuestions: GeneratedQuestion[] = [];

  // Process each chunk (max 2 chunks to keep costs reasonable)
  for (let i = 0; i < Math.min(chunks.length, 2); i++) {
    const chunk = chunks[i];
    const questionsNeeded = i === 0 ? 3 : 2; // 3 from first chunk, 2 from second

    const questionPrompt = `Génère ${questionsNeeded} questions de quiz à choix multiples basées sur cette transcription de ${contentType === 'video' ? 'vidéo' : 'podcast'}.

Titre: "${contentTitle}"
Sujets principaux: ${assessment.mainTopics?.join(', ') || 'Culture générale'}
Style du contenu: ${assessment.contentStyle || 'explicatif'}

Transcription:
"""
${chunk}
"""

PRINCIPES PÉDAGOGIQUES (taxonomie de Bloom) - Varie les niveaux cognitifs:
- Comprendre: "Que signifie [concept] selon l'auteur ?" / "Quel est le lien entre X et Y ?"
- Appliquer: "Dans quelle situation utiliserait-on [concept] ?" / "Comment appliquer [idée] à [contexte] ?"
- Analyser: "Pourquoi [fait] est-il important ?" / "Quelle est la cause principale de [phénomène] ?"

RÈGLES POUR LES DISTRACTEURS (options incorrectes):
- Chaque distracteur doit être PLAUSIBLE (pas absurde ni évident)
- Utiliser des erreurs de compréhension courantes comme distracteurs
- Les distracteurs ne doivent PAS être partiellement corrects
- Éviter les patterns prévisibles (option la plus longue = correcte, etc.)
- Varier la position de la bonne réponse (pas toujours A ou B)

RÈGLES POUR LES QUESTIONS:
1. Chaque question teste UN concept précis issu de la transcription
2. La question doit être impossible à répondre correctement sans avoir compris le contenu
3. 4 options exactement (A, B, C, D), une seule correcte
4. L'explication doit dire POURQUOI la bonne réponse est correcte ET pourquoi les autres ne le sont pas (1-2 phrases)
5. Tout en FRANÇAIS

Réponds uniquement en JSON:
{
  "questions": [
    {
      "question": "Question claire et spécifique ?",
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
            content: `Tu es un concepteur pédagogique expert en création de quiz basés sur la taxonomie de Bloom révisée.

Tes questions suivent ces principes scientifiques:
- Testing effect: les questions renforcent la mémorisation mieux que la relecture
- Desirable difficulties: un niveau de difficulté optimal stimule l'apprentissage
- Elaborative interrogation: demander "pourquoi" et "comment" ancre les connaissances

Génère des questions en FRANÇAIS qui testent la compréhension profonde, pas la mémorisation superficielle. Réponds uniquement en JSON valide.`,
          },
          {
            role: 'user',
            content: questionPrompt,
          },
        ],
        temperature: 0.6,
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
