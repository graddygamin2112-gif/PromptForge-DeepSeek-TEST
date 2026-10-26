import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  describeProviderError,
  findPreset,
  listModels,
  looksLikeKey,
  maskKey,
  normalizeBaseUrl,
  prettifyModelId,
  PROVIDER_PRESETS,
  TARGET_MODEL,
  type ProviderModel,
} from '@/lib/provider';
import { useConnection, type Connection } from '@/hooks/useForgeSettings';
import { cn } from '@/lib/utils';

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: Connection;
  update: (patch: Partial<Connection>) => void;
  selectProvider: (id: string) => void;
  selectModel: (model: ProviderModel) => void;
  disconnect: () => void;
}

/**
 * Picks the provider + model that forges prompts. Deliberately separate from
 * the DeepSeek V4.1 Flash target, which is fixed. State is owned by the page
 * and passed down so it propagates immediately.
 */
export function ConnectionDialog({
  open,
  onOpenChange,
  connection,
  update,
  selectProvider,
  selectModel,
  disconnect,
}: ConnectionDialogProps) {

  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [baseUrlDraft, setBaseUrlDraft] = useState(connection.baseUrl);
  const requestIdRef = useRef(0);

  const preset = findPreset(connection.providerId);
  const connected = Boolean(connection.apiKey && connection.crafterModel);
  const apiKeyValid = looksLikeKey(connection.apiKey);
  const baseUrlValid = /^https?:\/\/[^\s]+$/i.test(normalizeBaseUrl(baseUrlDraft));

  const fetchModels = useCallback(
    async (baseUrl: string, apiKey: string, providerId: string) => {
      if (!looksLikeKey(apiKey)) return;
      const requestId = ++requestIdRef.current;
      setLoadingModels(true);
      setModelsError(null);
      try {
        const result = await listModels(baseUrl, apiKey);
        if (requestId !== requestIdRef.current) return;
        setModels(result);
        if (result.length === 0) {
          setModelsError('This provider returned no models. Type a model id manually instead.');
        } else if (result.length === 1) {
          selectModel(result[0]);
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setModels([]);
        setModelsError(describeProviderError(err, findPreset(providerId).label));
      } finally {
        if (requestId === requestIdRef.current) setLoadingModels(false);
      }
    },
    [selectModel],
  );

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setBaseUrlDraft(connection.baseUrl);
    setModels([]);
    setModelsError(null);
  }, [open, connection.baseUrl]);

  // Debounce a fetch after the key settles — but never on every keystroke.
  useEffect(() => {
    if (!open || !apiKeyValid) return;
    const timer = window.setTimeout(() => {
      void fetchModels(connection.baseUrl, connection.apiKey, connection.providerId);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [open, apiKeyValid, connection.apiKey, connection.baseUrl, connection.providerId, fetchModels]);

  const commitBaseUrl = () => {
    const normalized = normalizeBaseUrl(baseUrlDraft);
    setBaseUrlDraft(normalized);
    update({ baseUrl: normalized });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Plug className="size-4 text-primary" />
            Connect a crafter
          </DialogTitle>
          <DialogDescription>
            Paste an [OI]-compatible API key. It stays in this browser and is sent only to
            the provider you choose — Prompt Forge has no server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-primary/[0.05] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
              Every prompt is forged for
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold">{TARGET_MODEL.label}</p>
            <p className="text-xs text-muted-foreground">
              {TARGET_MODEL.context} · {TARGET_MODEL.thinking}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={connection.providerId}
                onValueChange={(id) => {
                  selectProvider(id);
                  setModels([]);
                  setModelsError(null);
                  setBaseUrlDraft(id === 'custom' ? connection.baseUrl : findPreset(id).baseUrl);
                }}
              >
                <SelectTrigger id="provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API key</Label>
              <Input
                id="api-key"
                type="password"
                value={connection.apiKey}
                onChange={(e) => update({ apiKey: e.target.value.trim() })}
                placeholder={preset.keyHint}
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-sm"
                aria-invalid={connection.apiKey.length > 0 && !apiKeyValid}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="base-url">Base URL</Label>
              {connection.providerId === 'custom' && preset.docsUrl && (
                <a
                  href={preset.docsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Docs
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="base-url"
                value={baseUrlDraft}
                onChange={(e) => setBaseUrlDraft(e.target.value)}
                onBlur={commitBaseUrl}
                placeholder="https://api.provider.com/v1"
                spellCheck={false}
                className="font-mono text-[13px]"
                aria-invalid={!baseUrlValid}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  commitBaseUrl();
                  void fetchModels(normalizeBaseUrl(baseUrlDraft), connection.apiKey, connection.providerId);
                }}
                disabled={!apiKeyValid || !baseUrlValid || loadingModels}
                aria-label="Fetch model list"
                title="Fetch model list"
              >
                <RefreshCw className={cn('size-4', loadingModels && 'animate-spin')} />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="crafter-model">Model that forges the prompt</Label>
              {loadingModels && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  loading models…
                </span>
              )}
            </div>

            {models.length > 1 ? (
              <Select
                value={connection.crafterModel || '__none__'}
                onValueChange={(id) => {
                  if (id === '__none__') return;
                  const model = models.find((m) => m.id === id);
                  if (model) selectModel(model);
                }}
              >
                <SelectTrigger id="crafter-model" className="w-full">
                  <SelectValue placeholder="Choose a model…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex w-full flex-col items-start">
                        <span className="text-[13px]">{m.name}</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {m.id}
                          {m.context ? ` · ${Math.round(m.context / 1000)}K ctx` : ''}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="crafter-model"
                value={connection.crafterModel}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  update({ crafterModel: value, crafterLabel: prettifyModelId(value) });
                }}
                placeholder={
                  models.length === 1
                    ? models[0].id
                    : apiKeyValid
                      ? 'Fetch failed — type a model id'
                      : 'Add your API key to load models'
                }
                spellCheck={false}
                className="font-mono text-[13px]"
                disabled={!apiKeyValid}
              />
            )}

            {modelsError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <span className="text-muted-foreground">{modelsError}</span>
              </div>
            )}
            {!modelsError && models.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {models.length} model{models.length === 1 ? '' : 's'} available from {preset.label}.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-2">
              {connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    disconnect();
                    setModels([]);
                    onOpenChange(false);
                  }}
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Disconnect
                </Button>
              ) : (
                preset.docsUrl && (
                  <a
                    href={preset.docsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Get a {preset.label} key
                    <ExternalLink className="size-3" />
                  </a>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              {connection.apiKey && (
                <span className="hidden items-center gap-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
                  <KeyRound className="size-3" />
                  {maskKey(connection.apiKey)}
                </span>
              )}
              <Button
                onClick={() => onOpenChange(false)}
                disabled={!apiKeyValid || !connection.crafterModel || !baseUrlValid}
                className="gap-1.5"
              >
                <Check className="size-3.5" />
                {connected ? 'Done' : 'Use this model'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
