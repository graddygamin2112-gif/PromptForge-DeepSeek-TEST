import { useMemo, useState } from 'react';
import { Check, Copy, Download, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { estimateTokens } from '@/lib/history';
import { cn } from '@/lib/utils';

interface OutputPanelProps {
  title: string;
  prompt: string;
  streaming: boolean;
  active: boolean;
  onRefineAgain: () => void;
  onEditDraft: () => void;
  onCopy: () => void;
}

export function OutputPanel({
  title,
  prompt,
  streaming,
  active,
  onRefineAgain,
  onEditDraft,
  onCopy,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const wordCount = useMemo(() => prompt.trim().split(/\s+/).filter(Boolean).length, [prompt]);
  const tokens = useMemo(() => (prompt ? estimateTokens(prompt) : 0), [prompt]);

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    onCopy();
    window.setTimeout(() => setCopied(false), 1800);
  };

  const download = () => {
    const blob = new Blob([prompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'refined-prompt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const isEmpty = !prompt && !streaming;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Refined prompt
            </span>
            {streaming && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                streaming
              </span>
            )}
          </div>
          <h2 className="mt-1 truncate font-display text-base font-semibold" title={title}>
            {title || 'Awaiting your draft'}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={download}
            disabled={!prompt}
            aria-label="Download as Markdown"
            title="Download as Markdown"
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant={copied ? 'secondary' : 'default'}
            size="sm"
            onClick={copy}
            disabled={!prompt}
            className="gap-1.5"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto px-4 py-4 sm:px-5">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <span className="grid size-12 place-items-center rounded-2xl border border-dashed text-muted-foreground">
                <Sparkles className="size-5" />
              </span>
              <div className="max-w-[16rem] space-y-1">
                <p className="text-sm font-medium">Nothing forged yet</p>
                <p className="text-xs text-muted-foreground">
                  Paste a rough idea on the left and let DeepSeek reason its way to a
                  precise, production-grade prompt.
                </p>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.7] text-foreground/90">
              {prompt}
              {active && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-primary align-middle" />
              )}
            </pre>
          )}

          {streaming && !prompt && (
            <div className="space-y-2.5 pt-1">
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-9/12" />
              <Skeleton className="h-3.5 w-10/12" />
              <Skeleton className="h-3.5 w-7/12" />
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground',
          !prompt && 'opacity-60',
        )}
      >
        <span className="tabular-nums">
          {wordCount} words · ~{tokens} tokens
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={onEditDraft} className="gap-1 text-muted-foreground">
            <RotateCcw className="size-3" />
            Edit input
          </Button>
          <Button variant="ghost" size="xs" onClick={onRefineAgain} className="gap-1 text-muted-foreground">
            <Sparkles className="size-3" />
            Refine again
          </Button>
        </div>
      </div>
    </div>
  );
}
