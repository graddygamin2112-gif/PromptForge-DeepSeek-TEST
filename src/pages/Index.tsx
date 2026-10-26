import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  HardDrive,
  Info,
  Loader2,
  Plug,
  Sparkles,
  Square,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ForgeBackdrop, ForgeMark, Wordmark } from '@/components/forge/ForgeChrome';
import { ConnectionDialog } from '@/components/forge/ConnectionDialog';
import { ForgeControls } from '@/components/forge/ForgeControls';
import { OutputPanel } from '@/components/forge/OutputPanel';
import { ThinkingPanel } from '@/components/forge/ThinkingPanel';
import { HistoryList } from '@/components/forge/HistoryList';
import { useConnection, usePreferences } from '@/hooks/useForgeSettings';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import {
  describeProviderError,
  findPreset,
  maskKey,
  prettifyModelId,
  streamCompletion,
  TARGET_MODEL,
} from '@/lib/provider';
import {
  buildForgeMessages,
  buildForgeSystemPrompt,
  buildRefineMessage,
  STARTER_DRAFTS,
  type ForgeOptions,
} from '@/lib/promptEngine';
import {
  cleanPrompt,
  deriveTitle,
  ERROR_STORAGE_KEY,
  estimateTokens,
  expansionRatio,
  HISTORY_STORAGE_KEY,
  newId,
  pushLimited,
  type ApiErrorEntry,
  type GenerationResult,
} from '@/lib/history';
import { cn } from '@/lib/utils';

const MAX_DRAFT = 12000;

