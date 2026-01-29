// Markdown Export Service (S015)
import { prisma } from '../config/database.js';

interface ExportedContent {
  filename: string;
  content: string;
}

/**
 * Generate Markdown for a single content item
 */
export async function exportContentAsMarkdown(contentId: string, userId: string): Promise<ExportedContent | null> {
  const content = await prisma.content.findFirst({
    where: {
      id: contentId,
      userId,
    },
    include: {
      transcript: true,
      quizzes: true,
      tags: true,
    },
  });

  if (!content) {
    return null;
  }

  const filename = sanitizeFilename(content.title) + '.md';
  const markdown = generateMarkdown(content);

  return { filename, content: markdown };
}

/**
 * Export multiple content items as markdown
 */
export async function exportBulkAsMarkdown(
  userId: string,
  contentIds?: string[]
): Promise<ExportedContent[]> {
  const where = contentIds
    ? { id: { in: contentIds }, userId }
    : { userId };

  const contents = await prisma.content.findMany({
    where,
    include: {
      transcript: true,
      quizzes: true,
      tags: true,
    },
    orderBy: { capturedAt: 'desc' },
  });

  return contents.map((content) => ({
    filename: sanitizeFilename(content.title) + '.md',
    content: generateMarkdown(content),
  }));
}

/**
 * Generate markdown content for a single item
 */
function generateMarkdown(content: {
  title: string;
  url: string;
  platform: string;
  description: string | null;
  showName: string | null;
  duration: number | null;
  capturedAt: Date;
  tags: { name: string }[];
  transcript: { text: string; language: string; source: string } | null;
  quizzes: { question: string; options: unknown; correctAnswer: string; explanation: string | null }[];
}): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${content.title}`);
  lines.push('');

  // Metadata
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Platform:** ${content.platform}`);
  lines.push(`- **URL:** [${content.url}](${content.url})`);
  if (content.showName) {
    lines.push(`- **Show:** ${content.showName}`);
  }
  if (content.duration) {
    const mins = Math.floor(content.duration / 60);
    const secs = content.duration % 60;
    lines.push(`- **Duration:** ${mins}:${secs.toString().padStart(2, '0')}`);
  }
  lines.push(`- **Captured:** ${content.capturedAt.toISOString().split('T')[0]}`);
  if (content.tags.length > 0) {
    lines.push(`- **Tags:** ${content.tags.map(t => `\`${t.name}\``).join(', ')}`);
  }
  lines.push('');

  // Description
  if (content.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(content.description);
    lines.push('');
  }

  // Quiz Questions
  if (content.quizzes.length > 0) {
    lines.push('## Quiz Questions');
    lines.push('');
    content.quizzes.forEach((quiz, index) => {
      lines.push(`### Question ${index + 1}`);
      lines.push('');
      lines.push(quiz.question);
      lines.push('');

      // Options
      const options = quiz.options as string[];
      if (Array.isArray(options)) {
        options.forEach((option) => {
          const isCorrect = option.startsWith(quiz.correctAnswer);
          lines.push(`- ${option}${isCorrect ? ' ✓' : ''}`);
        });
      }
      lines.push('');

      // Explanation
      if (quiz.explanation) {
        lines.push(`**Explanation:** ${quiz.explanation}`);
        lines.push('');
      }
    });
  }

  // Transcript
  if (content.transcript) {
    lines.push('## Transcript');
    lines.push('');
    lines.push(`*Source: ${content.transcript.source} | Language: ${content.transcript.language}*`);
    lines.push('');
    lines.push(content.transcript.text);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Exported from Remember - Active Learning from Social Media*');

  return lines.join('\n');
}

/**
 * Sanitize filename to be filesystem-safe
 */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .substring(0, 100)             // Limit length
    .trim();
}

/**
 * Generate a ZIP file manifest for bulk export
 * Returns an array of {path, content} for the archiver to use
 */
export function generateExportManifest(exports: ExportedContent[]): { path: string; content: string }[] {
  // Add index file
  const indexLines = [
    '# Remember Export',
    '',
    `Exported: ${new Date().toISOString()}`,
    '',
    '## Contents',
    '',
  ];

  exports.forEach((exp, index) => {
    indexLines.push(`${index + 1}. [${exp.filename}](./${exp.filename})`);
  });

  return [
    { path: 'index.md', content: indexLines.join('\n') },
    ...exports.map(exp => ({ path: exp.filename, content: exp.content })),
  ];
}
