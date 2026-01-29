// Quiz Generation Tests
import { describe, it, expect } from 'vitest';

// Quiz validation helpers (extracted for testing)
interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

function validateQuizQuestion(q: unknown): q is QuizQuestion {
  if (typeof q !== 'object' || q === null) return false;

  const quiz = q as Record<string, unknown>;

  return (
    typeof quiz.question === 'string' &&
    quiz.question.length > 0 &&
    Array.isArray(quiz.options) &&
    quiz.options.length >= 2 &&
    quiz.options.length <= 5 &&
    quiz.options.every((opt) => typeof opt === 'string') &&
    typeof quiz.correctAnswer === 'string' &&
    ['A', 'B', 'C', 'D', 'E'].includes(quiz.correctAnswer)
  );
}

function parseQuizResponse(content: string): QuizQuestion[] {
  try {
    // Try to extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(validateQuizQuestion);
  } catch {
    return [];
  }
}

describe('Quiz Validation', () => {
  describe('validateQuizQuestion', () => {
    it('should accept valid quiz question', () => {
      const validQuiz = {
        question: 'What is 2 + 2?',
        options: ['A) 3', 'B) 4', 'C) 5', 'D) 6'],
        correctAnswer: 'B',
        explanation: 'Basic addition',
      };
      expect(validateQuizQuestion(validQuiz)).toBe(true);
    });

    it('should reject quiz without question', () => {
      const invalid = {
        options: ['A) 3', 'B) 4'],
        correctAnswer: 'B',
      };
      expect(validateQuizQuestion(invalid)).toBe(false);
    });

    it('should reject quiz with empty question', () => {
      const invalid = {
        question: '',
        options: ['A) 3', 'B) 4'],
        correctAnswer: 'B',
      };
      expect(validateQuizQuestion(invalid)).toBe(false);
    });

    it('should reject quiz with too few options', () => {
      const invalid = {
        question: 'What is 2 + 2?',
        options: ['A) 4'],
        correctAnswer: 'A',
      };
      expect(validateQuizQuestion(invalid)).toBe(false);
    });

    it('should reject quiz with too many options', () => {
      const invalid = {
        question: 'What is 2 + 2?',
        options: ['A) 1', 'B) 2', 'C) 3', 'D) 4', 'E) 5', 'F) 6'],
        correctAnswer: 'D',
      };
      expect(validateQuizQuestion(invalid)).toBe(false);
    });

    it('should reject quiz with invalid correct answer', () => {
      const invalid = {
        question: 'What is 2 + 2?',
        options: ['A) 3', 'B) 4'],
        correctAnswer: 'F',
      };
      expect(validateQuizQuestion(invalid)).toBe(false);
    });

    it('should reject null', () => {
      expect(validateQuizQuestion(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateQuizQuestion('string')).toBe(false);
      expect(validateQuizQuestion(123)).toBe(false);
      expect(validateQuizQuestion([])).toBe(false);
    });
  });

  describe('parseQuizResponse', () => {
    it('should parse valid JSON array', () => {
      const response = `[
        {
          "question": "What is the capital of France?",
          "options": ["A) London", "B) Paris", "C) Berlin", "D) Madrid"],
          "correctAnswer": "B",
          "explanation": "Paris is the capital of France"
        }
      ]`;
      const result = parseQuizResponse(response);
      expect(result).toHaveLength(1);
      expect(result[0].question).toBe('What is the capital of France?');
    });

    it('should extract JSON from surrounding text', () => {
      const response = `Here are the quiz questions:
      [
        {
          "question": "Test question?",
          "options": ["A) Yes", "B) No"],
          "correctAnswer": "A"
        }
      ]
      I hope these help!`;
      const result = parseQuizResponse(response);
      expect(result).toHaveLength(1);
    });

    it('should filter out invalid questions', () => {
      const response = `[
        {
          "question": "Valid question?",
          "options": ["A) Yes", "B) No"],
          "correctAnswer": "A"
        },
        {
          "question": "",
          "options": ["A) Yes"],
          "correctAnswer": "Z"
        }
      ]`;
      const result = parseQuizResponse(response);
      expect(result).toHaveLength(1);
    });

    it('should return empty array for invalid JSON', () => {
      const response = 'This is not JSON at all';
      const result = parseQuizResponse(response);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for non-array JSON', () => {
      const response = '{"question": "test"}';
      const result = parseQuizResponse(response);
      expect(result).toHaveLength(0);
    });
  });
});

describe('Tag Validation', () => {
  function validateTag(tag: unknown): tag is string {
    return typeof tag === 'string' && tag.length > 0 && tag.length <= 50;
  }

  function cleanTags(tags: unknown[]): string[] {
    return tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.toLowerCase().trim())
      .filter((tag) => tag.length > 0 && tag.length <= 50);
  }

  it('should validate correct tags', () => {
    expect(validateTag('machine learning')).toBe(true);
    expect(validateTag('python')).toBe(true);
    expect(validateTag('a')).toBe(true);
  });

  it('should reject invalid tags', () => {
    expect(validateTag('')).toBe(false);
    expect(validateTag(123)).toBe(false);
    expect(validateTag(null)).toBe(false);
    expect(validateTag('a'.repeat(51))).toBe(false);
  });

  it('should clean and normalize tags', () => {
    const input = ['  Machine Learning  ', 'PYTHON', '', 123, null, 'valid'];
    const result = cleanTags(input);
    expect(result).toEqual(['machine learning', 'python', 'valid']);
  });
});
