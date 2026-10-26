import type { ChatMessage } from './provider';

export type PersonaId = 'auto' | 'code' | 'agent' | 'writing' | 'research' | 'image' | 'business' | 'learning';

export interface Persona {
  id: PersonaId;
  label: string;
  icon: string;
  hint: string;
}

export const PERSONAS: Persona[] = [
  { id: 'auto', label: 'Auto-detect', icon: 'Wand2', hint: 'Let the crafter choose the framing' },
  { id: 'code', label: 'Code', icon: 'Code2', hint: 'Engineers, debugging, architecture, review' },
  { id: 'agent', label: 'Agent / Tools', icon: 'Bot', hint: 'System prompts for autonomous agents' },
  { id: 'writing', label: 'Writing', icon: 'PenLine', hint: 'Copy, essays, storytelling, voice' },
  { id: 'research', label: 'Research', icon: 'FlaskConical', hint: 'Analysis, synthesis, evidence handling' },
  { id: 'image', label: 'Image / Visual', icon: 'Image', hint: 'Art direction and image prompts' },
  { id: 'business', label: 'Business', icon: 'Briefcase', hint: 'Strategy, ops, marketing, decks' },
  { id: 'learning', label: 'Learning', icon: 'GraduationCap', hint: 'Tutors, curricula, explanations' },
];

export type Structure = 'xml' | 'markdown' | 'plain';
export type Length = 'compact' | 'balanced' | 'thorough';

export interface ForgeOptions {
  persona: PersonaId;
  structure: Structure;
  length: Length;
  /** Fill gaps with explicitly labelled assumptions instead of placeholders. */
  assumptionMode: boolean;
  /** Ask clarifying questions alongside the forged prompt. */
  askQuestions: boolean;
}

export const LENGTH_LABEL: Record<Length, string> = {
  compact: 'Compact',
  balanced: 'Balanced',
  thorough: 'Thorough',
};

export const STRUCTURE_LABEL: Record<Structure, string> = {
  xml: 'XML tags',
  markdown: 'Markdown',
  plain: 'Plain prose',
};

/** Default forging options. Mirrored by the preferences hook. */
export const DEFAULT_OPTIONS: ForgeOptions = {
  persona: 'auto',
  structure: 'xml',
  length: 'balanced',
  assumptionMode: true,
  askQuestions: false,
};

const LENGTH_GUIDE: Record<Length, string> = {
  compact:
    'Keep the final prompt under roughly 180 words. Every line must earn its place; prefer dense clauses over sections.',
  balanced:
    'Aim for roughly 250–450 words. Include only the sections that genuinely add value for this task.',
  thorough:
    'Aim for 500–900 words. Cover edge cases, worked examples, and explicit acceptance criteria in depth.',
};

const STRUCTURE_GUIDE: Record<Structure, string> = {
  xml:
    'Format the forged prompt as one self-contained block using XML-style tags such as <role>, <task>, <context>, <constraints>, <output_format>, and <examples>. Nothing outside the tags except the prompt itself.',
  markdown:
    'Format the forged prompt in Markdown with short `##` headings and tight bullets. It must read cleanly when pasted into a chat window.',
  plain:
    'Format the forged prompt as flowing, well-structured prose with no headings, tags, or bullet lists.',
};

/**
 * Everything the crafter needs to know about the destination model. DeepSeek
 * V4.1 Flash has a very large context, a huge output budget, optional thinking
 * with low/high/max effort, and a file/vision input mode — prompts can lean on
 * those instead of hedging.
 */
const TARGET_MODEL_BRIEF = [
  '## The model that will run the forged prompt',
  '- Name: DeepSeek V4.1 Flash (API id `deepseek-flash`).',
  '- 1M-token context window and up to 384K output tokens, so prompts may include long reference material, whole codebases, or multi-document context without asking for summaries "to save room".',
  '- Thinking mode with reasoning_effort of low / high / max (default high). Reasoning is not controlled by "think step by step" in the prompt — that is a wasted instruction. Prefer concrete procedure, ordering, and success criteria instead.',
  '- Temperature has no effect in thinking mode, so do not ask for "temperature 0.2" behaviour in prose; ask for determinism through explicit rules and formats.',
  '- Supports images as input (URLs or base64) plus text, and can read uploaded files.',
  '- Reliable at long structured output, XML-tagged sections, strict JSON, and tool-style protocols.',
].join('\n');

