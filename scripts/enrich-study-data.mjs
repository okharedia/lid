#!/usr/bin/env node
// One-shot enrichment: adds cluster cheat sheets, English-first hints,
// real memory aids, distractor explanations, thickened glossary, image
// captions, answer variants, duplicate marks. Run with: node scripts/enrich-study-data.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "data/lid-berlin-source-of-truth.json");
const I18N_PATH = path.join(ROOT, "data/i18n/en.json");

const source = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
const i18n = JSON.parse(fs.readFileSync(I18N_PATH, "utf8"));
const msg = i18n.messages;

// ---------- 1. Cluster cheat sheets ----------
// Each question can carry an optional clusterTag (wahlrecht|grundrechte|nszeit|berlin).
// The cheat sheet body lives under cluster.<id>.title / .body in i18n.
const CLUSTERS = {
  wahlrecht: {
    title: "Wahlrecht — Elections cheat sheet",
    body:
      "• German elections are: frei (free), gleich (equal), geheim (secret) — and allgemein (universal), unmittelbar (direct).\n" +
      "• Bundestag = federal parliament, elected every 4 years.\n" +
      "• Landesparlament (incl. Berlin Abgeordnetenhaus) = elected every 5 years.\n" +
      "• 5%-Hürde: a party needs ≥5% of second votes to enter the Bundestag.\n" +
      "• Aktives Wahlrecht = right to vote (≥18). Passives Wahlrecht = right to be elected.\n" +
      "• Wahlhelfer count votes after polls close (it's an Ehrenamt, a volunteer role).\n" +
      "• Foreigners can vote in some Kommunalwahlen (EU citizens only); not in Bundestag elections.",
  },
  grundrechte: {
    title: "Grundgesetz & Grundrechte — Basic Law cheat sheet",
    body:
      "• Grundgesetz = Germany's constitution (Verfassung). Article 1: 'Die Würde des Menschen ist unantastbar' — human dignity is inviolable.\n" +
      "• Core Grundrechte: Meinungsfreiheit (opinion), Pressefreiheit (press), Religionsfreiheit (religion), Versammlungsfreiheit (assembly), Gleichberechtigung (equality).\n" +
      "• A Grundrecht cannot be abolished — even by Bundestag majority.\n" +
      "• Rechtsstaat = rule of law: state AND all residents follow the laws.\n" +
      "• Todesstrafe (death penalty), Folter (torture), Zwangsarbeit (forced labor), Zwangsheirat (forced marriage) — all verboten.\n" +
      "• Religious instruction in school is parents' choice (until child turns 14).",
  },
  nszeit: {
    title: "NS-Zeit, WWII, DDR — History cheat sheet",
    body:
      "• 1933 = Nazis (Nationalsozialisten) come to power. 1945 = end of WWII / Nazi rule. 8. Mai 1945 = end of war in Europe.\n" +
      "• Holocaust: systematic murder of European Jews. Germany has special responsibility toward Israel because of these Verbrechen.\n" +
      "• 1949 = BRD (Bundesrepublik) and DDR founded. Grundgesetz takes effect.\n" +
      "• 4 Besatzungszonen after WWII: USA, UK, France, Sowjetunion.\n" +
      "• 1961 = Berliner Mauer built. 1989 = Mauerfall (fall). 1990 (3. Oktober) = Wiedervereinigung — German Unity Day.\n" +
      "• 5 'neue Bundesländer' from former DDR: Brandenburg, Mecklenburg-Vorpommern, Sachsen, Sachsen-Anhalt, Thüringen.\n" +
      "• 50er Jahre = Wirtschaftswunder. First Gastarbeiter came from Italy (1955).",
  },
  berlin: {
    title: "Berlin — State deck cheat sheet",
    body:
      "• Berlin is a Stadtstaat (city-state) and one of 16 Bundesländer.\n" +
      "• Coat of arms (Wappen): black bear on white shield with red crown.\n" +
      "• Flagge: weiß-rot (white-red) with the bear.\n" +
      "• Berlin has 12 Bezirke (e.g. Pankow, Mitte, Charlottenburg-Wilmersdorf).\n" +
      "• Government = Senat. Head = Regierende(r) Bürgermeister(in) (NOT Ministerpräsident).\n" +
      "• Abgeordnetenhaus (state parliament) elected every 5 years.\n" +
      "• Wahlalter for Abgeordnetenhaus: 16. Wahlalter for Bundestag: 18.\n" +
      "• Senats roles cover Bildung, Inneres, Justiz, Verkehr… NOT Außenbeziehungen (foreign affairs belong to the Bund).",
  },
};

const clusterAssignment = {
  // Wahlrecht (elections, parties, voting mechanics)
  wahlrecht: [5,12,13,20,28,31,41,43,57,62,70,73,78,79,89,93,94,98,103,105,106,108,109,112,113,114,115,116,117,119,120,121,122,123,124,125,126,127,130,133,159,170,232,268,282],
  // Grundrechte / Grundgesetz / basic rights
  grundrechte: [1,3,4,6,7,8,10,11,14,15,16,18,48,51,53,68,80],
  // NS-Zeit, DDR, war, reunification
  nszeit: [96,149,151,152,153,154,155,156,157,160,163,164,166,172,174,176,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,210,215,217,218,219,220,228,288,298],
  // Berlin deck
  berlin: [301,302,303,304,305,306,307,308,309,310],
};

const qToCluster = {};
for (const [tag, ids] of Object.entries(clusterAssignment)) {
  for (const id of ids) qToCluster[id] = tag;
}

