import { describe, expect, it } from 'vitest';
import { buildForgeMessages, buildForgeSystemPrompt, buildRefineMessage, DEFAULT_OPTIONS } from './promptEngine';
import { cleanPrompt, deriveTitle, expansionRatio, estimateTokens, pushLimited } from './history';

describe('prompt forging helpers', () => {
  it('tells the crafter the target is DeepSeek V4.1 Flash', () => {
    const system = buildForgeSystemPrompt(DEFAULT_OPTIONS);
    expect(system).toContain('DeepSeek V4.1 Flash');
    expect(system).toContain('deepseek-flash');
    expect(system).toContain('384K');
    // Thinking is a server-side setting, so prompts must not ask for CoT.
    expect(system).toContain('think step by step');
  });

  it('honours structure and length choices', () => {
    const markdown = buildForgeSystemPrompt({ ...DEFAULT_OPTIONS, structure: 'markdown', length: 'compact' });
    expect(markdown).toContain('Markdown');
    expect(markdown).toContain('180 words');

    const xml = buildForgeSystemPrompt({ ...DEFAULT_OPTIONS, structure: 'xml', length: 'thorough' });
    expect(xml).toContain('XML-style tags');
    expect(xml).toContain('900 words');
  });

  it('switches between assumptions and placeholders', () => {
    const withAssumptions = buildForgeSystemPrompt({ ...DEFAULT_OPTIONS, assumptionMode: true });
    expect(withAssumptions).toContain('[assumption: …]');

    const withPlaceholders = buildForgeSystemPrompt({ ...DEFAULT_OPTIONS, assumptionMode: false });
    expect(withPlaceholders).toContain('{{AUDIENCE}}');
  });

  it('builds a system + user message pair with the draft', () => {
    const messages = buildForgeMessages('make me a plan', DEFAULT_OPTIONS, 'be terse');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('make me a plan');
    expect(messages[1].content).toContain('be terse');
  });

  it('builds a refine message from a previous prompt', () => {
    expect(buildRefineMessage('<task>old</task>')).toContain('<task>old</task>');
  });

  it('strips fences and title lines from model output', () => {
    expect(cleanPrompt('TITLE: Support Bot\n```xml\n<task>Do it</task>\n```')).toBe('<task>Do it</task>');
    expect(cleanPrompt('```markdown\n## Role\nYou are…\n```')).toBe('## Role\nYou are…');
    expect(cleanPrompt('  no fence at all  ')).toBe('no fence at all');
  });

  it('derives a title from the TITLE line or the draft', () => {
    expect(deriveTitle('TITLE: "Refund Policy Bot"\n```text\nhi\n```', 'whatever')).toBe('Refund Policy Bot');
    expect(deriveTitle('```text\nhi\n```', 'write me a blog post about AI agents for developers')).toBe(
      'write me a blog post about AI agents…',
    );
  });

  it('estimates tokens and growth', () => {
    expect(estimateTokens('')).toBe(1);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
    expect(expansionRatio('a'.repeat(40), 'a'.repeat(400))).toBeGreaterThan(5);
  });

  it('caps history length', () => {
    const list = pushLimited<number>([1, 2], 0, 3);
    expect(list).toEqual([0, 1, 2]);
  });
});