const PERSONA_GUIDE: Record<PersonaId, string> = {
  auto: 'Infer the most useful domain framing from the user\'s draft and adopt that expert role.',
  code: 'Adopt the perspective of a principal engineer: correctness, edge cases, performance, testability, and maintainability.',
  agent: 'Adopt the perspective of someone who designs autonomous agent system prompts: tool contracts, stopping conditions, refusal policy, and failure handling.',
  writing: 'Adopt the perspective of an exacting editor: voice, structure, audience, and concrete revision criteria.',
  research: 'Adopt the perspective of a rigorous researcher: evidence quality, source handling, uncertainty, and synthesis.',
  image: 'Adopt the perspective of an art director: subject, composition, lighting, palette, medium, and rendering details.',
  business: 'Adopt the perspective of an operator: decision framing, stakeholders, tradeoffs, and measurable outcomes.',
  learning: 'Adopt the perspective of an expert tutor: prerequisite ordering, worked examples, checks for understanding, and common misconceptions.',
};

/** Build the crafter's system prompt. */
export function buildForgeSystemPrompt(options: ForgeOptions): string {
  const persona = PERSONAS.find((p) => p.id === options.persona) ?? PERSONAS[0];

  return [
    'You are Prompt Forge, an elite prompt engineer. A user hands you a rough, half-formed draft of a prompt. You return a dramatically stronger version of that same prompt, written for DeepSeek V4.1 Flash.',
    '',
    TARGET_MODEL_BRIEF,
    '',
    '## How you think before answering (private — never echoed in your output)',
    '1. Identify the real underlying task, even if the draft states it poorly.',
    '2. Infer the audience, environment, inputs, and what "done" looks like.',
    '3. List every ambiguity, missing constraint, and unstated assumption that could make DeepSeek V4.1 Flash fail.',
    '4. Choose the sections that best fit THIS task: role, task, context, constraints, output format, examples, edge cases.',
    '5. Draft it, then critique your own draft. Cut platitudes. Tighten vague verbs. Confirm the output contract is unambiguous. Rewrite.',
    '',
    '## Rules for the forged prompt',
    `- ${PERSONA_GUIDE[options.persona]}`,
    '- Preserve the user\'s intent, language, and any specifics they included. Never change the subject matter.',
    '- Never write platitudes such as "be helpful", "be accurate", "provide a high-quality answer", or "think step by step".',
    '- Replace adjectives with measurable criteria. Every instruction must be concrete and testable.',
    '- State the audience and assumed expertise level explicitly.',
    '- Define the output contract precisely: format, length, structure, ordering, and what to do with unknowns.',
    `- ${LENGTH_GUIDE[options.length]}`,
    `- ${STRUCTURE_GUIDE[options.structure]}`,
    options.assumptionMode
      ? '- Where the draft is silent on something important, choose the most sensible option yourself and mark it inline as [assumption: …].'
      : '- Where the draft is silent on something important, insert a clearly labelled placeholder such as {{AUDIENCE}} or {{TONE}} for the user to fill in.',
    options.askQuestions
      ? '- After the prompt, append a short "Open questions" list of at most 3 sharp questions whose answers would materially improve it.'
      : '- Do not ask the user questions.',
    '- The forged prompt must be immediately usable: no meta-commentary inside it, no "here is your prompt" wrapper, no reference to this conversation.',
    '',
    '## Output contract',
    'First line: `TITLE:` followed by a title of at most 6 words.',
    'Then: the forged prompt inside a single fenced code block tagged xml, markdown, or text.',
    'Then stop. No explanation of your reasoning, no summary of changes, no closing remarks.',
    `The persona framing was: ${persona.label}.`,
  ].join('\n');
}

/** Build the user message that carries the draft to the crafter. */
export function buildForgeUserMessage(draft: string, extraNotes: string | undefined): string {
  const parts = ['Here is my draft prompt:', '', '```', draft.trim(), '```'];
  if (extraNotes?.trim()) {
    parts.push('', 'Extra guidance for the rewrite:', extraNotes.trim());
  }
  parts.push('', 'Return the forged prompt now.');
  return parts.join('\n');
}

/** Ask the crafter to iterate on its own previous output. */
export function buildRefineMessage(previousPrompt: string): string {
  return [
    'Here is a prompt that I want you to make even stronger. Keep the intent, but sharpen the constraints, structure, and output contract.',
    '',
    '```',
    previousPrompt.trim(),
    '```',
    '',
    'Return the forged prompt now.',
  ].join('\n');
}

export function buildForgeMessages(
  draft: string,
  options: ForgeOptions,
  extraNotes?: string,
): ChatMessage[] {
  return [
    { role: 'system', content: buildForgeSystemPrompt(options) },
    { role: 'user', content: buildForgeUserMessage(draft, extraNotes) },
  ];
}

/** Starter drafts shown as one-click chips on an empty forge. */
export const STARTER_DRAFTS: { label: string; text: string }[] = [
  { label: 'Code review', text: 'review my react code and tell me whats wrong' },
  { label: 'Blog post', text: 'write a blog post about AI agents for developers' },
  { label: 'System prompt', text: 'system prompt for a support bot for a coffee subscription, no refunds over $50' },
  { label: 'Study plan', text: 'make me a study plan to learn rust in 6 weeks' },
  { label: 'Data analysis', text: 'analyse our churn data and tell me why customers leave' },
];
