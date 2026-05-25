const { test, expect } = require("@playwright/test");

async function openTrainer(page) {
  await page.goto("/?testSize=2");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Loading...");
}

async function answerCurrentQuestion(page) {
  const answers = page.locator("#answers [data-answer]");
  await expect(answers.first()).toBeEnabled();
  await answers.first().click();
  await expect(page.locator("#feedback")).toBeVisible();
}

async function switchToTestMode(page) {
  await page.getByLabel("Mode").getByRole("button", { name: "Test" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("takes a two-question test through result view", async ({ page }) => {
  await openTrainer(page);

  await switchToTestMode(page);
  await expect(page.locator("#questionTag")).toContainText("TEST");
  await expect(page.getByRole("button", { name: /Next|Finish/ })).toBeDisabled();

  await answerCurrentQuestion(page);
  await expect(page.getByRole("button", { name: /Next/ })).toBeEnabled();
  await page.getByRole("button", { name: /Next/ }).click();

  await answerCurrentQuestion(page);
  await page.getByRole("button", { name: /Finish/ }).click();

  await expect(page.locator("#resultView")).toBeVisible();
  await expect(page.locator("#resultView")).toContainText(/Correct/);
  await expect(page.locator(".result-stats")).toContainText("Correct");
  await expect(page.locator(".result-stats")).toContainText("Missed");
  await expect(page.getByRole("button", { name: /Try again/ })).toBeVisible();
});

test("theme preference defaults to system and persists explicit selection", async ({ page }) => {
  await openTrainer(page);

  const initialState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(initialState.theme).toBeUndefined();

  await page.locator("#filterButton").click();
  await page.getByRole("tab", { name: /Config/ }).click();
  await expect(page.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "dark");

  const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(savedState.theme).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#filterButton").click();
  await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
});

test("persists test answers across reload", async ({ page }) => {
  await openTrainer(page);

  await switchToTestMode(page);
  const firstQuestion = await page.locator("#questionText").innerText();
  await answerCurrentQuestion(page);

  await page.reload();
  await expect(page.locator("#questionText")).toHaveText(firstQuestion);
  await expect(page.locator("#feedback")).toBeVisible();
  await expect(page.getByRole("button", { name: /Next/ })).toBeEnabled();
});

test("preserves learn and test progress when switching modes", async ({ page }) => {
  await openTrainer(page);

  await page.getByRole("button", { name: "Next" }).click();
  const learnQuestion = await page.locator("#questionText").innerText();

  await switchToTestMode(page);
  await answerCurrentQuestion(page);
  await page.getByRole("button", { name: "Next" }).click();
  const testQuestion = await page.locator("#questionText").innerText();

  await page.getByLabel("Mode").getByRole("button", { name: "Learn" }).click();
  await expect(page.locator("#questionText")).toHaveText(learnQuestion);

  await switchToTestMode(page);
  await expect(page.locator("#questionText")).toHaveText(testQuestion);
});

test("can take tests without translations", async ({ page }) => {
  await openTrainer(page);

  await switchToTestMode(page);

  await expect(page.locator("#questionTranslation")).toBeHidden();
  await expect(page.locator("#answers .en")).toHaveCount(0);

  await answerCurrentQuestion(page);
  await expect(page.locator("#answers .en")).toHaveCount(0);
});

test("test translation preference defaults off and persists changes", async ({ page }) => {
  await openTrainer(page);

  await page.locator("#filterButton").click();
  await page.getByRole("tab", { name: /Config/ }).click();
  const translationSwitch = page.getByRole("switch", { name: /Show translations in tests/ });

  await expect(translationSwitch).not.toBeChecked();
  let savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(savedState.testTranslations).toBe(false);

  await translationSwitch.click();
  await expect(translationSwitch).toBeChecked();
  savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(savedState.testTranslations).toBe(true);

  await page.reload();
  await page.locator("#filterButton").click();
  await expect(translationSwitch).toBeChecked();

  await translationSwitch.click();
  await expect(translationSwitch).not.toBeChecked();
  savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(savedState.testTranslations).toBe(false);

  await page.reload();
  await page.locator("#filterButton").click();
  await expect(translationSwitch).not.toBeChecked();
});

test("can delay test feedback until results", async ({ page }) => {
  await openTrainer(page);

  await page.locator("#filterButton").click();
  await page.getByRole("tab", { name: /Config/ }).click();
  const feedbackSwitch = page.getByRole("switch", { name: /Show feedback while testing/ });

  await expect(feedbackSwitch).toBeChecked();
  await feedbackSwitch.click();
  await expect(feedbackSwitch).not.toBeChecked();
  await page.keyboard.press("Escape");

  await switchToTestMode(page);
  const answers = page.locator("#answers [data-answer]");
  await expect(answers.first()).toBeEnabled();
  await answers.first().click();

  await expect(page.locator("#feedback")).toBeHidden();
  await expect(page.locator("#answers .is-correct")).toHaveCount(0);
  await expect(page.locator("#answers .is-wrong")).toHaveCount(0);
  await expect(page.locator("#answers .is-selected")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Next/ })).toBeEnabled();

  let savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(savedState.testImmediateFeedback).toBe(false);

  await page.reload();
  await page.locator("#filterButton").click();
  await page.getByRole("tab", { name: /Config/ }).click();
  await expect(feedbackSwitch).not.toBeChecked();
});

test("marking mastered removes a card, can undo, and survives reload", async ({ page }) => {
  await openTrainer(page);

  const firstQuestion = await page.locator("#questionText").innerText();
  await page.getByRole("button", { name: /Mark as mastered/ }).click();
  await expect(page.locator("#questionText")).not.toHaveText(firstQuestion);
  await expect(page.locator("#snackbar")).toContainText("Marked as mastered");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#questionText")).toHaveText(firstQuestion);

  const undoneState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(undoneState.known.length).toBe(0);

  await page.getByRole("button", { name: /Mark as mastered/ }).click();
  await expect(page.locator("#questionText")).not.toHaveText(firstQuestion);

  const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(savedState.known.length).toBe(1);

  await page.reload();
  await expect(page.locator("#knownCount")).toContainText("1");
  await expect(page.locator("#knownCount use")).toHaveAttribute("href", "#tabler-star");
});

test("study help starts expanded and handle toggles it", async ({ page }) => {
  await openTrainer(page);

  const studyDock = page.locator("#studyDock");
  const handle = page.getByRole("button", { name: "Collapse study help" });

  await expect(studyDock).toBeVisible();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#keywordList")).toBeVisible();

  await handle.click();
  await expect(studyDock).toHaveClass(/is-collapsed/);
  await expect(page.getByRole("button", { name: "Expand study help" })).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Expand study help" }).click();
  await expect(studyDock).not.toHaveClass(/is-collapsed/);
  await expect(page.getByRole("button", { name: "Collapse study help" })).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("button", { name: "Collapse study help" }).focus();
  await page.keyboard.press("Escape");
  await expect(studyDock).toHaveClass(/is-collapsed/);
  await expect(page.getByRole("button", { name: "Expand study help" })).toBeFocused();
});

test("study help hides the drawer handle when content already fits", async ({ page }) => {
  await openTrainer(page);

  const studyDock = page.locator("#studyDock");
  const studyHandle = page.locator("#studyHandle");

  await expect(studyHandle).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("#questionTag")).toContainText("002");
  await expect(studyDock).toHaveClass(/is-static/);
  await expect(studyHandle).toBeHidden();
});

