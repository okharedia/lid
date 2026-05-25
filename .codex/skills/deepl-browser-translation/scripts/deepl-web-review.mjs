#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = parseArgs(process.argv.slice(2));
const root = process.cwd();
const sourcePath = args.source || "data/lid-berlin-source-of-truth.json";
const currentPath = args.current || "data/i18n/en.json";
const outputPath = args.output || "tmp/deepl-web-review/core-translations.json";
const outputFile = path.join(root, outputPath);
const start = Number(args.start || 0);
const maxChars = Number(args["max-chars"] || 850);
const maxItems = Number(args["max-items"] || 22);

const source = JSON.parse(fs.readFileSync(path.join(root, sourcePath), "utf8"));
const current = JSON.parse(fs.readFileSync(path.join(root, currentPath), "utf8")).messages;
const allItems = extractQuestionAnswerItems(source, current);
const items = allItems.slice(start);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });

const batches = makeBatches(items, maxChars, maxItems);
const results = loadResumeResults(outputFile, allItems, start);
const failures = [];

console.error(`items=${allItems.length} start=${start} remaining=${items.length} batches=${batches.length}`);

const browser = await chromium.launch({ headless: true });
let page = await newDeepLPage(browser);

for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
  const batch = batches[batchIndex];
  const input = batch.map((item, index) => `${marker(index + 1)} ${item.de}`).join("\n");
  const lastMarker = marker(batch.length);

  try {
    const sourceEditor = page.locator("d-textarea").nth(0).locator("[contenteditable=true]");
    await sourceEditor.waitFor({ timeout: 15000 });
    await sourceEditor.click();
    await sourceEditor.fill("");
    await page.waitForTimeout(300);
    await sourceEditor.fill(input);

    await page.waitForFunction(
      (expectedMarker) => {
        const target = document.querySelectorAll("d-textarea")[1];
        return target && (target.value || target.innerText || "").includes(expectedMarker);
      },
      lastMarker,
      { timeout: 30000 },
    );

    await page.waitForTimeout(1000);
    const target = await page
      .locator("d-textarea")
      .nth(1)
      .evaluate((element) => element.value || element.innerText || "");
    const parsed = parseMarked(target, batch.length);
    const missing = parsed.map((value, index) => (value ? null : index + 1)).filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`parse missing markers: ${missing.join(", ")}`);
    }

    for (let index = 0; index < batch.length; index += 1) {
      results.push({ ...batch[index], deepl: parsed[index] });
    }
    console.error(`batch ${batchIndex + 1}/${batches.length} ok (${results.length}/${allItems.length})`);
  } catch (error) {
    const textareas = await page
      .locator("d-textarea")
      .evaluateAll((elements) => elements.map((element) => element.value || element.innerText || ""))
      .catch(() => []);
    const body = await page.locator("body").innerText().catch(() => "");
    failures.push({
      batch: batchIndex + 1,
      globalStart: results.length,
      reason: error.message,
      sourceLen: input.length,
      source: input,
      target: textareas[1] || "",
      body: body.slice(0, 1200),
    });
    console.error(`batch ${batchIndex + 1}/${batches.length} failed: ${error.message}`);
    break;
  }

  if ((batchIndex + 1) % 12 === 0) {
    await page.close();
    page = await newDeepLPage(browser);
  } else {
    await page.waitForTimeout(500);
  }
}

await browser.close();

const output = {
  generatedAt: new Date().toISOString(),
  total: allItems.length,
  start,
  translated: results.length,
  failures,
  results,
};
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ total: allItems.length, translated: output.translated, failures: failures.length, output: outputPath }, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return parsed;
}

function extractQuestionAnswerItems(data, messages) {
  const items = [];
  for (const question of data.questions) {
    items.push({
      key: question.translationKey,
      de: question.question,
      current: messages[question.translationKey],
    });
    for (const answer of question.answers) {
      items.push({
        key: answer.translationKey,
        de: answer.text,
        current: messages[answer.translationKey],
      });
    }
  }
  return items;
}

function loadResumeResults(filePath, allItems, startIndex) {
  if (startIndex === 0) return [];
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cannot resume from --start ${startIndex}: ${outputPath} does not exist`);
  }

  const previous = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const previousResults = Array.isArray(previous.results) ? previous.results : [];
  if (previousResults.length < startIndex) {
    throw new Error(
      `Cannot resume from --start ${startIndex}: ${outputPath} only has ${previousResults.length} results`,
    );
  }

  const resumed = previousResults.slice(0, startIndex);
  for (let index = 0; index < resumed.length; index += 1) {
    if (resumed[index].key !== allItems[index].key) {
      throw new Error(`Cannot resume: result ${index} key mismatch in ${outputPath}`);
    }
  }
  return resumed;
}

function makeBatches(list, batchMaxChars, batchMaxItems) {
  const batches = [];
  let currentBatch = [];
  let currentLength = 0;
  for (const item of list) {
    const line = `${marker(currentBatch.length + 1)} ${item.de}`;
    if (
      currentBatch.length > 0 &&
      (currentLength + line.length + 1 > batchMaxChars || currentBatch.length >= batchMaxItems)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLength = 0;
    }
    currentBatch.push(item);
    currentLength += line.length + 1;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}

function marker(index) {
  return `§${String(index).padStart(3, "0")}§`;
}

function parseMarked(text, expectedCount) {
  const output = Array(expectedCount).fill(null);
  const markerPattern = /§0*(\d{1,4})§/g;
  const matches = [...text.matchAll(markerPattern)];
  for (let index = 0; index < matches.length; index += 1) {
    const markerIndex = Number(matches[index][1]) - 1;
    const startIndex = matches[index].index + matches[index][0].length;
    const endIndex = index + 1 < matches.length ? matches[index + 1].index : text.length;
    if (markerIndex >= 0 && markerIndex < expectedCount) {
      output[markerIndex] = text.slice(startIndex, endIndex).trim().replace(/\n{2,}/g, "\n");
    }
  }
  return output;
}

async function newDeepLPage(browser) {
  const page = await browser.newPage({ locale: "en-US" });
  page.setDefaultTimeout(45000);
  await page.goto("https://www.deepl.com/translator#de/en/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(3000);
  return page;
}
