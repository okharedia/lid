const STORAGE_KEY = "lid-trainer-v7";
const OLD_STORAGE_KEY = "lid-trainer-v6";
const ALL_CATS = "Alle Kategorien";
const DEFAULT_TEST_SIZE = 3;
const PASS_SCORE = 90;

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
  shuffleSeed: 0,
  known: new Set(),
  index: 0,
  selected: null,
  deck: [],
  panelTab: "filters",
  testSession: null,
  result: null,
};

let slideTimer = 0;
let swipeTimer = 0;
let swipeStart = null;

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
  app: document.querySelector(".bp-app"),
  categoryPills: document.querySelector("#categoryPills"),
  progressFill: document.querySelector("#progressFill"),
  card: document.querySelector("#card"),
  resultView: document.querySelector("#resultView"),
  emptyState: document.querySelector("#emptyState"),
  questionTag: document.querySelector("#questionTag"),
  categoryLabel: document.querySelector("#categoryLabel"),
  knownTag: document.querySelector("#knownTag"),
  feedback: document.querySelector("#feedback"),
  knownCount: document.querySelector("#knownCount"),
  progressText: document.querySelector("#progressText"),
  questionText: document.querySelector("#questionText"),
  questionTranslation: document.querySelector("#questionTranslation"),
  questionImage: document.querySelector("#questionImage"),
  questionChips: document.querySelector("#questionChips"),
  answers: document.querySelector("#answers"),
  hintText: document.querySelector("#hintText"),
  studyDock: document.querySelector("#studyDock"),
  keywordList: document.querySelector("#keywordList"),
  lockedHint: document.querySelector("#lockedHint"),
  cardNav: document.querySelector("#cardNav"),
  prevButton: document.querySelector("#prevButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  middleButton: document.querySelector("#middleButton"),
  nextButton: document.querySelector("#nextButton"),
};

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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        category: state.category,
        shuffleSeed: state.shuffleSeed,
        known: [...state.known],
        index: state.index,
        panelTab: state.panelTab,
        testSession: state.testSession,
      }),
    );
  } catch {}
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

function hasAnsweredTestQuestions(session = state.testSession) {
  return Boolean(session && Object.keys(session.answers || {}).length);
}

function buildLearnDeck(resetIndex = true) {
  let deck = availableQuestions();
  if (state.shuffleSeed) deck = shuffled(deck, state.shuffleSeed);
  state.deck = deck;
  if (resetIndex || state.index >= deck.length) state.index = Math.max(0, deck.length - 1);
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
      return `
        <button class="cat-pill" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === state.category}">
          <span class="de">${escapeHtml(label)}</span>
          <span class="en">${available}/${total} available</span>
        </button>
      `;
    })
    .join("");
}

function renderKnownPanel() {
  const knownQuestions = questions.filter((question) => state.known.has(question.id));
  els.knownSummary.innerHTML = `
    <span>${knownQuestions.length} known</span>
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
            <button type="button" data-remove-known="${question.id}" aria-label="Remove known mark">
              ${icon("trash")}
            </button>
          </article>
        `)
        .join("")
    : `<div class="known-empty">No known questions yet.</div>`;
}

function renderTestConfigPanel() {
  const value = configuredTestSize();
  const max = Math.max(1, availableQuestions().length || questions.length || value);
  els.testSizeInput.max = String(max);
  els.testSizeInput.value = String(value);
  els.testSizeMinus.disabled = value <= 1;
  els.testSizePlus.disabled = value >= max;
  els.testSizeMeta.textContent = `Current test: ${Math.min(value, max)} question${Math.min(value, max) === 1 ? "" : "s"}`;
}

function renderPanel() {
  const isKnownTab = state.panelTab === "known";
  const isTestConfigTab = state.panelTab === "test";
  els.filtersTab.setAttribute("aria-pressed", String(!isKnownTab && !isTestConfigTab));
  els.knownTab.setAttribute("aria-pressed", String(isKnownTab));
  els.testConfigTab.setAttribute("aria-pressed", String(isTestConfigTab));
  els.filtersPane.hidden = isKnownTab || isTestConfigTab;
  els.knownPane.hidden = !isKnownTab;
  els.testConfigPane.hidden = !isTestConfigTab;
  renderCategories();
  renderKnownPanel();
  renderTestConfigPanel();
}