// ---------- 2. Thickened glossary contexts ----------
// One-sentence context for the most-referenced terms. Rendered behind an (i) icon.
const GLOSSARY_CONTEXT = {
  Wahl: "An election. German elections must be frei, gleich, geheim — free, equal, secret.",
  Wahlen: "Elections. Bundestag every 4 years; Landtag every 5; Kommunalwahlen at municipal level.",
  nicht: "Negation — flips the question. Always read negated questions twice before picking.",
  Bundestag: "The federal parliament. Elected every 4 years; sits in Berlin (Reichstag building).",
  DDR: "East Germany (Deutsche Demokratische Republik), 1949–1990. A dictatorship led by the SED.",
  kann: "'Can/may'. Often signals a choice or possibility — read whether the question asks what is allowed.",
  Berlin: "The capital city of Germany and a Stadtstaat (city-state) — one of 16 Bundesländer.",
  Gesetz: "A law. Passed by the Bundestag (and where relevant, the Bundesrat).",
  Partei: "A political party. Needs ≥5% of second votes to enter the Bundestag.",
  alle: "'All/every'. Watch for traps: 'all immigrants must…' usually wrong; 'all residents…' often right.",
  Bundesland: "A federal state. Germany has 16 — including Berlin, Hamburg, Bremen as Stadtstaaten.",
  darf: "'May / is allowed'. Marks a question about permission or right.",
  Gericht: "A court. Independent — judges (Richter) decide based on Gesetz, not government.",
  Bundeskanzler: "The Chancellor — head of the federal government. Elected by the Bundestag.",
  Grundgesetz: "The Basic Law — Germany's constitution. Adopted 1949. Article 1 = human dignity.",
  muss: "'Must'. A strict requirement — careful: 'every citizen MUST vote' is wrong (it's a right).",
  Gesetze: "Laws (plural). Made by the Bundestag; the state and all residents must follow them.",
  Verfassung: "Constitution. In Germany, the Grundgesetz fills this role.",
  Richter: "A judge. Independent of government. Some are honorary (ehrenamtliche Richter/Schöffen).",
  "1945": "End of WWII / Nazi rule. 8. Mai 1945 = end of war in Europe.",
  kein: "'No / not any'. A negation — flips what the question is asking for.",
  nur: "'Only'. Almost always a trap word — 'only X' is rarely the correct answer.",
  Bundespräsident: "The Federal President — Staatsoberhaupt. Largely ceremonial. Elected by Bundesversammlung.",
  Bundespräsidentin: "The Federal President (female form). Same role as Bundespräsident.",
  Parteien: "Political parties. Plural of Partei.",
  Sozialversicherung: "Statutory social insurance: health, pension, unemployment, accident, long-term care.",
  Bundeskanzlerin: "The Chancellor (female form). Head of the federal government.",
  Mauer: "Wall — specifically the Berliner Mauer (1961–1989) that split East and West Berlin.",
  Nationalsozialisten: "The Nazis — came to power 1933 under Hitler. Ended 1945.",
  "1933": "Nazis (Nationalsozialisten) take power. End of the Weimar Republic.",
  "1989": "Fall of the Berliner Mauer (9. November). Beginning of Wiedervereinigung.",
  "1990": "German reunification (3. Oktober) — now German Unity Day (Tag der Deutschen Einheit).",
  Meinungsfreiheit: "Freedom of opinion — a Grundrecht. You may publicly criticize the government.",
  keine: "'No / not any' (feminine form). A negation that flips the question.",
  Wappen: "Coat of arms. Berlin's = bear on white shield with red crown.",
  Demokratie: "Democracy. Germany is a representative, federal, social democracy.",
  Fraktion: "A parliamentary group — MPs of the same party (or aligned parties) acting together.",
  Bundesregierung: "The federal government — Chancellor plus federal ministers.",
  Bundesrat: "The Federal Council — represents the 16 Bundesländer at federal level.",
  Ehrenamt: "Volunteer / honorary work, unpaid. E.g. Wahlhelfer, ehrenamtliche Richter.",
};

// ---------- 3. Duplicate pairs ----------
// Each entry: question marks itself as duplicateOfId (the lower id is canonical).
const DUPLICATES = {
  119: 5,    // both: "Wahlen in Deutschland sind frei. Was bedeutet das?"
  27: 26,    // both: "Deutschland ist …"
  54: 32,    // both: "Was ist keine staatliche Gewalt in Deutschland?"
  110: 107,  // both: "Für wie viele Jahre wird der Bundestag in Deutschland gewählt?"
  // q192/195/197/198/200 same question about old-DDR Bundesländer (different correct answer each); not true duplicates
  // q222/223/227/229/233 same question about neighbor country (different correct answer each); not true duplicates
};

// ---------- 4. Answer variants ----------
// Where source-of-truth and interactive trainer wording differ trivially.
// Currently the only flagged one is q3 (slash spacing). Add a flag for future-proofing.
const ANSWER_VARIANTS = {
  3: {
    note: "May appear worded slightly differently on the real exam (e.g. spacing around 'Einwohner / Einwohnerinnen').",
  },
};

// ---------- 5. Image captions ----------
// Visual mnemonics for image-question answers — independent of which Bild number it is.
const IMAGE_CAPTIONS = {
  21:  "Germany's Bundesflagge is three horizontal stripes: schwarz-rot-gold (black-red-gold), top to bottom.",
  55:  "The Bundesadler — a stylised black eagle facing right, on yellow shield. Germany's national emblem.",
  70:  "European Parliament chamber / EU symbol set — the official EU flag is 12 gold stars in a circle on blue.",
  130: "EU flag: 12 gold stars in a circle on a blue field. The number 12 is fixed, not the number of member states.",
  176: "Map of Germany after WWII showing the four Besatzungszonen (US, UK, France, Soviet).",
  181: "DDR (East Germany) symbol: hammer-and-compass with a wreath of grain.",
  187: "Map of the divided Germany — DDR (East) and BRD (West) with Berliner Mauer.",
  209: "Bundesadler (federal eagle) — Germany's coat of arms.",
  216: "EU flag: 12 gold stars in a circle on blue.",
  226: "EU flag: 12 gold stars in a circle on blue. (Pick the one with stars, not stripes.)",
  235: "Map of EU member states — the answer depends on which countries are highlighted.",
  301: "Berlin's Wappen: black bear standing upright on a white shield, with a red mural crown above.",
  308: "Map of Germany's 16 Bundesländer numbered on the map. Berlin is the small enclave inside Brandenburg.",
};

// ---------- 6. Bespoke hint/memory authoring ----------
// English-first concept anchor. Each entry can override the auto-generated hint/memory.
// Schema: { hint: string, memory: string } — both optional.

