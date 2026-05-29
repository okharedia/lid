// Build the data artifacts that get uploaded to Vercel Blob, plus the bundled
// UI i18n that ships with the app.
//
// Split of responsibilities:
//   Blob (data, updated out-of-band without a git deploy):
//     - lid-berlin-source-of-truth.json   the official questions (copied as-is)
//     - lid-berlin-learner-data.json       German learner data: per-question
//                                           themes/decks/study notes/glossaryRefs
//                                           + the glossary registry
//     - lid-berlin-i18n-en.json            content translations (questions.* + glossary.*)
//   Bundled with the app (ships with code):
//     - data/i18n/ui.en.json               UI chrome strings (ui.* + category.*)
//
// Run: node scripts/build-blob-data.js
// Outputs land in build/blob/ (gitignored) ready for upload, and the bundled
// UI i18n is written into data/i18n/.

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const OUT = path.join(root, "build/blob");
fs.mkdirSync(OUT, { recursive: true });

const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, value) => fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);

const sourceOfTruth = read("data/lid-berlin-source-of-truth.json");
const metadata = read("data/lid-berlin-question-metadata.json");
const i18n = read("data/i18n/en.json");
const messages = i18n.messages || {};

// --- learner-data: the German structural + learner content the app needs ---
const learnerData = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  glossary: metadata.glossary || [],
  questions: metadata.questions || [],
};

// --- i18n split by key namespace ---
const isContentKey = (k) => k.startsWith("questions.") || k.startsWith("glossary.");
const isUiKey = (k) => k.startsWith("ui.") || k.startsWith("category.");

const contentMessages = {};
const uiMessages = {};
const stray = [];
for (const [key, value] of Object.entries(messages)) {
  if (isContentKey(key)) contentMessages[key] = value;
  else if (isUiKey(key)) uiMessages[key] = value;
  else stray.push(key);
}
if (stray.length) {
  // Unknown namespace — keep it bundled so nothing silently disappears.
  for (const key of stray) uiMessages[key] = messages[key];
  console.warn(`[warn] ${stray.length} i18n key(s) outside ui/category/questions/glossary kept in bundled UI file: ${stray.slice(0, 5).join(", ")}${stray.length > 5 ? " …" : ""}`);
}

const contentI18n = { schemaVersion: 2, locale: i18n.locale || "en", generatedAt: learnerData.generatedAt, messages: contentMessages };
const uiI18n = { schemaVersion: 2, locale: i18n.locale || "en", messages: uiMessages };

// --- write blob artifacts ---
writeJson(path.join(OUT, "lid-berlin-source-of-truth.json"), sourceOfTruth);
writeJson(path.join(OUT, "lid-berlin-learner-data.json"), learnerData);
writeJson(path.join(OUT, "lid-berlin-i18n-en.json"), contentI18n);

// --- write bundled UI i18n into the app ---
writeJson(path.join(root, "data/i18n/ui.en.json"), uiI18n);

console.log("built blob artifacts -> build/blob/");
console.log(`  source-of-truth: ${learnerData.questions.length ? Object.keys(sourceOfTruth).length || "?" : "?"} questions`);
console.log(`  learner-data:    ${learnerData.questions.length} questions, ${learnerData.glossary.length} glossary terms`);
console.log(`  i18n-en (blob):  ${Object.keys(contentMessages).length} content keys`);
console.log(`  ui.en (bundled): ${Object.keys(uiMessages).length} UI keys`);
