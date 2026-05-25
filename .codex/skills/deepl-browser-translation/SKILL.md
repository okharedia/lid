---
name: deepl-browser-translation
description: Use when reviewing or extending German-to-English translations in this repo by manually driving the DeepL website with Playwright batches, comparing DeepL output against data/i18n/en.json, and producing high-confidence translation fixes.
---

# DeepL Browser Translation

Use this for one-off translation review when no DeepL API/MCP key is available. It reproduces the browser workflow used for the Berlin LiD question/answer review.

## Boundaries

- Use normal DeepL website access and report partial output if the site stops accepting input.
- Fresh browser/page sessions are OK for ordinary UI crashes or stale editors.
- Treat DeepL as a review aid. Prefer official terminology for civic/legal terms when DeepL and official sources differ.

## Core Workflow

1. Extract German strings with stable keys.
2. Prefix each line with a marker, e.g. `§001§ German text`.
3. Paste small batches into `https://www.deepl.com/translator#de/en/`.
4. Read the target `d-textarea` value/inner text.
5. Parse by markers and save `{ key, de, current, deepl }`.
6. Compare DeepL output against `data/i18n/en.json`.
7. Patch only high-confidence fixes. Keep style-only differences out unless they remove ambiguity.
8. Run `npm run test:data`. Run broader tests when implementation files changed.

## Repo Script

Use the bundled script from the repo root:

```bash
node .codex/skills/deepl-browser-translation/scripts/deepl-web-review.mjs
```

Default output:

```text
tmp/deepl-web-review/core-translations.json
```

The script translates the 310 questions plus 4 answers each from `data/lid-berlin-source-of-truth.json` and compares them with `data/i18n/en.json`.

Useful options:

```bash
node .codex/skills/deepl-browser-translation/scripts/deepl-web-review.mjs \
  --start 0 \
  --max-chars 850 \
  --max-items 22 \
  --output tmp/deepl-web-review/core-translations.json
```

If a run stops partway through, resume from the translated count:

```bash
node .codex/skills/deepl-browser-translation/scripts/deepl-web-review.mjs --start 1222
```

## Review Heuristics

Prioritize fixes where:

- the current English changes the meaning, e.g. `staatliche Gewalt` as `state violence`;
- two answer choices collapse into the same English text;
- a legal/civic term has an official English equivalent;
- the current English is ungrammatical or misleading for learners.

Common terms from the reviewed pass:

- `Abgeordnetenhaus`: `Berlin House of Representatives`
- `Bundesrat`: `Bundesrat (Federal Council)`
- `Fraktion`: `parliamentary group`
- `staatliche Gewalt`: `branch of government` / `state power`, not `state violence`
- `Ministerpräsident(in)`: `Minister-President`
- `wählen`: `vote`; `gewählt werden`: `be elected`
- `Prozess` before a court: `trial`

## Validation

After editing translations:

```bash
npm run test:data
```

If e2e tests fail in unrelated UI controls, report that separately and do not mix the fix into a translation-only PR.