const BESPOKE = {
  // ---- Grundrechte cluster ----
  1: { hint: "Q: Why may people in Germany openly criticize the government? → Because Meinungsfreiheit (freedom of opinion) is a Grundrecht here.",
       memory: "→ Cluster: Grundrechte. Opinion + press + religion are core rights." },
  2: { hint: "Q: Until age 14, parents decide whether their child takes part in which class? → Religionsunterricht (religious instruction).",
       memory: "Trap: Geschichts-/Politik-/Sprachunterricht are mandatory; only Religion is the parents' choice." },
  3: { hint: "Q: Germany is a Rechtsstaat — what does that mean? → State AND all residents must follow the laws.",
       memory: "Rechtsstaat = rule of law. Trap distractor: 'Nur Deutsche' (only Germans) — wrong; the law binds everyone." },
  4: { hint: "Q: Which right is a Grundrecht in Germany? → Meinungsfreiheit (freedom of opinion).",
       memory: "→ Cluster: Grundrechte. Waffenbesitz, Faustrecht are NEVER Grundrechte." },
  5: { hint: "Q: German elections are 'frei' — what does that mean? → Voters cannot be coerced or punished for how they vote.",
       memory: "→ Cluster: Wahlrecht. The 'free' principle is about no coercion, no disadvantage." },
  // ---- Statehood basics ----
  22: { hint: "Q: What form of state does Germany have? → Republik (republic — head of state is elected, not hereditary).",
        memory: "Germany is a Republik (not Monarchie). Also: Demokratie, Rechtsstaat, Bundesstaat, Sozialstaat." },
  23: { hint: "Q: Most working people in Germany are…? → Employed by a company or government agency.",
        memory: "Most Erwerbstätige are Angestellte (employees), not self-employed." },
  24: { hint: "Q: How many Bundesländer does Germany have? → 16.",
        memory: "16 Bundesländer. 3 are Stadtstaaten (Berlin, Hamburg, Bremen). 5 are 'neue Länder' (former DDR)." },
  26: { hint: "Q: Germany is…? → A democratic and social federal state.",
        memory: "Germany = demokratischer + sozialer + Bundesstaat (democratic + social + federal). Memorise this triad." },
  27: { hint: "Q: Germany is…? → A federal state (Bundesstaat).",
        memory: "Same triad — Germany is a Bundesstaat. Note q26 & q27 are duplicates; same answer pattern." },
  36: { hint: "Q: Which measure creates 'soziale Sicherheit' (social security) in Germany? → die Krankenversicherung (health insurance).",
        memory: "Sozialversicherung pillars: Kranken-, Renten-, Arbeitslosen-, Unfall-, Pflegeversicherung." },
  37: { hint: "Q: How are the heads of most Bundesländer called? → Ministerpräsident(in).",
        memory: "Most states: Ministerpräsident. EXCEPTION — Stadtstaaten: Berlin/Hamburg use 'Regierende(r) Bürgermeister(in)'; Bremen uses 'Präsident des Senats'." },
  38: { hint: "Q: Germany is a democratic and social…? → Bundesstaat (federal state).",
        memory: "Same triad again: demokratisch + sozial + Bundesstaat." },
  40: { hint: "Q: With which words does the German national anthem begin? → 'Einigkeit und Recht und Freiheit' (Unity and Justice and Freedom).",
        memory: "Three pillars: Einigkeit (unity), Recht (justice/law), Freiheit (freedom). The 3rd stanza of Hoffmann's poem." },
  42: { hint: "Q: Who decides on new laws in Germany? → Das Parlament (the Bundestag).",
        memory: "Bundestag = Legislative. The government proposes laws but Parliament passes them." },
  46: { hint: "Q: Which is a task of the German state? → It builds roads and schools.",
        memory: "State = infrastructure + public services. Trap distractors are usually 'manage private companies' — false." },
  49: { hint: "Q: Who decides school policy in Germany? → Die Bundesländer (the federal states).",
        memory: "Rule: Schulpolitik = Länder. Aussen-/Verteidigungspolitik = Bund. Federalism in action." },
  50: { hint: "Q: Germany's economic system is called…? → Soziale Marktwirtschaft (social market economy).",
        memory: "Market forces + state cares for social balance. NOT pure Marktwirtschaft, NOT Planwirtschaft." },
  56: { hint: "Q: Which office belongs to a German municipality? → Ordnungsamt (public order office).",
        memory: "Gemeindeverwaltung offices: Ordnungsamt, Einwohnermeldeamt, Standesamt, Jugendamt, Sozialamt." },
  59: { hint: "Q: How many years ago did the first Jewish community on today's German territory exist? → about 1700 years (vor etwa 1700 Jahren).",
        memory: "Jewish presence in Germany goes back ~1700 years — first community in Köln, ~321 AD." },
  61: { hint: "Q: What does 'Volkssouveränität' mean? → State power comes from the people.",
        memory: "Volk = people; souverän = sovereign. 'Alle Staatsgewalt geht vom Volke aus' — Grundgesetz Art. 20." },
  64: { hint: "Q: Germany today is structured into…? → Bund, Länder und Kommunen (Federation, States, Municipalities).",
        memory: "Three tiers: Bund (federal) → Länder (states) → Kommunen (towns/cities)." },
  69: { hint: "Q: Germany has a three-tier administration. What's the lowest level called? → Gemeinden (municipalities).",
        memory: "Bund → Land → Gemeinde. Gemeinde is the smallest unit." },
  75: { hint: "Q: Who is Germany's current head of state? → Frank-Walter Steinmeier (Bundespräsident).",
        memory: "Steinmeier = Bundespräsident (since 2017). Staatsoberhaupt = head of state. Don't confuse with Bundeskanzler (head of government)." },
  76: { hint: "Q: What does 'CDU' stand for? → Christlich Demokratische Union (Christian Democratic Union).",
        memory: "CDU = Christlich Demokratisch. CSU = Christlich Sozial (Bavaria only). They form one Fraktion." },
  77: { hint: "Q: What is the Bundeswehr? → The German military.",
        memory: "Bundeswehr = federal armed forces. Founded 1955. Under civilian (parliamentary) control." },
  92: { hint: "Q: What does 'CSU' stand for? → Christlich Soziale Union (Christian Social Union).",
        memory: "CSU exists only in Bavaria. Allied with CDU at federal level — together they're the 'Unionsfraktion'." },
  95: { hint: "Q: What applies to most children in Germany? → Schulpflicht (compulsory school attendance).",
        memory: "Schulpflicht = mandatory school. Usually 9–10 years. No homeschooling allowed (unlike US)." },
  128: { hint: "Q: Members of parliament elected by citizens are called…? → Abgeordnete (representatives / MPs).",
         memory: "Abgeordnete sit in the Bundestag. Together they form Fraktionen by party." },
  158: { hint: "Q: The 'Drittes Reich' was a…? → Diktatur (dictatorship).",
         memory: "→ Cluster: NS-Zeit. Nazi Germany 1933–1945 = Diktatur, NOT Demokratie." },
  161: { hint: "Q: What characterised the Nazi state? → A policy of staatlicher Rassismus (state racism).",
         memory: "→ Cluster: NS-Zeit. Nazi state = state-organised Rassismus, Antisemitismus, Holocaust." },
  167: { hint: "Q: Which countries were 'Alliierte Besatzungsmächte' after WWII? → USA, Sowjetunion, Großbritannien, Frankreich.",
         memory: "→ Cluster: NS-Zeit. 4 Besatzungszonen = USA, UK, France, Soviet Union. Memorise the four." },
  169: { hint: "Q: When was the Bundesrepublik founded? → 1949.",
         memory: "→ Cluster: NS-Zeit. 1949 = BRD founded + Grundgesetz takes effect + DDR founded (same year)." },
  171: { hint: "Q: 'Soziale Marktwirtschaft' means…? → Market rules supply & demand, but the state ensures social balance.",
         memory: "Market + social safety net. Father of the concept: Ludwig Erhard, 50er Jahre." },
  173: { hint: "Q: Germany is a founding member of…? → The European Union (EU).",
         memory: "BRD was a founding member of the EWG (1957, Römische Verträge) → became EU. Together with France, Italy, Benelux." },
  175: { hint: "Q: How many Besatzungszonen were there in Germany after WWII? → 4.",
         memory: "→ Cluster: NS-Zeit. 4 zones: USA, UK, France, Soviet. Berlin also split into 4 sectors." },
  179: { hint: "Q: How did WWII officially end in Europe? → Germany's unconditional surrender (bedingungslose Kapitulation).",
         memory: "→ Cluster: NS-Zeit. 8. Mai 1945 = bedingungslose Kapitulation. Tag der Befreiung." },
  180: { hint: "Q: Who was the first Bundeskanzler of the Bundesrepublik? → Konrad Adenauer (1949–1963, CDU).",
         memory: "First Bundeskanzler = Adenauer. Father of Westbindung, Wirtschaftswunder era." },
  182: { hint: "Q: What is the Jewish house of prayer called? → Synagoge (synagogue).",
         memory: "Synagoge = jüdisches Gebetshaus. Mosque = Moschee. Church = Kirche." },
  183: { hint: "Q: When was the 'Wirtschaftswunder' in West Germany? → 50er Jahre (the 1950s).",
         memory: "→ Cluster: NS-Zeit. Wirtschaftswunder = economic miracle, 1950s. Erhard, Adenauer era." },
  184: { hint: "Q: On what legal basis was the State of Israel founded? → A resolution of the United Nations (Vereinte Nationen).",
         memory: "UN-Resolution 181 (1947). Israel proclaimed independence 14 May 1948." },
  185: { hint: "Q: 'Eiserner Vorhang' (Iron Curtain) — what did it stand for? → The Warsaw Pact sealing itself off from the West.",
         memory: "→ Cluster: NS-Zeit. Iron Curtain divided communist East (Warschauer Pakt) from West (NATO)." },
  211: { hint: "Q: Which politician is associated with the 'Ostverträge'? → Willy Brandt (SPD chancellor 1969–1974).",
         memory: "Brandt = Ostpolitik + Ostverträge with USSR/Poland. Famous for Kniefall in Warsaw (1970)." },
  212: { hint: "Q: What is Germany's full official name? → Bundesrepublik Deutschland (BRD).",
         memory: "Full name = Bundesrepublik Deutschland. NOT 'Deutsche Republik' or 'Republik Deutschland'." },
  213: { hint: "Q: How many inhabitants does Germany have? → about 84 Millionen.",
         memory: "~84 million. Largest EU population. Berlin: ~3.7M, Hamburg: ~1.9M, München: ~1.5M." },
  214: { hint: "Q: What colours does the German flag have? → schwarz-rot-gold (black-red-gold).",
         memory: "Bundesflagge: schwarz oben, rot mitte, gold unten — three horizontal stripes." },
  // ---- Geography (neighbour-country pattern) ----
  221: { hint: "Q: Germany is a member of the Schengen Agreement — what does that mean? → Germans can travel to many European countries without passport checks.",
         memory: "Schengen = no border checks between member states. Currently 27 European countries." },
  222: { hint: "Q: Which country borders Germany? → Schweiz (Switzerland — south).",
         memory: "Germany's 9 neighbours: N=Dänemark; W=Niederlande, Belgien, Luxemburg, Frankreich; S=Schweiz, Österreich; E=Tschechien, Polen." },
  223: { hint: "Q: Which country borders Germany? → Polen (Poland — east).",
         memory: "Same neighbour list — Poland is east. (See q222 cheat sheet.)" },
  224: { hint: "Q: What does the abbreviation 'EU' stand for? → Europäische Union.",
         memory: "EU = Europäische Union. 27 member states. Founded 1993 (Maastricht). Capital institutions in Brüssel, Straßburg, Luxemburg." },
  225: { hint: "Q: Which other country has a large German-speaking population? → Österreich (Austria).",
         memory: "German is official in Österreich, parts of Schweiz, Liechtenstein, parts of Belgium/Italy (Südtirol)." },
  226: { hint: "Q: Which is the flag of the European Union? → The one with 12 gold stars in a circle on blue.",
         memory: "EU flag = 12 gold stars on blue. 12 is fixed (symbolises unity), NOT number of member states." },
  227: { hint: "Q: Which country borders Germany? → Dänemark (Denmark — north).",
         memory: "Denmark is the only northern neighbour. (See q222 list.)" },
  229: { hint: "Q: Which country borders Germany? → Luxemburg (Luxembourg — west).",
         memory: "Luxembourg shares Germany's western border. (See q222 list.)" },
  231: { hint: "Q: What does 'europäische Integration' mean? → The joining-together of European states into the EU.",
         memory: "Integration = political + economic merging. Started 1950s with Montanunion, continues today." },
  233: { hint: "Q: Which country borders Germany? → Tschechien (Czech Republic — east/south-east).",
         memory: "Tschechien is east of Bavaria and Saxony. (See q222 list.)" },
  234: { hint: "Q: Where is one seat of the European Parliament? → Straßburg (Strasbourg).",
         memory: "EU Parliament has 3 seats: Straßburg (main), Brüssel, Luxemburg. Strasbourg = symbolic main." },
  236: { hint: "Q: How many member states does the EU have today? → 27.",
         memory: "27 member states (after Brexit 2020). Don't confuse with EU flag's 12 stars." },
  237: { hint: "Q: The 'Römische Verträge' (Rome Treaties) of 1957 — what did they do? → Founded the EEC (Europäische Wirtschaftsgemeinschaft, EWG).",
         memory: "1957 Rome Treaties = founding of EWG → today's EU. 6 founding members." },
  238: { hint: "Q: Where does the European Parliament work? → Straßburg, Luxemburg, Brüssel.",
         memory: "3 cities. Straßburg = plenary, Brüssel = committees, Luxemburg = secretariat." },
  239: { hint: "Q: Through which treaties did the BRD join other states to form the EEC? → The 'Römische Verträge' (Rome Treaties).",
         memory: "Römische Verträge = 1957. BRD + France + Italy + Benelux = original 6." },
  240: { hint: "Q: Since when has Germany used Euro cash? → 2002.",
         memory: "Euro cash from 1 January 2002. Euro existed as accounting currency from 1999." },
  // ---- Family/Civic services ----
  242: { hint: "Q: Who decides whether a child goes to Kindergarten? → die Eltern / Erziehungsberechtigte (parents/legal guardians).",
         memory: "Kindergarten = parents' choice. Schule = Schulpflicht (mandatory)." },
  243: { hint: "Q: Maik and Sybille want to demonstrate. What must they do? → Anmelden (register/notify the authorities).",
         memory: "Demonstrations are allowed (Versammlungsfreiheit) but must be ANMELDEN at the Ordnungsamt 48h ahead." },
  244: { hint: "Q: Which school certificate is normally needed for university? → das Abitur.",
         memory: "Abitur = highest school certificate (Gymnasium, ~13 years). Required for full Universitätsstudium." },
  246: { hint: "Q: At what age is one 'volljährig' (legal adult) in Germany? → 18.",
         memory: "Volljährig = 18. Wahlalter for Bundestag = 18. Berlin Abgeordnetenhaus = 16." },
  249: { hint: "Q: Who is primarily responsible for raising children in Germany? → die Eltern (the parents).",
         memory: "Parents have Erziehungsrecht (right) AND Erziehungspflicht (duty). State only steps in if needed." },
  250: { hint: "Q: One has the best chances of a well-paid job in Germany if one is…? → gut ausgebildet (well-educated/trained).",
         memory: "Education = best predictor of income in Germany. Ausbildung (vocational) or Studium (academic)." },
  253: { hint: "Q: Where do you register if you move within Germany? → beim Einwohnermeldeamt (residents' registration office).",
         memory: "Anmelden within 14 days of moving. Required for ID, taxes, voting, benefits." },
  254: { hint: "Q: Divorce in Germany requires a 'Trennungsjahr' — what does that mean? → Spouses live separately for at least one year.",
         memory: "Trennungsjahr = 1 year living apart before divorce. Required by Familienrecht." },
  255: { hint: "Q: Parents with child-raising problems can get help from…? → Jugendamt (youth welfare office).",
         memory: "Jugendamt = state office for child & youth welfare. Free, confidential support for parents." },
  256: { hint: "Q: A couple wants to open a restaurant. What's absolutely required? → Gaststättenerlaubnis (restaurant licence) from the relevant authority.",
         memory: "Gaststättenerlaubnis = licence to serve food/alcohol. From the Ordnungsamt." },
  259: { hint: "Q: The 'BIZ' at the Bundesagentur für Arbeit helps with…? → Lehrstellensuche (apprenticeship search).",
         memory: "BIZ = Berufsinformationszentrum. Free career-info centre, part of the Arbeitsagentur." },
  260: { hint: "Q: In a German school, a child has…? → Anwesenheitspflicht (mandatory attendance).",
         memory: "Schulpflicht + Anwesenheitspflicht. No homeschooling. Truancy can mean fines." },
  264: { hint: "Q: At which festival do people wear colourful costumes and masks? → Rosenmontag (carnival Monday).",
         memory: "Karneval/Fasching/Fastnacht — peaks on Rosenmontag (Monday before Ash Wednesday). Big in Köln, Düsseldorf, Mainz." },
  269: { hint: "Q: From age 3 until school, children in Germany have a legal claim to…? → Kindergartenplatz (a kindergarten place).",
         memory: "Rechtsanspruch on Kita-Platz from age 1 (since 2013); guaranteed from age 3." },
  270: { hint: "Q: The Volkshochschule (VHS) is an institution for…? → Weiterbildung (adult / continuing education).",
         memory: "VHS = adult education. Affordable language courses, IT, hobby classes. Run by municipalities." },
  271: { hint: "Q: Which is a Christmas custom in Germany? → einen Tannenbaum schmücken (decorate a Christmas tree).",
         memory: "Weihnachtsbaum/Tannenbaum + Adventskranz + Heiligabend (24. Dec) = core German Christmas." },
  273: { hint: "Q: With child-raising problems, you go to…? → Jugendamt.",
         memory: "Same answer as q255 — Jugendamt is the go-to for parenting issues." },
  275: { hint: "Q: What do you need for a divorce in Germany? → die Unterstützung einer Anwältin / eines Anwalts (a lawyer).",
         memory: "Divorce requires a Familienanwalt and goes through Familiengericht. Can't divorce purely on your own." },
  286: { hint: "Q: Which organisation in a company helps employees with workplace problems? → der Betriebsrat (works council).",
         memory: "Betriebsrat = elected employee representation inside a firm (≥5 employees). Different from Gewerkschaft (external union)." },
  287: { hint: "Q: To end your employment, what must you observe? → die Kündigungsfrist (notice period).",
         memory: "Kündigungsfrist = legally required notice. Usually 4 weeks; longer if you've been there years." },
  288: { hint: "Q: Why does Germany have a special responsibility for Israel? → Because of Nazi crimes against Jews.",
         memory: "→ Cluster: NS-Zeit. Special responsibility = direct consequence of Holocaust / Shoah." },
  293: { hint: "Q: Which is an Easter custom in Germany? → Eier bemalen (painting eggs).",
         memory: "Ostern = Easter. Eier bemalen, Osterhase (Easter bunny), Ostereier suchen." },
  294: { hint: "Q: Pfingsten is a…? → christlicher Feiertag (Christian holiday).",
         memory: "Pfingsten = Pentecost. 50 days after Easter. Public holiday in Germany." },
  295: { hint: "Q: Which religion has shaped European and German culture? → Christentum (Christianity).",
         memory: "Christentum has shaped Western culture for ~2000 years. Don't confuse with Judentum or Islam in this question." },
  296: { hint: "Q: The last four weeks before Christmas are called…? → Adventszeit (Advent season).",
         memory: "Adventszeit = 4 Sundays before Christmas. Adventskranz with 4 candles, one lit per week." },
  297: { hint: "Q: Most migrants in Germany have come from which country? → Türkei (Turkey).",
         memory: "Largest migrant group = Turkish-origin. Came as Gastarbeiter from 1961." },
  299: { hint: "Q: Foreign workers recruited by the BRD in the 50s/60s were called…? → Gastarbeiterinnen/Gastarbeiter ('guest workers').",
         memory: "Gastarbeiter = guest workers, 50er/60er. From Italy, Spain, Greece, Turkey, Yugoslavia." },
  300: { hint: "Q: The first Gastarbeiter came to the BRD from which country? → Italien (Italy).",
         memory: "First Anwerbeabkommen = Italy, 1955. Then Spain (1960), Greece (1960), Turkey (1961)." },
  // ---- Berlin deck (q301-310) ----
  301: { hint: "Q: Which coat of arms belongs to Berlin? → The black bear on a white shield with a red crown.",
         memory: "→ Cluster: Berlin. Berlin's Wappen = black bear, white shield, red mural crown. Memorise the bear." },
  302: { hint: "Q: Which is a Berlin Bezirk (district)? → Pankow.",
         memory: "Berlin has 12 Bezirke. Common ones: Mitte, Pankow, Charlottenburg-Wilmersdorf, Friedrichshain-Kreuzberg, Neukölln. Altona = Hamburg." },
  303: { hint: "Q: For how many years is the Berlin Abgeordnetenhaus elected? → 5 years.",
         memory: "Landesparlament = 5 years (incl. Berlin). Bundestag = 4 years. Don't mix them up." },
  304: { hint: "Q: From what age may you vote in Berlin's Kommunalwahlen (BVV elections)? → 16.",
         memory: "Berlin Kommunalwahl: 16. Berlin Abgeordnetenhaus: 16. Bundestag: 18. The lowered age is Berlin-specific." },
  305: { hint: "Q: What colours are Berlin's Landesflagge? → weiß-rot (white-red), with the bear in the middle.",
         memory: "Berlin flag = weiß-rot. Don't confuse with the Bundesflagge (schwarz-rot-gold)." },
  306: { hint: "Q: Where in Berlin can you get information on political topics? → bei der Landeszentrale für politische Bildung.",
         memory: "Landeszentrale für politische Bildung = state office for civic education. Free materials, events." },
  307: { hint: "Q: Which Bundesland is a Stadtstaat? → Berlin.",
         memory: "3 Stadtstaaten total: Berlin, Hamburg, Bremen. Saarland/Brandenburg/Hessen are Flächenstaaten." },
  308: { hint: "Q: Which numbered region on the map is Berlin? → The small enclave inside Brandenburg (look for the dot).",
         memory: "Berlin is a city-state surrounded by Brandenburg. Tiny on any map of Germany — look for the enclave." },
  309: { hint: "Q: What is the head of Berlin's government called? → Regierende(r) Bürgermeister(in).",
         memory: "Berlin = Regierende(r) Bürgermeister(in). Hamburg = Erste(r) Bürgermeister(in). Bremen = Präsident des Senats. Other states = Ministerpräsident(in)." },
  310: { hint: "Q: Which Senator does Berlin NOT have? → Senator für Außenbeziehungen (foreign affairs).",
         memory: "Trap: 'nicht' in the question. Foreign affairs is a Bund matter — no state Senator for it. Berlin DOES have Senatoren for Inneres, Finanzen, Justiz, Bildung, etc." },
};

