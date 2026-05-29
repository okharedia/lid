import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import type { z } from 'zod';
import { extractJsonObject, runClaudeCli } from './claude-cli.js';

export const MODEL = process.env.LLM_MODEL ?? 'claude-sonnet-4-6';

// When set, generation runs through the local Claude Code CLI (subscription,
// no per-token API billing) instead of the AI SDK (ANTHROPIC_API_KEY).
const USE_CLAUDE_CLI = Boolean(process.env.USE_CLAUDE_CLI);

// Pin baseURL — some shells set ANTHROPIC_BASE_URL without the `/v1` suffix,
// which the SDK would otherwise pick up and POST to `/messages` → 404.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

export const TRANSLATION_MODEL = process.env.TRANSLATION_MODEL ?? 'claude-haiku-4-5';

interface CallArgs<S extends z.ZodTypeAny> {
  schema: S;
  schemaName: string;
  system: string;
  user: string;
  temperature?: number;
  // Cap output tokens — Anthropic counts `max_tokens` against the input-rate
  // budget, so the SDK's 128k default exhausts low-tier limits instantly.
  maxOutputTokens?: number;
  // Override the model for this call (e.g. cheaper Haiku for translation).
  model?: string;
}

// 1-hour cache TTL: a full 310-question run easily exceeds the 5-minute
// ephemeral default, so we'd otherwise pay a fresh cache-write every gap.
// 1h write costs 2x but read is still ~0.1x; for ~700 calls this is a win.
const CACHE_CONTROL = { type: 'ephemeral', ttl: '1h' } as const;

export async function call<S extends z.ZodTypeAny>({
  schema,
  schemaName,
  system,
  user,
  temperature = 0.2,
  maxOutputTokens = 2000,
  model = MODEL,
}: CallArgs<S>): Promise<z.infer<S>> {
  if (USE_CLAUDE_CLI) return callViaCli({ schema, system, user, model });

  const attempt = async (temp: number) =>
    generateText({
      model: anthropic(model),
      output: Output.object({ schema, name: schemaName }),
      temperature: temp,
      maxOutputTokens,
      messages: [
        {
          role: 'system',
          content: system,
          providerOptions: { anthropic: { cacheControl: CACHE_CONTROL } },
        },
        { role: 'user', content: user },
      ],
    });

  try {
    const result = await attempt(temperature);
    return result.output;
  } catch (err) {
    // generateText throws AI_NoObjectGeneratedError on schema mismatch. One
    // bad response shouldn't abort a 700-call run — retry once at temperature
    // 0 (more deterministic). API errors (429, 5xx) are already handled by
    // the SDK's own exponential backoff.
    const name = (err as { name?: string })?.name;
    if (name !== 'AI_NoObjectGeneratedError') throw err;
    const result = await attempt(0);
    return result.output;
  }
}

// Claude Code CLI path: prompt for raw JSON, parse, validate with the same zod
// schema (the preprocess handles stringified arrays). Retry once on a bad
// parse/validation; surface API/auth/rate errors to the caller's error handler.
async function callViaCli<S extends z.ZodTypeAny>(args: {
  schema: S;
  system: string;
  user: string;
  model: string;
}): Promise<z.infer<S>> {
  const user = `${args.user}\n\nAntworte mit GÜLTIGEM JSON, das exakt dem geforderten Schema entspricht. Keine Erklärungen, keine Code-Fences, kein Text außerhalb des JSON.`;
  const parseOnce = async (): Promise<z.infer<S>> => {
    const { text } = await runClaudeCli({ system: args.system, user, model: args.model });
    return args.schema.parse(extractJsonObject(text));
  };
  try {
    return await parseOnce();
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? '';
    // Bad JSON / schema mismatch → retry once. Anything else (auth, rate,
    // network) → rethrow so the stage logs it and moves on.
    const recoverable = /JSON|schema|Expected|Required|invalid/i.test(msg) || (err as { name?: string })?.name === 'ZodError';
    if (!recoverable) throw err;
    return await parseOnce();
  }
}
