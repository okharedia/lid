import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import type { z } from 'zod';

export const MODEL = process.env.LLM_MODEL ?? 'claude-sonnet-4-6';

// Pin baseURL — some shells set ANTHROPIC_BASE_URL without the `/v1` suffix,
// which the SDK would otherwise pick up and POST to `/messages` → 404.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

interface CallArgs<S extends z.ZodTypeAny> {
  schema: S;
  schemaName: string;
  system: string;
  user: string;
  temperature?: number;
  // Cap output tokens — Anthropic counts `max_tokens` against the input-rate
  // budget, so the SDK's 128k default exhausts low-tier limits instantly.
  maxOutputTokens?: number;
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
}: CallArgs<S>): Promise<z.infer<S>> {
  const attempt = async (temp: number) =>
    generateObject({
      model: anthropic(MODEL),
      schema,
      schemaName,
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
    return result.object;
  } catch (err) {
    // generateObject throws AI_NoObjectGeneratedError on schema mismatch. One
    // bad response shouldn't abort a 700-call run — retry once at temperature
    // 0 (more deterministic). API errors (429, 5xx) are already handled by
    // the SDK's own exponential backoff.
    const name = (err as { name?: string })?.name;
    if (name !== 'AI_NoObjectGeneratedError') throw err;
    const result = await attempt(0);
    return result.object;
  }
}
