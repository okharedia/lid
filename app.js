const STORAGE_KEY = "lid-trainer-v6";
const ALL_CATS = "Alle Kategorien";

let questions = [];
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
};

const els = {
  learnMode: document.querySelector("#learnMode"),
  testMode: document.querySelector("#testMode"),
  filterButton: document.querySelector("#filterButton"),
  filterButtonLabel: document.querySelector("#filterButtonLabel"),
  app: document.querySelector(".bp-app"),
  categoryPills: document.querySelector("#categoryPills"),
  progressFill: document.querySelector("#progressFill"),
  card: document.querySelector("#card"),
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
  answers: document.querySelector("#answers"),
  hintText: document.querySelector("#hintText"),
  studyDock: document.querySelector("#studyDock"),
  keywordList: document.querySelector("#keywordList"),
  lockedHint: document.querySelector("#lockedHint"),
  prevButton: document.querySelector("#prevButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  knownButton: document.querySelector("#knownButton"),
  nextButton: document.querySelector("#nextButton"),
};

function loadSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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

function currentCard() {
  return state.deck[state.index] || null;
}

function buildDeck(resetIndex = true) {
  let deck = questions;
  if (state.category !== ALL_CATS) {
    deck = deck.filter((question) => question.theme === state.category);
  }
  if (state.shuffleSeed) {
    deck = shuffled(deck, state.shuffleSeed);
  }
  state.deck = deck;
  if (resetIndex || state.index >= deck.length) state.index = 0;
  state.selected = null;
  render();
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function renderCategories() {
  els.categoryPills.innerHTML = categories
    .map((category) => {
      const isAll = category === ALL_CATS;
      const count = isAll ? questions.length : questions.filter((question) => question.theme === category).length;
      const label = isAll ? "All" : category;
      return `
        <button class="cat-pill" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === state.category}">
          <span class="de">${escapeHtml(label)}</span>
          <span class="en">${count} cards</span>
        </button>
      `;
    })
    .join("");
}

function shortCategoryLabel(category) {
  return category === ALL_CATS ? "All" : category;
}

function render() {
  els.app.classList.remove("fit-tight", "fit-tighter");
  renderCategories();

  const card = currentCard();
  const total = state.deck.length;
  const isLearn = state.mode === "learn";
  const isAnswered = state.selected !== null;
  const reveal = isLearn || isAnswered;
  const knownCount = state.deck.reduce((count, question) => count + (state.known.has(question.id) ? 1 : 0), 0);

  els.learnMode.setAttribute("aria-pressed", String(isLearn));
  els.testMode.setAttribute("aria-pressed", String(!isLearn));
  els.filterButtonLabel.textContent = shortCategoryLabel(state.category);
  els.filterButton.setAttribute("aria-expanded", String(els.app.classList.contains("filters-open")));
  els.shuffleButton.setAttribute("aria-pressed", String(Boolean(state.shuffleSeed)));
  els.card.hidden = !card;
  els.emptyState.hidden = Boolean(card);
  els.prevButton.disabled = state.index === 0;
  els.nextButton.disabled = !card || state.index >= total - 1;
  els.knownButton.disabled = !card;
  els.progressFill.style.width = total ? `${((state.index + 1) / total) * 100}%` : "0%";

  if (!card) {
    saveState();
    return;
  }

  const isKnown = state.known.has(card.id);
  const correctChosen = isAnswered && state.selected === card.correctIndex;
  const wrongChosen = isAnswered && state.selected !== card.correctIndex;

  els.questionTag.textContent = `FRAGE ${pad(card.localNumber || card.id, 3)}`;
  els.categoryLabel.textContent = card.theme;
  els.knownTag.hidden = !isKnown;
  els.feedback.hidden = !(correctChosen || wrongChosen);
  els.feedback.textContent = correctChosen ? "Richtig" : wrongChosen ? "Falsch" : "";
  els.feedback.className = `bp-feedback ${correctChosen ? "correct" : wrongChosen ? "wrong" : ""}`;
  els.knownCount.hidden = Boolean(correctChosen || wrongChosen || !knownCount);
  els.knownCount.innerHTML = `<span class="check">✓</span> ${knownCount}`;
  els.progressText.innerHTML = `${pad(state.index + 1)}<span class="pct">/${pad(total)}</span>`;
  els.questionText.innerHTML = highlightedText(card.question, card);
  const questionTranslation = t(card.translationKey);
  els.questionTranslation.textContent = questionTranslation;
  els.questionTranslation.hidden = !questionTranslation;
  els.questionImage.classList.toggle("visible", Boolean(card.imageUrl));
  if (card.imageUrl) {
    els.questionImage.onload = fitLayout;
    els.questionImage.src = card.imageUrl;
  }
  els.knownButton.classList.toggle("on", isKnown);
  els.knownButton.textContent = isKnown ? "✓ Gewusst" : "★ Mark known";

  els.answers.innerHTML = card.answers
    .map((answer, index) => {
      const isCorrectAnswer = index === card.correctIndex;
      let className = "bp-answer";
      if (reveal) {
        if (isCorrectAnswer) className += " is-correct";
        else if (state.selected === index) className += " is-wrong";
        else className += " is-dim";
      }
      const mark = reveal && isCorrectAnswer ? "✓" : reveal && state.selected === index ? "✕" : "";
      const answerTranslation = t(answer.translationKey);
      return `
        <li>
          <button class="${className}" type="button" data-answer="${index}" ${isLearn || isAnswered ? "disabled" : ""}>
            <span class="text">
              ${highlightedAnswerText(answer.text, card, isCorrectAnswer, reveal)}
              ${answerTranslation ? `<span class="en">${escapeHtml(answerTranslation)}</span>` : ""}
            </span>
            <span class="mark">${mark}</span>
          </button>
        </li>
      `;
    })
    .join("");

  els.studyDock.hidden = !reveal;
  els.lockedHint.hidden = reveal;
  const hint = t(card.study?.hintKey) || t(card.study?.memoryKey);
  const keywords = keywordRefs(card);
  els.hintText.innerHTML = highlightedText(hint, card);
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
  state.mode = mode;
  state.selected = null;
  render();
}

function move(step) {
  if (!state.deck.length) return;
  state.index = Math.max(0, Math.min(state.deck.length - 1, state.index + step));
  state.selected = null;
  render();
}

function pickAnswer(index) {
  if (state.mode === "learn" || state.selected !== null) return;
  state.selected = index;
  render();
}

function toggleKnown() {
  const card = currentCard();
  if (!card) return;
  if (state.known.has(card.id)) state.known.delete(card.id);
  else state.known.add(card.id);
  render();
}

function bindEvents() {
  els.learnMode.addEventListener("click", () => setMode("learn"));
  els.testMode.addEventListener("click", () => setMode("test"));
  els.filterButton.addEventListener("click", () => {
    els.app.classList.toggle("filters-open");
    els.filterButton.setAttribute("aria-expanded", String(els.app.classList.contains("filters-open")));
  });
  els.prevButton.addEventListener("click", () => move(-1));
  els.nextButton.addEventListener("click", () => move(1));
  els.knownButton.addEventListener("click", toggleKnown);
  els.shuffleButton.addEventListener("click", () => {
    state.shuffleSeed = state.shuffleSeed ? 0 : Math.floor(Math.random() * 1e9) + 1;
    buildDeck();
  });
  els.categoryPills.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    els.app.classList.remove("filters-open");
    els.filterButton.setAttribute("aria-expanded", "false");
    buildDeck();
  });
  els.answers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-answer]");
    if (!button) return;
    pickAnswer(Number(button.dataset.answer));
  });
  window.addEventListener("keydown", (event) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      toggleKnown();
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

  const response = await fetch("./data/lid-berlin-source-of-truth.json");
  if (!response.ok) throw new Error(`Could not load LiD database: ${response.status}`);
  const database = await response.json();
  const translationResponse = await fetch("./data/i18n/en.json");
  if (translationResponse.ok) {
    const translationCatalog = await translationResponse.json();
    messages = translationCatalog.messages || {};
  }
  questions = database.questions;
  categories = [ALL_CATS, ...new Set(questions.map((question) => question.theme))];
  if (!categories.includes(state.category)) state.category = ALL_CATS;

  bindEvents();
  buildDeck(false);
}

init().catch((error) => {
  els.questionText.textContent = error.message;
});
