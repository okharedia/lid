// Run with: node --test tests/data-integrity.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data/lid-berlin-source-of-truth.json"), "utf8"),
);
const metadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data/lid-berlin-question-metadata.json"), "utf8"),
);
const glossary = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data/glossary.json"), "utf8"),
);
const i18n = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data/i18n/en.json"), "utf8"),
);
const messages = i18n.messages;
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const glossaryDesignHtml = fs.readFileSync(path.join(__dirname, "..", "design/Glossary.html"), "utf8");
const metadataById = new Map(metadata.questions.map((question) => [question.id, question]));
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

const sourceQuestionEntries = Array.isArray(data)
  ? data.map((question) => [String(question.id), question])
  : Object.entries(data.questions || data);
const sourceQuestions = normalizeSourceQuestions(data);
const questions = sourceQuestions.map((question) => {
  const meta = metadataById.get(question.id) || {};
  const answerMetaByIndex = new Map((meta.answers || []).map((answer) => [answer.index, answer]));
  return {
    ...question,
    ...meta,
    answers: question.answers.map((answer) => ({ ...answer, ...(answerMetaByIndex.get(answer.index) || {}) })),
  };
});

test("source-of-truth stays slim and avoids derived learner fields", () => {
  const forbiddenQuestionFields = [
    "localNumber",
    "correctAnswer",
    "questionDangerWords",
    "study",
    "translationKey",
    "deck",
    "theme",
    "cluster",
    "clusters",
    "clusterTag",
    "duplicateOfId",
    "answerVariants",
  ];
  const forbiddenAnswerFields = ["isCorrect", "dangerWords", "translationKey", "whyKey"];
  const problems = [];

  for (const [id, question] of sourceQuestionEntries) {
    if (!/^[1-9]\d*$/.test(id)) problems.push(`source key ${id} should be a question id`);
    for (const field of forbiddenQuestionFields) {
      if (field in question) problems.push(`Q${id} source question still has ${field}`);
    }
    if ("id" in question) problems.push(`Q${id} source question still has id`);
    if (!Number.isInteger(question.correctAnswerIndex)) problems.push(`Q${id} missing correctAnswerIndex`);
    if (!Array.isArray(question.answers)) problems.push(`Q${id} missing answers array`);
    if (question.answers?.length !== 4) problems.push(`Q${id} should have four answers`);
    if (question.answers && !question.answers[question.correctAnswerIndex]) {
      problems.push(`Q${id} correctAnswerIndex does not point to an answer`);
    }
    for (const [index, answer] of (question.answers || []).entries()) {
      if (typeof answer !== "string") problems.push(`Q${id} answer[${index}] should be a string`);
      for (const field of forbiddenAnswerFields) {
        if (answer && typeof answer === "object" && field in answer) {
          problems.push(`Q${id} answer[${index}] source answer still has ${field}`);
        }
      }
    }
  }

  assert.deepEqual(problems, [], `source-of-truth shape problems:\n  ${problems.join("\n  ")}`);
});

test("learner metadata uses glossary refs and notes instead of hint-memory keyword concepts", () => {
  const problems = [];
  const glossaryTerms = new Set((metadata.glossary || []).map((entry) => entry.term));
  for (const key of Object.keys(messages)) {
    if (/^questions\.\d+\.study\.(hint|memory)$/.test(key)) problems.push(`old study key remains: ${key}`);
  }
  for (const question of metadata.questions) {
    // Every question carries a study note entry with a translation key. The
    // German note itself may be an empty string for pure-recall questions
    // (capital city, bare date, abbreviation expansion) — those intentionally
    // have no learner note.
    if (!question.study?.noteKey || typeof question.study?.note !== "string") {
      problems.push(`Q${question.id} missing German study note metadata`);
    }
    if ("keywordRefs" in question || "highlightTerms" in question || "dangerTerms" in question) {
      problems.push(`Q${question.id} still uses old keyword/highlight/danger metadata`);
    }
    for (const term of question.glossaryRefs || []) {
      if (typeof term !== "string") problems.push(`Q${question.id} glossary ref should be a string`);
      else if (!glossaryTerms.has(term)) problems.push(`Q${question.id} glossary ref ${term} is missing from glossary registry`);
    }
  }
  assert.deepEqual(problems, [], `learner metadata problems:\n  ${problems.join("\n  ")}`);
});

test("cluster grouping is not part of the content model", () => {
  const problems = [];
  if ("clusters" in data) problems.push("source-of-truth still defines clusters");
  if ("clusters" in metadata) problems.push("metadata still defines clusters");
  for (const question of sourceQuestions) {
    if ("cluster" in question || "clusterTag" in question) problems.push(`Q${question.id} source still has cluster data`);
  }
  for (const question of metadata.questions) {
    if ("cluster" in question || "clusterTag" in question) problems.push(`Q${question.id} metadata still has cluster data`);
  }
  assert.deepEqual(problems, [], `cluster concept remains:\n  ${problems.join("\n  ")}`);
});

test("answer-level why explanations are not part of the learner model", () => {
  const problems = [];
  for (const question of metadata.questions) {
    for (const answer of question.answers || []) {
      if ("whyKey" in answer) problems.push(`Q${question.id} answer[${answer.index}] still has whyKey`);
    }
  }
  for (const key of Object.keys(messages)) {
    if (/^questions\.\d+\.answers\.\d+\.why$/.test(key)) problems.push(`old answer why translation remains: ${key}`);
  }
  assert.deepEqual(problems, [], `answer why concept remains:\n  ${problems.join("\n  ")}`);
});

