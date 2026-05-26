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
  await expect(page.locator("#questionTag")).toContainText("FRAGE");
  await expect(page.locator("#questionChips")).toBeHidden();
  await expect(page.locator("#firstQuestionButton")).toBeHidden();
  await expect(page.locator("#lastQuestionButton")).toBeHidden();
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

test("opens question deeplinks in learn mode", async ({ page }) => {
  await page.goto("/q/24?testSize=2");
  await expect(page.locator("#questionTag")).toContainText("FRAGE 024");
  await expect(page.getByLabel("Mode").getByRole("button", { name: "Learn" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#filterButtonLabel")).toContainText("All");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/q\/25\?testSize=2$/);
});

test("question deeplinks use global question IDs", async ({ page }) => {
  await page.goto("/q/301");
  await expect(page.locator("#questionTag")).toContainText("FRAGE 001");
  await expect(page.locator("#categoryLabel")).toContainText("Berlin state question");
  await expect(page.locator("#questionText")).toContainText("Welches Wappen gehört zum Bundesland Berlin?");
  await expect(page.locator("#progressText")).toContainText("301");
  await expect(page.locator("#progressText")).toContainText("/310");
});

test("question deeplinks reset filters to all questions", async ({ page }) => {
  await openTrainer(page);
  await page.locator("#filterButton").click();
  await page.getByRole("button", { name: /Elections/i }).click();
  await expect(page.locator("#filterButtonLabel")).toContainText("Elections");

  await page.goto("/q/24");
  await expect(page.locator("#questionTag")).toContainText("FRAGE 024");
  await expect(page.locator("#filterButtonLabel")).toContainText("All");
});

test("question deeplinks show known questions", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lid-trainer-v7", JSON.stringify({ known: [24] }));
  });

  await page.goto("/q/24");
  await expect(page.locator("#questionTag")).toContainText("FRAGE 024");
  await expect(page.locator("#knownTag")).toBeVisible();
});

test("mastered questions link back to their deeplink", async ({ page }) => {
  await openTrainer(page);
  const firstQuestion = await page.locator("#questionText").innerText();

  await page.getByRole("button", { name: /Mark as mastered/ }).click();
  await page.locator("#filterButton").click();
  await page.getByRole("tab", { name: /Mastered/ }).click();

  const masteredLink = page.getByRole("link", { name: /Open question 001/ });
  await expect(masteredLink).toHaveAttribute("href", /\/q\/1$/);
  await masteredLink.click();

  await expect(page).toHaveURL(/\/q\/1$/);
  await expect(page.locator("#questionText")).toHaveText(firstQuestion);
  await expect(page.locator("#knownTag")).toBeVisible();
});

test("question deeplinks preserve resumable test sessions", async ({ page }) => {
  await openTrainer(page);

  await switchToTestMode(page);
  const testQuestion = await page.locator("#questionText").innerText();
  await answerCurrentQuestion(page);

  await page.goto("/q/24?testSize=2");
  await expect(page.locator("#questionTag")).toContainText("FRAGE 024");
  await expect(page.getByLabel("Mode").getByRole("button", { name: "Learn" })).toHaveAttribute("aria-pressed", "true");

  await switchToTestMode(page);
  await expect(page.locator("#questionText")).toHaveText(testQuestion);
  await expect(page.locator("#feedback")).toBeVisible();
});

