const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/lid-berlin-source-of-truth.json"), "utf8"));
const i18n = JSON.parse(fs.readFileSync(path.join(root, "data/i18n/en.json"), "utf8"));
const messages = i18n.messages || {};
const RANGES = ["A-D", "E-H", "I-S", "T-Z"];
const STOP_TERMS = new Set([
  "alle",
  "Berlin",
  "darf",
  "erlaubt",
  "falsch",
  "immer",
  "kann",
  "kein",
  "keine",
  "muss",
  "nicht",
  "nur",
  "richtig",
  "verboten",
]);

const CONTEXT_OVERRIDES = {
  "1933": "1933 is the year Hitler and the National Socialists came to power. It marks the beginning of the Nazi dictatorship, the end of democratic rule, and the start of the period that later leads to war, persecution, 1945, and postwar responsibility.",
  "1945": "1945 marks the end of the Second World War and Nazi rule. In German civic history, it separates dictatorship from the postwar democratic order and is tied to 8 May, liberation, occupation, and rebuilding.",
  "1961": "1961 is the year the Berlin Wall was built. It marks the hardening of Germany's division: East Germany sealed off West Berlin, and the Wall became the symbol of the DDR border regime until 1989.",
  "1989": "1989 is the year the Berlin Wall fell. Peaceful protest and political change in the DDR opened the path from division toward German unity in 1990.",
  "1990": "1990 is the year of German reunification. After the fall of the Wall, East and West Germany became one democratic federal republic again.",
  "3. Oktober": "3 October is German Unity Day. Reunification legally took effect on 3 October 1990, so this date became Germany's national holiday.",
  "5%-Hürde": "The 5%-Hürde is the election threshold for parties entering parliament. A party usually needs at least 5% of the second votes to receive Bundestag seats, which prevents very small parties from fragmenting parliament.",
  "8. Mai 1945": "8 May 1945 is the end of Nazi rule and the war in Europe. In Germany it is remembered as both defeat and liberation, which is why remembrance and responsibility are important civic themes.",
  "Adler": "Adler means eagle. The federal eagle is visible in the Bundestag plenary hall; Berlin's own coat of arms is different and uses the bear.",
  "Arbeitsgericht": "Arbeitsgericht means labor court. Work disputes belong in this part of the court system, not with police, ministries, or general administration.",
  "Asyl": "Asyl means asylum. In German constitutional law, asylum protects foreigners who need protection from political persecution. It is different from rights such as dignity or freedom of opinion, which apply broadly to people in Germany.",
  "Bezirk": "Bezirk means district. In Berlin, districts and district offices handle local city responsibilities below the state government.",
  "Bundeskanzler": "Bundeskanzler means Federal Chancellor, the head of Germany's federal government. After Bundestag elections, the Federal President proposes a candidate; the Bundestag elects the Chancellor, and the Federal President appoints them. The Chancellor sets the main direction of government policy and proposes federal ministers.",
  "Bundeskanzlerin": "Bundeskanzlerin is the female form of Federal Chancellor. The office is the head of the federal government: elected by the Bundestag, appointed by the Federal President, and responsible for leading the cabinet's political direction.",
  "Bundesland": "Bundesland means federal state. Germany is a federation of states; state governments are represented in the Bundesrat, and some areas, especially schools and education, are mainly state responsibilities.",
  "Bundespräsident": "Bundespräsident means Federal President, Germany's head of state. The role is mostly representative and constitutional: the President represents Germany, proposes a Chancellor candidate to the Bundestag, formally appoints officials, and is elected by the Bundesversammlung.",
  "Bundespräsidentin": "Bundespräsidentin is the female form of Federal President. The office represents Germany as head of state and has formal constitutional duties such as proposing the Chancellor candidate and appointing federal officials.",
  "Bundesrat": "Bundesrat means Federal Council. State governments participate in federal lawmaking here, so changes in state elections can change political majorities in the Bundesrat.",
  "Bundesregierung": "Bundesregierung means federal government. It consists of the Federal Chancellor and federal ministers, and is separate from parliament, courts, state governments, and the Federal President.",
  "Bundestag": "Bundestag means Germany's federal parliament. It passes federal laws, elects the Chancellor, contains parliamentary groups, and is chosen by voters in federal elections.",
  "Bundesversammlung": "Bundesversammlung means Federal Convention. Its key constitutional function is electing the Federal President, so do not confuse it with Bundestag, Bundesrat, or the cabinet.",
  "Bürgermeister": "Bürgermeister means mayor. Berlin uses the title Regierende/r Bürgermeister/in for the head of its state government, which is different from mayor titles in ordinary cities or from minister-president titles in other states.",
  "DDR": "DDR means East Germany, officially the German Democratic Republic. It was a socialist dictatorship with restricted freedoms; the Berlin Wall, protest in 1989, and reunification all belong to this history.",
  "Demokratie": "Demokratie means democracy. In Germany this means state power comes from the people: citizens vote, representatives are elected, governments can change, and parties compete under constitutional rules.",
  "Ehrenamt": "Ehrenamt means volunteering or honorary civic service. Election helpers are a practical example: citizens support elections by helping at polling stations and counting votes.",
  "Einheit": "Einheit means unity. In German civic history it usually points to German unity after division: 3 October 1990 and the political joining of East and West Germany.",
  "Fraktion": "Fraktion means parliamentary group. Members of parliament from the same party or allied parties work together as a group; Fraktionen matter for majorities, opposition, and Bundestag leadership.",
  "Gericht": "Gericht means court. Courts are part of the judiciary: they decide legal disputes, check state action, and protect the rule of law.",
  "Gesetz": "Gesetz means law. It appears with the Basic Law, parliament, courts, rights, and social insurance; the important distinction is often whether the issue is about making laws, obeying laws, or protecting legal rights.",
  "Gesetze": "Gesetze means laws. In a Rechtsstaat, residents and the state must follow the laws, and the Bundestag is central to making federal laws.",
  "Gewerkschaften": "Gewerkschaften means trade unions. They represent employees' interests in working life, especially around pay, working conditions, and collective bargaining.",
  "Grundgesetz": "Grundgesetz means Basic Law, Germany's constitution. It protects rights such as human dignity, freedom of opinion, religious freedom, equality, and limits on state power.",
  "Holocaust": "Holocaust means the Nazi murder of European Jews. Understanding it is central to German historical responsibility, remembrance culture, and the rejection of antisemitism and Nazi propaganda.",
  "Koalition": "Koalition means coalition. When no party governs alone, parties can form a government together by agreeing to cooperate.",
  "Kommunalwahlen": "Kommunalwahlen means local elections. In Berlin, local election rules can differ from federal elections, including voting age.",
  "Landesflagge": "Landesflagge means state flag. Berlin's state flag is white-red and uses the bear; it is not the federal black-red-gold flag.",
  "Landesparlament": "Landesparlament means state parliament. It matters for federalism: each state has its own parliament, while the Bundestag is the federal parliament.",
  "Mauer": "Mauer means Wall. In this civic-history context it usually means the Berlin Wall: built in 1961, opened in 1989, and a symbol of Germany's division.",
  "Meinungsfreiheit": "Meinungsfreiheit means freedom of opinion. It is a Basic Law right: people may criticize the government, open political speech is protected, and press freedom cannot simply be abolished by a party.",
  "Menschenwürde": "Menschenwürde means human dignity. It is one of the strongest Basic Law concepts: the state must respect and protect every person's dignity.",
  "Nationalsozialismus": "Nationalsozialismus means Nazism. It refers to the dictatorship responsible for war, persecution, antisemitism, the Holocaust, and the destruction of democracy between 1933 and 1945.",
  "Nationalsozialisten": "Nationalsozialisten means Nazis. They were the people and regime responsible for dictatorship, the Holocaust, and the destruction of democracy between 1933 and 1945.",
  "Opposition": "Opposition means the parties or representatives not in government. In parliament, opposition parties scrutinize, criticize, and offer alternatives to the government.",
  "Partei": "Partei means political party. Parties organize political goals, compete in elections, form parliamentary groups, may build coalitions, and must respect the democratic constitutional order.",
  "Parteien": "Parteien means parties. The plural usually points to the party system: voters choose among parties, parties may form coalitions, and their vote share affects seats.",
  "Polizei": "Polizei means police. Police enforce laws and protect public safety, but courts decide guilt and legal disputes.",
  "Pressefreiheit": "Pressefreiheit means freedom of the press. It is a protected basic right, so a party cannot simply abolish it even with political power.",
  "Rechtsstaat": "Rechtsstaat means rule of law. The state itself must obey the law, courts control state power, and nobody may be arrested or punished arbitrarily.",
  "Regierende": "Regierende is part of Regierende/r Bürgermeister/in, Berlin's title for head of government. Choose this title for Berlin instead of minister-president or ordinary mayor titles.",
  "Richter": "Richter means judge. Judges make legal decisions in independent courts; they are not supposed to follow political orders.",
  "Senat": "Senat means Berlin's state government. Berlin's government includes senators for areas such as internal affairs, justice, and finance.",
  "Sozialversicherung": "Sozialversicherung means social insurance. It includes public systems such as health, pension, unemployment, accident, and long-term care insurance; employers and employees fund parts of it. Private life insurance is not part of statutory social insurance.",
  "Stadtstaat": "Stadtstaat means city-state. Berlin is both a city and a federal state, like Hamburg and Bremen. That makes it different from larger territorial states such as Brandenburg, Hessen, or Saarland.",
  "Verfassung": "Verfassung means constitution. In Germany, the constitution is the Grundgesetz: it protects rights, organizes state power, and limits what government or parties can do.",
  "Wahl": "Wahl means election or vote. In German democracy, elections must be free, equal, and secret; voting rules decide who may vote, and election results turn citizens' choices into political power.",
  "Wahlen": "Wahlen means elections. Democratic elections must be free, equal, and secret; citizens choose representatives, and election helpers support the process.",
  "Wappen": "Wappen means coat of arms. Berlin's coat of arms is the bear, not the federal eagle or another state's symbol.",
  "Wiedervereinigung": "Wiedervereinigung means reunification. It refers to 1990 and 3 October, when East and West Germany became one country again.",
  "Würde": "Würde means dignity. It appears in the Basic Law phrase Die Würde des Menschen ist unantastbar: human dignity is inviolable and comes before ordinary politics.",
};

