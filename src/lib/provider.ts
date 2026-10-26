/**
 * Provider client for any [OI]-compatible Chat Completions endpoint, used to
 * forge prompts **for DeepSeek V4.1 Flash**.
 *
 * The user supplies their own API key (BYOK) and base URL. Every request goes
 * straight from the browser to that provider — there is no Prompt Forge server.
 */

/** The model the forged prompt is written for. Fixed by design. */
export const TARGET_MODEL = {
  id: 'deepseek-flash',
  label: 'DeepSeek V4.1 Flash',
  context: '1M context window',
  maxOutput: '384K output tokens',
  thinking: 'thinking mode with low / high / max effort',
} as const;

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  keyHint: string;
  docsUrl: string;
  /** Endpoint that lists models. Most [OI]-compatible providers expose /models. */
  modelsPath: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    keyHint: 'sk-…',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    modelsPath: '/models',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'sk-or-v1-…',
    docsUrl: 'https://openrouter.ai/keys',
    modelsPath: '/models',
  },
  {
    id: 'openai',
    label: '[OI]',
    baseUrl: 'https://api.openai.com/v1',
    keyHint: 'sk-proj-…',
    docsUrl: 'https://platform.openai.com/api-keys',
    modelsPath: '/models',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyHint: 'gsk_…',
    docsUrl: 'https://console.groq.com/keys',
    modelsPath: '/models',
  },
  {
    id: 'together',
    label: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    keyHint: '…',
    docsUrl: 'https://api.together.ai/settings/api-keys',
    modelsPath: '/models',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyHint: '…',
    docsUrl: 'https://console.mistral.ai/api-keys',
    modelsPath: '/models',
  },
  {
    id: 'custom',
    label: 'Custom endpoint',
    baseUrl: '',
    keyHint: 'any',
    docsUrl: '',
    modelsPath: '/models',
  },
];

export function findPreset(id: string): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[0];
}

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

