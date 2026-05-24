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
  await expect(page.locator("#resultView")).toContainText(/correct/);
  await expect(page.getByRole("button", { name: /Retry test/ })).toBeVisible();
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

test("marking known removes a card and survives reload", async ({ page }) => {
  await openTrainer(page);

  const firstQuestion = await page.locator("#questionText").innerText();
  await page.getByRole("button", { name: /Mark known/ }).click();
  await expect(page.locator("#questionText")).not.toHaveText(firstQuestion);

  const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("lid-trainer-v7")));
  expect(savedState.known.length).toBe(1);

  await page.reload();
  await expect(page.locator("#knownCount")).toContainText("1");
});
