# Stateful Trainer Flow

## Surfaces

- Default mode is Learn.
- The top navigation includes a language picker; English is active, Spanish and French are visible but disabled placeholders.
- Desktop uses the left review panel.
- Mobile opens the same review panel from the top filter button.
- The review panel has three tabs: Filters, Known, and Test.
- Learn order is stable; shuffle is intentionally not part of the trainer.

## Button Variants

- Primary buttons use solid indigo for the main forward action.
- Secondary buttons use indigo outline and indigo text for important but lower-pressure actions.
- Tertiary buttons use quiet text styling for supportive navigation.

## Filters

- Filters show available and total counts: `available/total`.
- Known questions are excluded from learning and tests.
- Starting a test uses the active filter only.

## Known Questions

- Marking a question known in Learn removes it from the learning deck immediately.
- Known questions can be reviewed and removed from the Known tab.
- Known state persists in localStorage.

## Test Session

- A test samples up to the configured test size from random available questions in the active filter.
- The temporary default test size is 3 for easier local testing.
- Test size can be configured from the Test tab, overridden with `?testSize=18`, or set with `localStorage.setItem("lid-test-size", "18")`.
- Test translations are off by default for German-only practice and can be turned on from the Test tab.
- Test answer feedback is on by default and can be turned off from the Test tab to hold correctness until results.
- If fewer questions are available than the configured size, the test uses the smaller set.
- With immediate feedback on, answers reveal correctness immediately; with it off, the chosen answer uses a neutral selected state until the result.
- Test progress persists until finished or restarted.
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
