// Export Service Tests
import { describe, it, expect } from 'vitest';

// Markdown generation helpers (extracted for testing)
interface ContentData {
  id: string;
  title: string;
  sourceUrl: string;
  sourceType: 'YOUTUBE' | 'SPOTIFY' | 'PODCAST';
  createdAt: Date;
  tags: { name: string }[];
  summary: string | null;
  transcript?: { text: string } | null;
  quizzes: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string | null;
  }[];
}

function generateMarkdown(content: ContentData): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${content.title}`);
  lines.push('');

  // Metadata
  lines.push(`**Source:** [${content.sourceType}](${content.sourceUrl})`);
  lines.push(`**Added:** ${content.createdAt.toLocaleDateString()}`);

  if (content.tags.length > 0) {
    lines.push(`**Tags:** ${content.tags.map((t) => `#${t.name}`).join(' ')}`);
  }
  lines.push('');

  // Summary
  if (content.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(content.summary);
    lines.push('');
  }

  // Transcript
  if (content.transcript?.text) {
    lines.push('## Transcript');
    lines.push('');
    lines.push(content.transcript.text);
    lines.push('');
  }

  // Quizzes
  if (content.quizzes.length > 0) {
    lines.push('## Quiz Questions');
    lines.push('');
    content.quizzes.forEach((quiz, index) => {
      lines.push(`### Question ${index + 1}`);
      lines.push('');
      lines.push(quiz.question);
      lines.push('');
      quiz.options.forEach((opt) => {
        lines.push(`- ${opt}`);
      });
      lines.push('');
      lines.push(`**Answer:** ${quiz.correctAnswer}`);
      if (quiz.explanation) {
        lines.push(`**Explanation:** ${quiz.explanation}`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

describe('Export Service', () => {
  describe('generateMarkdown', () => {
    it('should generate markdown with all fields', () => {
      const content: ContentData = {
        id: 'test-id',
        title: 'Test Video Title',
        sourceUrl: 'https://youtube.com/watch?v=test',
        sourceType: 'YOUTUBE',
        createdAt: new Date('2024-01-15'),
        tags: [{ name: 'javascript' }, { name: 'testing' }],
        summary: 'This is a test summary.',
        transcript: { text: 'This is the transcript text.' },
        quizzes: [
          {
            question: 'What is 2 + 2?',
            options: ['A) 3', 'B) 4', 'C) 5', 'D) 6'],
            correctAnswer: 'B',
            explanation: 'Basic math',
          },
        ],
      };

      const markdown = generateMarkdown(content);

      expect(markdown).toContain('# Test Video Title');
      expect(markdown).toContain('**Source:** [YOUTUBE](https://youtube.com/watch?v=test)');
      expect(markdown).toContain('#javascript');
      expect(markdown).toContain('#testing');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('This is a test summary.');
      expect(markdown).toContain('## Transcript');
      expect(markdown).toContain('This is the transcript text.');
      expect(markdown).toContain('## Quiz Questions');
      expect(markdown).toContain('What is 2 + 2?');
      expect(markdown).toContain('**Answer:** B');
    });

    it('should handle content without optional fields', () => {
      const content: ContentData = {
        id: 'test-id',
        title: 'Minimal Content',
        sourceUrl: 'https://spotify.com/track/test',
        sourceType: 'SPOTIFY',
        createdAt: new Date('2024-01-15'),
        tags: [],
        summary: null,
        transcript: null,
        quizzes: [],
      };

      const markdown = generateMarkdown(content);

      expect(markdown).toContain('# Minimal Content');
      expect(markdown).toContain('[SPOTIFY]');
      expect(markdown).not.toContain('## Summary');
      expect(markdown).not.toContain('## Transcript');
      expect(markdown).not.toContain('## Quiz Questions');
      expect(markdown).not.toContain('**Tags:**');
    });

    it('should format multiple quizzes correctly', () => {
      const content: ContentData = {
        id: 'test-id',
        title: 'Quiz Test',
        sourceUrl: 'https://example.com',
        sourceType: 'PODCAST',
        createdAt: new Date('2024-01-15'),
        tags: [],
        summary: null,
        transcript: null,
        quizzes: [
          {
            question: 'First question?',
            options: ['A) Yes', 'B) No'],
            correctAnswer: 'A',
            explanation: null,
          },
          {
            question: 'Second question?',
            options: ['A) True', 'B) False'],
            correctAnswer: 'B',
            explanation: 'Because reasons',
          },
        ],
      };

      const markdown = generateMarkdown(content);

      expect(markdown).toContain('### Question 1');
      expect(markdown).toContain('### Question 2');
      expect(markdown).toContain('First question?');
      expect(markdown).toContain('Second question?');
      expect(markdown).not.toContain('**Explanation:** null');
      expect(markdown).toContain('**Explanation:** Because reasons');
    });
  });

  describe('sanitizeFilename', () => {
    it('should convert to lowercase and replace spaces', () => {
      expect(sanitizeFilename('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(sanitizeFilename("Test: Video! What's this?")).toBe('test-video-what-s-this');
    });

    it('should limit length to 50 characters', () => {
      const longTitle =
        'This is a very long title that should be truncated because it exceeds the maximum length';
      expect(sanitizeFilename(longTitle).length).toBeLessThanOrEqual(50);
    });

    it('should handle empty strings', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(sanitizeFilename('--test--')).toBe('test');
      expect(sanitizeFilename('!!!test!!!')).toBe('test');
    });
  });
});