test("missing question deeplinks show not found", async ({ page }) => {
  await page.goto("/q/999");
  await expect(page.locator("#emptyState")).toBeVisible();
  await expect(page.locator("#emptyState")).toContainText("Question 999 not found");
  await expect(page).toHaveURL(/\/q\/999$/);
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

test("hides duplicate numeric answer translations", async ({ page }) => {
  await page.goto("/q/304");

  await expect(page.locator("#questionTag")).toContainText("FRAGE 004");
  await expect(page.locator("#answers .en")).toHaveCount(0);
  await expect(page.locator("#answers")).toContainText("16");
});

test("question images advertise and open a larger view", async ({ page }) => {
  await openTrainer(page);

  await page.getByRole("button", { name: /Jump to question/ }).click();
  await page.locator("#jumpInput").fill("130");
  await page.getByRole("button", { name: "Go" }).click();

  const imageButton = page.getByRole("button", { name: "Open larger question image" });
  await expect(imageButton).toBeVisible();
  await expect(imageButton.locator(".bp-image-zoom")).toBeVisible();

  await imageButton.click();
  const dialog = page.getByRole("dialog", { name: "Larger question image" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveAttribute("src", /j01649_0040\.jpg/);

  await page.getByRole("button", { name: "Close image" }).click();
  await expect(dialog).toBeHidden();
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
  await expect(page.locator("#knownCount")).toHaveCount(0);
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

test("progress controls jump within the current filter", async ({ page }) => {
  await page.goto("/q/301?testSize=2");
  await expect(page.locator("#questionTag")).toContainText("FRAGE 001");

  await page.locator("#filterButton").click();
  await page.locator('[data-category="Berlin state question"]').click();
  const filteredTotal = (await page.locator("#progressText .pct").innerText()).replace("/", "");
  expect(filteredTotal).toBe("20");

  await page.getByRole("button", { name: "Last question in current filter" }).click();
  await expect(page.locator("#progressText")).toContainText(filteredTotal);
  await expect(page).toHaveURL(/\/q\/310\?testSize=2$/);

  await page.getByRole("button", { name: "First question in current filter" }).click();
  await expect(page.locator("#progressText")).toContainText("01");
  await expect(page).toHaveURL(/\/q\/55\?testSize=2$/);
});

test("mastered questions are skipped without shrinking filtered progress", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("lid-trainer-v7", JSON.stringify({
      mode: "learn",
      category: "Berlin state question",
      known: [301],
      index: 11,
      learnIndex: 11,
    }));
  });

  await page.goto("/?testSize=2");
  await expect(page.locator("#questionTag")).toContainText("FRAGE 002");
  await expect(page.locator("#progressText")).toContainText("12");
  await expect(page.locator("#progressText")).toContainText("/20");

  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.locator("#questionTag")).toContainText("FRAGE 193");
  await expect(page.locator("#progressText")).toContainText("10");
  await expect(page.locator("#progressText")).toContainText("/20");
});

test("jump popover opens exact global question number and resets filter to all", async ({ page }) => {
  await openTrainer(page);

  await page.locator("#filterButton").click();
  await page.getByRole("button", { name: /Elections/i }).click();
  await expect(page.locator("#filterButtonLabel")).toContainText("Elections");

  await page.getByRole("button", { name: /Jump to question/ }).click();
  await expect(page.getByRole("dialog", { name: "Jump to question" })).toBeVisible();
  await expect(page.locator("#jumpDialog")).toHaveCSS("position", "absolute");
  await page.locator("#jumpInput").fill("24");
  await page.getByRole("button", { name: "Go" }).click();

  await expect(page).toHaveURL(/\/q\/24$/);
  await expect(page.locator("#questionTag")).toContainText("FRAGE 024");
  await expect(page.locator("#filterButtonLabel")).toContainText("All");
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

test("long mobile question typography does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const questionId of [235, 268]) {
    await page.goto(`/q/${questionId}`);
    await expect(page.locator("#questionText")).not.toHaveText("Loading...");
    await expect(page.locator("#answers [data-answer]").first()).toBeVisible();

    const overflowingText = await page.evaluate(() => {
      const selectors = [
        ".bp-q",
        ".bp-q-en",
        ".bp-answer .text",
        ".bp-answer .text .en",
        ".bp-answer .text .why",
        ".bp-hint",
        ".bp-nav button",
      ];

      return selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)]
          .filter((element) => element.checkVisibility())
          .map((element) => ({
            selector,
            text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
            clipsX: element.scrollWidth > element.clientWidth + 1,
            clipsY: element.scrollHeight > element.clientHeight + 1,
          }))
          .filter(({ clipsX, clipsY }) => clipsX || clipsY),
      );
    });

    expect(overflowingText, `Question ${questionId} has clipped typography`).toEqual([]);
  }
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

test("tablet review panel behaves as a dismissible overlay", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 820 });
  await openTrainer(page);

  const filterButton = page.locator("#filterButton");
  await filterButton.click();
  const drawer = page.locator("#filterBar");

  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(drawer).toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-modal", "true");

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(filterButton).toHaveAttribute("aria-expanded", "false");
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
