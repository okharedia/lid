# LiD Trainer

This context describes the learning vocabulary for the LiD question trainer.

## Language

**Question**:
An official LiD prompt with four answer choices and exactly one correct answer.
_Avoid_: Card

**Question ID**:
The globally unique catalog number that identifies one **Question**.
_Avoid_: Local number, display number, index

**Question Source**:
The protected official German content for a **Question**: its **Question ID**, prompt, answer choices, and correct answer position.
_Avoid_: App database, metadata, generated question

**Learner Metadata**:
Editable learner-support content attached to a **Question ID**, such as translation keys, **Study Notes**, and glossary references.
_Avoid_: Source of truth, official facts

**Study Note**:
A German learner-support note that explains the exact **Question** context and can be translated for the selected learner language.
_Avoid_: Hint, memory aid, keyword tip

**Glossary Term**:
A meaningful German word or phrase highlighted in a **Question** and explained in the glossary.
_Avoid_: Keyword, danger word

**Matched Term Text**:
The exact German text span from a **Question** prompt or correct answer that supports a **Glossary Term**.
_Avoid_: Lemma, normalized term

**Question Content Draft**:
An AI-generated review artifact for one **Question** containing candidate **Glossary Terms**, draft glossary explanations, and a draft **Study Note**.
_Avoid_: Final metadata, automatic import

**Corpus Content Review**:
The review pass that deduplicates **Glossary Terms** and refines glossary explanations and **Study Notes** across all **Questions**.
_Avoid_: Per-question generation, final write

**Content Suggestion File**:
A structured review file containing final proposed learner-support content before it is accepted into **Learner Metadata** or translation files.
_Avoid_: Metadata, generated source of truth

**Known Question**:
A question the learner has marked as mastered, excluding it from learning and tests until the mark is removed.
_Avoid_: Completed card, saved question

**Available Question**:
A question that is not currently marked known and can appear in learning or tests.
_Avoid_: Active card, unresolved card

**Question Position**:
The current **Question**'s ordinal place inside the active **Filter**.
_Avoid_: Available count, mastered-adjusted count

**Question Link**:
A direct `/q/{Question ID}` link that opens a specific **Question** in learning context.
_Avoid_: Test deeplink, practice question

**Missing Question Link**:
A **Question Link** whose **Question ID** does not match any **Question**.
_Avoid_: Empty deck, silent redirect

**Filter**:
A learner-selected question grouping that narrows learning and tests to questions in that group.
_Avoid_: Category-only view

**Review Panel**:
The shared desktop aside or mobile side panel where learners inspect filters and saved learning state.
_Avoid_: Settings page, profile page

**Test**:
A scored session drawn from available questions in the active filter, with correctness revealed after each answer unless delayed feedback is configured.
_Avoid_: Quiz mode, exam mode

**Test Session**:
The current test attempt, including its sampled questions, answers, score, and position.
_Avoid_: Test state, exam run

**Test Result**:
The finished test summary showing score, pass status, and missed questions with the learner's answer and correct answer.
_Avoid_: Score page, report

## Relationships