test("jump dialog navigates quickly through the deck", async ({ page }) => {
  await openTrainer(page);

  await page.getByRole("button", { name: /Jump to question/ }).click();
  await expect(page.getByRole("dialog", { name: "Jump to question" })).toBeVisible();
  await page.getByRole("button", { name: "Last" }).click();
  await expect(page.locator("#progressText")).toContainText("/310");
  await expect(page.locator("#progressText")).toContainText("310");

  await page.getByRole("button", { name: /Jump to question/ }).click();
  await page.locator("#jumpInput").fill("1");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page.locator("#progressText")).toContainText("01");

  await page.keyboard.press("End");
  await expect(page.locator("#progressText")).toContainText("310");
  await page.keyboard.press("Home");
  await expect(page.locator("#progressText")).toContainText("01");
});

test("mobile drawer behaves like a modal dialog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTrainer(page);

  const filterButton = page.locator("#filterButton");
  const drawer = page.locator("#filterBar");
  const card = page.locator("#card");

  await filterButton.click();
  await expect(drawer).toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(card).toHaveAttribute("inert", "");
  await expect(page.getByRole("tab", { name: "Filters" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(drawer).not.toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(card).not.toHaveAttribute("inert", "");
  await expect(filterButton).toBeFocused();
});

test("desktop review panel stays open after selecting a filter", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await openTrainer(page);

  const filterButton = page.locator("#filterButton");
  const drawer = page.locator("#filterBar");

  await filterButton.click();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");

  await page.getByRole("button", { name: /Elections/i }).click();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(filterButton).toHaveAttribute("aria-expanded", "true");

  await filterButton.click();
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(filterButton).toHaveAttribute("aria-expanded", "false");
});

test("tablet review panel uses rail layout without modal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 820 });
  await openTrainer(page);

  await page.locator("#filterButton").click();
  const drawer = page.locator("#filterBar");

  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(drawer).not.toHaveAttribute("role", "dialog");
  await expect(drawer).not.toHaveAttribute("aria-modal", "true");

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
});

test("learn mode renders the correct answer first without changing test answer indexes", async ({ page }) => {
  await openTrainer(page);

  await expect(page.locator("#answers [data-answer]").first()).toHaveAttribute("data-answer", "3");

  await switchToTestMode(page);
  const answerIndexes = await page.locator("#answers [data-answer]").evaluateAll((answers) =>
    answers.map((answer) => answer.getAttribute("data-answer")),
  );
  expect(answerIndexes).toEqual(["0", "1", "2", "3"]);
});
