import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar, Copy, Check, ChevronDown, ChevronUp, FileText, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import clsx from 'clsx';

interface Content {
  id: string;
  title: string;
  platform: string;
  thumbnailUrl: string | null;
}

interface Memo {
  id: string;
  memo: string;
  createdAt: string;
  questionsCount: number;
  contents: Content[];
}

interface MemosResponse {
  memos: Memo[];
}

const platformColors: Record<string, string> = {
  YOUTUBE: 'bg-red-100 text-red-700 border-red-200',
  SPOTIFY: 'bg-green-100 text-green-700 border-green-200',
  TIKTOK: 'bg-gray-100 text-gray-700 border-gray-200',
  INSTAGRAM: 'bg-pink-100 text-pink-700 border-pink-200',
};

function MemoCard({ memo }: { memo: Memo }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Parse memo into clean lines
  const parseLines = (text: string) => {
    return text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^#+\s*/, '')
        .trim()
      );
  };

  const lines = parseLines(memo.memo);
  const previewLines = lines.slice(0, 3);
  const hasMore = lines.length > 3;

  const copyMemo = async () => {
    try {
      await navigator.clipboard.writeText(memo.memo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          {/* Contents */}
          <div className="flex flex-wrap gap-2 mb-2">
            {memo.contents.slice(0, 2).map(content => (
              <span
                key={content.id}
                className={clsx(
                  'px-2 py-1 rounded-lg text-xs font-medium border truncate max-w-[200px]',
                  platformColors[content.platform] || 'bg-gray-100 text-gray-600 border-gray-200'
                )}
                title={content.title}
              >
                {content.title}
              </span>
            ))}
            {memo.contents.length > 2 && (
              <span className="px-2 py-1 rounded-lg text-xs text-gray-500 bg-gray-50">
                +{memo.contents.length - 2}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDate(memo.createdAt)}
            </span>
            <span>{memo.questionsCount} questions</span>
          </div>
        </div>
        <button
          onClick={copyMemo}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          title="Copier"
        >
          {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {(expanded ? lines : previewLines).map((line, idx) => {
          const isBullet = /^[-•]/.test(line);
          const content = isBullet ? line.replace(/^[-•]\s*/, '') : line;
          const isTitle = line.endsWith(':') && !isBullet;

          return (
            <p
              key={idx}
              className={clsx(
                'text-sm',
                isTitle ? 'text-gray-900 font-medium mt-3 first:mt-0' : 'text-gray-700',
                isBullet && 'pl-4 relative before:content-["•"] before:absolute before:left-0 before:text-gray-400'
              )}
            >
              {isTitle ? content.replace(/:$/, '') : content}
            </p>
          );
        })}
      </div>

      {/* Expand/Collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp size={16} />
              Voir moins
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              Voir tout ({lines.length - 3} lignes de plus)
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function NotesPage() {
  const { data, isLoading } = useQuery<MemosResponse>({
    queryKey: ['memos'],
    queryFn: async () => {
      const res = await api.get<MemosResponse>('/reviews/memos');
      return res.data;
    },
  });

  return (
    <div className="min-h-screen p-6 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <BookOpen size={24} className="text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Mes Notes</h1>
              <p className="text-sm text-gray-500">
                Tes mémos de révision générés par l'IA
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center animate-pulse">
              <FileText size={24} className="text-gray-400" />
            </div>
          </div>
        ) : data?.memos.length === 0 ? (
          <div className="border border-gray-200 rounded-lg p-8 text-center">
            <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pas encore de notes</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Termine une session de révision et génère un mémo IA pour voir tes notes apparaître ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.memos.map(memo => (
              <MemoCard key={memo.id} memo={memo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