- A **Known Question** is always a **Question**.
- A **Question** has exactly one **Question ID**.
- A **Question Source** contains the official German text for a **Question**.
- **Learner Metadata** references a **Question** by **Question ID**.
- **Learner Metadata** must not redefine official German question or answer text.
- A **Study Note** belongs to one **Question** and explains that question's context.
- A **Glossary Term** can be highlighted inside a **Question** and linked to its glossary explanation.
- A **Glossary Term** for a **Question** must appear in that **Question**'s prompt or correct answer.
- A **Glossary Term** must not be selected from a wrong answer only.
- Obvious function words such as "alle", "nicht", "nur", "kein", "keine", "muss", "kann", "darf", "richtig", and "falsch" are not **Glossary Terms**.
- "Berlin" is not a **Glossary Term** in this trainer.
- A **Glossary Term** can have many **Matched Term Texts** across **Questions**.
- A **Matched Term Text** belongs to exactly one **Question** occurrence.
- A **Matched Term Text** must be validated against the **Question** prompt or correct answer.
- A **Glossary Term** has one final glossary explanation across all accepted **Matched Term Texts**.
- A final glossary explanation should be two or three short German sentences unless the content direction changes.
- A final **Glossary Term** must keep provenance to the **Question IDs** and **Matched Term Texts** that caused its inclusion.
- A **Study Note** carries the question-specific explanation that does not belong in the global glossary explanation.
- A final **Study Note** is traced by **Question ID** and does not need claim-level provenance.
- A **Study Note** may explain naturally without mentioning every linked **Glossary Term**.
- A **Study Note** should be one or two short German sentences unless the content direction changes.
- **Study Notes** and glossary explanations may include factual civic background beyond the **Question Source**.
- Civic background in **Study Notes** and glossary explanations must be stable historical, legal, or civic context, not current officeholders, coalitions, election results, or time-sensitive facts.
- A **Question Content Draft** belongs to exactly one **Question**.
- A **Question Content Draft** is based on the **Question** prompt and correct answer only.
- A **Question Content Draft** can propose multiple **Glossary Terms**.
- A **Question Content Draft** uses German as the canonical language for learner-support prose.
- A **Corpus Content Review** combines many **Question Content Drafts** into one reviewable set.
- A **Content Suggestion File** contains final proposed content, not per-question draft artifacts.
- A **Content Suggestion File** must not modify **Question Source**.
- AI generation writes proposed learner-support content to a **Content Suggestion File** before production metadata or translation files are updated.
- A **Content Suggestion File** contains German learner-support prose and stable translation keys, not translated learner prose.
- Accepted **Content Suggestion File** entries can update **Learner Metadata** and translation files.
- A **Known Question** is excluded from both learning and tests.
- A **Question Link** can open a **Known Question** even though known questions are excluded from normal learning flow.
- Marking the current learning **Question** known removes it from learning immediately.
- **Known Questions** cannot be changed inside an active **Test Session**.
- A correct answer in a **Test** does not automatically create a **Known Question**.
- An **Available Question** is a **Question** that is not a **Known Question**.
- A **Question Link** targets one **Question** and does not create or enter a **Test Session**.
- A **Question Link** opens learning context without ending the current **Test Session**.
- A **Question Link** resets the active **Filter** to all questions.
- Normal learning navigation updates the current **Question Link** target.
- A **Missing Question Link** shows an explicit not-found state.
- A **Question Position** counts mastered and unmastered **Questions** in the active **Filter**.
- Normal learning navigation skips **Known Questions** while preserving **Question Position** numbering.
- A **Filter** shows the total question count for its group.
- The **Review Panel** contains **Filters** and **Known Questions**.
- A **Test** contains up to 18 available questions from the active **Filter**.
- Restarting a **Test Session** does not change **Known Questions** or the active **Filter**.
- Changing the active **Filter** ends the current **Test Session** and starts from that filter's available questions.
- A **Test Session** is finished from the final answered question and ends on a results view.
- A **Test Result** is passing when its score is 90% or higher.
- A **Test Result** shows missed **Questions** with the learner's answer and correct answer.
- A **Test Result** is not kept as long-term learner history.
- An unfinished **Test Session** can resume after refresh.
- Delayed test feedback keeps the selected answer neutral during the **Test Session** and shows scoring in the **Test Result**.

## Example dialogue

