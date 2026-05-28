import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SuggestionsFileSchema, type SuggestionsFile } from './schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SUGGESTIONS = resolve(__dirname, 'out/suggestions.json');
const METADATA_JSON = resolve(REPO_ROOT, 'data/lid-berlin-question-metadata.json');
const I18N_EN_JSON = resolve(REPO_ROOT, 'data/i18n/en.json');

interface MetadataGlossaryEntry {
  term: string;
  translationKey: string;
  explanationKey: string;
}

interface MetadataQuestion {
  id: number;
  deck?: string;
  theme?: string;
  translationKey?: string;
  study?: { note?: string; noteKey?: string };
  glossaryRefs?: string[];
  answers?: Array<{ index: number; translationKey?: string }>;
}

interface MetadataFile {
  glossary: MetadataGlossaryEntry[];
  questions: MetadataQuestion[];
}

interface I18nFile {
  schemaVersion?: number;
  locale: string;
  generatedAt?: string;
  source?: string;
  messages: Record<string, string>;
}

function termToTranslationKey(term: string): string {
  return `glossary.${term}`;
}

function termToExplanationKey(term: string): string {
  return `glossary.${term}.context`;
}

function noteKeyFor(id: string | number): string {
  return `questions.${id}.study.note`;
}

async function main() {
  const suggestionsRaw = JSON.parse(await readFile(SUGGESTIONS, 'utf8'));
  const suggestions: SuggestionsFile = SuggestionsFileSchema.parse(suggestionsRaw);
  const metadata: MetadataFile = JSON.parse(await readFile(METADATA_JSON, 'utf8'));
  const i18n: I18nFile = JSON.parse(await readFile(I18N_EN_JSON, 'utf8'));

  // --- glossary metadata (replace) ---
  const newGlossary: MetadataGlossaryEntry[] = suggestions.glossary
    .map((g) => ({
      term: g.term,
      translationKey: termToTranslationKey(g.term),
      explanationKey: termToExplanationKey(g.term),
    }))
    .sort((a, b) => a.term.localeCompare(b.term, 'de-DE'));

  // --- glossaryRefs per question (invert from glossary[].questionIds) ---
  const refsByQuestion = new Map<string, string[]>();
  for (const entry of suggestions.glossary) {
    for (const qid of entry.questionIds) {
      const list = refsByQuestion.get(qid) ?? [];
      if (!list.includes(entry.term)) list.push(entry.term);
      refsByQuestion.set(qid, list);
    }
  }

  // --- per-question notes (German) ---
  const noteDeById = new Map(suggestions.notes.map((n) => [n.id, n.noteDe]));

  for (const q of metadata.questions) {
    const id = String(q.id);
    q.glossaryRefs = (refsByQuestion.get(id) ?? []).slice().sort((a, b) =>
      a.localeCompare(b, 'de-DE'),
    );
    const noteDe = noteDeById.get(id) ?? '';
    q.study = { note: noteDe, noteKey: noteKeyFor(id) };
  }

  metadata.glossary = newGlossary;

  // --- en.json messages (merge, don't drop existing) ---
  const messages = i18n.messages;

  // Fall back to the German source / headword if a translation came back
  // empty (a failed translation batch), so downstream never has empty strings.
  for (const g of suggestions.glossary) {
    messages[termToTranslationKey(g.term)] = g.shortEn || g.term;
    messages[termToExplanationKey(g.term)] = g.explanationEn || g.explanationDe;
  }
  for (const n of suggestions.notes) {
    messages[noteKeyFor(n.id)] = n.noteEn || n.noteDe;
  }

  i18n.generatedAt = new Date().toISOString().slice(0, 10);

  await writeFile(METADATA_JSON, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  await writeFile(I18N_EN_JSON, JSON.stringify(i18n, null, 2) + '\n', 'utf8');

  const writtenNotes = suggestions.notes.filter((n) => n.noteDe !== '').length;
  console.log(`applied:`);
  console.log(`  glossary entries: ${newGlossary.length}`);
  console.log(`  questions touched: ${metadata.questions.length}`);
  console.log(`  notes written: ${writtenNotes} (empty: ${suggestions.notes.length - writtenNotes})`);
  console.log(`  en.json messages now: ${Object.keys(messages).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
