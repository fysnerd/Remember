// Quiz Generation Service - Uses LLM to generate quiz questions from transcripts
import { prisma } from '../config/database.js';
import { ContentStatus, QuizType } from '@prisma/client';
import { getLLMClient } from './llm.js';

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

  const assessmentResponse = await llm.chatCompletion({
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
  });

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

    const questionPrompt = `Generate ${questionsNeeded} high-quality multiple choice quiz questions based on this ${contentType} transcript.

Title: "${contentTitle}"
Main topics: ${assessment.mainTopics?.join(', ') || 'General knowledge'}

Transcript:
"""
${chunk}
"""

Requirements:
1. Questions must test understanding of specific facts or concepts from the transcript
2. Each question must have exactly 4 options (A, B, C, D)
3. Only one option should be correct
4. Include a brief explanation for the correct answer
5. Questions should be educational and help reinforce learning
6. Avoid trivial questions or those that can be answered without understanding the content

Respond with JSON only:
{
  "questions": [
    {
      "question": "Clear, specific question text?",
      "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
      "correctAnswer": "A",
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}`;

    try {
      const questionResponse = await llm.chatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator creating quiz questions. Generate clear, educational questions that test understanding. Respond only with valid JSON.',
          },
          {
            role: 'user',
            content: questionPrompt,
          },
        ],
        temperature: 0.7,
        jsonMode: true,
      });

      const result = JSON.parse(questionResponse.content || '{"questions": []}');

      if (result.questions && Array.isArray(result.questions)) {
        allQuestions.push(...result.questions);
      }
    } catch (error) {
      console.error(`[Quiz] Error generating questions from chunk ${i}:`, error);
    }
  }

  return {
    questions: allQuestions,
    isEducational: true,
  };
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
    },
  });

  if (!content) {
    console.error(`[Quiz] Content ${contentId} not found`);
    return false;
  }

  // Check if already has quizzes
  if (content.quizzes.length > 0) {
    console.log(`[Quiz] Content ${contentId} already has quizzes`);
    return true;
  }

  // Must have transcript
  if (!content.transcript) {
    console.log(`[Quiz] Content ${contentId} has no transcript, skipping`);
    return false;
  }

  // Update status to generating
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.GENERATING },
  });

  try {
    const contentType = content.platform === 'YOUTUBE' ? 'video' : 'podcast';

    console.log(`[Quiz] Generating quiz for: ${content.title}`);
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType
    );

    if (!result.isEducational) {
      console.log(`[Quiz] Content not educational: ${result.rejectionReason}`);
      // Still mark as ready, but with no quizzes
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
      return true;
    }

    if (result.questions.length === 0) {
      console.log(`[Quiz] No questions generated for ${contentId}`);
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

    console.log(`[Quiz] Created ${result.questions.length} questions for ${content.title}`);
    return true;

  } catch (error) {
    console.error(`[Quiz] Error generating quiz for ${contentId}:`, error);
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
  console.log('[Quiz Worker] Starting...');

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
    console.log('[Quiz Worker] No pending content for quiz generation');
    return;
  }

  console.log(`[Quiz Worker] Processing ${pendingContent.length} items`);

  let success = 0;
  let failed = 0;

  for (const content of pendingContent) {
    const result = await processContentQuiz(content.id);
    if (result) {
      success++;
    } else {
      failed++;
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`[Quiz Worker] Completed: ${success} success, ${failed} failed`);
}
