const STORAGE_KEY = "lid-trainer-v7";
const OLD_STORAGE_KEY = "lid-trainer-v6";
const ALL_CATS = "Alle Kategorien";
const DEFAULT_LOCALE = "en";
const SUPPORTED_LOCALES = new Set(["en", "es", "fr"]);
const DEFAULT_TEST_SIZE = 3;
const PASS_SCORE = 90;
const MOTION_MEDIUM_MS = 180;
const MOTION_LONG_MS = 240;
const THEME_LABEL_KEYS = {
  system: "ui.theme.system",
  light: "ui.theme.light",
  dark: "ui.theme.dark",
};
const CATEGORY_KEYS = {
  [ALL_CATS]: "category.all",
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

function configuredTestSize() {
  const urlValue = new URLSearchParams(window.location.search).get("testSize");
  const savedValue = localStorage.getItem("lid-test-size");
  const parsed = Number(urlValue || savedValue || DEFAULT_TEST_SIZE);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TEST_SIZE;
}

let questions = [];
let questionById = new Map();
let categories = [ALL_CATS];
let messages = {};
let locale = DEFAULT_LOCALE;
let glossary = { ranges: ["A-D", "E-H", "I-S", "T-Z"], terms: [] };

const state = {
  mode: "learn",
  category: ALL_CATS,
  known: new Set(),
  index: 0,
  learnIndex: 0,
  linkedQuestionId: null,
  missingQuestionId: null,
  syncQuestionUrl: false,
  selected: null,
  deck: [],
  panelTab: "filters",
  testSession: null,
  result: null,
  studyExpanded: true,
  theme: "system",
  themeExplicit: false,
  testTranslations: false,
  testImmediateFeedback: true,
  glossaryRange: "A-D",
  glossaryQuery: "",
};

let slideTimer = 0;
let modeTimer = 0;
let answerTimer = 0;
let swipeTimer = 0;
let swipeStart = null;
let drawerReturnFocus = null;

const els = {
  learnMode: document.querySelector("#learnMode"),
  testMode: document.querySelector("#testMode"),
  languageSelect: document.querySelector("#languageSelect"),
  filterButton: document.querySelector("#filterButton"),
  filterButtonLabel: document.querySelector("#filterButtonLabel"),
  filtersTab: document.querySelector("#filtersTab"),
  knownTab: document.querySelector("#knownTab"),
  testConfigTab: document.querySelector("#testConfigTab"),
  filtersPane: document.querySelector("#filtersPane"),
  knownPane: document.querySelector("#knownPane"),
  testConfigPane: document.querySelector("#testConfigPane"),
  knownSummary: document.querySelector("#knownSummary"),
  knownList: document.querySelector("#knownList"),
  testSizeInput: document.querySelector("#testSizeInput"),
  testSizeMinus: document.querySelector("#testSizeMinus"),
  testSizePlus: document.querySelector("#testSizePlus"),
  testSizeMeta: document.querySelector("#testSizeMeta"),
  testTranslationsToggle: document.querySelector("#testTranslationsToggle"),
  testImmediateFeedbackToggle: document.querySelector("#testImmediateFeedbackToggle"),
  themeButtons: [...document.querySelectorAll("[data-theme-choice]")],
  filterBar: document.querySelector("#filterBar"),
  app: document.querySelector(".bp-app"),
  top: document.querySelector(".bp-top"),
  categoryPills: document.querySelector("#categoryPills"),
  progressFill: document.querySelector("#progressFill"),
  track: document.querySelector(".bp-track"),
  card: document.querySelector("#card"),
  resultView: document.querySelector("#resultView"),
  emptyState: document.querySelector("#emptyState"),
  questionTag: document.querySelector("#questionTag"),
  categoryLabel: document.querySelector("#categoryLabel"),
  knownTag: document.querySelector("#knownTag"),
  feedback: document.querySelector("#feedback"),
  firstQuestionButton: document.querySelector("#firstQuestionButton"),
  progressText: document.querySelector("#progressText"),
  lastQuestionButton: document.querySelector("#lastQuestionButton"),
  jumpDialog: document.querySelector("#jumpDialog"),
  jumpInput: document.querySelector("#jumpInput"),
  questionText: document.querySelector("#questionText"),
  questionTranslation: document.querySelector("#questionTranslation"),
  questionImageButton: document.querySelector("#questionImageButton"),
  questionImage: document.querySelector("#questionImage"),
  imageDialog: document.querySelector("#imageDialog"),
  imageDialogImage: document.querySelector("#imageDialogImage"),
  imageDialogClose: document.querySelector("#imageDialogClose"),
  answers: document.querySelector("#answers"),
  hintText: document.querySelector("#hintText"),
  studyDock: document.querySelector("#studyDock"),
  studyHandle: document.querySelector("#studyHandle"),
  studyContent: document.querySelector("#studyContent"),
  keywordList: document.querySelector("#keywordList"),
  lockedHint: document.querySelector("#lockedHint"),
  cardNav: document.querySelector("#cardNav"),
  prevButton: document.querySelector("#prevButton"),
  middleButton: document.querySelector("#middleButton"),
  nextButton: document.querySelector("#nextButton"),
  snackbar: document.querySelector("#snackbar"),
  snackbarText: document.querySelector("#snackbarText"),
  snackbarAction: document.querySelector("#snackbarAction"),
  glossaryNav: document.querySelector("#glossaryNav"),
  glossaryPage: document.querySelector("#glossaryPage"),
  glossarySearch: document.querySelector("#glossarySearch"),
  glossaryClear: document.querySelector("#glossaryClear"),
  glossaryGroups: document.querySelector("#glossaryGroups"),
  glossaryRanges: document.querySelector("#glossaryRanges"),
};

let snackbarTimer = 0;
let knownUndo = null;

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveState() {
  try {
    const payload = {
      mode: state.mode,
      category: state.category,
      known: [...state.known],
      index: state.index,
      learnIndex: state.learnIndex,
      panelTab: state.panelTab,
      testSession: state.testSession,
      testTranslations: state.testTranslations,
      testImmediateFeedback: state.testImmediateFeedback,
    };
    if (state.themeExplicit) payload.theme = state.theme;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {}
}

function applyTheme() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = state.theme === "system" ? (prefersDark ? "dark" : "light") : state.theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = state.theme;
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, seed) {
  const random = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function icon(name, className = "") {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#tabler-${name}"></use></svg>`;
}

function t(key) {
  return key ? messages[key] || "" : "";
}

function isNumericText(value) {
  return /^[+-]?(?:\d+|\d{1,3}(?:[.,\s]\d{3})+)(?:[.,]\d+)?%?$/.test(String(value).trim());
}

function visibleAnswerTranslation(answer) {
  const translation = t(answer?.translationKey).trim();
  const source = String(answer?.text || "").trim();
  return source === translation && isNumericText(source) ? "" : translation;
}

function ui(key, replacements = {}) {
  const template = t(key) || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = replacements[name];
    return value === undefined || value === null ? "" : String(value);
  });
}

function uiHtml(key, replacements = {}) {
  const escaped = Object.fromEntries(
    Object.entries(replacements).map(([name, value]) => [name, escapeHtml(value)]),
  );
  return ui(key, escaped);
}

function uiCount(singularKey, pluralKey, count, replacements = {}) {
  return ui(count === 1 ? singularKey : pluralKey, { count, ...replacements });
}

function categoryLabel(category) {
  return ui(CATEGORY_KEYS[category] || "category.unknown", { category });
}

function applyStaticTranslations() {
  document.documentElement.lang = ui("ui.documentLang");
  document.title = ui("ui.documentTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = ui(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", ui(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.setAttribute("alt", ui(element.dataset.i18nAlt));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", ui(element.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", ui(element.dataset.i18nPlaceholder));
  });
}

function requestedLocale() {
  const urlLocale = new URLSearchParams(window.location.search).get("lang");
  const savedLocale = localStorage.getItem("lid-locale");
  const selectedLocale = els.languageSelect?.value;
  const nextLocale = urlLocale || savedLocale || selectedLocale || DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.has(nextLocale) ? nextLocale : DEFAULT_LOCALE;
}