export function Index() {
  useSeoMeta({
    title: 'PromptForge — forge prompts for DeepSeek V4.1 Flash',
    description:
      'Bring your own [OI]-compatible key, pick a model to do the thinking, and turn a rough idea into a precise prompt built for DeepSeek V4.1 Flash.',
    ogTitle: 'PromptForge — forge prompts for DeepSeek V4.1 Flash',
    ogDescription:
      'Your draft in, a model-sharpened prompt out — written specifically for DeepSeek V4.1 Flash. BYOK, browser-only, watch the reasoning live.',
    ogType: 'website',
    twitterCard: 'summary',
  });

  const { connection, disconnect, update: updateConnection, selectProvider, selectModel } = useConnection();
  const { preferences, updateOptions } = usePreferences();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);

  const [history, setHistory] = useLocalStorage<GenerationResult[]>(HISTORY_STORAGE_KEY, []);
  const [, setErrors] = useLocalStorage<ApiErrorEntry[]>(ERROR_STORAGE_KEY, []);

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [liveReasoning, setLiveReasoning] = useState('');
  const [liveContent, setLiveContent] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  const providerPreset = findPreset(connection.providerId);
  const crafterLabel = connection.crafterLabel || (connection.crafterModel ? prettifyModelId(connection.crafterModel) : '');
  const ready = Boolean(connection.apiKey && connection.crafterModel && connection.baseUrl);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!streaming) return;
    const interval = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 100);
    return () => window.clearInterval(interval);
  }, [streaming]);

  const charCount = draft.length;
  const draftTokens = useMemo(() => (draft.trim() ? estimateTokens(draft) : 0), [draft]);
  const canForge = draft.trim().length > 0 && !streaming;

  const promptText = streaming ? liveContent : result?.prompt ?? '';
  const thinkingText = streaming ? liveReasoning : result?.thinking ?? '';
  const displayTitle = streaming ? 'Forging…' : result?.title ?? '';

  const forge = useCallback(
    async (override?: { draftText?: string; previousPrompt?: string }) => {
      const sourceDraft = (override?.draftText ?? draft).trim();
      if (!sourceDraft) return;

      if (!ready) {
        setConnectionOpen(true);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setStreaming(true);
      setLiveReasoning('');
      setLiveContent('');
      setElapsedMs(0);
      startedAtRef.current = Date.now();

      const options: ForgeOptions = preferences.options;
      const messages = override?.previousPrompt
        ? [
            { role: 'system' as const, content: buildForgeSystemPrompt(options) },
            { role: 'user' as const, content: buildRefineMessage(override.previousPrompt) },
          ]
        : buildForgeMessages(sourceDraft, options, showNotes ? notes : undefined);

      try {
        const output = await streamCompletion({
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
          model: connection.crafterModel,
          messages,
          temperature: 0.4,
          onReasoning: (delta) => setLiveReasoning((prev) => prev + delta),
          onContent: (delta) => setLiveContent((prev) => prev + delta),
          signal: controller.signal,
        });

        const cleaned = cleanPrompt(output.content);
        if (!cleaned) {
          throw new Error(
            `${crafterLabel || 'The model'} returned an empty response. Try another crafter model or retry.`,
          );
        }

        const finishedAt = Date.now();
        const entry: GenerationResult = {
          id: newId(),
          createdAt: finishedAt,
          draft: sourceDraft,
          notes: showNotes ? notes : undefined,
          title: deriveTitle(output.content, sourceDraft),
          prompt: cleaned,
          thinking: output.reasoning,
          crafterModel: connection.crafterModel,
          crafterLabel: crafterLabel || prettifyModelId(connection.crafterModel),
          providerId: connection.providerId,
          options,
          elapsedMs: finishedAt - startedAtRef.current,
          totalTokens: output.usage?.total_tokens,
        };

        setResult(entry);
        setHistory((prev) => pushLimited(prev, entry));
        setElapsedMs(entry.elapsedMs);

        if (output.finishReason === 'length') {
          toast({
            title: 'Output was truncated',
            description: 'The crafter hit its output limit. Try the Compact length setting.',
          });
        }
      } catch (err) {
        if (controller.signal.aborted) {
          toast({ title: 'Forge stopped' });
          return;
        }
        const message = describeProviderError(err, providerPreset.label);
        setError(message);
        setErrors((prev) =>
          pushLimited(prev, {
            id: newId(),
            createdAt: Date.now(),
            draft: sourceDraft,
            status:
              err instanceof Error && 'status' in err
                ? Number((err as { status: number }).status) || null
                : null,
            message,
            crafterModel: connection.crafterModel,
          }),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      connection.apiKey,
      connection.baseUrl,
      connection.crafterModel,
      connection.providerId,
      crafterLabel,
      draft,
      notes,
      preferences.options,
      providerPreset.label,
      ready,
      setErrors,
      setHistory,
      showNotes,
      toast,
    ],
  );

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canForge) void forge();
    }
  };

  const restoreHistoryItem = (item: GenerationResult) => {
    setResult(item);
    setDraft(item.draft);
    setNotes(item.notes ?? '');
    setShowNotes(Boolean(item.notes));
    setError(null);
  };

  const removeHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((i) => i.id !== id));
    if (result?.id === id) setResult(null);
  };

  return (
    <div className="relative min-h-screen">
      <ForgeBackdrop />

      <header className="sticky top-0 z-20 border-b border-border/60 glass">
        <div className="container flex h-16 items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <ForgeMark />
            <span className="flex flex-col leading-none">
              <Wordmark />
              <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                DeepSeek V4.1 Flash studio
              </span>
            </span>
          </a>

          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden items-center gap-1.5 border-border/70 py-1 font-mono text-[10px] font-normal text-muted-foreground md:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              target: {TARGET_MODEL.id}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setConnectionOpen(true)}
              className="max-w-[9rem] gap-1.5 sm:max-w-[15rem]"
            >
              {ready ? (
                <>
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate text-xs">{crafterLabel}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </>
              ) : (
                <>
                  <Plug className="size-3.5" />
                  <span className="hidden sm:inline">Connect crafter</span>
                  <span className="sm:hidden">Connect</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container pb-16">
        <section className="pt-10 pb-8 sm:pt-14">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.07] px-2.5 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" />
              Forged for {TARGET_MODEL.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              BYOK · runs in your browser · your key never touches our servers
            </span>
          </div>

          <h1 className="mt-4 font-display text-[clamp(2.1rem,5.2vw,3.6rem)] font-semibold leading-[1.06] tracking-tight">
            Rough thought in.
            <br />
            <span className="text-gradient">Flawless prompt out.</span>
          </h1>

          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Write the idea however it comes out. The crafter model you pick audits it for
            missing intent, vague constraints, and hidden assumptions — then returns a
            structured prompt tuned to {TARGET_MODEL.label}&apos;s 1M-token context and
            thinking mode.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-5 flex animate-rise items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-destructive">Forge failed</p>
              <p className="text-[13px] text-muted-foreground">{error}</p>
              <Button variant="outline" size="xs" className="mt-1" onClick={() => setConnectionOpen(true)}>
                Check connection
              </Button>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setError(null)} aria-label="Dismiss error">
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
          {/* Composer */}
          <div className="space-y-3">
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Your draft
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">Messy is fine — that&apos;s the point.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectionOpen(true)}
                  className="group flex shrink-0 flex-col items-end rounded-lg px-1 py-0.5 text-right outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  title="Change the model that forges your prompt"
                >
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    crafter
                  </span>
                  <span className="flex max-w-[9rem] items-center gap-1 text-xs font-medium">
                    <span className="truncate">{crafterLabel || 'Not connected'}</span>
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  </span>
                </button>
              </div>

              <div className="relative">
                <Textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_DRAFT))}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. write me a system prompt for a support bot that handles refunds without being too generous…"
                  className="min-h-[13.5rem] resize-y border-0 bg-transparent px-4 py-3.5 text-sm leading-relaxed shadow-none focus-visible:ring-0 md:min-h-[15rem]"
                  aria-label="Your rough prompt"
                  disabled={streaming}
                />
                <div className="flex items-center justify-between px-4 pb-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    {charCount > 0 ? `${charCount} chars · ~${draftTokens} tokens` : '⌘/Ctrl + Enter to forge'}
                  </span>
                  <span className={cn('tabular-nums', charCount > MAX_DRAFT * 0.9 && 'text-destructive')}>
                    {charCount}/{MAX_DRAFT}
                  </span>
                </div>
              </div>

              <div className="border-t px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowNotes((s) => !s)}
                  className="flex items-center gap-1.5 rounded text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  aria-expanded={showNotes}
                >
                  <ChevronDown
                    className={cn('size-3.5 transition-transform motion-safe:duration-200', !showNotes && '-rotate-90')}
                  />
                  Add constraints or context
                  <span className="text-muted-foreground/60">(optional)</span>
                </button>
                {showNotes && (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                    placeholder="e.g. keep it under 200 words, audience is enterprise IT buyers, no emojis…"
                    className="mt-2.5 min-h-[4.5rem] resize-y text-[13px]"
                    disabled={streaming}
                    aria-label="Extra constraints"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-3">
                {streaming ? (
                  <Button onClick={stop} variant="outline" className="flex-1 gap-2">
                    <Square className="size-3.5 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    onClick={() => void forge()}
                    disabled={!canForge}
                    className="flex-1 gap-2 shadow-[0_8px_24px_-12px_var(--glow)]"
                    size="lg"
                  >
                    {ready ? <Wand2 className="size-4" /> : <Zap className="size-4" />}
                    {ready ? 'Forge prompt' : 'Connect a crafter'}
                    <ArrowRight className="size-4 opacity-60" />
                  </Button>
                )}
              </div>
            </div>

            <ForgeControls options={preferences.options} onChange={updateOptions} disabled={streaming} />

            {!draft && !result && (
              <div className="rounded-2xl border border-dashed p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Info className="size-3.5" />
                  Try one of these messy drafts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_DRAFTS.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => {
                        setDraft(sample.text);
                        draftRef.current?.focus();
                      }}
                      className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="hidden lg:block">
              <HistoryList
                items={history}
                activeId={result?.id ?? null}
                onSelect={restoreHistoryItem}
                onRemove={removeHistoryItem}
                onClear={() => {
                  setHistory([]);
                  toast({ title: 'History cleared' });
                }}
              />
            </div>
          </div>

          {/* Reasoning + output */}
          <div className="flex min-w-0 flex-col gap-3 lg:min-h-[calc(100vh-13rem)]">
            {(streaming || thinkingText) && (
              <ThinkingPanel
                thinking={thinkingText}
                active={streaming}
                elapsedMs={elapsedMs}
                defaultOpen={streaming || thinkingText.length < 900}
              />
            )}

            <div className="min-h-[24rem] flex-1 lg:min-h-0">
              <OutputPanel
                title={displayTitle}
                prompt={promptText}
                streaming={streaming}
                active={streaming}
                onRefineAgain={() => {
                  if (result) void forge({ draftText: result.draft, previousPrompt: result.prompt });
                }}
                onEditDraft={() => {
                  draftRef.current?.focus();
                  draftRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }}
                onCopy={() => toast({ title: 'Copied to clipboard' })}
              />
            </div>

            {result && !streaming && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
                <Stat label="Grew" value={`${expansionRatio(result.draft, result.prompt).toFixed(1)}×`} />
                <Divider />
                <Stat label="Tokens" value={`~${estimateTokens(result.prompt)}`} />
                <Divider />
                <Stat label="Time" value={`${(result.elapsedMs / 1000).toFixed(1)}s`} />
                {result.totalTokens !== undefined && (
                  <>
                    <Divider />
                    <Stat label="Billed" value={`${result.totalTokens} tok`} />
                  </>
                )}
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px]">
                  <Check className="size-3 text-emerald-500" />
                  crafter: {result.crafterLabel}
                </span>
              </div>
            )}
          </div>

          <div className="lg:hidden">
            <HistoryList
              items={history}
              activeId={result?.id ?? null}
              onSelect={restoreHistoryItem}
              onRemove={removeHistoryItem}
              onClear={() => {
                setHistory([]);
                toast({ title: 'History cleared' });
              }}
            />
          </div>
        </div>

        <section className="mt-16 border-t pt-10">
          <h2 className="font-display text-lg font-semibold">
            Built for how {TARGET_MODEL.label} actually behaves
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'No wasted instructions',
                body: '"Think step by step" is dropped — thinking is a server-side effort setting (low / high / max), not a prompt trick. The forge spends its words on constraints instead.',
              },
              {
                title: 'Context-aware by default',
                body: 'With a 1M-token window and 384K output budget, prompts can carry whole codebases, specs, and worked examples instead of asking the model to "be brief".',
              },
              {
                title: 'Self-critiqued',
                body: 'The crafter drafts, critiques its own draft for vagueness, then rewrites. You get the second attempt — plain, structured, and immediately usable.',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border bg-card/60 p-4">
                <h3 className="text-sm font-semibold">{card.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{card.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex flex-col items-start justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Runs entirely in your browser.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href="https://api-docs.deepseek.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
            >
              DeepSeek docs
              <ExternalLink className="size-3" />
            </a>
            <a
              href="https://shakespeare.diy"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
            >
              Vibed with Shakespeare
              <ExternalLink className="size-3" />
            </a>
            <span className="inline-flex items-center gap-1">
              <HardDrive className="size-3" />
              {ready ? `key: ${maskKey(connection.apiKey)}` : 'no crafter connected'}
            </span>
            {ready && (
              <button
                type="button"
                onClick={disconnect}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                disconnect
              </button>
            )}
          </div>
        </div>
      </footer>

      <ConnectionDialog
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
        connection={connection}
        update={updateConnection}
        selectProvider={selectProvider}
        selectModel={selectModel}
        disconnect={disconnect}
      />

      {streaming && <StreamStatus text={liveReasoning ? 'reasoning' : 'connecting'} crafter={crafterLabel} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="font-mono text-foreground/80 tabular-nums">{value}</span>
    </span>
  );
}

function Divider() {
  return <span aria-hidden className="hidden h-3 w-px bg-border sm:inline-block" />;
}

function StreamStatus({ text, crafter }: { text: string; crafter: string }) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border bg-card/90 px-3.5 py-1.5 text-[11px] shadow-lg backdrop-blur"
    >
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-3 animate-spin text-primary" />
        {crafter || 'Crafter'} is {text}…
      </span>
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export default Index;