function normalize(value = "") {
  return String(value)
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss");
}

function rangeFor(term) {
  const firstLetter = normalize(term).match(/[a-z]/)?.[0] || "t";
  if ("abcd".includes(firstLetter)) return "A-D";
  if ("efgh".includes(firstLetter)) return "E-H";
  if ("ijklmnopqrs".includes(firstLetter)) return "I-S";
  return "T-Z";
}

function includesTerm(text, term) {
  return normalize(text).includes(normalize(term));
}

function sentenceFragment(value = "") {
  return String(value).replace(/\s+/g, " ").replace(/[.。]+$/u, "").trim();
}

function learnerContext(term, translation, questions) {
  if (CONTEXT_OVERRIDES[term]) return CONTEXT_OVERRIDES[term];

  const correctAnswers = [...new Set(questions.map((question) => question.correctAnswer).filter(Boolean))]
    .slice(0, 2)
    .map(sentenceFragment);
  const themes = [...new Set(questions.map((question) => question.theme))].slice(0, 2);
  const themeText = themes.length ? themes.join(" and ") : "civic knowledge";
  const answerText = correctAnswers.length
    ? ` Key answer patterns include "${correctAnswers.join('" and "')}."`
    : "";
  return `In ${themeText.toLowerCase()}, this term is mainly used with these answer patterns.${answerText}`;
}