test("duplicate and answer-variant concepts are not part of the content model", () => {
  const problems = [];
  for (const question of metadata.questions) {
    if ("duplicateOfId" in question) problems.push(`Q${question.id} metadata still has duplicateOfId`);
    if ("answerVariants" in question) problems.push(`Q${question.id} metadata still has answerVariants`);
  }
  for (const key of Object.keys(messages)) {
    if (/^ui\.(answerVariantNote|chip\.(sameAsEarlier|seenBefore))$/.test(key)) {
      problems.push(`old duplicate/variant i18n remains: ${key}`);
    }
  }
  assert.deepEqual(problems, [], `duplicate/variant concept remains:\n  ${problems.join("\n  ")}`);
});

test("every static HTML i18n key resolves to a non-empty string", () => {
  const missing = [];
  const pattern = /\b(data-i18n(?:-aria-label|-alt|-title|-placeholder)?)="([^"]+)"/g;
  for (const match of indexHtml.matchAll(pattern)) {
    const [, attr, key] = match;
    if (!(messages[key] || "").trim()) missing.push(`${attr}=${key}`);
  }
  assert.deepEqual(missing, [], `missing static i18n keys:\n  ${missing.join("\n  ")}`);
});

test("all inline SVG icon symbols and references use Tabler icons", () => {
  const problems = [];
  for (const [file, html] of [
    ["index.html", indexHtml],
    ["design/Glossary.html", glossaryDesignHtml],
  ]) {
    for (const match of html.matchAll(/<symbol\s+id="([^"]+)"/g)) {
      if (!match[1].startsWith("tabler-")) problems.push(`${file} defines non-Tabler symbol ${match[1]}`);
    }
    for (const match of html.matchAll(/<use\s+href="([^"]+)"/g)) {
      if (!match[1].startsWith("#tabler-")) problems.push(`${file} references non-Tabler icon ${match[1]}`);
    }
  }
  assert.deepEqual(problems, [], `non-Tabler icon usage:\n  ${problems.join("\n  ")}`);
});

test("every rendered category has an i18n key", () => {
  const categoryKeys = {
    "Alle Kategorien": "category.all",
    "Basic Law and rights": "category.basicLawAndRights",
    "Religion and society": "category.religionAndSociety",
    "Law, courts, police": "category.lawCourtsPolice",
    Elections: "category.elections",
    "German institutions": "category.germanInstitutions",
    "General LiD recognition": "category.generalLidRecognition",
    "Work and civic life": "category.workAndCivicLife",
    "Family and equality": "category.familyAndEquality",
    "Berlin state question": "category.berlinStateQuestion",
    "Nazi period and responsibility": "category.naziPeriodAndResponsibility",
    "German division and reunification": "category.germanDivisionAndReunification",
  };
  const missing = [];
  for (const category of new Set(["Alle Kategorien", ...metadata.questions.map((question) => question.theme)])) {
    const key = categoryKeys[category];
    if (!key) missing.push(`${category} has no key mapping`);
    else if (!(messages[key] || "").trim()) missing.push(`${category} maps to missing key ${key}`);
  }
  assert.deepEqual(missing, [], `missing category i18n keys:\n  ${missing.join("\n  ")}`);
});

test("generated glossary is sourced from real question glossary refs", () => {
  const glossaryTerms = new Set(
    metadata.questions.flatMap((question) => question.glossaryRefs || []),
  );
  const excludedTerms = new Set(glossary.source?.excludedTerms || []);
  const problems = [];

  for (const term of glossary.terms) {
    if (excludedTerms.has(term.term)) problems.push(`${term.term} should have been excluded from the learner glossary`);
    if (!glossaryTerms.has(term.term)) problems.push(`${term.term} is not referenced by question glossary refs`);
    if (!glossary.ranges.includes(term.range)) problems.push(`${term.term} has invalid range ${term.range}`);
    if (!term.translation || !term.context || !term.matches?.length) {
      problems.push(`${term.term} is missing translation, context, or matches`);
    }
    // Reject exam/UI/test meta-language and the old auto-generated placeholder
    // templates. Targets meta *phrases* — not innocent civic prose that happens
    // to use words like "linked" ("the right is linked to age 18") or "question"
    // ("a legal question arises").
    if (/\bflash ?cards?\b|\bpractice items?\b|appears in .{0,40}questions?|used to test|\b(is|are|being) tested\b|quick anchor|in this question\b|on the (test|exam)\b|this exam\b|memoriz/i.test(term.context)) {
      problems.push(`${term.term} has placeholder learner context: ${term.context}`);
    }
    if (new RegExp(`^${term.term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s+means\\b`, "i").test(term.context)) {
      problems.push(`${term.term} repeats its translation in learner context: ${term.context}`);
    }
    for (const match of term.matches || []) {
      const sourceQuestion = sourceQuestions.find((question) => question.id === match.id);
      if (!sourceQuestion) {
        problems.push(`${term.term} links to missing question ${match.id}`);
        continue;
      }
      const correctAnswer = sourceQuestion.answers.find((answer) => answer.index === sourceQuestion.correctAnswerIndex);
      if (match.kind === "answer" && match.text !== correctAnswer?.text) {
        problems.push(`${term.term} links to non-correct answer for question ${match.id}`);
      }
      if (match.kind !== "question" && match.kind !== "answer") {
        problems.push(`${term.term} has invalid match kind ${match.kind}`);
      }
    }
  }

  assert.deepEqual(problems, [], `glossary data problems:\n  ${problems.join("\n  ")}`);
});
