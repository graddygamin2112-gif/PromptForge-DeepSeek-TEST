import { Archive, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { relativeTime, type GenerationResult } from '@/lib/history';
import { cn } from '@/lib/utils';

interface HistoryListProps {
  items: GenerationResult[];
  activeId: string | null;
  onSelect: (item: GenerationResult) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function HistoryList({ items, activeId, onSelect, onRemove, onClear }: HistoryListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Recent forges
        </h2>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onClear}
            className="gap-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
            Clear
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-6 text-center">
          <Archive className="mx-auto mb-2 size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Your refined prompts will collect here.</p>
        </div>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {items.map((item) => (
            <li key={item.id}>
              <div
                className={cn(
                  'group relative rounded-xl border border-transparent transition-colors hover:border-border hover:bg-muted/50',
                  activeId === item.id && 'border-border bg-muted/60',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <span className="block truncate pr-6 text-[13px] font-medium">{item.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-2.5" />
                    {relativeTime(item.createdAt)}
                    <span aria-hidden>·</span>
                    <span className="truncate">{item.crafterLabel}</span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 transition-opacity text-muted-foreground group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
