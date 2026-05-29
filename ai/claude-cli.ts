import { execFile } from 'node:child_process';
import { jsonrepair } from 'jsonrepair';

export interface CliResult {
  text: string;
  usage?: { cache_read_input_tokens?: number; cache_creation_input_tokens?: number; output_tokens?: number };
}

// Run a one-shot generation via the Claude Code CLI in print mode. This uses
// the local OAuth *subscription* (no per-token API billing), unlike the AI SDK
// path which uses ANTHROPIC_API_KEY.
//
// --system-prompt REPLACES Claude Code's default coding-agent system prompt
// (minimal overhead + clean output). --allowed-tools "" disables tools.
// We deliberately do NOT use --bare, which would force API-key auth.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Transient throttle / overload patterns worth waiting out (vs. a bad prompt).
const TRANSIENT = /rate.?limit|overloaded|429|too many requests|usage limit|capacity|temporarily|503|529/i;

export async function runClaudeCli(args: {
  system: string;
  user: string;
  model: string;
}): Promise<CliResult> {
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await runOnce(args);
    } catch (e) {
      lastErr = e;
      const msg = (e as { message?: string })?.message ?? '';
      if (attempt < maxAttempts && TRANSIENT.test(msg)) {
        await sleep(attempt * 20_000); // 20s, 40s, 60s
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function runOnce(args: {
  system: string;
  user: string;
  model: string;
}): Promise<CliResult> {
  const cliArgs = [
    '-p',
    args.user,
    '--output-format',
    'json',
    '--model',
    args.model,
    '--system-prompt',
    args.system,
    '--allowed-tools',
    '',
    '--no-session-persistence',
    // Don't load the user's MCP servers on every spawn (avoids flakiness).
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
  ];
  // Close stdin immediately: claude -p otherwise waits ~3s for piped stdin
  // ("no stdin data received in 3s") which both slows every call and can
  // surface as a non-zero exit. promisify(execFile) hides the child, so use
  // the callback form and end stdin right away.
  let stdout: string;
  try {
    stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        'claude',
        cliArgs,
        { maxBuffer: 32 * 1024 * 1024, env: process.env },
        (err, out, stderr) => {
          if (err) {
            (err as { stderr?: string }).stderr = stderr;
            reject(err);
          } else {
            resolve(out);
          }
        },
      );
      child.stdin?.end();
    });
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const detail = (err.stderr || err.stdout || '').toString().trim().slice(0, 500);
    throw new Error(`claude -p exited non-zero: ${detail || err.message || 'unknown'}`);
  }
  const env = JSON.parse(stdout) as {
    is_error?: boolean;
    subtype?: string;
    result?: string;
    api_error_status?: unknown;
    usage?: CliResult['usage'];
  };
  if (env.is_error || env.subtype !== 'success') {
    throw new Error(
      `claude -p result error: subtype=${env.subtype} api_error=${JSON.stringify(env.api_error_status)} result=${String(env.result ?? '').slice(0, 300)}`,
    );
  }
  return { text: env.result ?? '', usage: env.usage };
}

// Extract a JSON object from model text: strip ``` fences, then parse; if that
// fails, fall back to the outermost { ... } slice.
export function extractJsonObject(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    // The model sometimes closes a German guillemet „…" with a straight ASCII
    // quote, prematurely terminating the JSON string. jsonrepair fixes such
    // unescaped/mismatched quotes and other minor malformations.
    return JSON.parse(jsonrepair(t));
  }
}