function renderResult() {
  if (!state.result) return;
  const { correct, total, percent, missed } = state.result;
  const passed = percent >= PASS_SCORE;
  els.resultView.classList.toggle("passed", passed);
  els.resultView.innerHTML = `
    <div class="result-hero">
      <div class="result-icon">${icon(passed ? "confetti" : "trophy")}</div>
      <p class="result-kicker">${passed ? "Passed" : "Keep going"}</p>
      <h1>${percent}%</h1>
      <p>${correct}/${total} correct · ${escapeHtml(shortCategoryLabel(state.category))}</p>
    </div>
    <div class="result-actions">
      <button class="btn btn-secondary" type="button" data-action="restart-test">${icon("refresh")} Retry test</button>
      <button class="btn btn-tertiary" type="button" data-action="learn-mode">${icon("arrow-back-up")} Back to learn</button>
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
                const questionTranslation = t(question.translationKey);
                const selectedTranslation = selectedAnswerObject ? t(selectedAnswerObject.translationKey) : "";
                const correctTranslation = correctAnswerObject ? t(correctAnswerObject.translationKey) : "";
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
                    ${question.answerVariants ? `<p class="variant-note">${escapeHtml(t(question.answerVariants.noteKey))}</p>` : ""}
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
  const knownCount = state.known.size;

  els.learnMode.setAttribute("aria-pressed", String(isLearn));
  els.testMode.setAttribute("aria-pressed", String(!isLearn));
  els.filterButtonLabel.textContent = state.panelTab === "known" ? "Known" : shortCategoryLabel(state.category);
  els.filterButton.setAttribute("aria-expanded", String(els.app.classList.contains("filters-open")));
  els.shuffleButton.hidden = !isLearn || Boolean(state.result);
  els.shuffleButton.setAttribute("aria-pressed", String(Boolean(state.shuffleSeed)));
  els.resultView.hidden = !state.result;
  els.cardNav.hidden = Boolean(state.result);
  els.card.hidden = Boolean(state.result) || !card;
  els.emptyState.hidden = Boolean(state.result) || Boolean(card);
  els.studyDock.hidden = Boolean(state.result) || !reveal;
  els.lockedHint.hidden = Boolean(state.result) || reveal;
  els.prevButton.disabled = Boolean(state.result) || state.index === 0;
  els.progressFill.style.width = total ? `${((state.index + 1) / total) * 100}%` : state.result ? `${state.result.percent}%` : "0%";

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
  els.knownCount.innerHTML = `${icon("circle-check", "check")} ${knownCount}`;
  els.progressText.innerHTML = `${pad(state.index + 1)}<span class="pct">/${pad(total)}</span>`;
  els.questionText.innerHTML = highlightedText(card.question, card);
  const questionTranslation = t(card.translationKey);
  els.questionTranslation.textContent = questionTranslation;
  els.questionTranslation.hidden = !questionTranslation;
  els.questionImage.classList.toggle("visible", Boolean(card.imageUrl));
  if (card.imageUrl) {
    els.questionImage.onload = fitLayout;
    els.questionImage.src = card.imageUrl;
  } else {
    els.questionImage.removeAttribute("src");
  }

  renderQuestionChips(card);

  els.answers.innerHTML = card.answers
    .map((answer, index) => {
      const isCorrectAnswer = index === card.correctIndex;
      let className = "bp-answer";
      if (reveal) {
        if (isCorrectAnswer) className += " is-correct";
        else if (selected === index) className += " is-wrong";
        else className += " is-dim";
      }
      const mark = reveal && isCorrectAnswer ? icon("circle-check") : reveal && selected === index ? icon("x") : "";
      const answerTranslation = t(answer.translationKey);
      const why = reveal ? t(answer.whyKey) : "";
      return `
        <li>
          <button class="${className}" type="button" data-answer="${index}" ${isLearn || isAnswered ? "disabled" : ""}>
            <span class="text">
              ${highlightedAnswerText(answer.text, card, isCorrectAnswer, reveal)}
              ${answerTranslation ? `<span class="en">${escapeHtml(answerTranslation)}</span>` : ""}
              ${why ? `<span class="why">${icon("info-circle", "why-icon")}<span>${escapeHtml(why)}</span></span>` : ""}
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
    els.middleButton.className = `known-btn ${isKnown ? "on" : ""}`;
    els.middleButton.disabled = !card;
    els.middleButton.innerHTML = isKnown ? `${icon("circle-check")} Gewusst` : `${icon("star")} Mark known`;
    els.nextButton.disabled = !card || state.index >= total - 1;
    els.nextButton.innerHTML = `Next ${icon("arrow-right", "arrow")}`;
    return;
  }

  const finalQuestion = state.index >= total - 1;
  els.prevButton.innerHTML = `${icon("arrow-left", "arrow")} Prev`;
  els.middleButton.className = "known-btn";
  els.middleButton.disabled = false;
  els.middleButton.innerHTML = `${icon("refresh")} Restart`;
  els.nextButton.disabled = !card || !isAnswered;
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
  }, 260);
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
  }, 180);
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
  }, 170);
}

function hasVerticalOverflow(element) {
  if (!element || element.hidden) return false;
  return element.scrollHeight > element.clientHeight + 1;
}