// ---------- 7. Distractor explanations (~60 highest-confusion questions) ----------
// Per-question map: answer index -> short English 'why wrong' (or correct).
const DISTRACTORS = {
  1: { 0: "Religionsfreiheit exists, but it covers religion, not government criticism.",
       1: "Paying taxes doesn't grant the right to criticise government.",
       2: "The right to vote is separate from the right to criticise.",
       3: "Correct — Meinungsfreiheit is the right at stake." },
  2: { 0: "Geschichtsunterricht (history) is mandatory.",
       1: "Correct — Religion is the only subject parents can opt out of.",
       2: "Politikunterricht is mandatory.",
       3: "Sprachunterricht is mandatory." },
  3: { 0: "Correct — Rechtsstaat = everyone, including the state, follows the law.",
       1: "Wrong — in a Rechtsstaat the state IS bound by law.",
       2: "Wrong — laws apply to ALL residents, not only Germans.",
       3: "Wrong — laws are made by the Bundestag, not by the courts." },
  4: { 0: "Owning weapons is restricted, not a Grundrecht.",
       1: "'Right of the fist' (Faustrecht) is the opposite of rule of law.",
       2: "Correct — Meinungsfreiheit is a core Grundrecht (Art. 5)." },
  5: { 0: "Convicted criminals losing voting rights is a separate, narrow rule — not what 'frei' means.",
       1: "Employer time-off is about Wahlhelfer, not 'frei'.",
       2: "Wrong — 'frei' is about no coercion, not freedom to choose location.",
       3: "Correct — 'frei' = no coercion, no disadvantage from the vote." },
  // negation traps
  25: { 0: "Bremen IS a Bundesland — north Germany.",
        1: "Saarland IS a Bundesland — west.",
        2: "Correct — Elsass-Lothringen is in France today (Alsace-Lorraine), NOT a Bundesland.",
        3: "Bayern IS a Bundesland — the largest by area." },
  30: { 0: "Allgemeine Wahlen exist in democracies — not absent.",
        1: "Freie Presse is core to democracy — not absent.",
        2: "Correct — Pressezensur (press censorship) does NOT belong in a democracy.",
        3: "Religionsfreiheit is core to democracy — not absent." },
  100: { 0: "Correct — Lebensversicherung (life insurance) is PRIVATE, not statutory.",
         1: "Renten- (pension) is one of the 5 statutory pillars.",
         2: "Arbeitslosen- (unemployment) is statutory.",
         3: "Pflege- (long-term care) is statutory." },
  104: { 0: "Long illness CAN be grounds for dismissal (with strict rules).",
         1: "Being late repeatedly CAN justify dismissal.",
         2: "Private affairs at work CAN justify dismissal.",
         3: "Correct — pregnancy is protected; firing for pregnancy is illegal (Mutterschutzgesetz)." },
  // years
  107: { 0: "Too short — 2 years is not the Wahlperiode.",
         1: "Correct — Bundestag = 4 years.",
         2: "Wrong — 6 years is the term in some countries, not Germany.",
         3: "Wrong — 8 years is nowhere in German politics." },
  110: { 0: "Too short.",
         1: "Too short.",
         2: "Correct — Bundestag = 4 years. (Duplicate of q107.)",
         3: "That's the Landesparlament term length, not Bundestag." },
  // names
  75: { 0: "Wrong — not Germany's current president.",
        1: "Wrong — not Germany's current president.",
        2: "Wrong — Merkel was Bundeskanzlerin (2005–2021), not Bundespräsidentin.",
        3: "Correct — Frank-Walter Steinmeier (since 2017)." },
  180: { 0: "Correct — Konrad Adenauer, 1949–1963 (CDU).",
         1: "Brandt was 4th Bundeskanzler (1969–1974).",
         2: "Schmidt was 5th Bundeskanzler (1974–1982).",
         3: "Kohl was 6th Bundeskanzler (1982–1998)." },
  // Berlin deck (all 10)
  301: { 0: "Wrong Wappen — that's not the Berlin bear shield.",
         1: "Wrong Wappen.",
         2: "Wrong Wappen.",
         3: "Correct — Berlin's Wappen: black bear on white shield with red crown." },
  302: { 0: "Altona is a Hamburg district — NOT a Berlin Bezirk.",
         1: "Prignitz is a Brandenburg district — NOT Berlin.",
         2: "Correct — Pankow is one of Berlin's 12 Bezirke.",
         3: "Mecklenburgische Seenplatte is in Mecklenburg-Vorpommern — NOT Berlin." },
  303: { 0: "Too short.",
         1: "That's the Bundestag term, not the Landesparlament.",
         2: "Correct — Berlin Abgeordnetenhaus = 5 years.",
         3: "Too long." },
  304: { 0: "Too low — 14 is below Wahlalter anywhere in Germany.",
         1: "Correct — Berlin's Kommunalwahl Wahlalter is 16.",
         2: "That's the Bundestag voting age, not Berlin's Kommunalwahl.",
         3: "Wrong — no Wahlalter is 20." },
  305: { 0: "Wrong — that's blue-white-red, not Berlin.",
         1: "Correct — Berlin's Landesflagge is weiß-rot (white-red) with the bear.",
         2: "Wrong — green-white-red is not Berlin.",
         3: "Wrong — black-gold is not Berlin's flag." },
  306: { 0: "Ordnungsamt handles public order, not political education.",
         1: "Churches are about faith, not political education.",
         2: "Verbraucherzentrale is for consumer rights, not political education.",
         3: "Correct — Landeszentrale für politische Bildung handles civic education." },
  307: { 0: "Correct — Berlin is one of 3 Stadtstaaten (with Hamburg and Bremen).",
         1: "Saarland is a Flächenstaat in the southwest.",
         2: "Brandenburg is a Flächenstaat that surrounds Berlin.",
         3: "Hessen is a Flächenstaat (capital Wiesbaden)." },
  309: { 0: "Ministerpräsident(in) is the title in Flächenstaaten, NOT in Berlin.",
         1: "Oberbürgermeister(in) is a city-mayor title (e.g. Köln, München) — not Berlin's state government head.",
         2: "Präsident des Senats is Bremen's title, NOT Berlin's.",
         3: "Correct — Berlin uses Regierende(r) Bürgermeister(in)." },
  310: { 0: "Finanzsenator(in) exists in Berlin.",
         1: "Innensenator(in) exists in Berlin.",
         2: "Correct — there's NO 'Senator für Außenbeziehungen' (foreign affairs is a Bund matter).",
         3: "Justizsenator(in) exists in Berlin." },
  // History highlights
  152: { 0: "1933 = Nazis came to power.",
         1: "Wrong year for the founding of the BRD.",
         2: "Correct — BRD founded 1949 (Grundgesetz takes effect).",
         3: "1961 = Berlin Wall built." },
  155: { 0: "Wrong year for the Berliner Mauer.",
         1: "Correct — 1961, Berliner Mauer is built (13. August).",
         2: "Wrong year.",
         3: "1989 = Mauerfall, not construction." },
  // Add a couple more — keeping list moderate
  217: { 0: "1933 = Nazis to power.",
         1: "1945 = WWII end.",
         2: "Correct — Wiedervereinigung on 3. Oktober 1990.",
         3: "1949 = BRD/DDR founded." },
};

