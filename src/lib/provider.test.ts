import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  describeProviderError,
  listModels,
  looksLikeKey,
  maskKey,
  normalizeBaseUrl,
  prettifyModelId,
  ProviderError,
  streamCompletion,
} from './provider';

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const data = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

describe('provider helpers', () => {
  it('normalizes base URLs', () => {
    expect(normalizeBaseUrl('api.deepseek.com/')).toBe('https://api.deepseek.com');
    expect(normalizeBaseUrl(' https://api.openai.com/v1// ')).toBe('https://api.openai.com/v1');
    expect(normalizeBaseUrl('')).toBe('');
  });

  it('masks keys without leaking the middle', () => {
    expect(maskKey('sk-abcdefghijklmnop')).toBe('sk-abc••••mnop');
    expect(maskKey('short')).toBe('••••');
  });

  it('accepts any reasonably long key', () => {
    expect(looksLikeKey('gsk_1234567890abcdef')).toBe(true);
    expect(looksLikeKey('short')).toBe(false);
  });

  it('humanizes model ids as a fallback label', () => {
    expect(prettifyModelId('google/gemini-2.5-flash')).toBe('Gemini 2.5 Flash');
    expect(prettifyModelId('deepseek-v4-pro')).toBe('Deepseek V4 Pro');
  });

  it('explains auth failures clearly', () => {
    const message = describeProviderError(new ProviderError('bad key', 401), 'DeepSeek');
    expect(message).toContain('rejected your API key');
    expect(describeProviderError(new ProviderError('slow down', 429), 'Groq')).toContain('rate limit');
  });
});

describe('provider network calls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists models from the /models endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          object: 'list',
          data: [
            { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro', context_window: 1048576 },
            { id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash', context_window: 1048576 },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const models = await listModels('https://api.deepseek.com', 'sk-test');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/models',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(models.map((m) => m.id)).toEqual(['deepseek-flash', 'deepseek-v4-pro']);
    expect(models[0].context).toBe(1048576);
  });

  it('streams reasoning and content deltas separately', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          data({ choices: [{ delta: { reasoning_content: 'Think: ' } }] }),
          data({ choices: [{ delta: { reasoning_content: 'needs constraints.' } }] }),
          data({ choices: [{ delta: { content: 'TITLE: Support bot\n' } }] }),
          data({ choices: [{ delta: { content: '```xml\n<task />\n```' } }] }),
          'data: [DONE]\n\n',
        ]),
      ),
    );

    const reasoningDeltas: string[] = [];
    const contentDeltas: string[] = [];

    const result = await streamCompletion({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: 'hi' }],
      onReasoning: (d) => reasoningDeltas.push(d),
      onContent: (d) => contentDeltas.push(d),
    });

    expect(result.reasoning).toBe('Think: needs constraints.');
    expect(result.content).toBe('TITLE: Support bot\n```xml\n<task />\n```');
    expect(reasoningDeltas.join('')).toBe(result.reasoning);
    expect(contentDeltas.join('')).toBe(result.content);
  });

  it('throws a ProviderError with the provider message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(
      streamCompletion({
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'bad',
        model: 'deepseek-flash',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow(ProviderError);
  });

  it('falls back to a JSON body when the provider ignores streaming', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'plain answer' }, finish_reason: 'stop' }],
            usage: { total_tokens: 42 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await streamCompletion({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'k',
      model: 'some-model',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.content).toBe('plain answer');
    expect(result.usage?.total_tokens).toBe(42);
  });
});
