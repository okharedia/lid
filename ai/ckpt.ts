import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Append-only JSONL checkpoint, keyed by a stable string. Each completed item
// is flushed immediately so a crash / credit-out never loses paid work — a
// re-run reloads the file and skips keys already present.
//
// Only SUCCESSFUL results are checkpointed; failed/empty fallbacks are NOT,
// so they get retried on the next run.

export function loadCheckpoint<T>(file: string): Map<string, T> {
  const map = new Map<string, T>();
  if (!existsSync(file)) return map;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const { key, value } = JSON.parse(line) as { key: string; value: T };
      map.set(key, value); // last write wins
    } catch {
      // ignore a partially-written trailing line
    }
  }
  return map;
}

// Synchronous append. JS is single-threaded so concurrent pMap workers cannot
// interleave bytes within a single appendFileSync call.
export function appendCheckpoint<T>(file: string, key: string, value: T): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify({ key, value }) + '\n', 'utf8');
}
