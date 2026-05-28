import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pMap from 'p-map';

import { call, MODEL } from './llm.js';
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

// Tier-1 Anthropic rate limit is 30k input tokens/min. Concurrency 2 keeps us
// safely under it even when several calls in flight all miss cache.
const CONCURRENCY = 2;
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
  const runOne = async (q: MinimalQuestion): Promise<PerQuestionEntry> => {
    try {
      const result = await call({
        schema: PerQuestionResultSchema,
        schemaName: 'PerQuestionResult',
        system,
        user: buildPerQuestionPrompt(q),
        maxOutputTokens: 1500,
      });
      return { id: q.id, ...result };
    } catch (err) {
      logFail(`per-question q${q.id}`, err);
      return { id: q.id, needsNote: false, noteReason: 'extraction-failed', candidateTerms: [] };
    }
  };

  const results: PerQuestionEntry[] = [];
  if (questions.length === 0) return results;
  process.stdout.write('  warming prompt cache... ');
  results.push(await runOne(questions[0]!));
  process.stdout.write('done\n');

  let done = 1;
  const total = questions.length;
  const rest = await pMap(
    questions.slice(1),
    async (q) => {
      const r = await runOne(q);
      done += 1;
      if (done % 25 === 0 || done === total) process.stdout.write(`  per-question ${done}/${total}\n`);
      return r;
    },
    { concurrency: CONCURRENCY },
  );
  return [...results, ...rest];
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
  let done = 0;
  const total = merged.length;
  const entries = await pMap(
    merged,
    async (g) => {
      let explanationDe = '';
      try {
        const result = await call({
          schema: FinalGlossarySchema,
          schemaName: 'FinalGlossary',
          system,
          user: buildFinalGlossaryPrompt(g),
          maxOutputTokens: 800,
        });
        explanationDe = result.explanation;
      } catch (err) {
        logFail(`glossary "${g.canonical}"`, err);
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

  const toWrite = questions.filter((q) => needsNoteById.get(q.id));
  let done = 0;
  const total = toWrite.length;

  const written = await pMap(
    toWrite,
    async (q) => {
      const linked = glossaryByQuestion.get(q.id) ?? [];
      let noteDe = '';
      try {
        const result = await call({
          schema: FinalNoteSchema,
          schemaName: 'FinalNote',
          system,
          user: buildFinalNotePrompt(q, linked),
          maxOutputTokens: 600,
        });
        noteDe = result.note;
      } catch (err) {
        logFail(`note q${q.id}`, err);
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

async function translateBatch(
  items: Array<{ key: string; de: string }>,
  system: string,
): Promise<Map<string, string>> {
  const result = await call({
    schema: TranslationBatchSchema,
    schemaName: 'TranslationBatch',
    system,
    user: buildTranslationPrompt(items),
    // Each item is ~50 tokens of EN. 12 items × ~100 tokens for safety = 1200.
    maxOutputTokens: 2500,
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
  });
  return new Map(result.items.map((it) => [it.key, it.en]));
}

async function stageTranslate(
  glossary: GlossaryEntryDe[],
  notes: NoteDe[],
  system: string,
): Promise<{ glossary: SuggestionsFile['glossary']; notes: SuggestionsFile['notes'] }> {
  // Glossary long explanations
  const explanationItems = glossary.map((g) => ({ key: `g:${g.term}`, de: g.explanationDe }));
  // Glossary short labels (just from the German headword)
  const shortItems = glossary.map((g) => ({ key: `s:${g.term}`, term: g.term }));
  // Question notes (skip empties)
  const noteItems = notes
    .filter((n) => n.noteDe !== '')
    .map((n) => ({ key: `n:${n.id}`, de: n.noteDe }));

  const explanationBatches = chunk(explanationItems, TRANSLATION_BATCH);
  const shortBatches = chunk(shortItems, TRANSLATION_BATCH);
  const noteBatches = chunk(noteItems, TRANSLATION_BATCH);

  let doneE = 0;
  let doneN = 0;
  let doneS = 0;

  const safeTranslate = async (
    batch: Array<{ key: string; de: string }>,
    label: string,
  ): Promise<Map<string, string>> => {
    try {
      return await translateBatch(batch, system);
    } catch (err) {
      logFail(`${label} batch (${batch.length} items)`, err);
      return new Map();
    }
  };
  const safeShortLabels = async (
    batch: Array<{ key: string; term: string }>,
  ): Promise<Map<string, string>> => {
    try {
      return await shortLabelBatch(batch, system);
    } catch (err) {
      logFail(`short-label batch (${batch.length} items)`, err);
      return new Map();
    }
  };

  const explanationMaps = await pMap(
    explanationBatches,
    async (batch) => {
      const m = await safeTranslate(batch, 'translate glossary');
      doneE += batch.length;
      process.stdout.write(`  translate glossary ${doneE}/${explanationItems.length}\n`);
      return m;
    },
    { concurrency: CONCURRENCY },
  );
  const noteMaps = await pMap(
    noteBatches,
    async (batch) => {
      const m = await safeTranslate(batch, 'translate notes');
      doneN += batch.length;
      process.stdout.write(`  translate notes ${doneN}/${noteItems.length}\n`);
      return m;
    },
    { concurrency: CONCURRENCY },
  );
  const shortMaps = await pMap(
    shortBatches,
    async (batch) => {
      const m = await safeShortLabels(batch);
      doneS += batch.length;
      process.stdout.write(`  short labels ${doneS}/${shortItems.length}\n`);
      return m;
    },
    { concurrency: CONCURRENCY },
  );

  const explanationEn = new Map<string, string>();
  for (const m of explanationMaps) for (const [k, v] of m) explanationEn.set(k, v);
  const noteEn = new Map<string, string>();
  for (const m of noteMaps) for (const [k, v] of m) noteEn.set(k, v);
  const shortEn = new Map<string, string>();
  for (const m of shortMaps) for (const [k, v] of m) shortEn.set(k, v);

  const outGlossary: SuggestionsFile['glossary'] = glossary.map((g) => ({
    term: g.term,
    shortEn: shortEn.get(`s:${g.term}`) ?? g.term,
    explanationDe: g.explanationDe,
    explanationEn: explanationEn.get(`g:${g.term}`) ?? '',
    questionIds: g.questionIds,
  }));
  const outNotes: SuggestionsFile['notes'] = notes.map((n) => ({
    id: n.id,
    noteDe: n.noteDe,
    noteEn: n.noteDe === '' ? '' : noteEn.get(`n:${n.id}`) ?? '',
  }));

  return { glossary: outGlossary, notes: outNotes };
}

export async function runPipeline(limit: number | null): Promise<SuggestionsFile> {
  const runId = randomUUID();
  const { questions, curriculum } = await loadSources(limit);
  console.log(`[1] loaded ${questions.length} questions, ~${curriculum.length.toLocaleString()} chars curriculum`);

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
