const scenarios = [
  {
    tag: "FRAGE 001",
    category: "All / baseline",
    progress: "01/05",
    question: "In Deutschland dürfen Menschen offen etwas gegen die Regierung sagen, weil …",
    questionEn: "In Germany, people may openly say things against the government because …",
    correct: 3,
    hint:
      'Baseline case. Balanced question length, ordinary answers, one keyword, and enough content to show the dock without stressing layout.',
    keywords: [{ de: "Meinungsfreiheit", en: "freedom of opinion" }],
    answers: [
      ["hier Religionsfreiheit gilt.", "freedom of religion applies here."],
      ["die Menschen Steuern zahlen.", "people pay taxes."],
      ["die Menschen das Wahlrecht haben.", "people have the right to vote."],
      ["hier Meinungsfreiheit gilt.", "freedom of opinion applies here."],
    ],
  },
  {
    tag: "FRAGE 066",
    category: "Berlin state question",
    progress: "02/20",
    question: "Welche Städte haben die größten jüdischen Gemeinden in Deutschland?",
    questionEn: "Which cities have the largest Jewish communities in Germany?",
    correct: 0,
    hint:
      'Berlin state question. Simple idea: recognize the German keywords (Berlin = Berlin) and choose the answer meaning "Berlin und München".',
    keywords: [{ de: "Berlin", en: "Berlin" }],
    answers: [
      ["Berlin und München", "Berlin and Munich"],
      ["Hamburg und Essen", "Hamburg and food"],
      ["Nürnberg und Stuttgart", "Nuremberg and Stuttgart"],
      ["Worms und Speyer", "Worms and Speyer"],
    ],
  },
  {
    tag: "FRAGE 005",
    category: "Elections",
    progress: "05/310",
    question: "Wahlen in Deutschland sind frei. Was bedeutet das?",
    questionEn: "Elections in Germany are free. What does that mean?",
    correct: 2,
    hint:
      'Elections. Simple idea: recognize the German keywords (Wahl = election/vote; Wahlen = elections; kein = no/not any; keine = no/not any) and choose the long answer.',
    keywords: [
      { de: "Wahl", en: "election/vote" },
      { de: "Wahlen", en: "elections" },
      { de: "kein", en: "no/not any" },
      { de: "keine", en: "no/not any" },
      { de: "darf", en: "may/is allowed" },
    ],
    answers: [
      [
        "Man darf Geld annehmen, wenn man dafür eine bestimmte Kandidatin/einen bestimmten Kandidaten wählt.",
        "You can accept money if you vote for a specific candidate.",
      ],
      [
        "Nur Personen, die noch nie im Gefängnis waren, dürfen wählen.",
        "Only people who have never been in prison are allowed to vote.",
      ],
      [
        "Die Wählerin/der Wähler darf bei der Wahl weder beeinflusst noch zu einer bestimmten Stimmabgabe gezwungen werden und keine Nachteile durch die Wahl haben.",
        "The voter may neither be influenced nor forced to cast a specific vote during the election and may not suffer any disadvantages as a result of the election.",
      ],
      ["Alle wahlberechtigten Personen müssen wählen.", "All eligible voters must vote."],
    ],
  },
  {
    tag: "FRAGE 021",
    category: "General LiD recognition",
    progress: "21/310",
    question: "Welches ist das Wappen der Bundesrepublik Deutschland?",
    questionEn: "What is the coat of arms of the Federal Republic of Germany?",
    correct: 0,
    image:
      "https://www.gesetze-im-internet.de/normengrafiken/bgbl1_2008/j01649_0010.jpg",
    hint: 'Image question. Keep the image inside the card and choose the answer meaning "Bild 1".',
    keywords: [{ de: "Wappen", en: "coat of arms" }],
    answers: [
      ["Bild 1", "Image 1"],
      ["Bild 2", "Image 2"],
      ["Bild 3", "Image 3"],
      ["Bild 4", "Image 4"],
    ],
  },
  {
    tag: "FRAGE 112",
    category: "Law, courts, police",
    progress: "12/29",
    question: "Was bedeutet „Rechtsstaat“ in Deutschland?",
    questionEn: "What does rule of law mean in Germany?",
    correct: 1,
    hint:
      "Short question. Useful for checking that the pinned bottom dock does not float too high on sparse cards.",
    keywords: [{ de: "Rechtsstaat", en: "rule of law" }],
    answers: [
      ["Der Staat hat ein Rechtssystem.", "The state has a legal system."],
      ["Der Staat muss sich an die Gesetze halten.", "The state must follow the laws."],
      ["Die Bürger denken rechts.", "Citizens think right-wing."],
      ["Im Staat gibt es nur rechte Parteien.", "There are only right-wing parties in the state."],
    ],
  },
  {
    tag: "FRAGE 188",
    category: "Test locked state",
    progress: "18/31",
    mode: "test",
    selected: null,
    question: "Was ist eine Aufgabe der Polizei in Deutschland?",
    questionEn: "What is one task of the police in Germany?",
    correct: 2,
    hint: "Hidden until answered.",
    keywords: [{ de: "Polizei", en: "police" }],
    answers: [
      ["Sie macht Gesetze.", "It makes laws."],
      ["Sie wählt die Regierung.", "It elects the government."],
      ["Sie schützt die Bevölkerung.", "It protects the population."],
      ["Sie spricht Recht.", "It passes judgement."],
    ],
  },
];

const categories = [
  ["All", "baseline"],
  ["Long question", "desktop stress"],
  ["Long answers", "wrapping"],
  ["Image question", "media"],
  ["Short question", "sparse"],
  ["Test locked", "hidden hints"],
];

