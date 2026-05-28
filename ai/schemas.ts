import { z } from 'zod';

// Defensive preprocessor: Anthropic occasionally returns a nested array as a
// JSON-encoded *string* rather than a real array, even in tool-use mode.
function arrayOrJsonString<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((v) => {
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* fall through */
      }
    }
    return v;
  }, z.array(item));
}

export const CandidateTermSchema = z.object({
  surface: z
    .string()
    .describe('Term exactly as it appears in the question or correct answer (preserve inflection).'),
  canonical: z
    .string()
    .describe('Canonical headword (singular, base form) for the glossary entry.'),
  draftExplanation: z
    .string()
    .describe('Short German explanation drafted in the context of this question and correct answer.'),
});
export type CandidateTerm = z.infer<typeof CandidateTermSchema>;

export const PerQuestionResultSchema = z.object({
  needsNote: z
    .boolean()
    .describe(
      'True if a study note adds civic/legal/historical/political learning value. False for pure-recall questions (capital city, bare date, abbreviation expansion, one-to-one fact).',
    ),
  noteReason: z
    .string()
    .describe('One short sentence justifying the needsNote decision. For logging only.'),
  candidateTerms: arrayOrJsonString(CandidateTermSchema).describe(
    'Meaningful glossary candidates from this question. Empty if nothing useful remains after filtering. MUST be an actual JSON array, not a stringified array.',
  ),
});
export type PerQuestionResult = z.infer<typeof PerQuestionResultSchema>;

// Deterministic merge (groupBy canonical) — no LLM call needed at scale.
export interface MergedTermGroup {
  canonical: string;
  surfaces: string[];
  questionIds: string[];
  draftExplanations: string[];
}

export const FinalGlossarySchema = z.object({
  explanation: z
    .string()
    .describe('Two or three short German sentences. Reusable across all linked questions. No exam meta language.'),
});
export type FinalGlossary = z.infer<typeof FinalGlossarySchema>;

export const FinalNoteSchema = z.object({
  note: z
    .string()
    .describe('One or two short German sentences explaining the civic context of this question. No memory tricks, no exam meta language, no "Die Frage zeigt …" or "In dieser Frage geht es …".'),
});
export type FinalNote = z.infer<typeof FinalNoteSchema>;

// Translation batching: one call translates up to N items. Items are addressed
// by stable `key` strings so we can re-attach translations to source entries.
export const TranslationItemSchema = z.object({
  key: z.string().describe('Stable key passed by the caller; must be returned unchanged.'),
  en: z.string().describe('English translation. Plain learner prose, no meta language.'),
});
export const TranslationBatchSchema = z.object({
  items: arrayOrJsonString(TranslationItemSchema),
});
export type TranslationBatch = z.infer<typeof TranslationBatchSchema>;

// Short English label for a glossary term (e.g. "asylum" for "Asyl").
export const ShortLabelItemSchema = z.object({
  key: z.string(),
  en: z.string().describe('Short English label, 1–4 words, lowercase unless a proper noun. No definitions, no sentences.'),
});
export const ShortLabelBatchSchema = z.object({
  items: arrayOrJsonString(ShortLabelItemSchema),
});
export type ShortLabelBatch = z.infer<typeof ShortLabelBatchSchema>;

// Final on-disk artifact shape.
export const SuggestionsFileSchema = z.object({
  generatedAt: z.string(),
  runId: z.string(),
  model: z.string(),
  questions: z.number(),
  glossary: z.array(
    z.object({
      term: z.string(),
      shortEn: z.string(),
      explanationDe: z.string(),
      explanationEn: z.string(),
      questionIds: z.array(z.string()),
    }),
  ),
  notes: z.array(
    z.object({
      id: z.string(),
      noteDe: z.string(),
      noteEn: z.string(),
    }),
  ),
});
export type SuggestionsFile = z.infer<typeof SuggestionsFileSchema>;

// Minimal question shape consumed by the pipeline.
export interface MinimalQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  theme?: string;
}
