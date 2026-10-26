import { cn } from '@/lib/utils';

/** Layered ambient background: grid, aurora glow, vignette. Decorative only. */
export function ForgeBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_50%_0%,black_20%,transparent_75%)] dark:opacity-20" />
      <div className="absolute -top-40 left-1/2 h-[38rem] w-[70rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" />
      <div className="absolute -bottom-56 -right-32 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,hsl(190_90%_55%/0.14),transparent)] blur-2xl" />
      <div className="absolute bottom-0 left-0 h-64 w-full bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

/** Compact logo: a spark inside a rounded die-cut tile. */
export function ForgeMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary via-primary to-[hsl(190_90%_50%)] text-primary-foreground shadow-[0_6px_20px_-6px_var(--glow)]',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
        <path
          d="M12 2.5l1.9 5.2a4.2 4.2 0 0 0 2.4 2.4l5.2 1.9-5.2 1.9a4.2 4.2 0 0 0-2.4 2.4L12 21.5l-1.9-5.2a4.2 4.2 0 0 0-2.4-2.4L2.5 12l5.2-1.9a4.2 4.2 0 0 0 2.4-2.4L12 2.5z"
          fill="currentColor"
          opacity="0.95"
        />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-[1.05rem] font-semibold tracking-tight', className)}>
      Prompt<span className="text-primary">Forge</span>
    </span>
  );
}
