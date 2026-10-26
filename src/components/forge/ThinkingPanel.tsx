import { useState } from 'react';
import { ChevronRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThinkingDots } from './ThinkingDots';

interface ThinkingPanelProps {
  thinking: string;
  active: boolean;
  elapsedMs: number;
  defaultOpen?: boolean;
}

/** Collapsible live view of the model's reasoning stream. */
export function ThinkingPanel({ thinking, active, elapsedMs, defaultOpen = true }: ThinkingPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const lines = thinking.split('\n').filter((l) => l.trim().length > 0);

  return (
    <div className="rounded-2xl border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/40 rounded-2xl"
        aria-expanded={open}
      >
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-lg',
            active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Brain className="size-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            {active ? 'Thinking…' : 'Reasoning trace'}
            {active && <ThinkingDots />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {active
              ? `${lines.length} reasoning step${lines.length === 1 ? '' : 's'} · ${(elapsedMs / 1000).toFixed(1)}s`
              : `Refined in ${(elapsedMs / 1000).toFixed(1)}s · ${lines.length} steps`}
          </span>
        </span>
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform motion-safe:duration-200',
            open && 'rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          {lines.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {active ? 'Warming up the reasoning engine…' : 'No reasoning trace was returned.'}
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto pr-1">
              <ol className="relative space-y-2.5 border-l border-border/70 pl-4 text-[13px] leading-relaxed text-muted-foreground">
                {lines.map((line, i) => (
                  <li key={i} className="relative animate-rise">
                    <span className="absolute top-[0.55em] -left-[1.29rem] size-1.5 rounded-full bg-primary/60" />
                    {line.replace(/^\s*[-*]\s*/, '')}
                  </li>
                ))}
                {active && (
                  <li className="relative">
                    <span className="absolute top-[0.55em] -left-[1.29rem] size-1.5 animate-pulse rounded-full bg-primary" />
                    <span className="inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary/60 align-middle" />
                  </li>
                )}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
