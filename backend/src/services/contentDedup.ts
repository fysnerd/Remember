// Content Deduplication Service
// When a user syncs content that another user already processed (transcript + quiz),
// clone the processed data instead of re-running the expensive pipeline.

import { prisma } from '../config/database.js';
import { ContentStatus, Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';
import { sendPushToUser } from './pushNotifications.js';

const log = logger.child({ service: 'content-dedup' });

/**
 * Try to clone processed data from an existing "donor" content
 * that shares the same externalId + platform.
 *
 * Returns true if clone succeeded (content is now READY).
 * Returns false if no suitable donor found (pipeline must run normally).
 */
export async function cloneFromDonor(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      userId: true,
      platform: true,
      externalId: true,
      status: true,
    },
  });

  if (!content) return false;

  // Find a donor: same externalId+platform, different user, has transcript + quizzes
  const donor = await prisma.content.findFirst({
    where: {
      platform: content.platform,
      externalId: content.externalId,
      id: { not: content.id },
      transcript: { isNot: null },
      quizzes: { some: {} },
      status: ContentStatus.READY,
    },
    include: {
      transcript: true,
      quizzes: true,
      tags: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' }, // prefer the oldest (most complete)
  });

  if (!donor || !donor.transcript) return false;

  log.info(
    { contentId, donorId: donor.id, platform: content.platform, externalId: content.externalId },
    'Found donor content, cloning data'
  );

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Clone transcript
      await tx.transcript.upsert({
        where: { contentId: content.id },
        create: {
          contentId: content.id,
          text: donor.transcript!.text,
          segments: donor.transcript!.segments as Prisma.InputJsonValue ?? Prisma.JsonNull,
          language: donor.transcript!.language,
          source: donor.transcript!.source,
        },
        update: {
          text: donor.transcript!.text,
          segments: donor.transcript!.segments as Prisma.InputJsonValue ?? Prisma.JsonNull,
          language: donor.transcript!.language,
          source: donor.transcript!.source,
        },
      });

      // 2. Clone quizzes + create cards for this user
      const cardNextReview = new Date();
      cardNextReview.setDate(cardNextReview.getDate() + 1); // SRS-01: first review in 24h

      for (const donorQuiz of donor.quizzes) {
        const quiz = await tx.quiz.create({
          data: {
            contentId: content.id,
            question: donorQuiz.question,
            type: donorQuiz.type,
            options: donorQuiz.options as Prisma.InputJsonValue,
            correctAnswer: donorQuiz.correctAnswer,
            explanation: donorQuiz.explanation,
          },
        });

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

      // 3. Clone tags (connect existing Tag records)
      if (donor.tags.length > 0) {
        await tx.content.update({
          where: { id: content.id },
          data: {
            tags: { connect: donor.tags.map(t => ({ id: t.id })) },
          },
        });
      }

      // 4. Clone synopsis + memo
      await tx.content.update({
        where: { id: content.id },
        data: {
          status: ContentStatus.READY,
          synopsis: donor.synopsis,
          memo: donor.memo,
          memoGeneratedAt: donor.memoGeneratedAt,
          transcriptCacheId: donor.transcriptCacheId,
        },
      });
    });

    // Notify user (fire-and-forget)
    const fullContent = await prisma.content.findUnique({
      where: { id: contentId },
      select: { title: true, userId: true },
    });
    if (fullContent) {
      const titleShort = fullContent.title.length > 50
        ? fullContent.title.substring(0, 47) + '...'
        : fullContent.title;
      sendPushToUser(
        fullContent.userId,
        'Quiz pret !',
        `${donor.quizzes.length} questions sur "${titleShort}"`,
        { screen: '/(tabs)', contentId }
      ).catch(() => {});
    }

    log.info(
      { contentId, donorId: donor.id, quizCount: donor.quizzes.length, tagCount: donor.tags.length },
      'Content cloned successfully'
    );
    return true;
  } catch (error) {
    log.error({ err: error, contentId, donorId: donor.id }, 'Clone from donor failed');
    return false;
  }
}
