import type { MergedTermGroup, MinimalQuestion } from './schemas.js';

// One shared system prompt is reused across all stages so prompt caching hits.
// Contains: role, curriculum, and the stable rules from the spec.
export function buildSystemPrompt(curriculum: string): string {
  return `Du bist ein Redakteur für Lernmaterial zum Einbürgerungstest „Leben in Deutschland / Berlin".
Du schreibst kurze, sachliche, deutsche Lerntexte für erwachsene Lernende.
Du schreibst niemals UI-Hinweise, Eselsbrücken oder Prüfungssprache.

## Quelle und Grenzen

- Du arbeitest ausschließlich mit der offiziellen deutschen Frage und der offiziellen korrekten Antwort.
- Du verwendest NIE die falschen Antwortoptionen.
- Du veränderst NIE die offiziellen Fakten der Frage.
- Du beziehst Hintergrund aus dem unten eingebetteten BAMF-Curriculum (Orientierungskurs).

## Stilregeln

- Sprache: Deutsch.
- Erkläre den zivilgesellschaftlichen, rechtlichen, historischen oder politischen Hintergrund — keine Übersetzung, keine Definition aus dem Wörterbuch.
- Keine zeitabhängigen Fakten: keine aktuellen Amtsinhaber:innen, keine aktuellen Koalitionen, keine aktuellen Wahlergebnisse.
- Verboten sind diese Phrasen und alles, was so klingt:
  - „Die Frage zeigt …"
  - „In dieser Frage geht es …"
  - „Diese Frage testet …"
  - „Merken Sie sich …"
  - „Eselsbrücke …"
  - jede Form von Klick-, App-, Prüfungs- oder Test-Sprache.

## Was eine Studie-Note (study note) ist

Eine Studie-Note ist eine kurze deutsche Erklärung (ein bis zwei Sätze), die den
zivilgesellschaftlichen Kontext der Frage erklärt — warum die richtige Antwort
in den Kontext passt. Sie spricht direkt vom Thema, nicht von der Frage selbst.

Eine Studie-Note ist NICHT nötig bei reinen Faktenfragen (z. B. Hauptstadt,
nacktes Datum, Abkürzungsauflösung, eindeutige Eins-zu-eins-Tatsache).

## Was ein Glossareintrag ist

Gute Glossarbegriffe:
- Verfassungsrechte und Grundrechte (z. B. Meinungsfreiheit, Grundrecht)
- Staats- und Rechtskonzepte (z. B. Rechtsstaat, Gesetz, Verfassung, Demokratie)
- Institutionen und Ämter (z. B. Bundestag, Bundesrat, Bundespräsident, Gericht)
- Historische und politische Konzepte (z. B. DDR, Wiedervereinigung, Nationalsozialismus)

Schwache Begriffe (verwerfen):
- generische Wörter, Funktionswörter, Modalverben, Negationen
- Korrektheitsausdrücke
- reine Ortsnamen wie „Berlin" allein

Kanonisierung:
- Glossarköpfe stehen im Singular und in der Grundform.
  „Gesetze" → „Gesetz". „Wahlen" → „Wahl". „Grundrechten" → „Grundrecht".

## Curriculum (BAMF-Orientierungskurs, Auszug)

Dies ist deine Hauptquelle für stabile zivilgesellschaftliche, rechtliche und historische Hintergründe.

<curriculum>
${curriculum}
</curriculum>
`;
}

export function buildPerQuestionPrompt(q: MinimalQuestion): string {
  const themeLine = q.theme ? `\nThema (Hinweis, nicht zwingend): ${q.theme}` : '';
  return `Frage-ID: ${q.id}
Frage: ${q.question}
Richtige Antwort: ${q.correctAnswer}${themeLine}

Aufgaben:
1) Entscheide, ob diese Frage eine Studie-Note benötigt (\`needsNote\`). Gib in \`noteReason\` einen kurzen Grund.
2) Liste sinnvolle Glossarkandidaten als \`candidateTerms\`. Jeder Kandidat enthält:
   - \`surface\`: der Begriff genau wie in Frage oder richtiger Antwort vorkommt,
   - \`canonical\`: Singular/Grundform,
   - \`draftExplanation\`: kurze deutsche Erklärung im Kontext DIESER Frage und der richtigen Antwort (2–3 Sätze, sachlich, ohne Prüfungssprache).

Wenn nach den Filterregeln kein sinnvoller Begriff übrig bleibt, gib eine leere Liste zurück.`;
}