function removeRedundantOpening(context, term) {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return context
    .replace(new RegExp(`^${escapedTerm}\\s+means\\s+[^.]+\\.\\s*`, "i"), "")
    .replace(new RegExp(`^${escapedTerm}\\s+is\\s+the\\s+German\\s+word\\s+for\\s+[^.]+\\.\\s*`, "i"), "")
    .trim();
}

const referencedTerms = new Map();

for (const question of data.questions) {
  for (const keyword of question.study?.keywordRefs || []) {
    if (!referencedTerms.has(keyword.term)) referencedTerms.set(keyword.term, keyword.translationKey);
  }
}

const terms = [...referencedTerms.entries()]
  .filter(([term]) => !STOP_TERMS.has(term))
  .map(([term, translationKey]) => {
    const translation = messages[translationKey] || term;
    const matchingQuestions = data.questions.filter((question) => {
      const answerText = question.answers.map((answer) => answer.text).join(" ");
      return includesTerm(`${question.question} ${answerText}`, term);
    });

    const matches = matchingQuestions.flatMap((question) => {
      const items = [];
      if (includesTerm(question.question, term)) {
        items.push({
          id: question.id,
          localNumber: question.localNumber,
          kind: "question",
          text: question.question,
          translation: messages[question.translationKey] || "",
        });
      }
      question.answers.forEach((answer) => {
        if (!includesTerm(answer.text, term)) return;
        items.push({
          id: question.id,
          localNumber: question.localNumber,
          kind: "answer",
          text: answer.text,
          translation: messages[answer.translationKey] || "",
          isCorrect: answer.isCorrect,
        });
      });
      return items;
    });

    return {
      term,
      translation,
      context: removeRedundantOpening(learnerContext(term, translation, matchingQuestions), term),
      range: rangeFor(term),
      matches,
    };
  })
  .filter((term) => term.matches.length)
  .sort((left, right) => left.term.localeCompare(right.term, "de-DE", { sensitivity: "base" }));

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    questions: "data/lid-berlin-source-of-truth.json",
    translations: "data/i18n/en.json",
    basis: "questions[].study.keywordRefs matched against question and answer text",
    excludedTerms: [...STOP_TERMS].sort((left, right) => left.localeCompare(right, "de-DE", { sensitivity: "base" })),
  },
  ranges: RANGES,
  terms,
};

fs.writeFileSync(path.join(root, "data/glossary.json"), `${JSON.stringify(output, null, 2)}\n`);
