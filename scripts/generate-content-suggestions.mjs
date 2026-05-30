import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const DEFAULT_OUTPUT = "data/generated/lid-content-suggestions.json";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_TERM_BATCH_SIZE = 20;
const HARD_REJECT_TERMS = new Set([
  "alle",
  "berlin",
  "darf",
  "falsch",
  "kann",
  "kein",
  "keine",
  "muss",
  "nicht",
  "nur",
  "richtig",
]);

const cli = parseArgs(process.argv.slice(2));
if (!process.env.OPENAI_API_KEY && process.env.OPEN_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPEN_API_KEY;
}
const sourcePath = path.join(root, "data/lid-berlin-source-of-truth.json");
const outputPath = path.join(root, cli.out || DEFAULT_OUTPUT);
const modelName = cli.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
const batchSize = Number(cli.batchSize || DEFAULT_BATCH_SIZE);
const termBatchSize = Number(cli.termBatchSize || DEFAULT_TERM_BATCH_SIZE);
const limit = cli.limit ? Number(cli.limit) : null;
const dryRun = Boolean(cli.dryRun);

const sourceData = readJson(sourcePath);
const sourceQuestions = Array.isArray(sourceData) ? sourceData : sourceData.questions;
const questions = (limit ? sourceQuestions.slice(0, limit) : sourceQuestions).map(toGenerationInput);
const questionsById = new Map(questions.map((question) => [question.id, question]));

if (!questions.length) {
  throw new Error("No source questions found.");
}

if (dryRun) {
  console.log(`Loaded ${questions.length} source questions.`);
  console.log(`Question batches: ${chunk(questions, batchSize).length}`);
  console.log(`Output path: ${path.relative(root, outputPath)}`);
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set. Export it or add it to a local .env file.");
}

console.log(`Generating content suggestions with ${modelName} for ${questions.length} questions...`);

const questionDrafts = [];
for (const [index, questionBatch] of chunk(questions, batchSize).entries()) {
  console.log(`Question batch ${index + 1}: ${questionBatch[0].id}-${questionBatch.at(-1).id}`);
  const result = await generateQuestionDrafts(questionBatch);
  questionDrafts.push(...result.questions);
}

const { glossaryInput, questionRefs } = buildGlossaryInput(questionDrafts);

const glossaryTerms = [];
for (const [index, termBatch] of chunk(glossaryInput, termBatchSize).entries()) {
  console.log(`Glossary batch ${index + 1}: ${termBatch.map((term) => term.term).join(", ")}`);
  const result = await generateGlossaryExplanations(termBatch);
  glossaryTerms.push(...result.terms);
}

const reviewedNotes = [];
for (const [index, noteBatch] of chunk(questionDrafts, batchSize).entries()) {
  console.log(`Study-note review batch ${index + 1}: ${noteBatch[0].questionId}-${noteBatch.at(-1).questionId}`);
  const input = noteBatch.map((draft) => {
    const source = questionsById.get(draft.questionId);
    return {
      questionId: draft.questionId,
      question: source.question,
      correctAnswer: source.correctAnswer,
      glossaryRefs: questionRefs.get(draft.questionId) || [],
      draftStudyNoteDe: draft.studyNoteDe,
    };
  });
  const result = await reviewStudyNotes(input);
  reviewedNotes.push(...result.questions);
}

const suggestions = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    questions: "data/lid-berlin-source-of-truth.json",
    basis: "official question prompt and correct answer only",
  },
  generator: {
    script: "scripts/generate-content-suggestions.mjs",
    model: modelName,
    hardRejectTerms: [...HARD_REJECT_TERMS].sort(),
  },
  glossaryTerms: glossaryTerms
    .map((term) => ({
      term: term.term,
      translationKey: `glossary.${term.term}`,
      explanationKey: `glossary.${term.term}.explanation`,
      explanationDe: term.explanationDe,
      matches: glossaryInput.find((item) => item.term === term.term)?.matches || [],
    }))
    .sort((left, right) => left.term.localeCompare(right.term, "de-DE", { sensitivity: "base" })),
  questions: reviewedNotes
    .map((question) => ({
      questionId: question.questionId,
      studyNoteKey: `questions.${question.questionId}.study.note`,
      studyNoteDe: question.studyNoteDe,
      glossaryRefs: questionRefs.get(question.questionId) || [],
    }))
    .sort((left, right) => left.questionId - right.questionId),
};