export function buildFinalGlossaryPrompt(group: MergedTermGroup): string {
  const drafts = group.draftExplanations.map((d, i) => `(${i + 1}) ${d}`).join('\n');
  const surfaces = group.surfaces.join(', ');
  return `Kanonischer Begriff: ${group.canonical}
Vorkommende Wortformen: ${surfaces}
Verlinkte Fragen: ${group.questionIds.join(', ')}

Vorhandene Roh-Erklärungen aus den einzelnen Fragen:
${drafts}

Aufgabe: Schreibe EINE endgültige deutsche Glossarerklärung für „${group.canonical}".

Anforderungen:
- 2–3 kurze deutsche Sätze.
- Funktioniert für ALLE verlinkten Fragen, nicht nur eine.
- Synthese der Roh-Erklärungen, nicht blind kopieren.
- Stabile zivilgesellschaftliche / rechtliche / historische Hintergründe — keine aktuellen Politiknamen oder Tagesfakten.
- Keine Prüfungs-, UI- oder Eselsbrücken-Sprache.`;
}

export function buildFinalNotePrompt(
  q: MinimalQuestion,
  linkedTerms: Array<{ canonical: string; explanation: string }>,
): string {
  const termsBlock =
    linkedTerms.length > 0
      ? linkedTerms.map((t) => `- ${t.canonical}: ${t.explanation}`).join('\n')
      : '(keine verlinkten Glossarbegriffe)';

  return `Frage-ID: ${q.id}
Frage: ${q.question}
Richtige Antwort: ${q.correctAnswer}

Bereits vorhandene Glossarerklärungen für verlinkte Begriffe (nicht wiederholen):
${termsBlock}

Aufgabe: Schreibe eine endgültige deutsche Studie-Note für diese Frage.

Anforderungen:
- 1–2 kurze deutsche Sätze.
- Erklärt den Kontext genau dieser Frage und warum die richtige Antwort passt.
- Unterscheidet sich klar von den Glossarerklärungen — sie wiederholt diese nicht.
- Spricht direkt vom Thema, nicht von der Frage. Keine Phrasen wie „Die Frage zeigt …", „In dieser Frage geht es …".
- Keine Eselsbrücken, kein UI-Bezug, keine Prüfungssprache, keine zeitabhängigen Fakten.`;
}

export function buildTranslationPrompt(items: Array<{ key: string; de: string }>): string {
  const lines = items.map((it) => `- key=${it.key} | de="${it.de.replace(/\n/g, ' ')}"`).join('\n');
  return `Translate each German learner-prose item below into clear, natural English for adult learners.

Rules:
- Keep the same number of sentences and the same factual content.
- Plain English. No exam meta language ("This question shows…", "This question tests…"), no memory tricks, no UI instructions.
- Keep German civic proper nouns (Grundgesetz, Bundestag, Bundesrat, Bundespräsident, DDR, etc.) in German; add a short English gloss in parentheses only on first mention if a learner would need it.
- Preserve neutral, factual tone. Do not embellish.
- Return one item per input key. The \`key\` field must match the input exactly.

Items:
${lines}`;
}

export function buildShortLabelPrompt(items: Array<{ key: string; term: string }>): string {
  const lines = items.map((it) => `- key=${it.key} | term="${it.term}"`).join('\n');
  return `For each German civic term below, give a short English label.

Rules:
- 1–4 words. No definitions, no sentences, no examples.
- Lowercase unless the English term is a proper noun.
- German proper nouns of institutions/laws/eras keep their German form (e.g. "Grundgesetz" → "Basic Law" is fine; "Bundestag" → "Bundestag"; "DDR" → "East Germany"; "Holocaust" → "Holocaust").
- Years and dates: translate naturally ("3. Oktober" → "3 October"; "1989" → "1989").
- Return one item per key. The \`key\` field must match the input exactly.

Terms:
${lines}`;
}
