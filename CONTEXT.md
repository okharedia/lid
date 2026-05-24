# LiD Trainer

This context describes the learning vocabulary for the LiD question trainer.

## Language

**Question**:
An official LiD prompt with four answer choices and exactly one correct answer.
_Avoid_: Card

**Known Question**:
A question the learner has marked as mastered, excluding it from learning and tests until the mark is removed.
_Avoid_: Completed card, saved question

**Available Question**:
A question that is not currently marked known and can appear in learning or tests.
_Avoid_: Active card, unresolved card

**Filter**:
A learner-selected question grouping that narrows learning and tests to available questions in that group.
_Avoid_: Category-only view

**Review Panel**:
The shared desktop aside or mobile side panel where learners inspect filters and saved learning state.
_Avoid_: Settings page, profile page

**Test**:
A scored session drawn from available questions in the active filter, with correctness revealed after each answer.
_Avoid_: Quiz mode, exam mode

**Test Session**:
The current test attempt, including its sampled questions, answers, score, and position.
_Avoid_: Test state, exam run

**Test Result**:
The finished test summary showing score, pass status, and missed questions with the learner's answer and correct answer.
_Avoid_: Score page, report

## Relationships

- A **Known Question** is always a **Question**.
- A **Known Question** is excluded from both learning and tests.
- Marking the current learning **Question** known removes it from learning immediately.
- **Known Questions** cannot be changed inside an active **Test Session**.
- A correct answer in a **Test** does not automatically create a **Known Question**.
- An **Available Question** is a **Question** that is not a **Known Question**.
- A **Filter** shows available and total question counts for its group.
- The **Review Panel** contains **Filters** and **Known Questions**.
- A **Test** contains up to 18 available questions from the active **Filter**.
- Restarting a **Test Session** does not change **Known Questions** or the active **Filter**.
- Changing the active **Filter** ends the current **Test Session** and starts from that filter's available questions.
- A **Test Session** is finished from the final answered question and ends on a results view.
- A **Test Result** is passing when its score is 90% or higher.
- A **Test Result** shows missed **Questions** with the learner's answer and correct answer.
- A **Test Result** is not kept as long-term learner history.
- An unfinished **Test Session** can resume after refresh.

## Example dialogue

> **Dev:** "Should this **Question** appear in a test after the learner marks it known?"
> **Domain expert:** "No — a **Known Question** should stay out of learning and tests until the learner removes that mark."
> **Dev:** "Should the **Filter** count hide known questions?"
> **Domain expert:** "Show both: how many **Available Questions** remain and how many total questions exist in the group."
> **Dev:** "If the learner filters to Elections and starts a **Test**, can Berlin state questions appear?"
> **Domain expert:** "No — the **Test** should use only **Available Questions** inside the active **Filter**."
> **Dev:** "Where should learners remove a **Known Question**?"
> **Domain expert:** "In the **Review Panel**, alongside filters and saved learning state."
> **Dev:** "After the learner marks the current learning **Question** known, should it stay visible?"
> **Domain expert:** "No — it should immediately leave learning and the next **Available Question** should appear."
> **Dev:** "Can a **Test** start when only 7 **Available Questions** remain?"
> **Domain expert:** "Yes — the **Test** should use those 7 questions and make the shorter size clear."
> **Dev:** "Should a **Test** hide correctness until the end?"
> **Domain expert:** "No — reveal correctness after each answer, then summarize the score at the end."
> **Dev:** "Does restarting a **Test Session** remove known marks?"
> **Domain expert:** "No — it only resets the sampled questions, answers, score, and position for the current **Test Session**."
> **Dev:** "Can a **Test Session** continue after switching from Elections to Berlin?"
> **Domain expert:** "No — changing the **Filter** changes the question pool, so the current **Test Session** ends."
> **Dev:** "Should a correct answer in a **Test** make the **Question** known?"
> **Domain expert:** "No — becoming a **Known Question** should be deliberate."
> **Dev:** "Can learners mark questions known during a **Test Session**?"
> **Domain expert:** "No — known-question management belongs outside active tests."
> **Dev:** "When does a **Test Session** finish?"
> **Domain expert:** "After the final question is answered, the learner can finish and see results."
> **Dev:** "What makes a **Test Result** passing?"
> **Domain expert:** "A score of 90% or higher passes."
> **Dev:** "What should learners see after a lower **Test Result**?"
> **Domain expert:** "Encouragement plus the missed **Questions**, including their chosen answer and the correct answer."
> **Dev:** "Should old **Test Results** be saved as learner history?"
> **Domain expert:** "No — show the current result, but do not keep long-term score history."
> **Dev:** "If the learner refreshes mid-test, should the **Test Session** restart?"
> **Domain expert:** "No — an unfinished **Test Session** should resume where it left off."

## Flagged ambiguities

- "known" was used as both a label and a study-state action — resolved: **Known Question** means mastered and excluded from future learning and tests.
- Marking known could apply after navigation or immediately — resolved: marking the current learning **Question** known removes it immediately.
- Filter counts could mean either total questions or remaining questions — resolved: a **Filter** shows available and total counts.
- State viewing could be a separate settings page or use the existing panel — resolved: the **Review Panel** holds filters and known-question management.
- Test scope could mean all available questions or filtered available questions — resolved: a **Test** uses the active **Filter**.
- Test size could require exactly 18 questions or use fewer when fewer are available — resolved: a **Test** uses up to 18 available questions.
- Test feedback could be delayed until completion or shown immediately — resolved: a **Test** reveals correctness after each answer.
- Correct test answers could automatically become known questions — resolved: **Known Question** is deliberate, not automatic.
- Known-question changes could be allowed during tests — resolved: active **Test Sessions** do not change **Known Questions**.
- Restarting could mean clearing all learner state or only the current attempt — resolved: restart resets only the **Test Session**.
- Filter changes during a test could preserve or end the attempt — resolved: changing **Filter** ends the current **Test Session**.
- Passing could mean above 90% or at least 90% — resolved: **Test Result** passes at 90% or higher.
- Test results could become score history — resolved: **Test Result** is not kept as long-term learner history.
- Refreshing mid-test could restart or resume the attempt — resolved: unfinished **Test Sessions** resume.
