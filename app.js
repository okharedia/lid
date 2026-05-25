const STORAGE_KEY = "lid-trainer-v7";
const OLD_STORAGE_KEY = "lid-trainer-v6";
const ALL_CATS = "Alle Kategorien";
const DEFAULT_TEST_SIZE = 3;
const PASS_SCORE = 90;
const MOTION_MEDIUM_MS = 180;
const MOTION_LONG_MS = 240;

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

const state = {
  mode: "learn",
  category: ALL_CATS,
  known: new Set(),
  index: 0,
  learnIndex: 0,
  selected: null,
  deck: [],
  panelTab: "filters",
  testSession: null,
  result: null,
  studyExpanded: true,
  theme: "system",
  themeExplicit: false,
  testTranslations: true,
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
  knownCount: document.querySelector("#knownCount"),
  progressText: document.querySelector("#progressText"),
  jumpDialog: document.querySelector("#jumpDialog"),
  jumpInput: document.querySelector("#jumpInput"),
  jumpClose: document.querySelector("#jumpClose"),
  questionText: document.querySelector("#questionText"),
  questionTranslation: document.querySelector("#questionTranslation"),
  questionImage: document.querySelector("#questionImage"),
  questionChips: document.querySelector("#questionChips"),
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

function keywordRefs(card) {
  return card.study?.keywordRefs || [];
}

function highlightTerms(card) {
  return [
    ...(card.study?.highlightTerms || []),
    ...(card.questionDangerWords || []),
  ].filter(Boolean);
}

function dangerTerms(card) {
  return new Set(card.study?.dangerTerms || card.questionDangerWords || []);
}

function highlightedText(text, card) {
  const terms = highlightTerms(card);
  if (!terms.length) return escapeHtml(text);

  const sortedTerms = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const danger = dangerTerms(card);
  const expression = new RegExp(`(${sortedTerms.map(escapeRegExp).join("|")})`, "gi");

  return escapeHtml(text).replace(expression, (match) => {
    const original = sortedTerms.find((term) => term.toLowerCase() === match.toLowerCase());
    const className = danger.has(original) ? "kw danger" : "kw";
    return `<span class="${className}">${match}</span>`;
  });
}

function highlightedAnswerText(answer, card, isCorrectAnswer, reveal) {
  return reveal && isCorrectAnswer ? highlightedText(answer, card) : escapeHtml(answer);
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function shortCategoryLabel(category) {
  return category === ALL_CATS ? "All" : category;
}

function baseFilteredQuestions(category = state.category) {
  if (category === ALL_CATS) return questions;
  return questions.filter((question) => question.theme === category);
}

function availableQuestions(category = state.category) {
  return baseFilteredQuestions(category).filter((question) => !state.known.has(question.id));
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
  state.deck = availableQuestions();
  if (resetIndex) state.index = 0;
  else if (state.index >= state.deck.length) state.index = Math.max(0, state.deck.length - 1);
  state.learnIndex = state.index;
  state.selected = null;
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
    if (selected === question.correctIndex) {
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
      const available = availableQuestions(category).length;
      const label = isAll ? "All" : category;
      const selected = category === state.category;
      return `
        <button class="cat-pill" type="button" data-category="${escapeHtml(category)}" aria-pressed="${selected}">
          <span class="cat-check" aria-hidden="true">${icon("check")}</span>
          <span class="cat-copy">
            <span class="de">${escapeHtml(label)}</span>
            <span class="en">${available}/${total} available</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderKnownPanel() {
  const knownQuestions = questions.filter((question) => state.known.has(question.id));
  els.knownSummary.innerHTML = `
    <span>${knownQuestions.length} mastered</span>
    <span>${questions.length - knownQuestions.length}/${questions.length} available</span>
  `;
  els.knownList.innerHTML = knownQuestions.length
    ? knownQuestions
        .map((question) => `
          <article class="known-item">
            <div>
              <span class="known-meta">FRAGE ${pad(question.localNumber || question.id, 3)} · ${escapeHtml(question.theme)}</span>
              <p>${escapeHtml(question.question)}</p>
            </div>
            <button type="button" data-remove-known="${question.id}" aria-label="Remove mastered mark">
              ${icon("trash")}
            </button>
          </article>
        `)
        .join("")
    : `<div class="known-empty">${icon("book")}<strong>No mastered cards yet</strong><span>Mark questions as mastered when they feel easy.</span></div>`;
}

function renderTestConfigPanel() {
  const value = configuredTestSize();
  const max = Math.max(1, availableQuestions().length || questions.length || value);
  els.testSizeInput.max = String(max);
  els.testSizeInput.value = String(value);
  els.testSizeMinus.disabled = value <= 1;
  els.testSizePlus.disabled = value >= max;
  els.testSizeMeta.textContent = `Test length: ${Math.min(value, max)} question${Math.min(value, max) === 1 ? "" : "s"}`;
  els.testTranslationsToggle.checked = state.testTranslations;
  els.themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === state.theme));
  });
}

function renderPanel() {
  const isKnownTab = state.panelTab === "known";
  const isTestConfigTab = state.panelTab === "test";
  els.knownTab.setAttribute("aria-label", `Mastered questions, ${state.known.size} marked`);
  els.testConfigTab.setAttribute("aria-label", `Config, theme ${state.theme}`);
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
      <p class="result-kicker">${passed ? "Passed" : "Keep practicing"}</p>
      <h1>${percent}%</h1>
      <div class="result-stats" aria-label="Test score">
        <span><strong>${correct}</strong><small>Correct</small></span>
        <span><strong>${total - correct}</strong><small>Missed</small></span>
        <span><strong>${total}</strong><small>Total</small></span>
      </div>
      <p>${escapeHtml(shortCategoryLabel(state.category))}</p>
    </div>
    <div class="result-actions">
      <button class="btn btn-secondary" type="button" data-action="restart-test">${icon("refresh")} Try again</button>
      <button class="btn btn-tertiary" type="button" data-action="learn-mode">${icon("arrow-back-up")} Study mode</button>
    </div>
    <section class="missed-review">
      <h2>${missed.length ? "Review misses" : "Clean run"}</h2>
      ${
        missed.length
          ? missed
              .map(({ question, selected }) => {
                const selectedAnswerObject = selected === null || selected === undefined
                  ? null
                  : question.answers[selected];
                const correctAnswerObject = question.answers[question.correctIndex];
                const selectedAnswer = selectedAnswerObject === null
                  ? "No answer"
                  : selectedAnswerObject?.text || "No answer";
                const correctAnswer = correctAnswerObject?.text || question.correctAnswer;
                const questionTranslation = showTranslations ? t(question.translationKey) : "";
                const selectedTranslation = showTranslations && selectedAnswerObject ? t(selectedAnswerObject.translationKey) : "";
                const correctTranslation = showTranslations && correctAnswerObject ? t(correctAnswerObject.translationKey) : "";
                return `
                  <article class="missed-item">
                    <span>FRAGE ${pad(question.localNumber || question.id, 3)}</span>
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
                    ${showTranslations && question.answerVariants ? `<p class="variant-note">${escapeHtml(t(question.answerVariants.noteKey))}</p>` : ""}
                  </article>
                `;
              })
              .join("")
          : `<p class="result-note">No wrong answers to review.</p>`
      }
    </section>
  `;
}

function render() {
  els.app.classList.remove("fit-tight", "fit-tighter");
  renderPanel();

  if (state.mode === "test" && !state.result) ensureTestSession();
  if (state.mode === "learn") buildLearnDeck(false);
  if (state.mode === "test" && !state.result) hydrateTestDeck();

  const card = currentCard();
  const total = state.deck.length;
  const isLearn = state.mode === "learn";
  const testAnswer = currentTestAnswer();
  const isAnswered = isLearn ? state.selected !== null : testAnswer !== null;
  const reveal = isLearn || isAnswered;
  const showTranslations = isLearn || state.testTranslations;
  const knownCount = state.known.size;

  els.learnMode.setAttribute("aria-pressed", String(isLearn));
  els.testMode.setAttribute("aria-pressed", String(!isLearn));
  els.filterButtonLabel.textContent = state.panelTab === "known" ? "Mastered" : shortCategoryLabel(state.category);
  els.filterButton.setAttribute("aria-label", `${els.app.classList.contains("filters-open") ? "Close" : "Open"} review panel`);
  els.filterButton.setAttribute("aria-expanded", String(els.app.classList.contains("filters-open")));
  syncDrawerAccessibility();
  els.resultView.hidden = !state.result;
  els.cardNav.hidden = Boolean(state.result);
  els.card.hidden = Boolean(state.result) || !card;
  els.emptyState.hidden = Boolean(state.result) || Boolean(card);
  els.studyDock.hidden = Boolean(state.result) || !reveal;
  syncStudyDockState();
  els.lockedHint.hidden = Boolean(state.result) || reveal;
  els.prevButton.disabled = Boolean(state.result) || state.index === 0;
  const progressValue = total ? Math.round(((state.index + 1) / total) * 100) : state.result ? state.result.percent : 0;
  els.progressFill.style.width = `${progressValue}%`;
  els.track.setAttribute("aria-valuenow", String(progressValue));
  els.track.setAttribute("aria-valuetext", state.result ? `${progressValue}% test score` : `${state.index + 1} of ${total || 0} questions`);

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
  const correctChosen = isAnswered && selected === card.correctIndex;
  const wrongChosen = isAnswered && selected !== card.correctIndex;

  els.questionTag.textContent = `${isLearn ? "FRAGE" : "TEST"} ${pad(card.localNumber || card.id, 3)}`;
  els.categoryLabel.textContent = card.theme;
  els.knownTag.hidden = !state.known.has(card.id);
  els.feedback.hidden = !(correctChosen || wrongChosen);
  els.feedback.innerHTML = correctChosen ? `${icon("circle-check")} Richtig` : wrongChosen ? `${icon("x")} Falsch` : "";
  els.feedback.className = `bp-feedback ${correctChosen ? "correct" : wrongChosen ? "wrong" : ""}`;
  els.knownCount.hidden = Boolean(correctChosen || wrongChosen || !knownCount);
  els.knownCount.innerHTML = `${icon("star", "mastered-icon")} ${knownCount}`;
  els.progressText.innerHTML = `${pad(state.index + 1)}<span class="pct">/${pad(total)}</span>`;
  els.progressText.disabled = Boolean(state.result) || total <= 1;
  els.progressText.setAttribute("aria-label", `Jump to question, currently ${state.index + 1} of ${total}`);
  els.questionText.innerHTML = highlightedText(card.question, card);
  const questionTranslation = t(card.translationKey);
  els.questionTranslation.textContent = questionTranslation;
  els.questionTranslation.hidden = !showTranslations || !questionTranslation;
  els.questionImage.classList.toggle("visible", Boolean(card.imageUrl));
  if (card.imageUrl) {
    els.questionImage.onload = fitLayout;
    els.questionImage.src = card.imageUrl;
  } else {
    els.questionImage.removeAttribute("src");
  }

  renderQuestionChips(card);

  const renderedAnswers = card.answers.map((answer, index) => ({ answer, index }));
  if (isLearn) {
    renderedAnswers.sort((left, right) => {
      if (left.index === card.correctIndex) return -1;
      if (right.index === card.correctIndex) return 1;
      return left.index - right.index;
    });
  }

  els.answers.innerHTML = renderedAnswers
    .map(({ answer, index }) => {
      const isCorrectAnswer = index === card.correctIndex;
      let className = "bp-answer";
      if (reveal) {
        if (isCorrectAnswer) className += " is-correct";
        else if (selected === index) className += " is-wrong";
        else className += " is-dim";
      }
      const mark = reveal && isCorrectAnswer ? icon("check") : reveal && selected === index ? icon("x") : "";
      const answerTranslation = showTranslations ? t(answer.translationKey) : "";
      const why = reveal ? t(answer.whyKey) : "";
      const checked = reveal && (isLearn ? isCorrectAnswer : selected === index);
      return `
        <li>
          <button class="${className}" type="button" role="radio" aria-checked="${checked}" data-answer="${index}" ${isLearn || isAnswered ? "disabled" : ""}>
            <span class="text">
              ${highlightedAnswerText(answer.text, card, isCorrectAnswer, reveal)}
              ${answerTranslation ? `<span class="en">${escapeHtml(answerTranslation)}</span>` : ""}
              ${why ? `<span class="why">${icon("sparkle-2", "why-icon")}<span>${escapeHtml(why)}</span></span>` : ""}
            </span>
            <span class="mark">${mark}</span>
          </button>
        </li>
      `;
    })
    .join("");

  const hint = t(card.study?.hintKey) || t(card.study?.memoryKey);
  const keywords = keywordRefs(card);
  els.hintText.innerHTML = `${icon("sparkle-2", "hint-icon")} ${highlightedText(hint, card)}`;
  els.keywordList.hidden = !keywords.length;
  els.keywordList.innerHTML = keywords
    .map((keyword) => `
      <span class="kw-item">
        <span class="de">${escapeHtml(keyword.term)}</span>
        <span class="en">${escapeHtml(t(keyword.translationKey))}</span>
      </span>
    `)
    .join("");

  syncStudyDockState();
  saveState();
  fitLayout();
  setTimeout(fitLayout, 250);
}

function renderQuestionChips(card) {
  const chips = [];
  if (card.duplicateOfId) {
    const original = questionById.get(card.duplicateOfId);
    if (original) {
      chips.push(`
        <span class="bp-chip duplicate-chip" title="Same as earlier question">
          ${icon("repeat")} <span>Seen before: FRAGE ${pad(original.localNumber || original.id, 3)}</span>
        </span>
      `);
    }
  }
  els.questionChips.innerHTML = chips.join("");
  els.questionChips.hidden = !chips.length;
}

function renderNav(card, isLearn, isAnswered, total) {
  if (isLearn) {
    const isKnown = Boolean(card && state.known.has(card.id));
    els.prevButton.innerHTML = `${icon("arrow-left", "arrow")} Prev`;
    els.prevButton.setAttribute("aria-label", "Previous question");
    els.middleButton.className = `known-btn ${isKnown ? "on" : ""}`;
    els.middleButton.disabled = !card;
    els.middleButton.setAttribute("aria-label", isKnown ? "Remove mastered mark" : "Mark as mastered");
    els.middleButton.innerHTML = isKnown ? `${icon("star", "mastered-icon")} Mastered` : `${icon("star")} Mark as mastered`;
    els.nextButton.disabled = !card || state.index >= total - 1;
    els.nextButton.setAttribute("aria-label", "Next question");
    els.nextButton.innerHTML = `Next ${icon("arrow-right", "arrow")}`;
    return;
  }

  const finalQuestion = state.index >= total - 1;
  els.prevButton.innerHTML = `${icon("arrow-left", "arrow")} Prev`;
  els.prevButton.setAttribute("aria-label", "Previous question");
  els.middleButton.className = "known-btn";
  els.middleButton.disabled = false;
  els.middleButton.setAttribute("aria-label", "Restart test");
  els.middleButton.innerHTML = `${icon("refresh")} Restart`;
  els.nextButton.disabled = !card || !isAnswered;
  els.nextButton.setAttribute("aria-label", finalQuestion ? "Finish test" : "Next question");
  els.nextButton.innerHTML = finalQuestion ? `Finish ${icon("trophy")}` : `Next ${icon("arrow-right", "arrow")}`;
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
  state.selected = null;
  if (state.testSession) state.testSession.index = state.index;
  render();
  animateMove(direction);
}

function openJumpDialog() {
  if (state.result || !state.deck.length) return;
  els.jumpInput.max = String(state.deck.length);
  els.jumpInput.value = String(state.index + 1);
  if (typeof els.jumpDialog.showModal === "function") els.jumpDialog.showModal();
  else els.jumpDialog.setAttribute("open", "");
  requestAnimationFrame(() => {
    els.jumpInput.focus();
    els.jumpInput.select();
  });
}

function closeJumpDialog() {
  if (els.jumpDialog.open) els.jumpDialog.close();
}

function submitJump() {
  const target = Number(els.jumpInput.value);
  if (!Number.isFinite(target)) return;
  closeJumpDialog();
  jumpToIndex(target - 1);
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
  els.studyHandle.setAttribute("aria-label", state.studyExpanded ? "Collapse study help" : "Expand study help");
  els.studyHandle.title = toggleable ? (state.studyExpanded ? "Collapse study help" : "Expand study help") : "";
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
  if (mode === state.mode && !state.result) return;
  rememberCurrentProgress();
  state.mode = mode;
  state.result = null;
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
  const nextIndex = Math.max(0, Math.min(state.deck.length - 1, state.index + step));
  if (nextIndex === state.index) return;
  state.index = nextIndex;
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
    state.index = Math.min(state.index, Math.max(0, availableQuestions().length - 1));
    showSnackbar("Marked as mastered", "Undo");
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

function finishTest() {
  state.result = { ...scoreFor(), showTranslations: state.testTranslations };
  state.testSession = null;
  state.deck = [];
  state.index = 0;
  render();
  els.resultView.focus({ preventScroll: true });
}

function changeCategory(category) {
  if (state.category === category) return;
  if (state.mode === "test" && hasAnsweredTestQuestions()) {
    const proceed = window.confirm("Changing filters will restart the current test.");
    if (!proceed) return;
  }
  state.category = category;
  state.index = 0;
  state.learnIndex = 0;
  state.selected = null;
  state.result = null;
  if (state.mode === "test") state.testSession = newTestSession(category);
  if (isMobileDrawer()) closeReviewPanel(false);
  render();
}

function isMobileDrawer() {
  return window.innerWidth < 600;
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
  els.categoryPills.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    changeCategory(button.dataset.category);
  });
  els.knownList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-known]");
    if (!button) return;
    removeKnown(button.dataset.removeKnown);
  });
  els.answers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-answer]");
    if (!button) return;
    pickAnswer(Number(button.dataset.answer));
  });
  els.progressText.addEventListener("click", openJumpDialog);
  els.jumpClose.addEventListener("click", closeJumpDialog);
  els.jumpDialog.addEventListener("click", (event) => {
    if (event.target === els.jumpDialog) closeJumpDialog();
  });
  els.jumpDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    submitJump();
  });
  els.jumpDialog.addEventListener("click", (event) => {
    const shortcut = event.target.closest("[data-jump]")?.dataset.jump;
    if (!shortcut) return;
    const last = state.deck.length - 1;
    const target = shortcut === "first" ? 0 : shortcut === "middle" ? Math.floor(last / 2) : last;
    closeJumpDialog();
    jumpToIndex(target);
  });
  els.resultView.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "restart-test") startTest(state.category);
    if (action === "learn-mode") setMode("learn");
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
    if (event.defaultPrevented || els.jumpDialog.open) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key === "Home") {
      event.preventDefault();
      jumpToIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      jumpToIndex(state.deck.length - 1);
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
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") applyTheme();
  });
}

async function init() {
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
  state.testTranslations = saved.testTranslations !== false;
  applyTheme();

  const response = await fetch("./data/lid-berlin-source-of-truth.json");
  if (!response.ok) throw new Error(`Could not load LiD database: ${response.status}`);
  const database = await response.json();
  const translationResponse = await fetch("./data/i18n/en.json");
  if (translationResponse.ok) {
    const translationCatalog = await translationResponse.json();
    messages = translationCatalog.messages || {};
  }
  questions = database.questions;
  questionById = new Map(questions.map((question) => [question.id, question]));
  categories = [ALL_CATS, ...new Set(questions.map((question) => question.theme))];
  if (!categories.includes(state.category)) state.category = ALL_CATS;

  bindEvents();
  if (state.mode === "test") ensureTestSession();
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