/** Human-friendly explanation of a failed provider request. */
export function describeProviderError(error: unknown, providerLabel: string): string {
  if (error instanceof ProviderError) {
    switch (error.status) {
      case 0:
        return error.message;
      case 400:
        return `${providerLabel} rejected the request — ${error.message}`;
      case 401:
      case 403:
        return `${providerLabel} rejected your API key. Check it, and make sure the base URL matches the provider.`;
      case 402:
        return `${providerLabel} reports insufficient balance for this key.`;
      case 404:
        return 'Model or endpoint not found. The base URL may be wrong — it should usually end in /v1 (or be https://api.deepseek.com).';
      case 422:
        return `${providerLabel} could not process the parameters — ${error.message}`;
      case 429:
        return `${providerLabel} rate limit reached. Wait a moment, then retry.`;
      case 500:
      case 502:
      case 503:
      case 504:
        return `${providerLabel} servers are busy. Try again in a few seconds.`;
      default:
        return error.message || `Request failed (${error.status}).`;
    }
  }
  if (error instanceof TypeError) {
    return 'Could not reach the provider. This is often a network error or a base URL that blocks browser requests (CORS).';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong while contacting the provider.';
}

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export interface ProviderModel {
  id: string;
  name: string;
  /** Provider-reported context window when available. */
  context?: number;
  ownedBy?: string;
}

interface RawModel {
  id?: string;
  name?: string;
  context_window?: number;
  context_length?: number;
  owned_by?: string;
}

/** CORS proxy used when a provider's /models endpoint blocks browser origins. */
const CORS_PROXY = 'https://proxy.shakespeare.diy/?url={href}';

function proxiedUrl(url: string): string {
  return CORS_PROXY.replace('{href}', encodeURIComponent(url));
}

/** Fetch JSON with a timeout. Returns null on network/CORS failure. */
async function fetchJson(url: string, apiKey: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    // Network error, CORS block, or timeout — let the caller try a fallback.
    console.warn(`Request failed: ${url}`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse an [OI]-compatible /models payload. */
function parseModelsPayload(payload: { data?: RawModel[] } | RawModel[]): ProviderModel[] {
  const rows = Array.isArray(payload) ? payload : payload.data ?? [];
  return rows
    .filter((m): m is RawModel & { id: string } => typeof m?.id === 'string' && m.id.length > 0)
    .map((m) => ({
      id: m.id,
      name: m.name?.trim() || m.id,
      context: m.context_window ?? m.context_length,
      ownedBy: m.owned_by,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Extract a readable message from a failed response. */
async function extractErrorMessage(response: Response): Promise<string> {
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: { message?: string }; message?: string };
    message = body?.error?.message ?? body?.message ?? message;
  } catch {
    // Non-JSON error body.
  }
  return message;
}

/**
 * Fetch the model list from an [OI]-compatible /models endpoint.
 * Tries the provider directly; if that fails (CORS, timeout, network), retries
 * through the CORS proxy before giving up.
 */
export async function listModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 12000,
): Promise<ProviderModel[]> {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) throw new ProviderError('Add a base URL for your provider first.', 0);

  const target = `${root}/models`;

  // Pass 1: direct request.
  let response = await fetchJson(target, apiKey, timeoutMs);

  // Pass 2: proxy fallback for CORS-blocked or unreachable endpoints.
  let usedProxy = false;
  if (!response) {
    usedProxy = true;
    response = await fetchJson(proxiedUrl(target), apiKey, timeoutMs);
  }

  if (!response) {
    throw new ProviderError(
      `Could not reach ${root}/models from the browser. Check the base URL, and note that some providers block browser requests entirely — you can still enter the model id manually.`,
      0,
    );
  }

  if (!response.ok) {
    throw new ProviderError(await extractErrorMessage(response), response.status);
  }

  try {
    const payload = (await response.json()) as { data?: RawModel[] } | RawModel[];
    return parseModelsPayload(payload);
  } catch {
    throw new ProviderError(
      usedProxy
        ? 'The provider response could not be parsed (even through the proxy). Verify this endpoint serves an [OI]-compatible /models list.'
        : 'The provider response could not be parsed. Verify this endpoint serves an [OI]-compatible /models list.',
      0,
    );
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type FinishReason = 'stop' | 'length' | 'content_filter' | 'insufficient_system_resource' | 'aborted' | null;

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface StreamResult {
  content: string;
  /** Reasoning/thinking trace, when the provider exposes one. */
  reasoning: string;
  finishReason: FinishReason;
  usage?: Usage;
}

interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null };
    message?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: FinishReason;
  }>;
  usage?: Usage;
  error?: { message?: string };
}

export interface StreamOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  onReasoning?: (delta: string) => void;
  onContent?: (delta: string) => void;
  signal?: AbortSignal;
  /** Ask the provider for SSE streaming (default). */
  stream?: boolean;
}

/**
 * Run a chat completion, streaming tokens as they arrive. Falls back to a
 * single JSON response when the provider ignores `stream`.
 */
export async function streamCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  onReasoning,
  onContent,
  signal,
  stream = true,
}: StreamOptions): Promise<StreamResult> {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) throw new ProviderError('Add a base URL for your provider first.', 0);

  const requestBody = JSON.stringify({
    model,
    messages,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
  });

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: stream ? 'text/event-stream' : 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: requestBody,
    signal,
  };

  // Try the provider directly; fall back to the proxy if the browser request
  // is CORS-blocked or otherwise fails before a response exists.
  let response: Response;
  try {
    response = await fetch(`${root}/chat/completions`, requestInit);
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn('Direct request failed, retrying through the CORS proxy.', error);
    response = await fetch(proxiedUrl(`${root}/chat/completions`), requestInit);
  }

  if (!response.ok) {
    throw new ProviderError(await extractErrorMessage(response), response.status);
  }

  const contentType = response.headers.get('content-type') ?? '';

  // Some [OI]-compatible gateways ignore `stream`. Handle plain JSON gracefully.
  if (!contentType.includes('text/event-stream') || !response.body) {
    const body = (await response.json()) as StreamChunk;
    if (body.error?.message) throw new ProviderError(body.error.message, 0);
    const choice = body.choices?.[0];
    const content = choice?.message?.content ?? '';
    const reasoning = choice?.message?.reasoning_content ?? '';
    if (content) onContent?.(content);
    if (reasoning) onReasoning?.(reasoning);
    return { content, reasoning, finishReason: choice?.finish_reason ?? null, usage: body.usage };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let finishReason: FinishReason = null;
  let usage: Usage | undefined;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(payload) as StreamChunk;
    } catch {
      return;
    }

    if (chunk.error?.message) throw new ProviderError(chunk.error.message, 0);
    if (chunk.usage) usage = chunk.usage;

    const choice = chunk.choices?.[0];
    if (!choice) return;

    const reasoningDelta = choice.delta?.reasoning_content ?? choice.delta?.reasoning;
    if (reasoningDelta) {
      reasoning += reasoningDelta;
      onReasoning?.(reasoningDelta);
    }

    const contentDelta = choice.delta?.content;
    if (contentDelta) {
      content += contentDelta;
      onContent?.(contentDelta);
    }

    if (choice.finish_reason) finishReason = choice.finish_reason;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let index = buffer.indexOf('\n');
      while (index !== -1) {
        handleLine(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf('\n');
      }
    }
    if (buffer.trim()) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return { content, reasoning, finishReason, usage };
}

/** Loose sanity check — providers use wildly different key formats. */
export function looksLikeKey(key: string): boolean {
  return key.trim().length >= 12;
}

/** Mask a key for display: sk-abcd••••wxyz */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 10) return '••••';
  return `${trimmed.slice(0, 6)}••••${trimmed.slice(-4)}`;
}

/** "google/gemini-2.5-flash" → "Gemini 2.5 Flash" (fallback display name). */
export function prettifyModelId(id: string): string {
  const base = id.includes('/') ? id.split('/')[1] : id;
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