async function loadMessages(nextLocale = DEFAULT_LOCALE) {
  const response = await fetch(`/data/i18n/${nextLocale}.json`, { cache: "no-store" });
  if (!response.ok && nextLocale !== DEFAULT_LOCALE) return loadMessages(DEFAULT_LOCALE);
  if (!response.ok) return;
  const translationCatalog = await response.json();
  locale = translationCatalog.locale || nextLocale;
  messages = translationCatalog.messages || {};
  if (els.languageSelect) els.languageSelect.value = locale;
  document.documentElement.dataset.locale = locale;
}

function correctAnswerIndex(question) {
  return question?.correctAnswerIndex ?? question?.correctIndex ?? 0;
}

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

function glossaryRefs(card) {
  return card.glossaryRefs || [];
}

function highlightTerms(card) {
  return glossaryRefs(card).map((ref) => ref.term || ref).filter(Boolean);
}

function highlightedText(text, card) {
  const terms = highlightTerms(card);
  if (!terms.length) return escapeHtml(text);

  const sortedTerms = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const expression = new RegExp(`(${sortedTerms.map(escapeRegExp).join("|")})`, "gi");

  return escapeHtml(text).replace(expression, (match) => {
    return `<span class="kw">${match}</span>`;
  });
}

function highlightedAnswerText(answer, card) {
  return highlightedText(answer, card);
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function shortCategoryLabel(category) {
  return category === ALL_CATS ? ui("category.all.short") : categoryLabel(category);
}

function baseFilteredQuestions(category = state.category) {
  if (category === ALL_CATS) return questions;
  return questions.filter((question) => question.theme === category);
}

function availableQuestions(category = state.category) {
  return baseFilteredQuestions(category).filter((question) => !state.known.has(question.id));
}

function questionLinkIdFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/q\/(\d+)\/?$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function questionPath(id) {
  return `/q/${id}`;
}

function isGlossaryPath(pathname = window.location.pathname) {
  return pathname === "/glossary" || pathname === "/glossary/";
}

function updateQuestionUrl(id, mode = "replace") {
  if (!id || window.location.pathname === questionPath(id)) return;
  const nextUrl = `${questionPath(id)}${window.location.search}${window.location.hash}`;
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", nextUrl);
}

function indexForQuestionId(id, deck = state.deck) {
  return deck.findIndex((question) => question.id === id);
}

function currentCard() {
  return state.deck[state.index] || null;
}

function currentTestAnswer() {
  const card = currentCard();
  if (!card || !state.testSession) return null;
  return state.testSession.answers[String(card.id)] ?? null;
}

function rememberCurrentProgress() {
  if (state.mode === "learn") {
    state.learnIndex = state.index;
  } else if (state.testSession) {
    state.testSession.index = state.index;
  }
}

function hasAnsweredTestQuestions(session = state.testSession) {
  return Boolean(session && Object.keys(session.answers || {}).length);
}

function buildLearnDeck(resetIndex = true) {
  state.deck = baseFilteredQuestions();
  if (resetIndex) state.index = 0;
  else if (state.index >= state.deck.length) state.index = Math.max(0, state.deck.length - 1);
  state.learnIndex = state.index;
  state.selected = null;
}

function nextLearnIndex(step, startIndex = state.index) {
  if (!state.deck.length) return startIndex;
  let index = startIndex;
  while (true) {
    const nextIndex = index + step;
    if (nextIndex < 0 || nextIndex >= state.deck.length) return index;
    index = nextIndex;
    const question = state.deck[index];
    if (question && !state.known.has(question.id)) return index;
  }
}

function firstAvailableLearnIndex() {
  return state.deck.findIndex((question) => !state.known.has(question.id));
}

function lastAvailableLearnIndex() {
  for (let index = state.deck.length - 1; index >= 0; index -= 1) {
    if (!state.known.has(state.deck[index].id)) return index;
  }
  return -1;
}

function hydrateTestDeck() {
  if (!state.testSession) {
    state.deck = [];
    return;
  }
  state.deck = state.testSession.questionIds
    .map((id) => questionById.get(Number(id)))
    .filter(Boolean)
    .filter((question) => !state.known.has(question.id));
  if (state.index >= state.deck.length) state.index = Math.max(0, state.deck.length - 1);
}

function newTestSession(category = state.category) {
  const pool = availableQuestions(category);
  const seed = Math.floor(Math.random() * 1e9) + 1;
  const size = configuredTestSize();
  return {
    category,
    size,
    seed,
    questionIds: shuffled(pool, seed).slice(0, size).map((question) => question.id),
    answers: {},
    index: 0,
  };
}

function startTest(category = state.category) {
  state.mode = "test";
  state.category = category;
  state.result = null;
  state.testSession = newTestSession(category);
  state.index = 0;
  state.selected = null;
  hydrateTestDeck();
  render();
}

function ensureTestSession() {
  if (state.mode !== "test") return;
  if (!state.testSession || state.testSession.category !== state.category || state.testSession.size !== configuredTestSize()) {
    state.testSession = newTestSession(state.category);
    state.index = 0;
  } else {
    state.index = Math.min(state.testSession.index || 0, Math.max(0, state.testSession.questionIds.length - 1));
  }
  hydrateTestDeck();
}

function scoreFor(session = state.testSession) {
  if (!session) return { correct: 0, total: 0, percent: 0, missed: [] };
  const total = session.questionIds.length;
  let correct = 0;
  const missed = [];

  session.questionIds.forEach((id) => {
    const question = questionById.get(Number(id));
    if (!question) return;
    const selected = session.answers[String(id)];
    if (selected === correctAnswerIndex(question)) {
      correct += 1;
      return;
    }
    missed.push({ question, selected });
  });

  return {
    correct,
    total,
    percent: total ? Math.round((correct / total) * 100) : 0,
    missed,
  };
}

function renderCategories() {
  els.categoryPills.innerHTML = categories
    .map((category) => {
      const isAll = category === ALL_CATS;
      const total = baseFilteredQuestions(category).length;
      const label = isAll ? ui("category.all.short") : categoryLabel(category);
      const selected = category === state.category;
      return `
        <button class="cat-pill" type="button" data-category="${escapeHtml(category)}" aria-pressed="${selected}">
          <span class="cat-check" aria-hidden="true">${icon("check")}</span>
          <span class="cat-copy">
            <span class="de">${escapeHtml(label)}</span>
            <span class="en">${uiCount("ui.category.questionCountOne", "ui.category.questionCountOther", total)}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderKnownPanel() {
  const knownQuestions = questions.filter((question) => state.known.has(question.id));
  els.knownSummary.innerHTML = "";
  els.knownList.innerHTML = knownQuestions.length
    ? knownQuestions
        .map((question) => `
          <article class="known-item">
            <a class="known-link" href="${questionPath(question.id)}" data-question-link="${question.id}" aria-label="${uiHtml("ui.known.openQuestion", { number: pad(question.id, 3) })}">
              <span class="known-link-copy">
                <span class="known-meta">${uiHtml("ui.question.label", { number: pad(question.id, 3) })} · ${escapeHtml(categoryLabel(question.theme))}</span>
                <span class="known-question">${escapeHtml(question.question)}</span>
              </span>
              <span class="known-link-icon" aria-hidden="true">${icon("arrow-up-right")}</span>
            </a>
            <button type="button" data-remove-known="${question.id}" aria-label="${uiHtml("ui.mastered.remove")}">
              ${icon("trash")}
            </button>
          </article>
        `)
        .join("")
    : `<div class="known-empty">${icon("book")}<strong>${uiHtml("ui.known.emptyTitle")}</strong><span>${uiHtml("ui.known.emptyBody")}</span></div>`;
}

function renderTestConfigPanel() {
  const value = configuredTestSize();
  const max = Math.max(1, availableQuestions().length || questions.length || value);
  els.testSizeInput.max = String(max);
  els.testSizeInput.value = String(value);
  els.testSizeMinus.disabled = value <= 1;
  els.testSizePlus.disabled = value >= max;
  els.testSizeMeta.textContent = uiCount(
    "ui.test.lengthOne",
    "ui.test.lengthOther",
    Math.min(value, max),
  );
  els.testTranslationsToggle.checked = state.testTranslations;
  els.testImmediateFeedbackToggle.checked = state.testImmediateFeedback;
  els.themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === state.theme));
  });
}

function renderPanel() {
  const isKnownTab = state.panelTab === "known";
  const isTestConfigTab = state.panelTab === "test";
  els.knownTab.setAttribute("aria-label", ui("ui.aria.masteredQuestions", { count: state.known.size }));
  els.testConfigTab.setAttribute("aria-label", ui("ui.aria.configTheme", { theme: ui(THEME_LABEL_KEYS[state.theme]) }));
  const tabStates = [
    [els.filtersTab, !isKnownTab && !isTestConfigTab],
    [els.knownTab, isKnownTab],
    [els.testConfigTab, isTestConfigTab],
  ];
  tabStates.forEach(([tab, selected]) => {
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  els.filtersPane.hidden = isKnownTab || isTestConfigTab;
  els.knownPane.hidden = !isKnownTab;
  els.testConfigPane.hidden = !isTestConfigTab;
  renderCategories();
  renderKnownPanel();
  renderTestConfigPanel();
}

function setPanelTab(tab) {
  state.panelTab = tab;
  render();
  const activeTab = {
    filters: els.filtersTab,
    known: els.knownTab,
    test: els.testConfigTab,
  }[tab];
  activeTab?.focus();
}

function movePanelTab(event) {
  const tabs = [els.filtersTab, els.knownTab, els.testConfigTab];
  const currentIndex = tabs.indexOf(document.activeElement);
  if (currentIndex === -1) return;
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  else return;

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  setPanelTab(nextTab === els.knownTab ? "known" : nextTab === els.testConfigTab ? "test" : "filters");
}

function renderResult() {
  if (!state.result) return;
  const { correct, total, percent, missed, showTranslations = true } = state.result;
  const passed = percent >= PASS_SCORE;
  els.resultView.classList.toggle("passed", passed);
  els.resultView.innerHTML = `
    <div class="result-hero" aria-live="polite">
      <div class="result-icon">${icon(passed ? "confetti" : "trophy")}</div>
      <p class="result-kicker">${uiHtml(passed ? "ui.result.passed" : "ui.result.keepPracticing")}</p>
      <h1>${percent}%</h1>
      <div class="result-stats" aria-label="${uiHtml("ui.aria.testScore")}">
        <span><strong>${correct}</strong><small>${uiHtml("ui.result.correct")}</small></span>
        <span><strong>${total - correct}</strong><small>${uiHtml("ui.result.missed")}</small></span>
        <span><strong>${total}</strong><small>${uiHtml("ui.result.total")}</small></span>
      </div>
      <p>${escapeHtml(shortCategoryLabel(state.category))}</p>
    </div>
    <div class="result-actions">
      <button class="btn btn-secondary" type="button" data-action="restart-test">${icon("refresh")} ${uiHtml("ui.action.tryAgain")}</button>
      <button class="btn btn-tertiary" type="button" data-action="learn-mode">${icon("arrow-back-up")} ${uiHtml("ui.mode.study")}</button>
    </div>
    <section class="missed-review">
      <h2>${uiHtml(missed.length ? "ui.result.reviewMisses" : "ui.result.cleanRun")}</h2>
      ${
        missed.length
          ? missed
              .map(({ question, selected }) => {
                const selectedAnswerObject = selected === null || selected === undefined
                  ? null
                  : question.answers[selected];
                const correctAnswerObject = question.answers[correctAnswerIndex(question)];
                const selectedAnswer = selectedAnswerObject === null
                  ? ui("ui.result.noAnswer")
                  : selectedAnswerObject?.text || ui("ui.result.noAnswer");
                const correctAnswer = correctAnswerObject?.text || ui("ui.result.noAnswer");
                const questionTranslation = showTranslations ? t(question.translationKey) : "";
                const selectedTranslation = showTranslations && selectedAnswerObject ? visibleAnswerTranslation(selectedAnswerObject) : "";
                const correctTranslation = showTranslations && correctAnswerObject ? visibleAnswerTranslation(correctAnswerObject) : "";
                return `
                  <article class="missed-item">
                    <span>${uiHtml("ui.question.label", { number: pad(question.id, 3) })}</span>
                    <h3>${escapeHtml(question.question)}</h3>
                    ${questionTranslation ? `<p class="missed-q-en">${escapeHtml(questionTranslation)}</p>` : ""}
                    <div class="missed-answer wrong">
                      ${icon("x")}
                      <span>
                        <span class="de">${escapeHtml(selectedAnswer)}</span>
                        ${selectedTranslation ? `<span class="en">${escapeHtml(selectedTranslation)}</span>` : ""}
                      </span>
                    </div>
                    <div class="missed-answer right">
                      ${icon("circle-check")}
                      <span>
                        <span class="de">${escapeHtml(correctAnswer)}</span>
                        ${correctTranslation ? `<span class="en">${escapeHtml(correctTranslation)}</span>` : ""}
                      </span>
                    </div>
                  </article>
                `;
              })
              .join("")
          : `<p class="result-note">${uiHtml("ui.result.noWrongAnswers")}</p>`
      }
    </section>
  `;
}

function renderChrome(glossaryActive = isGlossaryPath()) {
  els.app.classList.toggle("is-glossary", glossaryActive);
  els.glossaryPage.hidden = !glossaryActive;
  els.glossaryNav.setAttribute("aria-current", glossaryActive ? "page" : "false");
  els.learnMode.setAttribute("aria-current", !glossaryActive && state.mode === "learn" ? "page" : "false");
  els.testMode.setAttribute("aria-current", !glossaryActive && state.mode === "test" ? "page" : "false");
  els.filterButton.hidden = false;

  if (!glossaryActive) {
    document.title = ui("ui.documentTitle");
    els.filterBar.hidden = false;
    return;
  }

  closeReviewPanel(false);
  els.filterBar.hidden = false;
  els.track.hidden = true;
  els.card.hidden = true;
  els.resultView.hidden = true;
  els.emptyState.hidden = true;
  els.studyDock.hidden = true;
  els.cardNav.hidden = true;
  document.title = ui("ui.glossary.documentTitle");
}

function glossaryMatchesQuery(item, query) {
  if (!query) return true;
  const haystack = [
    item.term,
    item.translation,
    item.context,
    ...item.matches.flatMap((match) => [match.text, match.translation]),
  ].join(" ");
  return haystack.toLocaleLowerCase("de-DE").includes(query);
}

function filteredGlossaryTerms(range) {
  const query = state.glossaryQuery.trim().toLocaleLowerCase("de-DE");
  return glossary.terms.filter((item) => item.range === range && glossaryMatchesQuery(item, query));
}

function glossarySlug(term) {
  return term
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function glossaryHashItem() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!hash) return null;
  return glossary.terms.find((item) => glossarySlug(item.term) === hash) || null;
}

function syncGlossaryHashState() {
  const item = glossaryHashItem();
  if (!item) return false;
  state.glossaryRange = item.range;
  state.glossaryQuery = "";
  return true;
}

function scrollToGlossaryHash() {
  const item = glossaryHashItem();
  if (!item) return;
  document.getElementById(glossarySlug(item.term))?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function renderGlossary() {
  syncGlossaryHashState();
  const query = state.glossaryQuery.trim();
  els.glossarySearch.value = state.glossaryQuery;
  els.glossaryClear.hidden = !state.glossaryQuery;

  els.glossaryRanges.innerHTML = glossary.ranges
    .map((range) => `
      <button type="button" data-glossary-range="${escapeHtml(range)}" aria-pressed="${range === state.glossaryRange}">
        ${escapeHtml(range)}
      </button>
    `)
    .join("");

  els.glossaryGroups.innerHTML = glossary.ranges
    .map((range) => {
      const terms = filteredGlossaryTerms(range);
      if (!terms.length && query) return "";
      return `
        <section class="gl-group" id="range-${escapeHtml(range)}" ${range !== state.glossaryRange && !query ? "hidden" : ""}>
          <h2 class="gl-group-title">${escapeHtml(range)}</h2>
          ${
            terms.length
              ? `<div class="gl-term-list">${terms.map(renderGlossaryTerm).join("")}</div>`
              : `<p class="gl-empty">${uiHtml("ui.glossary.emptyRange")}</p>`
          }
        </section>
      `;
    })
    .join("") || `<p class="gl-empty">${uiHtml("ui.glossary.emptySearch")}</p>`;
  requestAnimationFrame(() => {
    updateGlossaryCarouselControls();
    scrollToGlossaryHash();
  });
}

function updateGlossaryCarouselControls(strip) {
  const strips = strip ? [strip] : [...els.glossaryGroups.querySelectorAll(".gl-match-strip")];
  strips.forEach((matchStrip) => {
    const scroller = matchStrip.querySelector(".gl-match-grid");
    const previous = matchStrip.querySelector('[data-glossary-scroll="-1"]');
    const next = matchStrip.querySelector('[data-glossary-scroll="1"]');
    if (!scroller || !previous || !next) return;

    const tolerance = 8;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const hasOverflow = maxScroll > tolerance;
    const atStart = scroller.scrollLeft <= tolerance;
    const atEnd = scroller.scrollLeft >= maxScroll - tolerance;

    matchStrip.classList.toggle("has-overflow", hasOverflow);
    matchStrip.classList.toggle("is-start", !hasOverflow || atStart);
    matchStrip.classList.toggle("is-end", !hasOverflow || atEnd);
    previous.hidden = !hasOverflow || atStart;
    next.hidden = !hasOverflow || atEnd;
  });
}

function renderGlossaryTerm(item) {
  const slug = glossarySlug(item.term);
  return `
    <article class="gl-term-entry" id="${escapeHtml(slug)}" data-glossary-term="${escapeHtml(slug)}">
      <div>
        <h3 class="gl-term-de">${escapeHtml(item.term)}</h3>
        <p class="gl-term-en">${escapeHtml(item.translation)}</p>
        <p class="gl-term-context">${escapeHtml(item.context)}</p>
      </div>
      <div class="gl-match-strip">
        <button class="gl-carousel-control is-prev" type="button" data-glossary-scroll="-1" aria-label="${uiHtml("ui.glossary.scrollLeft")}">
          ${icon("arrow-left")}
        </button>
        <div class="gl-match-grid">
          ${item.matches.slice(0, 8).map(renderGlossaryMatch).join("")}
        </div>
        <button class="gl-carousel-control is-next" type="button" data-glossary-scroll="1" aria-label="${uiHtml("ui.glossary.scrollRight")}">
          ${icon("arrow-right")}
        </button>
      </div>
    </article>
  `;
}

function renderGlossaryMatch(match) {
  return `
    <button class="gl-match-card" type="button" data-href="${questionPath(match.id)}" aria-label="${uiHtml("ui.glossary.openQuestion", { number: pad(match.id, 3) })}">
      <span class="gl-match-meta">
        <span class="gl-match-kind is-${escapeHtml(match.kind)}" aria-label="${escapeHtml(match.kind)}">
          ${icon(match.kind === "question" ? "help-circle" : "list-check")}
        </span>
        <span class="gl-match-away" aria-hidden="true">${icon("arrow-up-right")}</span>
      </span>
      <span class="gl-match-text">${escapeHtml(match.text)}</span>
    </button>
  `;
}

function render() {
  const glossaryActive = isGlossaryPath();
  renderChrome(glossaryActive);
  if (glossaryActive) {
    renderGlossary();
    saveState();
    return;
  }

  els.track.hidden = false;
  els.app.classList.remove("fit-tight", "fit-tighter");
  renderPanel();

  if (state.mode === "test" && !state.result) ensureTestSession();
  if (state.mode === "learn") buildLearnDeck(false);
  if (state.mode === "test" && !state.result) hydrateTestDeck();

  if (state.missingQuestionId) {
    els.resultView.hidden = true;
    els.card.hidden = true;
    els.cardNav.hidden = true;
    els.studyDock.hidden = true;
    els.emptyState.hidden = false;
    els.emptyState.innerHTML = `
      ${icon("alert-circle")}
      <div class="big">${uiHtml("ui.question.notFoundTitle", { id: state.missingQuestionId })}</div>
      <div>${uiHtml("ui.question.notFoundBody")}</div>
      <button class="btn btn-secondary" type="button" data-action="learn-all">${icon("book")} ${uiHtml("ui.question.backToLearn")}</button>
    `;
    saveState();
    fitLayout();
    return;
  }

  const card = currentCard();
  const total = state.deck.length;
  const isLearn = state.mode === "learn";
  const testAnswer = currentTestAnswer();
  const isAnswered = isLearn ? state.selected !== null : testAnswer !== null;
  const reveal = isLearn || (isAnswered && state.testImmediateFeedback);
  const showTranslations = isLearn || state.testTranslations;

  els.learnMode.setAttribute("aria-current", isLearn ? "page" : "false");
  els.testMode.setAttribute("aria-current", !isLearn ? "page" : "false");
  els.glossaryNav.setAttribute("aria-current", "false");
  els.filterButtonLabel.textContent = state.panelTab === "known" ? ui("ui.tab.mastered") : shortCategoryLabel(state.category);
  els.filterButton.setAttribute(
    "aria-label",
    ui(els.app.classList.contains("filters-open") ? "ui.aria.closeReviewPanel" : "ui.aria.openReviewPanel"),
  );
  els.filterButton.setAttribute("aria-expanded", String(els.app.classList.contains("filters-open")));
  syncDrawerAccessibility();
  els.resultView.hidden = !state.result;
  els.cardNav.hidden = Boolean(state.result);
  els.card.hidden = Boolean(state.result) || !card;
  els.emptyState.hidden = Boolean(state.result) || Boolean(card);
  els.studyDock.hidden = Boolean(state.result) || !reveal;
  syncStudyDockState();
  els.lockedHint.hidden = Boolean(state.result) || reveal || isAnswered;
  els.prevButton.disabled = Boolean(state.result) || state.index === 0;
  const progressValue = total ? Math.round(((state.index + 1) / total) * 100) : state.result ? state.result.percent : 0;
  els.progressFill.style.width = `${progressValue}%`;
  els.track.setAttribute("aria-valuenow", String(progressValue));
  els.track.setAttribute(
    "aria-valuetext",
    state.result
      ? ui("ui.progress.testScore", { percent: progressValue })
      : ui("ui.progress.questionCount", { current: state.index + 1, total: total || 0 }),
  );

  if (state.result) {
    renderResult();
    saveState();
    fitLayout();
    return;
  }

  renderNav(card, isLearn, isAnswered, total);

  if (!card) {
    saveState();
    fitLayout();
    return;
  }

  const selected = isLearn ? state.selected : testAnswer;
  const correctChosen = isAnswered && selected === correctAnswerIndex(card);
  const wrongChosen = isAnswered && selected !== correctAnswerIndex(card);

  els.questionTag.textContent = ui("ui.question.label", { number: pad(card.id, 3) });
  els.categoryLabel.textContent = categoryLabel(card.theme);
  els.knownTag.hidden = !state.known.has(card.id);
  els.feedback.hidden = !reveal || !(correctChosen || wrongChosen);
  els.feedback.innerHTML = correctChosen ? `${icon("circle-check")} ${uiHtml("ui.feedback.correct")}` : wrongChosen ? `${icon("x")} ${uiHtml("ui.feedback.wrong")}` : "";
  els.feedback.className = `bp-feedback ${correctChosen ? "correct" : wrongChosen ? "wrong" : ""}`;
  const firstIndex = isLearn ? firstAvailableLearnIndex() : 0;
  const lastIndex = isLearn ? lastAvailableLearnIndex() : total - 1;
  els.firstQuestionButton.hidden = !isLearn;
  els.firstQuestionButton.disabled = Boolean(state.result) || !total || firstIndex === -1 || state.index === firstIndex;
  els.progressText.innerHTML = `${pad(state.index + 1)}<span class="pct">/${pad(total)}</span>`;
  els.progressText.disabled = Boolean(state.result) || total <= 1;
  els.progressText.setAttribute("aria-label", ui("ui.aria.jumpToQuestionCurrent", { current: state.index + 1, total }));
  els.lastQuestionButton.hidden = !isLearn;
  els.lastQuestionButton.disabled = Boolean(state.result) || !total || lastIndex === -1 || state.index === lastIndex;
  els.questionText.innerHTML = highlightedText(card.question, card);
  const questionTranslation = t(card.translationKey);
  els.questionTranslation.textContent = questionTranslation;
  els.questionTranslation.hidden = !showTranslations || !questionTranslation;
  els.questionImageButton.hidden = !card.imageUrl;
  els.questionImage.classList.toggle("visible", Boolean(card.imageUrl));
  if (card.imageUrl) {
    els.questionImage.onload = fitLayout;
    els.questionImage.src = card.imageUrl;
    els.imageDialogImage.src = card.imageUrl;
  } else {
    els.questionImage.removeAttribute("src");
    els.imageDialogImage.removeAttribute("src");
  }

  const renderedAnswers = card.answers.map((answer, index) => ({ answer, index }));
  if (isLearn) {
    renderedAnswers.sort((left, right) => {
      if (left.index === correctAnswerIndex(card)) return -1;
      if (right.index === correctAnswerIndex(card)) return 1;
      return left.index - right.index;
    });
  }

  els.answers.innerHTML = renderedAnswers
    .map(({ answer, index }) => {
      const isCorrectAnswer = index === correctAnswerIndex(card);
      let className = "bp-answer";
      if (reveal) {
        if (isCorrectAnswer) className += " is-correct";
        else if (selected === index) className += " is-wrong";
        else className += " is-dim";
      } else if (!isLearn && isAnswered && selected === index) {
        className += " is-selected";
      }
      const mark = reveal && isCorrectAnswer ? icon("check") : reveal && selected === index ? icon("x") : "";
      const answerTranslation = showTranslations ? visibleAnswerTranslation(answer) : "";
      const checked = reveal ? (isLearn ? isCorrectAnswer : selected === index) : !isLearn && selected === index;
      return `
        <li>
          <button class="${className}" type="button" role="radio" aria-checked="${checked}" data-answer="${index}" ${isLearn || isAnswered ? "disabled" : ""}>
            <span class="text">
              ${highlightedAnswerText(answer.text, card)}
              ${answerTranslation ? `<span class="en">${escapeHtml(answerTranslation)}</span>` : ""}
            </span>
            <span class="mark">${mark}</span>
          </button>
        </li>
      `;
    })
    .join("");

  const note = t(card.study?.noteKey) || card.study?.note || "";
  const refs = glossaryRefs(card);
  els.hintText.innerHTML = note ? `${icon("sparkle-2", "hint-icon")} ${highlightedText(note, card)}` : "";
  els.hintText.hidden = !note;
  els.keywordList.hidden = !refs.length;
  els.keywordList.innerHTML = refs
    .map((ref) => {
      const term = ref.term || ref;
      const translationKey = ref.translationKey || `glossary.${term}`;
      return `
      <button class="kw-item" type="button" data-glossary-chip="${escapeHtml(glossarySlug(term))}" aria-label="${uiHtml("ui.glossary.openTerm", { term })}">
        <span class="de">${escapeHtml(term)}</span>
        <span class="en">${escapeHtml(t(translationKey))}</span>
      </button>
    `;
    })
    .join("");

  syncStudyDockState();
  if (isLearn && state.syncQuestionUrl) updateQuestionUrl(card.id);
  saveState();
  fitLayout();
  setTimeout(fitLayout, 250);
}

function renderNav(card, isLearn, isAnswered, total) {
  if (isLearn) {
    const isKnown = Boolean(card && state.known.has(card.id));
    const previousIndex = nextLearnIndex(-1);
    const nextIndex = nextLearnIndex(1);
    els.prevButton.innerHTML = `${icon("arrow-left", "arrow")} ${uiHtml("ui.nav.prev")}`;
    els.prevButton.setAttribute("aria-label", ui("ui.nav.previousQuestion"));
    els.prevButton.disabled = !card || previousIndex === state.index;
    els.middleButton.className = `known-btn ${isKnown ? "on" : ""}`;
    els.middleButton.disabled = !card;
    els.middleButton.setAttribute("aria-label", ui(isKnown ? "ui.mastered.remove" : "ui.mastered.mark"));
    els.middleButton.innerHTML = isKnown
      ? `${icon("star", "mastered-icon")} <span>${uiHtml("ui.tab.mastered")}</span>`
      : `${icon("star")} <span class="mastered-label-full">${uiHtml("ui.mastered.mark")}</span><span class="mastered-label-compact">${uiHtml("ui.tab.mastered")}</span>`;
    els.nextButton.disabled = !card || nextIndex === state.index;
    els.nextButton.setAttribute("aria-label", ui("ui.nav.nextQuestion"));
    els.nextButton.innerHTML = `${uiHtml("ui.nav.next")} ${icon("arrow-right", "arrow")}`;
    return;
  }

  const finalQuestion = state.index >= total - 1;
  els.prevButton.innerHTML = `${icon("arrow-left", "arrow")} ${uiHtml("ui.nav.prev")}`;
  els.prevButton.setAttribute("aria-label", ui("ui.nav.previousQuestion"));
  els.middleButton.className = "known-btn";
  els.middleButton.disabled = false;
  els.middleButton.setAttribute("aria-label", ui("ui.action.restartTest"));
  els.middleButton.innerHTML = `${icon("refresh")} ${uiHtml("ui.action.restart")}`;
  els.nextButton.disabled = !card || !isAnswered;
  els.nextButton.setAttribute("aria-label", ui(finalQuestion ? "ui.action.finishTest" : "ui.nav.nextQuestion"));
  els.nextButton.innerHTML = finalQuestion ? `${uiHtml("ui.action.finish")} ${icon("trophy")}` : `${uiHtml("ui.nav.next")} ${icon("arrow-right", "arrow")}`;
}

function animateMove(step) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.clearTimeout(slideTimer);
  els.app.classList.remove("slide-next", "slide-prev", "swipe-active", "swipe-dragging", "swipe-release");
  els.app.style.setProperty("--swipe-x", "0px");
  void els.app.offsetWidth;
  els.app.classList.add(step > 0 ? "slide-next" : "slide-prev");
  slideTimer = window.setTimeout(() => {
    els.app.classList.remove("slide-next", "slide-prev");
  }, MOTION_LONG_MS);
}

function animateModeChange() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.clearTimeout(modeTimer);
  els.app.classList.remove("mode-switch");
  void els.app.offsetWidth;
  els.app.classList.add("mode-switch");
  modeTimer = window.setTimeout(() => {
    els.app.classList.remove("mode-switch");
  }, MOTION_LONG_MS);
}

function animateAnswerReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.clearTimeout(answerTimer);
  els.app.classList.remove("answer-reveal");
  void els.app.offsetWidth;
  els.app.classList.add("answer-reveal");
  answerTimer = window.setTimeout(() => {
    els.app.classList.remove("answer-reveal");
  }, MOTION_LONG_MS);
}

function hideSnackbar() {
  window.clearTimeout(snackbarTimer);
  els.snackbar.hidden = true;
  els.snackbar.classList.remove("is-visible");
  els.snackbarAction.hidden = true;
  els.snackbarAction.textContent = "";
  knownUndo = null;
}

function showSnackbar(message, actionLabel = "") {
  window.clearTimeout(snackbarTimer);
  els.snackbarText.textContent = message;
  els.snackbarAction.textContent = actionLabel;
  els.snackbarAction.hidden = !actionLabel;
  els.snackbar.hidden = false;
  requestAnimationFrame(() => els.snackbar.classList.add("is-visible"));
  snackbarTimer = window.setTimeout(hideSnackbar, 5200);
}

function undoKnownMark() {
  if (!knownUndo) return;
  state.known.delete(knownUndo.id);
  state.index = knownUndo.index;
  if (state.mode === "learn") buildLearnDeck(false);
  hideSnackbar();
  render();
}

function jumpToIndex(index) {
  if (state.result || !state.deck.length) return;
  const nextIndex = Math.max(0, Math.min(state.deck.length - 1, index));
  if (nextIndex === state.index) return;
  const direction = nextIndex > state.index ? 1 : -1;
  state.index = nextIndex;
  state.linkedQuestionId = null;
  state.selected = null;
  if (state.testSession) state.testSession.index = state.index;
  render();
  animateMove(direction);
}

function jumpToLearnEdge(edge) {
  if (state.mode !== "learn") {
    jumpToIndex(edge === "first" ? 0 : state.deck.length - 1);
    return;
  }
  const target = edge === "first" ? firstAvailableLearnIndex() : lastAvailableLearnIndex();
  if (target !== -1) jumpToIndex(target);
}

function openJumpDialog() {
  if (state.result || !state.deck.length) return;
  els.jumpInput.max = String(questions.length);
  els.jumpInput.value = String(currentCard()?.id || state.index + 1);
  els.jumpDialog.hidden = false;
  els.progressText.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    els.jumpInput.focus();
    els.jumpInput.select();
  });
}

function closeJumpDialog() {
  if (els.jumpDialog.hidden) return;
  els.jumpDialog.hidden = true;
  els.progressText.setAttribute("aria-expanded", "false");
}

function submitJump() {
  const target = Number(els.jumpInput.value);
  if (!Number.isFinite(target)) return;
  closeJumpDialog();
  const current = currentCard();
  if (current && target === current.id) return;
  openQuestionLink(target);
}

function clampSwipeDistance(dx) {
  const max = Math.min(118, window.innerWidth * 0.32);
  const atStart = state.index === 0 && dx > 0;
  const atEnd = state.index >= state.deck.length - 1 && dx < 0;
  const resistance = atStart || atEnd ? 0.28 : 1;
  return Math.max(-max, Math.min(max, dx * resistance));
}

function releaseSwipe() {
  window.clearTimeout(swipeTimer);
  els.app.classList.remove("swipe-dragging");
  els.app.classList.add("swipe-release");
  els.app.style.setProperty("--swipe-x", "0px");
  swipeTimer = window.setTimeout(() => {
    els.app.classList.remove("swipe-active", "swipe-release");
  }, MOTION_MEDIUM_MS);
}

function commitSwipe(step) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    move(step);
    return;
  }
  window.clearTimeout(swipeTimer);
  els.app.classList.remove("swipe-dragging");
  els.app.classList.add("swipe-active", "swipe-release");
  els.app.style.setProperty("--swipe-x", `${step > 0 ? -window.innerWidth : window.innerWidth}px`);
  swipeTimer = window.setTimeout(() => {
    els.app.classList.remove("swipe-active", "swipe-release");
    els.app.style.setProperty("--swipe-x", "0px");
    move(step);
  }, MOTION_MEDIUM_MS);
}

function hasVerticalOverflow(element) {
  if (!element || element.hidden) return false;
  return element.scrollHeight > element.clientHeight + 1;
}

function collapsedStudyHeight() {
  return isMobileDrawer() ? 96 : 104;
}

function canToggleStudyDock() {
  if (els.studyDock.hidden) return false;
  const wasCollapsed = els.studyDock.classList.contains("is-collapsed");
  const wasStatic = els.studyDock.classList.contains("is-static");
  els.studyDock.classList.remove("is-collapsed", "is-static");
  const styles = window.getComputedStyle(els.studyDock);
  const padding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
  const toggleable = els.studyContent.scrollHeight + padding > collapsedStudyHeight() + 2;
  els.studyDock.classList.toggle("is-collapsed", wasCollapsed);
  els.studyDock.classList.toggle("is-static", wasStatic);
  return toggleable;
}

function syncStudyDockState() {
  if (els.studyDock.hidden) {
    els.studyDock.classList.remove("is-collapsed", "is-static");
    els.studyHandle.hidden = true;
    return;
  }

  const toggleable = canToggleStudyDock();
  els.studyDock.classList.toggle("is-static", !toggleable);
  els.studyDock.classList.toggle("is-collapsed", toggleable && !state.studyExpanded);
  els.studyHandle.hidden = !toggleable;
  els.studyHandle.disabled = !toggleable;
  els.studyHandle.setAttribute("aria-expanded", String(toggleable ? state.studyExpanded : true));
  const label = ui(state.studyExpanded ? "ui.study.collapse" : "ui.study.expand");
  els.studyHandle.setAttribute("aria-label", label);
  els.studyHandle.title = toggleable ? label : "";
}

function fitLayout() {
  requestAnimationFrame(() => {
    syncStudyDockState();
    els.app.classList.remove("fit-tight", "fit-tighter");

    const overflows = () =>
      hasVerticalOverflow(els.card) ||
      hasVerticalOverflow(els.studyDock) ||
      document.documentElement.scrollHeight > window.innerHeight + 1 ||
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

    if (!overflows()) return;
    els.app.classList.add("fit-tight");

    requestAnimationFrame(() => {
      syncStudyDockState();
      if (!overflows()) return;
      els.app.classList.add("fit-tighter");
    });
  });
}

function setMode(mode) {
  if (isGlossaryPath()) window.history.pushState({}, "", "/");
  if (mode === state.mode && !state.result) {
    render();
    return;
  }
  rememberCurrentProgress();
  state.mode = mode;
  state.result = null;
  state.missingQuestionId = null;
  state.selected = null;
  if (mode === "learn") {
    state.index = state.learnIndex || 0;
    buildLearnDeck(false);
  } else {
    ensureTestSession();
  }
  render();
  animateModeChange();
}

function move(step) {
  if (state.result || !state.deck.length) return;
  if (state.mode === "test" && step > 0 && currentTestAnswer() === null) return;
  const nextIndex = state.mode === "learn"
    ? nextLearnIndex(step)
    : Math.max(0, Math.min(state.deck.length - 1, state.index + step));
  if (nextIndex === state.index) return;
  state.index = nextIndex;
  state.linkedQuestionId = null;
  state.selected = null;
  rememberCurrentProgress();
  render();
  animateMove(step);
}

function pickAnswer(index) {
  if (state.mode === "learn" || state.result || currentTestAnswer() !== null) return;
  const card = currentCard();
  if (!card || !state.testSession) return;
  state.testSession.answers[String(card.id)] = index;
  render();
  animateAnswerReveal();
}

function toggleKnown() {
  if (state.mode !== "learn") {
    startTest(state.category);
    return;
  }
  const card = currentCard();
  if (!card) return;
  if (state.known.has(card.id)) {
    state.known.delete(card.id);
    hideSnackbar();
  } else {
    knownUndo = { id: card.id, index: state.index };
    state.known.add(card.id);
    const nextIndex = nextLearnIndex(1);
    state.index = nextIndex === state.index ? nextLearnIndex(-1) : nextIndex;
    showSnackbar(ui("ui.snackbar.markedMastered"), ui("ui.action.undo"));
  }
  buildLearnDeck(false);
  render();
}

function removeKnown(id) {
  state.known.delete(Number(id));
  hideSnackbar();
  if (state.mode === "learn") buildLearnDeck(false);
  render();
}

function openQuestionLink(id) {
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId <= 0) return;
  window.history.pushState({}, "", questionPath(questionId));
  applyQuestionLinkFromUrl();
  if (isMobileDrawer()) closeReviewPanel(false);
  render();
}

function setTestSize(value) {
  const max = Math.max(1, availableQuestions().length || questions.length || DEFAULT_TEST_SIZE);
  const parsed = Number(value);
  const nextSize = Math.max(1, Math.min(max, Number.isInteger(parsed) ? parsed : DEFAULT_TEST_SIZE));
  localStorage.setItem("lid-test-size", String(nextSize));
  if (state.mode === "test") {
    state.result = null;
    state.testSession = newTestSession(state.category);
    state.index = 0;
    hydrateTestDeck();
  }
  render();
}

function setTestTranslations(showTranslations) {
  state.testTranslations = Boolean(showTranslations);
  render();
}

function setTestImmediateFeedback(showFeedback) {
  state.testImmediateFeedback = Boolean(showFeedback);
  render();
}

function finishTest() {
  state.result = {
    ...scoreFor(),
    showTranslations: state.testTranslations,
  };
  state.testSession = null;
  state.deck = [];
  state.index = 0;
  render();
  els.resultView.focus({ preventScroll: true });
}

function changeCategory(category) {
  if (state.category === category) return;
  if (state.mode === "test" && hasAnsweredTestQuestions()) {
    const proceed = window.confirm(ui("ui.confirm.changeFilterRestartsTest"));
    if (!proceed) return;
  }
  state.category = category;
  state.index = 0;
  state.learnIndex = 0;
  state.linkedQuestionId = null;
  state.missingQuestionId = null;
  state.selected = null;
  state.result = null;
  if (state.mode === "test") state.testSession = newTestSession(category);
  if (isMobileDrawer()) closeReviewPanel(false);
  render();
}

function isMobileDrawer() {
  return window.innerWidth < 840;
}

function focusableDrawerElements() {
  return [...els.filterBar.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.offsetParent !== null);
}

function modalSiblings() {
  return [els.top, els.track, els.card, els.emptyState, els.resultView, els.studyDock, els.cardNav].filter(Boolean);
}

function setSurfaceInert(isInert) {
  modalSiblings().forEach((element) => {
    element.toggleAttribute("inert", isInert);
    if (isInert) element.setAttribute("aria-hidden", "true");
    else element.removeAttribute("aria-hidden");
  });
}

function syncDrawerAccessibility() {
  const modal = els.app.classList.contains("filters-open") && isMobileDrawer();
  els.filterBar.setAttribute("aria-hidden", String(!els.app.classList.contains("filters-open")));
  if (modal) {
    els.filterBar.setAttribute("role", "dialog");
    els.filterBar.setAttribute("aria-modal", "true");
    setSurfaceInert(true);
  } else {
    els.filterBar.removeAttribute("role");
    els.filterBar.removeAttribute("aria-modal");
    setSurfaceInert(false);
  }
}

function openReviewPanel() {
  drawerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : els.filterButton;
  els.app.classList.add("filters-open");
  els.filterButton.setAttribute("aria-expanded", "true");
  syncDrawerAccessibility();
  if (isMobileDrawer()) {
    requestAnimationFrame(() => {
      const selectedTab = els.filterBar.querySelector('[role="tab"][aria-selected="true"]');
      (selectedTab || els.filterBar).focus();
    });
  }
}

function closeReviewPanel(restoreFocus = true) {
  els.app.classList.remove("filters-open");
  els.filterButton.setAttribute("aria-expanded", "false");
  syncDrawerAccessibility();
  if (restoreFocus && drawerReturnFocus instanceof HTMLElement) drawerReturnFocus.focus();
  drawerReturnFocus = null;
}

function bindEvents() {
  els.learnMode.addEventListener("click", () => setMode("learn"));
  els.testMode.addEventListener("click", () => setMode("test"));
  els.glossaryNav.addEventListener("click", (event) => {
    event.preventDefault();
    rememberCurrentProgress();
    window.history.pushState({}, "", "/glossary");
    render();
  });
  els.glossarySearch.addEventListener("input", () => {
    if (window.location.hash) window.history.replaceState({}, "", "/glossary");
    state.glossaryQuery = els.glossarySearch.value;
    renderGlossary();
  });
  els.glossaryClear.addEventListener("click", () => {
    if (window.location.hash) window.history.replaceState({}, "", "/glossary");
    state.glossaryQuery = "";
    els.glossarySearch.focus();
    renderGlossary();
  });
  els.glossaryRanges.addEventListener("click", (event) => {
    const button = event.target.closest("[data-glossary-range]");
    if (!button) return;
    if (window.location.hash) window.history.replaceState({}, "", "/glossary");
    state.glossaryRange = button.dataset.glossaryRange;
    state.glossaryQuery = "";
    renderGlossary();
    els.glossaryGroups.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  els.glossaryGroups.addEventListener("click", (event) => {
    const control = event.target.closest("[data-glossary-scroll]");
    if (control) {
      event.preventDefault();
      const scroller = control.closest(".gl-match-strip")?.querySelector(".gl-match-grid");
      if (!scroller) return;
      const direction = Number(control.dataset.glossaryScroll || 1);
      scroller.scrollBy({
        left: direction * Math.max(280, scroller.clientWidth * 0.82),
        behavior: "smooth",
      });
      requestAnimationFrame(() => updateGlossaryCarouselControls(control.closest(".gl-match-strip")));
      return;
    }

    const card = event.target.closest("[data-href]");
    if (!card) return;
    event.preventDefault();
    window.history.pushState({}, "", card.dataset.href);
    applyQuestionLinkFromUrl();
    render();
  });
  els.glossaryGroups.addEventListener("scroll", (event) => {
    const scroller = event.target.closest?.(".gl-match-grid");
    if (!scroller) return;
    updateGlossaryCarouselControls(scroller.closest(".gl-match-strip"));
  }, true);
  els.filtersTab.addEventListener("click", () => setPanelTab("filters"));
  els.knownTab.addEventListener("click", () => setPanelTab("known"));
  els.testConfigTab.addEventListener("click", () => setPanelTab("test"));
  [els.filtersTab, els.knownTab, els.testConfigTab].forEach((tab) => tab.addEventListener("keydown", movePanelTab));
  els.testSizeMinus.addEventListener("click", () => setTestSize(configuredTestSize() - 1));
  els.testSizePlus.addEventListener("click", () => setTestSize(configuredTestSize() + 1));
  els.testSizeInput.addEventListener("change", () => setTestSize(Number(els.testSizeInput.value)));
  els.testSizeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    setTestSize(Number(els.testSizeInput.value));
    els.testSizeInput.blur();
  });
  els.testTranslationsToggle.addEventListener("change", () => setTestTranslations(els.testTranslationsToggle.checked));
  els.testImmediateFeedbackToggle.addEventListener("change", () => setTestImmediateFeedback(els.testImmediateFeedbackToggle.checked));
  els.languageSelect?.addEventListener("change", async () => {
    const nextLocale = SUPPORTED_LOCALES.has(els.languageSelect.value) ? els.languageSelect.value : DEFAULT_LOCALE;
    localStorage.setItem("lid-locale", nextLocale);
    await loadMessages(nextLocale);
    applyStaticTranslations();
    render();
  });
  els.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.theme = button.dataset.themeChoice;
      state.themeExplicit = true;
      applyTheme();
      saveState();
      renderTestConfigPanel();
    });
  });
  els.filterButton.addEventListener("click", () => {
    if (els.app.classList.contains("filters-open")) closeReviewPanel();
    else openReviewPanel();
  });
  window.addEventListener("keydown", (event) => {
    if (!els.app.classList.contains("filters-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeReviewPanel();
      return;
    }
    if (event.key !== "Tab" || !isMobileDrawer()) return;
    const focusable = focusableDrawerElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  els.app.addEventListener("click", (event) => {
    if (!isMobileDrawer()) return;
    if (!els.app.classList.contains("filters-open")) return;
    if (event.target.closest("#filterBar") || event.target.closest("#filterButton")) return;
    closeReviewPanel();
  });
  els.prevButton.addEventListener("click", () => move(-1));
  els.nextButton.addEventListener("click", () => {
    if (state.mode === "test" && state.index >= state.deck.length - 1 && currentTestAnswer() !== null) {
      finishTest();
      return;
    }
    move(1);
  });
  els.middleButton.addEventListener("click", toggleKnown);
  els.snackbarAction.addEventListener("click", undoKnownMark);
  els.questionImageButton.addEventListener("click", openImageDialog);
  els.imageDialogClose.addEventListener("click", closeImageDialog);
  els.imageDialog.addEventListener("click", (event) => {
    if (event.target === els.imageDialog) closeImageDialog();
  });
  els.studyHandle.addEventListener("click", () => {
    if (els.studyHandle.hidden || els.studyHandle.disabled) return;
    state.studyExpanded = !state.studyExpanded;
    render();
  });
  els.studyDock.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.studyExpanded || els.studyHandle.hidden) return;
    event.preventDefault();
    state.studyExpanded = false;
    render();
    els.studyHandle.focus();
  });
  els.keywordList.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-glossary-chip]");
    if (!chip) return;
    rememberCurrentProgress();
    window.history.pushState({}, "", `/glossary#${encodeURIComponent(chip.dataset.glossaryChip)}`);
    render();
  });
  els.categoryPills.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    changeCategory(button.dataset.category);
  });
  els.knownList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-known]");
    if (button) {
      removeKnown(button.dataset.removeKnown);
      return;
    }

    const link = event.target.closest("[data-question-link]");
    if (!link) return;
    event.preventDefault();
    openQuestionLink(link.dataset.questionLink);
  });
  els.answers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-answer]");
    if (!button) return;
    pickAnswer(Number(button.dataset.answer));
  });
  els.firstQuestionButton.addEventListener("click", () => jumpToLearnEdge("first"));
  els.lastQuestionButton.addEventListener("click", () => jumpToLearnEdge("last"));
  els.progressText.addEventListener("click", () => {
    if (els.jumpDialog.hidden) openJumpDialog();
    else closeJumpDialog();
  });
  document.addEventListener("pointerdown", (event) => {
    if (els.jumpDialog.hidden) return;
    if (event.target.closest("#jumpDialog") || event.target.closest("#progressText")) return;
    closeJumpDialog();
  });
  els.jumpDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    submitJump();
  });
  els.resultView.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "restart-test") startTest(state.category);
    if (action === "learn-mode") setMode("learn");
  });
  els.emptyState.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action !== "learn-all") return;
    state.mode = "learn";
    state.category = ALL_CATS;
    state.index = 0;
    state.learnIndex = 0;
    state.linkedQuestionId = null;
    state.missingQuestionId = null;
    state.syncQuestionUrl = true;
    state.result = null;
    buildLearnDeck(true);
    updateQuestionUrl(currentCard()?.id || 1, "push");
    render();
  });
  els.app.addEventListener("pointerdown", (event) => {
    if (!isMobileDrawer() || els.app.classList.contains("filters-open") || state.result) return;
    if (event.pointerType === "mouse") return;
    if (event.target.closest(".bp-top, .bp-nav, #filterBar")) return;
    window.clearTimeout(swipeTimer);
    els.app.classList.remove("swipe-active", "swipe-dragging", "swipe-release");
    els.app.style.setProperty("--swipe-x", "0px");
    swipeStart = { x: event.clientX, y: event.clientY, dragging: false };
  });
  els.app.addEventListener("pointermove", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    if (!swipeStart.dragging) {
      if (Math.abs(dx) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) {
        swipeStart = null;
        return;
      }
      swipeStart.dragging = true;
      els.app.classList.add("swipe-active", "swipe-dragging");
    }
    if (event.cancelable) event.preventDefault();
    els.app.style.setProperty("--swipe-x", `${clampSwipeDistance(dx)}px`);
  });
  els.app.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    const wasDragging = swipeStart.dragging;
    swipeStart = null;
    if (!wasDragging || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) {
      releaseSwipe();
      return;
    }
    const step = dx < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(state.deck.length - 1, state.index + step));
    if (nextIndex === state.index || (state.mode === "test" && step > 0 && currentTestAnswer() === null)) {
      releaseSwipe();
      return;
    }
    commitSwipe(step);
  });
  els.app.addEventListener("pointercancel", () => {
    swipeStart = null;
    releaseSwipe();
  });
  window.addEventListener("keydown", (event) => {
    if (!els.jumpDialog.hidden && event.key === "Escape") {
      event.preventDefault();
      closeJumpDialog();
      els.progressText.focus();
      return;
    }
    if (event.defaultPrevented || !els.jumpDialog.hidden || els.imageDialog.open) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key === "Home") {
      event.preventDefault();
      jumpToLearnEdge("first");
    } else if (event.key === "End") {
      event.preventDefault();
      jumpToLearnEdge("last");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (state.mode === "test" && state.index >= state.deck.length - 1 && currentTestAnswer() !== null) finishTest();
      else move(1);
    } else if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      if (state.mode === "learn") toggleKnown();
    } else if (event.key === "l" || event.key === "L") {
      event.preventDefault();
      setMode("learn");
    } else if (event.key === "t" || event.key === "T") {
      event.preventDefault();
      setMode("test");
    } else if (["1", "2", "3", "4"].includes(event.key)) {
      event.preventDefault();
      pickAnswer(Number(event.key) - 1);
    }
  });
  window.addEventListener("resize", () => {
    syncStudyDockState();
    fitLayout();
    if (isGlossaryPath()) updateGlossaryCarouselControls();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") applyTheme();
  });
  window.addEventListener("popstate", () => {
    if (isGlossaryPath()) {
      render();
      return;
    }
    if (!applyQuestionLinkFromUrl()) state.syncQuestionUrl = false;
    render();
  });
  window.addEventListener("hashchange", () => {
    if (!isGlossaryPath()) return;
    syncGlossaryHashState();
    renderGlossary();
  });
}

