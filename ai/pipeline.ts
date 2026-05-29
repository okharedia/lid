import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pMap from 'p-map';

import { call, MODEL, TRANSLATION_MODEL } from './llm.js';
import { appendCheckpoint, loadCheckpoint } from './ckpt.js';
import {
  buildFinalGlossaryPrompt,
  buildFinalNotePrompt,
  buildPerQuestionPrompt,
  buildShortLabelPrompt,
  buildSystemPrompt,
  buildTranslationPrompt,
} from './prompts.js';
import {
  FinalGlossarySchema,
  FinalNoteSchema,
  PerQuestionResultSchema,
  ShortLabelBatchSchema,
  TranslationBatchSchema,
  type MergedTermGroup,
  type MinimalQuestion,
  type PerQuestionResult,
  type SuggestionsFile,
} from './schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SOURCE_JSON = resolve(REPO_ROOT, 'data/lid-berlin-source-of-truth.json');
const METADATA_JSON = resolve(REPO_ROOT, 'data/lid-berlin-question-metadata.json');
const CURRICULUM_MD = resolve(__dirname, 'curriculum.md');
const OUT_DIR = resolve(__dirname, 'out');

// Resumable checkpoints (append-only JSONL). Successful results are flushed as
// they complete; a re-run skips keys already present. gitignored via out/.
const CKPT = {
  perQuestion: resolve(OUT_DIR, 'ckpt-per-question.jsonl'),
  glossary: resolve(OUT_DIR, 'ckpt-glossary-de.jsonl'),
  notes: resolve(OUT_DIR, 'ckpt-notes-de.jsonl'),
  translations: resolve(OUT_DIR, 'ckpt-translations.jsonl'),
};

// Concurrency. For the API path, tier-1 rate limit (30k input tokens/min)
// caps this ~2. For the CLI path each call is a ~30s process cold-start, so
// higher parallelism is the main speed lever. Override via CONCURRENCY env.
const CONCURRENCY = Number(process.env.CONCURRENCY ?? (process.env.USE_CLAUDE_CLI ? 6 : 2));
const TRANSLATION_BATCH = 12;

interface RawQuestion {
  question: string;
  correctAnswerIndex: number;
  answers: string[];
}

