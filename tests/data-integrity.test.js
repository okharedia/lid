// Catches the class of bug where a per-distractor explanation says
// "Correct" on a non-correctIndex answer (or "Wrong" on the correct one).
// Trusting a labelled explanation is worse than no explanation at all —
// it trains false confidence.
//
// Run with: node --test tests/data-integrity.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data/lid-berlin-source-of-truth.json"), "utf8"),
);
const i18n = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data/i18n/en.json"), "utf8"),
);
const messages = i18n.messages;

test("every whyKey labelled 'Correct'/'Wrong' matches its answer position", () => {
  const mismatches = [];
  for (const question of data.questions) {
    question.answers.forEach((answer, index) => {
      if (!answer.whyKey) return;
      const why = (messages[answer.whyKey] || "").trim();
      const startsCorrect = /^Correct\b/i.test(why);
      const startsWrong = /^Wrong\b/i.test(why);
      const isCorrect = index === question.correctIndex;
      if (isCorrect && startsWrong) {
        mismatches.push(`Q${question.id} answer[${index}] is the correct answer but its 'why' starts with "Wrong"`);
      }
      if (!isCorrect && startsCorrect) {
        mismatches.push(`Q${question.id} answer[${index}] is a distractor but its 'why' starts with "Correct"`);
      }
    });
  }
  assert.deepEqual(mismatches, [], `whyKey/correctIndex mismatches:\n  ${mismatches.join("\n  ")}`);
});

test("every whyKey referenced from data resolves to a non-empty i18n string", () => {
  const missing = [];
  for (const question of data.questions) {
    question.answers.forEach((answer, index) => {
      if (!answer.whyKey) return;
      const value = messages[answer.whyKey];
      if (!value || !value.trim()) {
        missing.push(`Q${question.id} answer[${index}] whyKey=${answer.whyKey} has no i18n value`);
      }
    });
  }
  assert.deepEqual(missing, [], `missing whyKey translations:\n  ${missing.join("\n  ")}`);
});

test("every clusterTag on a question points to a defined cluster", () => {
  const clusterIds = new Set((data.clusters || []).map((c) => c.id));
  const unknown = [];
  for (const question of data.questions) {
    if (question.clusterTag && !clusterIds.has(question.clusterTag)) {
      unknown.push(`Q${question.id} has clusterTag="${question.clusterTag}" but no such cluster is defined`);
    }
  }
  assert.deepEqual(unknown, [], `unknown clusterTags:\n  ${unknown.join("\n  ")}`);
});

test("every duplicateOfId points to a real question", () => {
  const ids = new Set(data.questions.map((q) => q.id));
  const broken = [];
  for (const question of data.questions) {
    if (question.duplicateOfId && !ids.has(question.duplicateOfId)) {
      broken.push(`Q${question.id} duplicateOfId=${question.duplicateOfId} does not exist`);
    }
  }
  assert.deepEqual(broken, [], `broken duplicateOfId links:\n  ${broken.join("\n  ")}`);
});