> **Dev:** "Should this **Question** appear in a test after the learner marks it known?"
> **Domain expert:** "No — a **Known Question** should stay out of learning and tests until the learner removes that mark."
> **Dev:** "Should the **Filter** count hide known questions?"
> **Domain expert:** "No — show the total question count for the group."
> **Dev:** "If the learner filters to Elections and starts a **Test**, can Berlin state questions appear?"
> **Domain expert:** "No — the **Test** should use only **Available Questions** inside the active **Filter**."
> **Dev:** "Should a glossary link to question 24 use the local displayed number or the global **Question ID**?"
> **Domain expert:** "Use the global **Question ID** — question 24 means the **Question** whose ID is 24."
> **Dev:** "What should the canonical URL for question 24 be?"
> **Domain expert:** "`/q/24`."
> **Dev:** "What should happen for `/q/999` when no such **Question** exists?"
> **Domain expert:** "Show a not-found state instead of silently redirecting."
> **Dev:** "Should that link open question 24 inside a **Test Session**?"
> **Domain expert:** "No — a **Question Link** opens that **Question** in learning context only."
> **Dev:** "If a learner opens a **Question Link** during a **Test Session**, should the test be lost?"
> **Domain expert:** "No — the link switches to learning context, and the **Test Session** can resume when the learner switches back."
> **Dev:** "After opening a **Question Link**, should learning navigation keep the URL on the original question?"
> **Domain expert:** "No — the URL should follow the current learning **Question**."
> **Dev:** "If question 24 is a **Known Question**, should its **Question Link** still open?"
> **Domain expert:** "Yes — the link should still show the **Question** with its mastered state visible."
> **Dev:** "If a learner opens a **Question Link** while filtered to Elections, should that filter stay active?"
> **Domain expert:** "No — opening a **Question Link** resets the **Filter** to all questions."
> **Dev:** "If a mastered question is skipped, should the progress count shrink?"
> **Domain expert:** "No — progress shows the **Question Position** inside the active **Filter**, while navigation skips mastered questions."
> **Dev:** "Where should learners remove a **Known Question**?"
> **Domain expert:** "In the **Review Panel**, alongside filters and saved learning state."
> **Dev:** "After the learner marks the current learning **Question** known, should it stay visible?"
> **Domain expert:** "No — it should immediately leave learning and the next **Available Question** should appear."
> **Dev:** "Can a **Test** start when only 7 **Available Questions** remain?"
> **Domain expert:** "Yes — the **Test** should use those 7 questions and make the shorter size clear."
> **Dev:** "Should a **Test** hide correctness until the end?"
> **Domain expert:** "Default to immediate feedback, but allow delayed feedback from the Test config."
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
- Linking to a question could mean entering a **Test Session** or opening the **Question** directly — resolved: a **Question Link** opens learning context only.
- The question route could be long or short — resolved: **Question Links** use `/q/{Question ID}`.
- Invalid question links could redirect silently or fail visibly — resolved: a **Missing Question Link** shows a not-found state.
- Opening a link during a **Test Session** could discard or preserve the session — resolved: **Question Links** preserve the current **Test Session**.
- Question numbers could mean local/source numbering or global catalog identity — resolved: **Question Link** numbers use **Question ID**.
- Source content and learner-support content could live together — resolved: **Question Source** contains official German facts; **Learner Metadata** contains notes, translation keys, and glossary references.
- Hints, memory aids, keywords, and danger words overlapped — resolved: use **Study Note** for question context and **Glossary Term** for highlighted terms.
- Learning navigation after a **Question Link** could leave the original URL or follow the current question — resolved: the URL follows the current learning **Question**.
- Known questions could be hidden from links because they are excluded from learning — resolved: **Question Links** can still open **Known Questions**.
- A **Question Link** could preserve the active **Filter** or change it — resolved: opening a **Question Link** resets the **Filter** to all questions.
- Progress could count only available questions or all questions in the active **Filter** — resolved: **Question Position** counts all filtered questions, while navigation skips mastered questions.
- Marking known could apply after navigation or immediately — resolved: marking the current learning **Question** known removes it immediately.
- Filter counts could mean total questions or remaining questions — resolved: a **Filter** shows total question count.
- State viewing could be a separate settings page or use the existing panel — resolved: the **Review Panel** holds filters and known-question management.
- Test scope could mean all available questions or filtered available questions — resolved: a **Test** uses the active **Filter**.
- Test size could require exactly 18 questions or use fewer when fewer are available — resolved: a **Test** uses up to 18 available questions.
- Test feedback could be delayed until completion or shown immediately — resolved: a **Test** defaults to immediate feedback and can delay it from config.
- Correct test answers could automatically become known questions — resolved: **Known Question** is deliberate, not automatic.
- Known-question changes could be allowed during tests — resolved: active **Test Sessions** do not change **Known Questions**.
- Restarting could mean clearing all learner state or only the current attempt — resolved: restart resets only the **Test Session**.
- Filter changes during a test could preserve or end the attempt — resolved: changing **Filter** ends the current **Test Session**.
- Passing could mean above 90% or at least 90% — resolved: **Test Result** passes at 90% or higher.
- Test results could become score history — resolved: **Test Result** is not kept as long-term learner history.
- Refreshing mid-test could restart or resume the attempt — resolved: unfinished **Test Sessions** resume.