let index = Number(new URLSearchParams(location.search).get("case") || 0);
index = Math.max(0, Math.min(scenarios.length - 1, index));

const app = document.querySelector(".bp-app");
const els = {
  learnMode: document.querySelector("#learnMode"),
  testMode: document.querySelector("#testMode"),
  filterButton: document.querySelector("#filterButton"),
  filterButtonLabel: document.querySelector("#filterButtonLabel"),
  shuffleButton: document.querySelector("#shuffleButton"),
  categoryPills: document.querySelector("#categoryPills"),
  progressFill: document.querySelector("#progressFill"),
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
  lockedHint: document.querySelector("#lockedHint"),
  studyDock: document.querySelector("#studyDock"),
  hintText: document.querySelector("#hintText"),
  keywordList: document.querySelector("#keywordList"),
  prevButton: document.querySelector("#prevButton"),
  knownButton: document.querySelector("#knownButton"),
  nextButton: document.querySelector("#nextButton"),
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlight(text, keywords) {
  const terms = keywords.map((keyword) => keyword.de).sort((a, b) => b.length - a.length);
  if (!terms.length) return escapeHtml(text);
  const re = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return escapeHtml(text).replace(re, '<span class="kw">$1</span>');
}

function highlightAnswer(text, keywords, isCorrect, reveal) {
  return reveal && isCorrect ? highlight(text, keywords) : escapeHtml(text);
}

function render() {
  app.classList.remove("fit-tight", "fit-tighter", "filters-open");
  const scenario = scenarios[index];
  const isTest = scenario.mode === "test";
  const reveal = !isTest || scenario.selected !== null;

  els.learnMode.setAttribute("aria-pressed", String(!isTest));
  els.testMode.setAttribute("aria-pressed", String(isTest));
  els.filterButtonLabel.textContent = categories[index]?.[0] || "All";
  els.filterButton.setAttribute("aria-expanded", "false");
  els.progressFill.style.width = `${((index + 1) / scenarios.length) * 100}%`;

  els.categoryPills.innerHTML = categories
    .map(([de, en], i) => `
      <button class="cat-pill" type="button" data-case="${i}" aria-pressed="${i === index}">
        <span class="de">${escapeHtml(de)}</span>
        <span class="en">${escapeHtml(en)}</span>
      </button>
    `)
    .join("");

  els.questionTag.textContent = scenario.tag;
  els.categoryLabel.textContent = scenario.category;
  els.progressText.innerHTML = `${scenario.progress.split("/")[0]}<span class="pct">/${scenario.progress.split("/")[1]}</span>`;
  els.questionText.innerHTML = highlight(scenario.question, scenario.keywords);
  els.questionTranslation.textContent = scenario.questionEn;
  els.questionImage.classList.toggle("visible", Boolean(scenario.image));
  if (scenario.image) {
    els.questionImage.onload = fitLayout;
    els.questionImage.src = scenario.image;
  }

  els.feedback.hidden = true;
  els.knownTag.hidden = true;
  els.knownCount.hidden = true;
  els.prevButton.disabled = index === 0;
  els.nextButton.disabled = index === scenarios.length - 1;

  els.answers.innerHTML = scenario.answers
    .map(([de, en], i) => {
      let className = "bp-answer";
      if (reveal) {
        if (i === scenario.correct) className += " is-correct";
        else className += " is-dim";
      }
      return `
        <li>
          <button class="${className}" type="button" ${reveal ? "disabled" : ""}>
            <span class="text">
              ${highlightAnswer(de, scenario.keywords, i === scenario.correct, reveal)}
              <span class="en">${escapeHtml(en)}</span>
            </span>
            <span class="mark">${reveal && i === scenario.correct ? "✓" : ""}</span>
          </button>
        </li>
      `;
    })
    .join("");

  els.lockedHint.hidden = reveal;
  els.studyDock.hidden = !reveal;
  els.hintText.innerHTML = highlight(scenario.hint, scenario.keywords);
  els.keywordList.innerHTML = scenario.keywords
    .map((keyword) => `
      <span class="kw-item">
        <span class="de">${escapeHtml(keyword.de)}</span>
        <span class="en">${escapeHtml(keyword.en)}</span>
      </span>
    `)
    .join("");

  fitLayout();
  setTimeout(fitLayout, 250);
}

function hasVerticalOverflow(element) {
  if (!element || element.hidden) return false;
  return element.scrollHeight > element.clientHeight + 1;
}

function fitLayout() {
  requestAnimationFrame(() => {
    app.classList.remove("fit-tight", "fit-tighter");
    const overflows = () =>
      hasVerticalOverflow(document.querySelector("#card")) ||
      hasVerticalOverflow(document.querySelector("#studyDock")) ||
      document.documentElement.scrollHeight > window.innerHeight + 1 ||
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    if (!overflows()) return;
    app.classList.add("fit-tight");
    requestAnimationFrame(() => {
      if (overflows()) app.classList.add("fit-tighter");
    });
  });
}

els.categoryPills.addEventListener("click", (event) => {
  const button = event.target.closest("[data-case]");
  if (!button) return;
  index = Number(button.dataset.case);
  render();
});

els.filterButton.addEventListener("click", () => {
  app.classList.toggle("filters-open");
  els.filterButton.setAttribute("aria-expanded", String(app.classList.contains("filters-open")));
});

els.prevButton.addEventListener("click", () => {
  index = Math.max(0, index - 1);
  render();
});

els.nextButton.addEventListener("click", () => {
  index = Math.min(scenarios.length - 1, index + 1);
  render();
});

window.addEventListener("resize", fitLayout);
render();