// Q308 has a content slip in my table — fix the correct answer text below
// (correctIndex==2 means '4'; actual real answer per source is '12'). Let me reset 308.
// Re-checking: the actual question varies. Skip rewriting unless I'm sure.
delete DISTRACTORS[308];

// ---------- 8. Auto-generate fallback hint when none bespoke ----------
function autoHint(q) {
  const ans = q.correctAnswer;
  return `Q: ${msg[q.translationKey] || "(see German question above)"} → "${ans}".`;
}

function autoMemory(q) {
  const cluster = qToCluster[q.id];
  if (cluster) {
    const clusterTitle = CLUSTERS[cluster].title.split(" — ")[0];
    return `→ Topic: ${clusterTitle}. Open the cheat sheet for the full set of rules.`;
  }
  return `Key answer: "${q.correctAnswer}". Read the question's danger words first, then match by concept.`;
}

// ---------- 9. Apply changes ----------

// 9a. Bump schemaVersion
source.schemaVersion = 4;
source.generatedAt = "2026-05-24";

// 9b. Add clusters block to source-of-truth
source.clusters = Object.entries(CLUSTERS).map(([id, c]) => ({
  id,
  titleKey: `cluster.${id}.title`,
  bodyKey: `cluster.${id}.body`,
}));

// 9c. Add cluster strings to i18n
for (const [id, c] of Object.entries(CLUSTERS)) {
  msg[`cluster.${id}.title`] = c.title;
  msg[`cluster.${id}.body`] = c.body;
}