function fitLayout() {
  requestAnimationFrame(() => {
    els.app.classList.remove("fit-tight", "fit-tighter");

    const overflows = () =>
      hasVerticalOverflow(els.card) ||
      hasVerticalOverflow(els.studyDock) ||
      document.documentElement.scrollHeight > window.innerHeight + 1 ||
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

    if (!overflows()) return;
    els.app.classList.add("fit-tight");

    requestAnimationFrame(() => {
      if (!overflows()) return;
      els.app.classList.add("fit-tighter");
    });
  });
}

function setMode(mode) {
  if (mode === state.mode && !state.result) return;
  state.mode = mode;
  state.result = null;
  state.selected = null;
  if (mode === "learn") {
    buildLearnDeck(false);
  } else {
    ensureTestSession();
  }
  render();
}

function move(step) {
  if (state.result || !state.deck.length) return;
  if (state.mode === "test" && step > 0 && currentTestAnswer() === null) return;
  const nextIndex = Math.max(0, Math.min(state.deck.length - 1, state.index + step));
  if (nextIndex === state.index) return;
  state.index = nextIndex;
  state.selected = null;
  if (state.testSession) state.testSession.index = state.index;
  render();
  animateMove(step);
}

function pickAnswer(index) {
  if (state.mode === "learn" || state.result || currentTestAnswer() !== null) return;
  const card = currentCard();
  if (!card || !state.testSession) return;
  state.testSession.answers[String(card.id)] = index;
  render();
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
  } else {
    state.known.add(card.id);
    state.index = Math.min(state.index, Math.max(0, availableQuestions().length - 1));
  }
  buildLearnDeck(false);
  render();
}

function removeKnown(id) {
  state.known.delete(Number(id));
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

function finishTest() {
  state.result = scoreFor();
  state.testSession = null;
  state.deck = [];
  state.index = 0;
  render();
}

function changeCategory(category) {
  if (state.category === category) return;
  if (state.mode === "test" && hasAnsweredTestQuestions()) {
    const proceed = window.confirm("Changing filters will restart the current test.");
    if (!proceed) return;
  }
  state.category = category;
  state.index = 0;
  state.selected = null;
  state.result = null;
  if (state.mode === "test") state.testSession = newTestSession(category);
  els.app.classList.remove("filters-open");
  els.filterButton.setAttribute("aria-expanded", "false");
  render();
}

function bindEvents() {
  els.learnMode.addEventListener("click", () => setMode("learn"));
  els.testMode.addEventListener("click", () => setMode("test"));
  els.filtersTab.addEventListener("click", () => {
    state.panelTab = "filters";
    render();
  });
  els.knownTab.addEventListener("click", () => {
    state.panelTab = "known";
    render();
  });
  els.testConfigTab.addEventListener("click", () => {
    state.panelTab = "test";
    render();
  });
  els.testSizeMinus.addEventListener("click", () => setTestSize(configuredTestSize() - 1));
  els.testSizePlus.addEventListener("click", () => setTestSize(configuredTestSize() + 1));
  els.testSizeInput.addEventListener("change", () => setTestSize(Number(els.testSizeInput.value)));
  els.testSizeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    setTestSize(Number(els.testSizeInput.value));
    els.testSizeInput.blur();
  });
  els.filterButton.addEventListener("click", () => {
    els.app.classList.toggle("filters-open");
    els.filterButton.setAttribute("aria-expanded", String(els.app.classList.contains("filters-open")));
  });
  els.app.addEventListener("click", (event) => {
    if (window.innerWidth >= 720) return;
    if (!els.app.classList.contains("filters-open")) return;
    if (event.target.closest("#filterBar") || event.target.closest("#filterButton")) return;
    els.app.classList.remove("filters-open");
    els.filterButton.setAttribute("aria-expanded", "false");
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
  els.shuffleButton.addEventListener("click", () => {
    state.shuffleSeed = state.shuffleSeed ? 0 : Math.floor(Math.random() * 1e9) + 1;
    buildLearnDeck();
    render();
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
  els.resultView.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "restart-test") startTest(state.category);
    if (action === "learn-mode") setMode("learn");
  });
  els.app.addEventListener("pointerdown", (event) => {
    if (window.innerWidth >= 720 || els.app.classList.contains("filters-open") || state.result) return;
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
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key === "ArrowLeft") {
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
  window.addEventListener("resize", fitLayout);
}

async function init() {
  const saved = loadSavedState();
  state.mode = saved.mode === "test" ? "test" : "learn";
  state.category = saved.category || ALL_CATS;
  state.shuffleSeed = saved.shuffleSeed || 0;
  state.known = new Set(saved.known || []);
  state.index = saved.index || 0;
  state.panelTab = ["known", "test"].includes(saved.panelTab) ? saved.panelTab : "filters";
  state.testSession = saved.testSession || null;

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
}

init().catch((error) => {
  els.questionText.textContent = error.message;
});
