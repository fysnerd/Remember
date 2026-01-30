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
  YOUTUBE: 'bg-[#FF0000]/20 text-[#FF6B6B] border-[#FF0000]/30',
  SPOTIFY: 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/30',
  TIKTOK: 'bg-gradient-to-r from-[#00f2ea]/20 to-[#ff0050]/20 text-[#00f2ea] border-[#00f2ea]/30',
  INSTAGRAM: 'bg-gradient-to-r from-[#833AB4]/20 via-[#FD1D1D]/20 to-[#F77737]/20 text-[#FD1D1D] border-[#FD1D1D]/30',
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
    <div className="card hover:border-void-300 transition-all">
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
                  platformColors[content.platform] || 'bg-void-200 text-cream-muted border-void-300'
                )}
                title={content.title}
              >
                {content.title}
              </span>
            ))}
            {memo.contents.length > 2 && (
              <span className="px-2 py-1 rounded-lg text-xs text-cream-dark bg-void-100">
                +{memo.contents.length - 2}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-cream-dark">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDate(memo.createdAt)}
            </span>
            <span>{memo.questionsCount} questions</span>
          </div>
        </div>
        <button
          onClick={copyMemo}
          className="p-2 text-cream-dark hover:text-info rounded-lg hover:bg-info/10 transition-colors flex-shrink-0"
          title="Copier"
        >
          {copied ? <Check size={18} className="text-sage" /> : <Copy size={18} />}
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
                isTitle ? 'text-info font-medium mt-3 first:mt-0' : 'text-cream',
                isBullet && 'pl-4 relative before:content-["•"] before:absolute before:left-0 before:text-info'
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
          className="mt-4 flex items-center gap-1 text-sm text-cream-muted hover:text-amber transition-colors"
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
    <div className="min-h-screen p-8">
      {/* Ambient effects */}
      <div className="fixed top-20 right-20 w-72 h-72 bg-info/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 left-80 w-48 h-48 bg-amber/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-info/20 flex items-center justify-center">
              <BookOpen size={28} className="text-info" />
            </div>
            <div>
              <h1 className="text-3xl font-display text-cream">Mes Notes</h1>
              <p className="text-cream-dark">
                Tes mémos de révision générés par l'IA
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-info/20 flex items-center justify-center animate-pulse">
              <FileText size={24} className="text-info" />
            </div>
          </div>
        ) : data?.memos.length === 0 ? (
          <div className="card text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-info/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-info" />
            </div>
            <h3 className="text-xl font-display text-cream mb-2">Pas encore de notes</h3>
            <p className="text-cream-muted max-w-md mx-auto">
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