// 9d. Add glossary contexts (i18n)
for (const [term, context] of Object.entries(GLOSSARY_CONTEXT)) {
  msg[`glossary.${term}.context`] = context;
}

// 9e. Add answer-variant note string
msg[`ui.answerVariantNote`] = "May appear worded slightly differently on the real exam.";

// 9f. Per-question updates
const keywordLessHints = new Set([2,22,23,24,26,27,36,37,38,40,46,49,50,56,59,61,64,69,75,76,77,92,95,128,158,161,167,169,171,173,175,179,182,183,184,185,211,212,213,214,221,222,223,224,225,226,227,229,231,233,234,236,237,238,239,240,242,243,244,246,249,250,253,254,255,256,259,260,264,269,270,271,273,275,286,287,288,293,294,295,296,297,299,300]);
const anchorMemories = new Set([1,2,4,17,20,21,22,23,24,26,27,29,31,35,36,37,38,39,40,41,42,45,46,49,50,55,56,58,59,60,61,64,66,69,70,71,72,73,74,75,76,77,78,79,82,84,85,87,88,89,90,92,93,95,97,99,101,103,123,131,132,135,136,137,139,140,141,142,143,144,145,146,147,148,150,158,161,165,167,169,171,173,175,177,178,179,180,181,182,183,184,185,209,211,212,213,214,216,221,222,223,224,225,226,227,229,231,233,234,235,236,237,238,239,240,242,243,244,246,247,249,250,253,254,255,256,259,260,263,264,266,269,270,271,273,275,282,286,287,288,293,294,295,296,297,299,300]);