interface RawMetadata {
  questions?: Array<{ id: number; theme?: string }>;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function loadSources(limit: number | null): Promise<{
  questions: MinimalQuestion[];
  curriculum: string;
}> {
  const [rawSource, rawMeta, curriculum] = await Promise.all([
    readFile(SOURCE_JSON, 'utf8').then((s) => JSON.parse(s) as Record<string, RawQuestion>),
    readFile(METADATA_JSON, 'utf8').then((s) => JSON.parse(s) as RawMetadata),
    readFile(CURRICULUM_MD, 'utf8'),
  ]);

  const themeById = new Map<string, string | undefined>();
  for (const meta of rawMeta.questions ?? []) {
    themeById.set(String(meta.id), meta.theme);
  }

  let ids = Object.keys(rawSource).sort((a, b) => Number(a) - Number(b));
  if (limit !== null) ids = ids.slice(0, limit);
  const questions: MinimalQuestion[] = ids.map((id) => {
    const q = rawSource[id]!;
    const correctAnswer = q.answers[q.correctAnswerIndex] ?? '';
    return {
      id,
      question: q.question,
      correctAnswer,
      theme: themeById.get(id),
    };
  });

  return { questions, curriculum };
}

interface PerQuestionEntry extends PerQuestionResult {
  id: string;
}

// Stage 2 (per-question). First call runs alone so it primes the prompt
// cache; the remaining 309 then run at high concurrency hitting cache reads.
const failures: string[] = [];
function logFail(label: string, err: unknown): void {
  const msg = (err as { message?: string })?.message ?? String(err);
  failures.push(`${label}: ${msg.split('\n')[0]}`);
  process.stderr.write(`  ! ${label} failed: ${msg.split('\n')[0]}\n`);
}

async function stagePerQuestion(
  questions: MinimalQuestion[],
  system: string,
): Promise<PerQuestionEntry[]> {
  const cache = loadCheckpoint<PerQuestionResult>(CKPT.perQuestion);
  const runOne = async (q: MinimalQuestion): Promise<PerQuestionEntry> => {
    const cached = cache.get(q.id);
    if (cached) return { id: q.id, ...cached };
    try {
      const result = await call({
        schema: PerQuestionResultSchema,
        schemaName: 'PerQuestionResult',
        system,
        user: buildPerQuestionPrompt(q),
        maxOutputTokens: 1500,
      });
      appendCheckpoint(CKPT.perQuestion, q.id, result);
      return { id: q.id, ...result };
    } catch (err) {
      logFail(`per-question q${q.id}`, err);
      return { id: q.id, needsNote: false, noteReason: 'extraction-failed', candidateTerms: [] };
    }
  };

  const todo = questions.filter((q) => !cache.has(q.id));
  console.log(`  resume: ${questions.length - todo.length}/${questions.length} from checkpoint, ${todo.length} to fetch`);

  const results: PerQuestionEntry[] = [];
  if (todo.length === 0) return questions.map((q) => ({ id: q.id, ...cache.get(q.id)! }));

  // Warm the prompt cache with one call before fanning out.
  process.stdout.write('  warming prompt cache... ');
  const warmDone = await runOne(todo[0]!);
  process.stdout.write('done\n');

  let done = 1;
  const total = todo.length;
  await pMap(
    todo.slice(1),
    async (q) => {
      await runOne(q);
      done += 1;
      if (done % 25 === 0 || done === total) process.stdout.write(`  per-question ${done}/${total}\n`);
    },
    { concurrency: CONCURRENCY },
  );
  void warmDone;

  // Reload so the returned set includes everything (cached + freshly written).
  const merged = loadCheckpoint<PerQuestionResult>(CKPT.perQuestion);
  return questions.map((q) => {
    const r = merged.get(q.id);
    return r ? { id: q.id, ...r } : { id: q.id, needsNote: false, noteReason: 'extraction-failed', candidateTerms: [] };
  });
}

// Stage 3: deterministic merge by canonical (case-insensitive, German locale).
function stageMerge(perQuestion: PerQuestionEntry[]): MergedTermGroup[] {
  const norm = (s: string) => s.trim().toLocaleLowerCase('de-DE');
  const byKey = new Map<string, MergedTermGroup>();

  for (const q of perQuestion) {
    for (const term of q.candidateTerms) {
      const key = norm(term.canonical);
      if (!key) continue;
      let group = byKey.get(key);
      if (!group) {
        group = {
          canonical: term.canonical.trim(),
          surfaces: [],
          questionIds: [],
          draftExplanations: [],
        };
        byKey.set(key, group);
      }
      if (!group.surfaces.includes(term.surface)) group.surfaces.push(term.surface);
      if (!group.questionIds.includes(q.id)) group.questionIds.push(q.id);
      group.draftExplanations.push(term.draftExplanation);
    }
  }
  for (const g of byKey.values()) {
    g.questionIds.sort((a, b) => Number(a) - Number(b));
  }
  return [...byKey.values()].sort((a, b) =>
    a.canonical.localeCompare(b.canonical, 'de-DE'),
  );
}

interface GlossaryEntryDe {
  term: string;
  explanationDe: string;
  questionIds: string[];
}

async function stageFinalGlossary(
  merged: MergedTermGroup[],
  system: string,
): Promise<GlossaryEntryDe[]> {
  const cache = loadCheckpoint<string>(CKPT.glossary); // term -> explanationDe
  const todoCount = merged.filter((g) => !cache.has(g.canonical)).length;
  console.log(`  resume: ${merged.length - todoCount}/${merged.length} from checkpoint, ${todoCount} to fetch`);

  let done = 0;
  const total = merged.length;
  const entries = await pMap(
    merged,
    async (g) => {
      let explanationDe = cache.get(g.canonical) ?? '';
      if (!explanationDe) {
        try {
          const result = await call({
            schema: FinalGlossarySchema,
            schemaName: 'FinalGlossary',
            system,
            user: buildFinalGlossaryPrompt(g),
            maxOutputTokens: 800,
          });
          explanationDe = result.explanation;
          appendCheckpoint(CKPT.glossary, g.canonical, explanationDe);
        } catch (err) {
          logFail(`glossary "${g.canonical}"`, err);
        }
      }
      done += 1;
      if (done % 20 === 0 || done === total) process.stdout.write(`  glossary ${done}/${total}\n`);
      return { term: g.canonical, explanationDe, questionIds: g.questionIds };
    },
    { concurrency: CONCURRENCY },
  );
  return entries.sort((a, b) => a.term.localeCompare(b.term, 'de-DE'));
}

interface NoteDe {
  id: string;
  noteDe: string;
}

async function stageFinalNotes(
  questions: MinimalQuestion[],
  perQuestion: PerQuestionEntry[],
  glossary: GlossaryEntryDe[],
  system: string,
): Promise<NoteDe[]> {
  const needsNoteById = new Map(perQuestion.map((p) => [p.id, p.needsNote]));
  const glossaryByQuestion = new Map<string, Array<{ canonical: string; explanation: string }>>();
  for (const entry of glossary) {
    for (const qid of entry.questionIds) {
      const list = glossaryByQuestion.get(qid) ?? [];
      list.push({ canonical: entry.term, explanation: entry.explanationDe });
      glossaryByQuestion.set(qid, list);
    }
  }

  const cache = loadCheckpoint<string>(CKPT.notes); // id -> noteDe
  const toWrite = questions.filter((q) => needsNoteById.get(q.id));
  const todoCount = toWrite.filter((q) => !cache.has(q.id)).length;
  console.log(`  resume: ${toWrite.length - todoCount}/${toWrite.length} from checkpoint, ${todoCount} to fetch`);

  let done = 0;
  const total = toWrite.length;

  const written = await pMap(
    toWrite,
    async (q) => {
      const linked = glossaryByQuestion.get(q.id) ?? [];
      let noteDe = cache.get(q.id) ?? '';
      if (!noteDe) {
        try {
          const result = await call({
            schema: FinalNoteSchema,
            schemaName: 'FinalNote',
            system,
            user: buildFinalNotePrompt(q, linked),
            maxOutputTokens: 600,
          });
          noteDe = result.note;
          appendCheckpoint(CKPT.notes, q.id, noteDe);
        } catch (err) {
          logFail(`note q${q.id}`, err);
        }
      }
      done += 1;
      if (done % 20 === 0 || done === total) process.stdout.write(`  notes ${done}/${total}\n`);
      return { id: q.id, noteDe };
    },
    { concurrency: CONCURRENCY },
  );

  const writtenById = new Map(written.map((n) => [n.id, n]));
  return questions
    .map((q) => writtenById.get(q.id) ?? { id: q.id, noteDe: '' })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Translation runs on the cheaper Haiku model — it's a mechanical DE→EN task.
async function translateBatch(
  items: Array<{ key: string; de: string }>,
  system: string,
): Promise<Map<string, string>> {
  const result = await call({
    schema: TranslationBatchSchema,
    schemaName: 'TranslationBatch',
    system,
    user: buildTranslationPrompt(items),
    maxOutputTokens: 2500,
    model: TRANSLATION_MODEL,
  });
  return new Map(result.items.map((it) => [it.key, it.en]));
}

async function shortLabelBatch(
  items: Array<{ key: string; term: string }>,
  system: string,
): Promise<Map<string, string>> {
  const result = await call({
    schema: ShortLabelBatchSchema,
    schemaName: 'ShortLabelBatch',
    system,
    user: buildShortLabelPrompt(items),
    maxOutputTokens: 800,
    model: TRANSLATION_MODEL,
  });
  return new Map(result.items.map((it) => [it.key, it.en]));
}

async function stageTranslate(
  glossary: GlossaryEntryDe[],
  notes: NoteDe[],
  system: string,
): Promise<{ glossary: SuggestionsFile['glossary']; notes: SuggestionsFile['notes'] }> {
  // Single checkpoint keyed by item key (g:<term>, n:<id>, s:<term>).
  const cache = loadCheckpoint<string>(CKPT.translations);

  // Glossary long explanations + short labels + question notes (skip empties).
  const explanationItems = glossary
    .filter((g) => g.explanationDe)
    .map((g) => ({ key: `g:${g.term}`, de: g.explanationDe }));
  const shortItems = glossary.map((g) => ({ key: `s:${g.term}`, term: g.term }));
  const noteItems = notes
    .filter((n) => n.noteDe !== '')
    .map((n) => ({ key: `n:${n.id}`, de: n.noteDe }));

  const todoExpl = explanationItems.filter((it) => !cache.has(it.key));
  const todoShort = shortItems.filter((it) => !cache.has(it.key));
  const todoNote = noteItems.filter((it) => !cache.has(it.key));
  console.log(
    `  resume: glossary ${explanationItems.length - todoExpl.length}/${explanationItems.length}, ` +
      `notes ${noteItems.length - todoNote.length}/${noteItems.length}, ` +
      `labels ${shortItems.length - todoShort.length}/${shortItems.length} from checkpoint`,
  );

  const runTextBatches = async (
    todo: Array<{ key: string; de: string }>,
    label: string,
  ): Promise<void> => {
    let done = 0;
    await pMap(
      chunk(todo, TRANSLATION_BATCH),
      async (batch) => {
        try {
          const m = await translateBatch(batch, system);
          for (const [k, v] of m) {
            cache.set(k, v);
            appendCheckpoint(CKPT.translations, k, v);
          }
        } catch (err) {
          logFail(`${label} batch (${batch.length} items)`, err);
        }
        done += batch.length;
        process.stdout.write(`  ${label} ${done}/${todo.length}\n`);
      },
      { concurrency: CONCURRENCY },
    );
  };

  await runTextBatches(todoExpl, 'translate glossary');
  await runTextBatches(todoNote, 'translate notes');

  // Short labels (different prompt shape).
  let doneS = 0;
  await pMap(
    chunk(todoShort, TRANSLATION_BATCH),
    async (batch) => {
      try {
        const m = await shortLabelBatch(batch, system);
        for (const [k, v] of m) {
          cache.set(k, v);
          appendCheckpoint(CKPT.translations, k, v);
        }
      } catch (err) {
        logFail(`short-label batch (${batch.length} items)`, err);
      }
      doneS += batch.length;
      process.stdout.write(`  short labels ${doneS}/${todoShort.length}\n`);
    },
    { concurrency: CONCURRENCY },
  );

  const outGlossary: SuggestionsFile['glossary'] = glossary.map((g) => ({
    term: g.term,
    shortEn: cache.get(`s:${g.term}`) ?? g.term,
    explanationDe: g.explanationDe,
    explanationEn: cache.get(`g:${g.term}`) ?? '',
    questionIds: g.questionIds,
  }));
  const outNotes: SuggestionsFile['notes'] = notes.map((n) => ({
    id: n.id,
    noteDe: n.noteDe,
    noteEn: n.noteDe === '' ? '' : cache.get(`n:${n.id}`) ?? '',
  }));

  return { glossary: outGlossary, notes: outNotes };
}

export async function runPipeline(limit: number | null): Promise<SuggestionsFile> {
  const runId = randomUUID();
  const { questions, curriculum } = await loadSources(limit);
  console.log(`[1] loaded ${questions.length} questions, ~${curriculum.length.toLocaleString()} chars curriculum`);
  console.log(`    model=${MODEL} translation=${TRANSLATION_MODEL} concurrency=${CONCURRENCY} (resumable)`);

  const system = buildSystemPrompt(curriculum);

  const perQuestion = await stagePerQuestion(questions, system);
  await writeJson(resolve(OUT_DIR, '03-per-question.json'), perQuestion);
  const candidateCount = perQuestion.reduce((n, p) => n + p.candidateTerms.length, 0);
  const needsNoteCount = perQuestion.filter((p) => p.needsNote).length;
  console.log(`[3] per-question: ${candidateCount} term candidates, ${needsNoteCount} needsNote`);

  const merged = stageMerge(perQuestion);
  await writeJson(resolve(OUT_DIR, '04-merged.json'), merged);
  console.log(`[4] merged: ${merged.length} canonical terms`);

  const glossaryDe = await stageFinalGlossary(merged, system);
  await writeJson(resolve(OUT_DIR, '05-glossary-de.json'), glossaryDe);
  console.log(`[5] final glossary (DE): ${glossaryDe.length} entries`);

  const notesDe = await stageFinalNotes(questions, perQuestion, glossaryDe, system);
  await writeJson(resolve(OUT_DIR, '06-notes-de.json'), notesDe);
  const writtenNotes = notesDe.filter((n) => n.noteDe !== '').length;
  console.log(`[6] final notes (DE): ${writtenNotes} written, ${notesDe.length - writtenNotes} empty`);

  const { glossary, notes } = await stageTranslate(glossaryDe, notesDe, system);
  console.log(`[7] translations done`);

  const suggestions: SuggestionsFile = {
    generatedAt: new Date().toISOString(),
    runId,
    model: MODEL,
    questions: questions.length,
    glossary,
    notes,
  };
  const outPath = resolve(OUT_DIR, 'suggestions.json');
  await writeJson(outPath, suggestions);
  console.log(`[done] wrote ${outPath}`);

  if (failures.length) {
    console.log(`\n[warn] ${failures.length} call(s) failed; affected items got empty fallbacks:`);
    for (const f of failures.slice(0, 20)) console.log(`  - ${f}`);
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  }

  return suggestions;
}