validateSuggestions(suggestions);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(suggestions, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outputPath)}`);

async function generateQuestionDrafts(questionBatch) {
  const schema = z.object({
    questions: z.array(
      z.object({
        questionId: z.number().int(),
        glossaryCandidates: z.array(
          z.object({
            term: z.string().min(1).describe("Canonical German glossary term."),
            matchedText: z.string().min(1).describe("Exact German text span from the question or correct answer."),
            source: z.enum(["question", "correctAnswer"]),
            draftExplanationDe: z.string().min(1),
          }),
        ),
        studyNoteDe: z.string().min(1),
      }),
    ),
  });

  return generateWithSchema({
    schema,
    prompt: [
      "You create learner-support content for a Leben in Deutschland / Berlin trainer.",
      "The input contains only the official question and its correct answer.",
      "Choose meaningful glossary terms: civic, legal, historical, political, or government-related German terms.",
      "Good glossary terms are words like Grundgesetz, Verfassung, Einheit, DDR, Rechtsstaat, Bundesrat, and Meinungsfreiheit.",
      "Weak glossary terms are generic words, function words, simple modals, negations, correctness words, or the app's location context by itself.",
      "Glossary terms may be canonicalized, but matchedText must appear in the German question text or the German correct answer.",
      "Write learner-facing prose in German. Do not write memory tricks, UI language, or phrases like 'is tested'.",
      "Study notes: 1-2 short German sentences. Draft glossary explanations: 2-3 short German sentences.",
      "",
      "Examples:",
      JSON.stringify(
        [
          {
            question: "Deutschland ist ein Rechtsstaat. Was ist damit gemeint?",
            correctAnswer: "Alle Einwohnerinnen/Einwohner und der Staat muessen sich an die Gesetze halten.",
            goodGlossaryCandidates: [
              {
                term: "Rechtsstaat",
                matchedText: "Rechtsstaat",
                source: "question",
                draftExplanationDe:
                  "Ein Rechtsstaat ist ein Staat, in dem staatliches Handeln an Gesetze gebunden ist. Auch der Staat selbst muss sich an Recht und Gesetz halten.",
              },
              {
                term: "Gesetz",
                matchedText: "Gesetze",
                source: "correctAnswer",
                draftExplanationDe:
                  "Ein Gesetz ist eine verbindliche Regel des Staates. In einem Rechtsstaat gelten Gesetze fuer die Menschen und fuer staatliche Stellen.",
              },
            ],
            badGlossaryCandidates: ["Alle", "muessen"],
            studyNoteDe:
              "Beim Rechtsstaat geht es darum, dass nicht nur die Menschen, sondern auch der Staat an Gesetze gebunden ist.",
          },
          {
            question: "Was ist die Hauptstadt der Bundesrepublik Deutschland?",
            correctAnswer: "Berlin",
            goodGlossaryCandidates: [],
            badGlossaryCandidates: ["Berlin"],
            studyNoteDe:
              "Berlin ist die Hauptstadt Deutschlands. In dieser Frage steht nur die richtige Zuordnung im Mittelpunkt, ohne dass ein eigener Glossarbegriff noetig ist.",
          },
          {
            question: "Berlin ist ein Bundesland. Was ist Berlin zugleich?",
            correctAnswer: "ein Stadtstaat",
            goodGlossaryCandidates: [
              {
                term: "Bundesland",
                matchedText: "Bundesland",
                source: "question",
                draftExplanationDe:
                  "Ein Bundesland ist ein Teilstaat der Bundesrepublik Deutschland. Die Bundeslaender haben eigene politische Zuständigkeiten.",
              },
              {
                term: "Stadtstaat",
                matchedText: "Stadtstaat",
                source: "correctAnswer",
                draftExplanationDe:
                  "Ein Stadtstaat ist zugleich Stadt und Bundesland. Berlin, Hamburg und Bremen sind deutsche Stadtstaaten.",
              },
            ],
            badGlossaryCandidates: ["Berlin", "zugleich"],
            studyNoteDe:
              "Berlin ist nicht nur eine Stadt, sondern auch ein eigenes Bundesland. Deshalb wird Berlin als Stadtstaat bezeichnet.",
          },
          {
            question: "Was bedeutet die Abkuerzung DDR?",
            correctAnswer: "Deutsche Demokratische Republik",
            goodGlossaryCandidates: [
              {
                term: "DDR",
                matchedText: "DDR",
                source: "question",
                draftExplanationDe:
                  "Die DDR war der ostdeutsche Staat von 1949 bis 1990. Sie war keine freiheitliche Demokratie wie die Bundesrepublik.",
              },
            ],
            badGlossaryCandidates: ["bedeutet", "Abkuerzung"],
            studyNoteDe:
              "DDR steht fuer Deutsche Demokratische Republik. Gemeint ist der ostdeutsche Staat, der bis zur Wiedervereinigung 1990 bestand.",
          },
        ],
        null,
        2,
      ),
      "",
      "Questions:",
      JSON.stringify(questionBatch, null, 2),
    ].join("\n"),
  });
}

async function generateGlossaryExplanations(termBatch) {
  const schema = z.object({
    terms: z.array(
      z.object({
        term: z.string().min(1),
        explanationDe: z.string().min(1),
      }),
    ),
  });

  return generateWithSchema({
    schema,
    prompt: [
      "You revise glossary explanations for a Leben in Deutschland / Berlin trainer.",
      "Write exactly one German explanation for each canonical term.",
      "Use all question contexts and draft explanations for that term.",
      "Stable historical, legal, or civic background facts are allowed.",
      "Current officeholders, coalitions, election results, or time-sensitive facts are not allowed.",
      "The explanation should be 2-3 short German sentences and should not merely repeat the translation.",
      "Do not write UI language or phrases like 'appears in questions' or 'is tested'.",
      "",
      "Terms:",
      JSON.stringify(termBatch, null, 2),
    ].join("\n"),
  });
}

async function reviewStudyNotes(noteBatch) {
  const schema = z.object({
    questions: z.array(
      z.object({
        questionId: z.number().int(),
        studyNoteDe: z.string().min(1),
      }),
    ),
  });

  return generateWithSchema({
    schema,
    prompt: [
      "You revise German study notes for a Leben in Deutschland / Berlin trainer.",
      "Each study note explains the exact context of the question and correct answer.",
      "Stable historical, legal, or civic background facts are allowed.",
      "Current officeholders, coalitions, election results, or time-sensitive facts are not allowed.",
      "Do not write memory tricks, UI language, or phrases like 'watch for' or 'is tested'.",
      "The note should be 1-2 short German sentences and does not need to mention every glossary term.",
      "",
      "Study Notes:",
      JSON.stringify(noteBatch, null, 2),
    ].join("\n"),
  });
}

async function generateWithSchema({ schema, prompt }) {
  const result = await generateObject({
    model: openai(modelName),
    schema,
    temperature: 0.2,
    prompt,
  });

  return result.object;
}

function buildGlossaryInput(drafts) {
  const byTerm = new Map();
  const questionRefs = new Map();

  for (const draft of drafts) {
    const source = questionsById.get(draft.questionId);
    if (!source) throw new Error(`Draft references unknown question ${draft.questionId}`);
    const refs = [];

    for (const candidate of draft.glossaryCandidates || []) {
      const term = candidate.term.trim();
      const matchedText = candidate.matchedText.trim();
      const sourceText = candidate.source === "question" ? source.question : source.correctAnswer;

      if (!term || HARD_REJECT_TERMS.has(normalizeTerm(term))) continue;
      if (!containsText(sourceText, matchedText)) {
        throw new Error(`Q${draft.questionId}: matchedText "${matchedText}" is not in ${candidate.source}.`);
      }

      refs.push(term);
      if (!byTerm.has(term)) {
        byTerm.set(term, {
          term,
          contexts: [],
          draftExplanationsDe: [],
          matches: [],
        });
      }

      const entry = byTerm.get(term);
      entry.contexts.push({
        questionId: draft.questionId,
        question: source.question,
        correctAnswer: source.correctAnswer,
      });
      entry.draftExplanationsDe.push(candidate.draftExplanationDe);
      entry.matches.push({
        questionId: draft.questionId,
        source: candidate.source,
        matchedText,
      });
    }

    questionRefs.set(draft.questionId, [...new Set(refs)]);
  }

  return {
    glossaryInput: [...byTerm.values()].map((entry) => ({
      ...entry,
      contexts: uniqueBy(entry.contexts, (item) => `${item.questionId}`),
      draftExplanationsDe: [...new Set(entry.draftExplanationsDe)],
      matches: uniqueBy(entry.matches, (item) => `${item.questionId}:${item.source}:${item.matchedText}`),
    })),
    questionRefs,
  };
}

function validateSuggestions(suggestions) {
  const problems = [];
  const glossaryTerms = new Set(suggestions.glossaryTerms.map((term) => term.term));
  const suggestedQuestionIds = new Set(suggestions.questions.map((question) => question.questionId));

  for (const question of questions) {
    if (!suggestedQuestionIds.has(question.id)) problems.push(`Q${question.id} is missing a study note suggestion`);
  }

  for (const term of suggestions.glossaryTerms) {
    if (HARD_REJECT_TERMS.has(normalizeTerm(term.term))) problems.push(`${term.term} is hard-rejected`);
    if (!term.explanationDe.trim()) problems.push(`${term.term} has no explanationDe`);

    for (const match of term.matches || []) {
      const source = questionsById.get(match.questionId);
      if (!source) {
        problems.push(`${term.term} references missing Q${match.questionId}`);
        continue;
      }
      const sourceText = match.source === "question" ? source.question : source.correctAnswer;
      if (!containsText(sourceText, match.matchedText)) {
        problems.push(`${term.term} match "${match.matchedText}" is not in Q${match.questionId} ${match.source}`);
      }
    }
  }

  for (const question of suggestions.questions) {
    if (!questionsById.has(question.questionId)) problems.push(`Unknown question ${question.questionId}`);
    if (!question.studyNoteDe.trim()) problems.push(`Q${question.questionId} has no studyNoteDe`);
    for (const ref of question.glossaryRefs || []) {
      if (!glossaryTerms.has(ref)) problems.push(`Q${question.questionId} references missing glossary term ${ref}`);
    }
  }

  if (problems.length) {
    throw new Error(`Generated suggestion validation failed:\n- ${problems.join("\n- ")}`);
  }
}

function toGenerationInput(question) {
  const correctAnswer = question.answers.find((answer) => answer.index === question.correctAnswerIndex);
  if (!correctAnswer) throw new Error(`Q${question.id} has no correct answer`);
  return {
    id: question.id,
    question: question.question,
    correctAnswer: correctAnswer.text,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function containsText(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function normalizeText(value) {
  return String(value)
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");
}

function normalizeTerm(value) {
  return normalizeText(value).replace(/[.!?,;:()[\]"]/g, "");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}
