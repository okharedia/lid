const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/lid-berlin-source-of-truth.json"), "utf8"));
function normalizeSourceQuestions(database) {
  const entries = Array.isArray(database)
    ? database.map((question) => [question.id, question])
    : Object.entries(database?.questions || database || {});

  return entries
    .map(([id, question]) => {
      const questionId = Number(question?.id ?? id);
      return {
        ...question,
        id: questionId,
        answers: (question.answers || []).map((answer, index) => (
          typeof answer === "string" ? { index, text: answer } : { index: answer.index ?? index, ...answer }
        )),
      };
    })
    .filter((question) => Number.isInteger(question.id))
    .sort((left, right) => left.id - right.id);
}

const sourceQuestions = normalizeSourceQuestions(data);
const metadata = JSON.parse(fs.readFileSync(path.join(root, "data/lid-berlin-question-metadata.json"), "utf8"));
const i18n = JSON.parse(fs.readFileSync(path.join(root, "data/i18n/en.json"), "utf8"));
const messages = i18n.messages || {};
const RANGES = ["A-D", "E-H", "I-S", "T-Z"];

function normalize(value = "") {
  return String(value)
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss");
}

function rangeFor(term) {
  const firstLetter = normalize(term).match(/[a-z]/)?.[0] || "t";
  if ("abcd".includes(firstLetter)) return "A-D";
  if ("efgh".includes(firstLetter)) return "E-H";
  if ("ijklmnopqrs".includes(firstLetter)) return "I-S";
  return "T-Z";
}

function includesTerm(text, term) {
  return normalize(text).includes(normalize(term));
}

const metadataById = new Map((metadata.questions || []).map((question) => [question.id, question]));
const glossaryEntries = metadata.glossary || [];
const glossaryKeyByTerm = new Map(glossaryEntries.map((entry) => [entry.term, entry.translationKey]));
const explanationKeyByTerm = new Map(glossaryEntries.map((entry) => [entry.term, entry.explanationKey]));

const questions = sourceQuestions.map((question) => {
  const meta = metadataById.get(question.id) || {};
  const answerMetaByIndex = new Map((meta.answers || []).map((answer) => [answer.index, answer]));
  return {
    ...question,
    deck: meta.deck || (question.id > 300 ? "berlin" : "general"),
    theme: meta.theme || "",
    translationKey: meta.translationKey || `questions.${question.id}.question`,
    glossaryRefs: (meta.glossaryRefs || []).map((term) => ({
      term,
      translationKey: glossaryKeyByTerm.get(term) || `glossary.${term}`,
    })),
    answers: question.answers.map((answer) => {
      const answerMeta = answerMetaByIndex.get(answer.index) || {};
      return {
        ...answer,
        isCorrect: answer.index === question.correctAnswerIndex,
        translationKey: answerMeta.translationKey || `questions.${question.id}.answers.${answer.index}`,
      };
    }),
  };
});

// Invert glossaryRefs: term -> [questionIds]
const questionsByTerm = new Map();
for (const question of questions) {
  for (const ref of question.glossaryRefs || []) {
    if (!questionsByTerm.has(ref.term)) questionsByTerm.set(ref.term, []);
    questionsByTerm.get(ref.term).push(question);
  }
}

const terms = glossaryEntries
  .filter((entry) => questionsByTerm.has(entry.term))
  .map((entry) => {
    const term = entry.term;
    const translationKey = entry.translationKey;
    const explanationKey = entry.explanationKey || `glossary.${term}.context`;
    const translation = messages[translationKey] || term;
    const context = messages[explanationKey] || "";
    const linkedQuestions = questionsByTerm.get(term) || [];

    // Best-effort textual matches for in-card highlighting. If the canonical
    // term does not appear literally in question or answer text (the AI
    // sometimes generalises surface forms), we still surface the linked
    // question without a highlightable text match.
    const matches = linkedQuestions.flatMap((question) => {
      const items = [];
      const answer = question.answers[question.correctAnswerIndex];
      const answerText = answer?.text || "";
      const inQuestion = includesTerm(question.question, term);
      const inAnswer = answer && includesTerm(answerText, term);

      if (inQuestion) {
        items.push({
          id: question.id,
          kind: "question",
          text: question.question,
          translation: messages[question.translationKey] || "",
        });
      }
      if (inAnswer) {
        items.push({
          id: question.id,
          kind: "answer",
          text: answer.text,
          translation: messages[answer.translationKey] || "",
          isCorrect: true,
        });
      }
      if (!inQuestion && !inAnswer) {
        // Linked by AI but no literal substring — still expose the question
        // so the glossary card shows the connection. Uses "question" kind
        // (the only non-"answer" kind the data-integrity test accepts).
        items.push({
          id: question.id,
          kind: "question",
          text: question.question,
          translation: messages[question.translationKey] || "",
        });
      }
      return items;
    });

    return {
      term,
      translation,
      context,
      range: rangeFor(term),
      matches,
    };
  })
  .filter((entry) => entry.matches.length)
  .sort((left, right) => left.term.localeCompare(right.term, "de-DE", { sensitivity: "base" }));

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    questions: "data/lid-berlin-source-of-truth.json",
    metadata: "data/lid-berlin-question-metadata.json",
    translations: "data/i18n/en.json",
    basis: "metadata.glossary cross-referenced with metadata.questions[].glossaryRefs; explanations from i18n messages[<term>.context]",
  },
  ranges: RANGES,
  terms,
};

fs.writeFileSync(path.join(root, "data/glossary.json"), `${JSON.stringify(output, null, 2)}\n`);
