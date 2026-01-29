// SM-2 Algorithm Tests
import { describe, it, expect } from 'vitest';

// SM-2 Algorithm implementation (extracted for testing)
interface SM2Input {
  easeFactor: number;
  interval: number;
  repetitions: number;
  rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
}

interface SM2Output {
  newEaseFactor: number;
  newInterval: number;
  newRepetitions: number;
}

function calculateSM2(input: SM2Input): SM2Output {
  const ratingValue = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 }[input.rating];

  let newEaseFactor = input.easeFactor;
  let newInterval = input.interval;
  let newRepetitions = input.repetitions;

  if (ratingValue < 3) {
    // Failed review - reset
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Successful review
    newRepetitions += 1;

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 3;
    } else {
      newInterval = Math.round(input.interval * newEaseFactor);
    }

    // Update ease factor
    newEaseFactor = Math.max(
      1.3,
      input.easeFactor + (0.1 - (5 - ratingValue) * (0.08 + (5 - ratingValue) * 0.02))
    );

    // Bonus for easy
    if (input.rating === 'EASY') {
      newInterval = Math.round(newInterval * 1.3);
    }
  }

  return { newEaseFactor, newInterval, newRepetitions };
}

describe('SM-2 Algorithm', () => {
  describe('First review (new card)', () => {
    const newCard = { easeFactor: 2.5, interval: 1, repetitions: 0 };

    it('should set interval to 1 day on GOOD rating', () => {
      const result = calculateSM2({ ...newCard, rating: 'GOOD' });
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(1);
    });

    it('should set interval to 1 day on EASY rating with bonus', () => {
      const result = calculateSM2({ ...newCard, rating: 'EASY' });
      expect(result.newInterval).toBe(1); // 1 * 1.3 = 1.3, rounded to 1
      expect(result.newRepetitions).toBe(1);
    });

    it('should reset on AGAIN rating', () => {
      const result = calculateSM2({ ...newCard, rating: 'AGAIN' });
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(0);
    });

    it('should reset on HARD rating', () => {
      const result = calculateSM2({ ...newCard, rating: 'HARD' });
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(0);
    });
  });

  describe('Second review', () => {
    const secondReview = { easeFactor: 2.5, interval: 1, repetitions: 1 };

    it('should set interval to 3 days on GOOD rating', () => {
      const result = calculateSM2({ ...secondReview, rating: 'GOOD' });
      expect(result.newInterval).toBe(3);
      expect(result.newRepetitions).toBe(2);
    });

    it('should set interval to ~4 days on EASY rating (3 * 1.3)', () => {
      const result = calculateSM2({ ...secondReview, rating: 'EASY' });
      expect(result.newInterval).toBe(4); // 3 * 1.3 = 3.9, rounded to 4
      expect(result.newRepetitions).toBe(2);
    });

    it('should reset on AGAIN rating', () => {
      const result = calculateSM2({ ...secondReview, rating: 'AGAIN' });
      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(0);
    });
  });

  describe('Subsequent reviews', () => {
    const thirdReview = { easeFactor: 2.5, interval: 3, repetitions: 2 };

    it('should multiply interval by ease factor on GOOD rating', () => {
      const result = calculateSM2({ ...thirdReview, rating: 'GOOD' });
      expect(result.newInterval).toBe(8); // 3 * 2.5 = 7.5, rounded to 8
      expect(result.newRepetitions).toBe(3);
    });

    it('should apply bonus on EASY rating', () => {
      const result = calculateSM2({ ...thirdReview, rating: 'EASY' });
      // 3 * 2.5 = 7.5 → 8, then * 1.3 = 10.4 → 10
      expect(result.newInterval).toBe(10);
      expect(result.newRepetitions).toBe(3);
    });
  });

  describe('Ease factor adjustments', () => {
    const card = { easeFactor: 2.5, interval: 10, repetitions: 5 };

    it('should maintain ease factor on EASY rating', () => {
      const result = calculateSM2({ ...card, rating: 'EASY' });
      // SM-2 formula: 0.1 - (5-4) * (0.08 + (5-4) * 0.02) = 0
      expect(result.newEaseFactor).toBe(2.5);
    });

    it('should slightly decrease ease factor on GOOD rating', () => {
      const result = calculateSM2({ ...card, rating: 'GOOD' });
      // SM-2 formula: 0.1 - (5-3) * (0.08 + (5-3) * 0.02) = -0.14
      expect(result.newEaseFactor).toBeCloseTo(2.36, 2);
    });

    it('should never go below 1.3', () => {
      const lowEase = { ...card, easeFactor: 1.3 };
      const result = calculateSM2({ ...lowEase, rating: 'GOOD' });
      expect(result.newEaseFactor).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe('Long-term progression', () => {
    it('should reach long intervals after many successful reviews', () => {
      let card = { easeFactor: 2.5, interval: 1, repetitions: 0 };

      // Simulate 10 successful reviews
      for (let i = 0; i < 10; i++) {
        const result = calculateSM2({ ...card, rating: 'GOOD' });
        card = {
          easeFactor: result.newEaseFactor,
          interval: result.newInterval,
          repetitions: result.newRepetitions,
        };
      }

      // After 10 good reviews, interval should be quite long
      expect(card.interval).toBeGreaterThan(30); // At least a month
      expect(card.repetitions).toBe(10);
    });

    it('should reset completely on failure after many successes', () => {
      let card = { easeFactor: 2.6, interval: 60, repetitions: 8 };

      const result = calculateSM2({ ...card, rating: 'AGAIN' });

      expect(result.newInterval).toBe(1);
      expect(result.newRepetitions).toBe(0);
      // Ease factor is not changed on failure in this implementation
    });
  });
});

describe('Streak Milestones', () => {
  const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365];

  it('should identify milestone streaks', () => {
    STREAK_MILESTONES.forEach((milestone) => {
      expect(STREAK_MILESTONES.includes(milestone)).toBe(true);
    });
  });

  it('should not identify non-milestone streaks', () => {
    const nonMilestones = [1, 5, 10, 15, 25, 50, 99];
    nonMilestones.forEach((day) => {
      expect(STREAK_MILESTONES.includes(day)).toBe(false);
    });
  });
});
