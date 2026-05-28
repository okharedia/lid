# Stateful Trainer Flow

## Surfaces

- Default mode is Learn.
- Question links use `/q/{Question ID}` and open the target question in Learn.
- Missing question links show a not-found state with a path back to Learn.
- The top navigation includes a language picker; English is active, Spanish and French are visible but disabled placeholders.
- Desktop uses the left review panel.
- Mobile and tablet widths open the same review panel as a dismissible overlay from the top filter button.
- The review panel has three tabs: Filters, Known, and Test.
- Learn order is stable; shuffle is intentionally not part of the trainer.

## Button Variants

- Primary buttons use solid indigo for the main forward action.
- Secondary buttons use indigo outline and indigo text for important but lower-pressure actions.
- Tertiary buttons use quiet text styling for supportive navigation.

## Filters

- Filters show total question counts only.
- Known questions are excluded from learning and tests.
- Starting a test uses the active filter only.
- The progress counter shows the current question's position in the active filter's total question set, including mastered questions.
- The progress counter and first/last controls use borderless filled surfaces; in Test, the counter collapses to a single right-aligned pill.
- The progress counter opens a compact anchored popover with a numeric field and icon submit button; jumping to a different number opens that question link and resets the filter to all.
- Answer rows use borderless filled surfaces, with correctness communicated by state fill, text color, and the trailing mark. Revealed non-selected wrong answers use dedicated dim-answer tokens so the fill stays visible without dropping text below readable contrast.
- Answer rows keep radio-option behavior while rendering selectable text, so learners can copy terms without choosing an answer.

## Known Questions

- Marking a question known in Learn removes it from the learning deck immediately.
- Known questions can be reviewed, opened through their question link, and removed from the Known tab.
- Known state persists in localStorage.

## Test Session

- A test samples up to the configured test size from random available questions in the active filter.
- The temporary default test size is 3 for easier local testing.
- Test size can be configured from the Test tab, overridden with `?testSize=18`, or set with `localStorage.setItem("lid-test-size", "18")`.
- Test translations are off by default for German-only practice and can be turned on from the Test tab.
- Test answer feedback is on by default and can be turned off from the Test tab to hold correctness until results.
- If fewer questions are available than the configured size, the test uses the smaller set.
- With immediate feedback on, answers reveal correctness immediately; with it off, the chosen answer uses a neutral selected state until the result.
- Test questions use the same FRAGE badge as Learn; duplicate/seen-before chips and first/last progress controls are hidden to keep the test header quiet.
- Test progress persists until finished or restarted.
- Opening a question link switches to Learn without clearing the resumable test session.
- Switching between Learn and Test preserves each mode's current question.
- Changing filters during an answered test prompts because it restarts the session.

## Results

- Finish appears after the final question is answered.
- Passing is 90% or higher and uses a celebratory result state.
- Lower scores use an encouraging result state.
- Results show missed questions, the learner's answer, and the correct answer.
- Completed results are not saved as long-term score history.

## Internationalization

- All visible app shell copy, ARIA labels, category labels, and dynamic result/status text are keyed in `data/i18n/en.json`.
- Question, answer, study-help, glossary, and per-answer explanation translations continue to use the question-owned keys from the source-of-truth data.
- Answer translations are suppressed when the answer and translation are the same numeric string, avoiding duplicate number rows while still allowing localized number forms in other languages.