function openImageDialog() {
  if (!els.imageDialogImage.getAttribute("src")) return;
  if (els.imageDialog.open) return;
  els.imageDialog.showModal();
  els.imageDialogClose.focus();
}

function closeImageDialog() {
  if (!els.imageDialog.open) return;
  els.imageDialog.close();
  els.questionImageButton.focus();
}

function applyQuestionLinkFromUrl() {
  const linkedId = questionLinkIdFromPath();
  if (!linkedId) return false;

  state.mode = "learn";
  state.category = ALL_CATS;
  state.result = null;
  state.selected = null;
  state.missingQuestionId = null;
  state.syncQuestionUrl = true;

  if (!questionById.has(linkedId)) {
    state.linkedQuestionId = null;
    state.missingQuestionId = linkedId;
    state.syncQuestionUrl = false;
    state.deck = [];
    state.index = 0;
    state.learnIndex = 0;
    return true;
  }

  state.linkedQuestionId = linkedId;
  buildLearnDeck(false);
  const index = indexForQuestionId(linkedId);
  state.index = index === -1 ? 0 : index;
  state.learnIndex = state.index;
  return true;
}

async function init() {
  await loadMessages(requestedLocale());
  applyStaticTranslations();

  const saved = loadSavedState();
  state.mode = saved.mode === "test" ? "test" : "learn";
  state.category = saved.category || ALL_CATS;
  state.known = new Set(saved.known || []);
  state.index = saved.index || 0;
  state.learnIndex = Number.isInteger(saved.learnIndex) ? saved.learnIndex : state.mode === "learn" ? state.index : 0;
  state.panelTab = ["known", "test"].includes(saved.panelTab) ? saved.panelTab : "filters";
  state.testSession = saved.testSession || null;
  state.theme = ["system", "light", "dark"].includes(saved.theme) ? saved.theme : "system";
  state.themeExplicit = ["system", "light", "dark"].includes(saved.theme);
  state.testTranslations = saved.testTranslations === true;
  state.testImmediateFeedback = saved.testImmediateFeedback !== false;
  applyTheme();

  const response = await fetch("/data/lid-berlin-source-of-truth.json", { cache: "no-store" });
  if (!response.ok) throw new Error(ui("ui.error.loadDatabase", { status: response.status }));
  const database = await response.json();
  const metadataResponse = await fetch("/data/lid-berlin-question-metadata.json", { cache: "no-store" });
  if (!metadataResponse.ok) throw new Error(ui("ui.error.loadDatabase", { status: metadataResponse.status }));
  const metadata = await metadataResponse.json();
  const metadataById = new Map((metadata.questions || []).map((question) => [question.id, question]));
  const glossaryKeyByTerm = new Map((metadata.glossary || []).map((entry) => [entry.term, entry.translationKey]));
  const glossaryResponse = await fetch("/data/glossary.json", { cache: "no-store" });
  if (!glossaryResponse.ok) throw new Error(ui("ui.error.loadDatabase", { status: glossaryResponse.status }));
  glossary = await glossaryResponse.json();
  const sourceQuestions = normalizeSourceQuestions(database);
  questions = sourceQuestions.map((question) => {
    const meta = metadataById.get(question.id) || {};
    const answerMetaByIndex = new Map((meta.answers || []).map((answer) => [answer.index, answer]));
    const answerIndex = correctAnswerIndex(question);
    return {
      ...question,
      correctAnswerIndex: answerIndex,
      deck: meta.deck || (question.id > 300 ? "berlin" : "general"),
      theme: meta.theme || "",
      translationKey: meta.translationKey || `questions.${question.id}.question`,
      study: meta.study || {},
      glossaryRefs: (meta.glossaryRefs || []).map((term) => ({
        term,
        translationKey: glossaryKeyByTerm.get(term) || `glossary.${term}`,
      })),
      answers: question.answers.map((answer) => {
        const answerMeta = answerMetaByIndex.get(answer.index) || {};
        return {
          ...answer,
          isCorrect: answer.index === answerIndex,
          translationKey: answerMeta.translationKey || `questions.${question.id}.answers.${answer.index}`,
        };
      }),
    };
  });
  questionById = new Map(questions.map((question) => [question.id, question]));
  categories = [ALL_CATS, ...new Set(questions.map((question) => question.theme))];
  if (!categories.includes(state.category)) state.category = ALL_CATS;

  bindEvents();
  const hasQuestionLink = applyQuestionLinkFromUrl();
  if (!hasQuestionLink && state.mode === "test") ensureTestSession();
  else buildLearnDeck(false);
  render();
  els.app.classList.remove("is-loading");
  els.card.setAttribute("aria-busy", "false");
}

init().catch((error) => {
  els.app.classList.remove("is-loading");
  els.questionText.textContent = error.message;
  els.card.removeAttribute("aria-busy");
});