for (const q of source.questions) {
  // Cluster tag
  if (qToCluster[q.id]) q.clusterTag = qToCluster[q.id];

  // Duplicate marker
  if (DUPLICATES[q.id]) q.duplicateOfId = DUPLICATES[q.id];

  // Answer variants
  if (ANSWER_VARIANTS[q.id]) {
    q.answerVariants = { hasVariants: true, noteKey: "ui.answerVariantNote" };
  }

  // Image caption
  if (IMAGE_CAPTIONS[q.id]) {
    q.imageCaptionKey = `questions.${q.id}.imageCaption`;
    msg[`questions.${q.id}.imageCaption`] = IMAGE_CAPTIONS[q.id];
  }

  // Hint rewrite
  const bespoke = BESPOKE[q.id];
  if (bespoke?.hint) {
    msg[q.study.hintKey] = bespoke.hint;
  } else if (keywordLessHints.has(q.id) && !bespoke) {
    msg[q.study.hintKey] = autoHint(q);
  }

  // Memory rewrite
  if (bespoke?.memory) {
    msg[q.study.memoryKey] = bespoke.memory;
  } else if (anchorMemories.has(q.id)) {
    // Only overwrite the rote "Anchor on..." memories
    if ((msg[q.study.memoryKey] || "").startsWith("Anchor on the correct answer phrase")) {
      msg[q.study.memoryKey] = autoMemory(q);
    }
  } else if ((msg[q.study.memoryKey] || "").startsWith("Berlin card: connect")) {
    // Rote Berlin pattern — replace with cluster pointer if not already bespoke
    msg[q.study.memoryKey] = autoMemory(q);
  }

  // Distractor explanations
  const distractors = DISTRACTORS[q.id];
  if (distractors) {
    for (const [idx, why] of Object.entries(distractors)) {
      const answer = q.answers[Number(idx)];
      if (!answer) continue;
      const key = `${answer.translationKey}.why`;
      answer.whyKey = key;
      msg[key] = why;
    }
  }

  // Fix danger-word semantics: don't claim a danger word changes the task
  // if the danger word is in the correct answer. The questionDangerWords stay
  // as highlight-driven, but study.dangerTerms only marks DISTRACTOR traps.
  const correctAnswer = q.answers[q.correctIndex];
  const correctDangerWords = new Set(correctAnswer?.dangerWords || []);
  const allTraps = new Set();
  q.answers.forEach((a, idx) => {
    if (idx === q.correctIndex) return;
    (a.dangerWords || []).forEach(w => allTraps.add(w));
  });
  // Effective danger terms = those appearing in distractors but NOT just the correct answer
  q.study.dangerTerms = [...allTraps].filter(w => !correctDangerWords.has(w) || allTraps.has(w));
}

// ---------- 10. Write back ----------
fs.writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + "\n");
fs.writeFileSync(I18N_PATH, JSON.stringify({ ...i18n, generatedAt: "2026-05-24", messages: msg }, null, 2) + "\n");

console.log("Enrichment applied.");
console.log("  clusters:", Object.keys(CLUSTERS).length);
console.log("  glossary contexts:", Object.keys(GLOSSARY_CONTEXT).length);
console.log("  bespoke hints/memories:", Object.keys(BESPOKE).length);
console.log("  distractor packs:", Object.keys(DISTRACTORS).length);
console.log("  image captions:", Object.keys(IMAGE_CAPTIONS).length);
console.log("  duplicates marked:", Object.keys(DUPLICATES).length);
