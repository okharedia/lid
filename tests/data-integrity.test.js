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
const sourceQuestions = Array.isArray(data) ? data : data.questions;
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

  for (const question of sourceQuestions) {
    for (const field of forbiddenQuestionFields) {
      if (field in question) problems.push(`Q${question.id} source question still has ${field}`);
    }
    if (!Number.isInteger(question.correctAnswerIndex)) problems.push(`Q${question.id} missing correctAnswerIndex`);
    for (const answer of question.answers) {
      for (const field of forbiddenAnswerFields) {
        if (field in answer) problems.push(`Q${question.id} answer[${answer.index}] source answer still has ${field}`);
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
    if (!question.study?.noteKey || !question.study?.note) problems.push(`Q${question.id} missing German study note metadata`);
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
    if (/\b(cards?|linked|questions?|exam|tested|practice items?)\b|used to test|appears in .* questions|quick anchor/i.test(term.context)) {
      problems.push(`${term.term} has placeholder learner context: ${term.context}`);
    }
    if (new RegExp(`^${term.term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s+means\\b`, "i").test(term.context)) {
      problems.push(`${term.term} repeats its translation in learner context: ${term.context}`);
    }
    for (const match of term.matches || []) {
      if (!sourceQuestions.some((question) => question.id === match.id)) {
        problems.push(`${term.term} links to missing question ${match.id}`);
      }
    }
  }

  assert.deepEqual(problems, [], `glossary data problems:\n  ${problems.join("\n  ")}`);
});
