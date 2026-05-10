# ROADMAP.md

Development roadmap for UniSim. Phases are ordered by dependency — Phase 1 must come first, but Phase 2 can run in parallel with it.

---

## Phase 1 — Foundations ✓
*Prerequisite for Phases 3–5*

- `departments.csv`, `majors.csv`, `courses.csv`, and `settings.json` exist as static input seed files under `data/{simName}/input/`. The seed API endpoint (`POST /api/seed/:simName`) currently only creates the output directory; population data lives in `input/` and is authored manually.
- The pipeline determines the next term by scanning existing output files for the highest `YYYYTT` term code, where `TT` is the term-within-year (1–`termsPerYear`). `startYear` and `termsPerYear` come from `settings.json`. The first term uses `prevTermTag = '000000'`; subsequent terms read their starting state from the prior term's output files.

## Phase 2 — Reporting stage ✓
*First stub to implement; independent of Phase 1*

- Stage 8 runs at the end of each term. It scans all grade files ever written to compute each student's cumulative credit-weighted GPA (all attempts, passed and failed) and passed-course count. Students who have passed 40 courses are written to `{termTag}_degrees_awarded.csv` and removed from the active population. All others carry forward to `{termTag}_students.csv` with updated GPA and course count. Year level increments once per academic year on `isLastTermOfYear`.

## Phase 3 — Multi-term chaining ✓
*Near-term requirement; depends on Phase 1*

- Enrollment reads all previous `{termTag}_grades.csv` files to build per-student passed-course sets. Students are never enrolled in a course they have already passed.
- GPA is recalculated from scratch each term in stage 8 from the full cumulative grade history. The denominator is credit-hours attempted (not course count), using the `credits` column from `courses.csv`.
- Year level is stored on the student record and incremented in stage 8 on the last term of each academic year.
- Graduation threshold is 40 passed courses. Graduates exit the active population and are not carried forward.

## Phase 4 — Faculty assignment ✓
*Second stub to implement; depends on Phase 1*

- Stage 3 groups courses and faculty by `department_id`. Within each department, courses are shuffled randomly and assigned greedily to faculty who still have remaining load capacity. Faculty are only eligible if `active_status = 'AC'`.
- Maximum course load per term by rank: PROF/ASSO/ASST = 2, LECT/INST = 3, RPRO/CPRO = 1. Courses exceeding the department's total load capacity go unassigned.
- Writes `{termTag}_faculty_assignment.csv`.

## Phase 5 — Employee hiring ✓
*Third stub to implement; depends on Phase 1*

- Stage 2 reads the previous term's employee roster and ages all faculty: `career_years`, `years_since_hire`, and `years_at_rank` each increment by 1 on `isLastTermOfYear`.
- Attrition uses a career-years-based departure probability: flat 2% below 25 years, rising linearly to 99% at 45 years. Departures are recorded as `DEP` events.
- Promotions are evaluated only at end of year: ASST at exactly 7 career years has a 65% chance of promotion to ASSO and 5% chance to PROF (otherwise departs); INST at exactly 4 years has a 10% chance of conversion to ASST (otherwise departs); ASSO between 12–18 years has a 10% chance per year of promotion to PROF. Promotions reset `years_at_rank` to 0 and are recorded as `PROM` events.
- After attrition, the stage calculates teaching capacity per department (sum of MAX_LOAD for all continuing active faculty) and hires until the deficit against the course count is covered. New hire ranks are drawn randomly: 10% INST, 20% LECT, 30% ASST, 40% split equally among PROF/ASSO/RPRO/CPRO. All new hires are assigned a flat `salary = 100000` regardless of rank.
- Writes `{termTag}_employee_roster.csv` and `{termTag}_employee_events.csv`.

---

## Enrollment detail — major alignment and course level progression ✓

Stage 5 (enrollment) implements two layers of course selection logic on top of basic eligibility (not already passed, has remaining capacity):

**Level gating**: Course level is extracted from the numeric portion of the course ID (e.g. CS301 → level 3). Students may only enroll in a level once they have passed a minimum number of courses at the level below: level 2 requires 4 passed level-1 courses, level 3 requires 6 passed level-2, level 4 requires 6 passed level-3.

**Weighted sampling**: Each eligible course is assigned a weight of `majorMult × levelWeight`. `majorMult` is 3 if the course's `department_id` matches the department of the student's declared major (`specialization_1`), otherwise 1. `levelWeight` is 2.5 if the student's passed-course share at that level is below 20%, otherwise 1. This biases enrollment toward the student's major and toward underrepresented levels without hard-excluding anything.

New students enter with zero passed courses and only level-1 unlocked, so their first term is always level-1 courses in their declared major's department.

---

## Phase 7 — Employee term activities
*Depends on Phase 5 (employee roster); splits the existing grading stage into two sub-stages*

Stage 7 covers what faculty do during a term beyond teaching. It is split into two sub-stages that run in order before reporting.

### 7a — Research output *(new)*

Each term, each active faculty member is independently sampled for research publications using rank-based probabilities:

- **RPRO**: highest base rate — their capped teaching load (1 course/term) represents dedicated research time.
- **CPRO**: low base rate — their reduced teaching load is reserved for other activities to be modelled in future phases.
- **PROF/ASSO**: medium rate.
- **ASST**: lower rate (building a research programme).
- **LECT/INST**: minimal rate (teaching-focused appointments).

Two publication types are sampled independently per faculty member per term: **ARTICLE** (journal article, higher probability) and **BOOK** (lower probability). A faculty member can produce at most one of each type per term.

**Procedural generation:**

- *Titles* are constructed by sampling from a fixed word list to produce plausible-sounding academic title strings.
- *Journals* are drawn from a fixed list of two journals per department/field. Articles are attributed to a journal from the author's department.
- *Publishers* are drawn from a fixed list of academic book publishers. Books are attributed to one publisher regardless of department.
- *Publication ID* is a unique fake reference number in IBAN-style format (e.g. `PUB-XXXX-XXXX-XXXX-XXXX`), generated fresh for each publication.

Writes `{termTag}_research_output.csv` with columns: `publication_id`, `employee_id`, `department_id`, `publication_type` (ARTICLE | BOOK), `term`, `title`, `venue` (journal name or publisher name).

### 7b — Grading *(relabeled; previously the sole stage 7)*

Unchanged from its prior implementation. Each enrolled student-course pair receives a grade, score, and grade points. Writes `{termTag}_grades.csv`.

---

## Phase 6 — Non-faculty expenditures
*Depends on Phases 1 and 5*

The university incurs costs beyond faculty salaries — facilities, administration, IT, student services, etc. These should be simulated and recorded as transactions so that the financial picture is complete and analysts can model total cost against tuition revenue.

- A non-faculty expenditure amount is calculated each term and written to `{termTag}_nonfaculty_expenditures.csv` with at minimum a total and a per-department breakdown.
- Expenditures are recorded as outflow transactions (negative amounts) with an appropriate expense type code.
- The budget stage (stage 1) should incorporate non-faculty expenditure projections alongside faculty salary totals so that the tuition rate calculation targets full cost coverage, not just salary cost times a fixed multiplier.

---

## Future improvements

Enhancements deferred until core phases are stable.

- **Richer research title generation** — the current generator uses a naive vowel-letter check for "a/an" article selection, producing incorrect forms like "An Unified". Replace with a phonetic lookup or exception list for words with a consonant onset despite a leading vowel letter. Additional title patterns and a larger, more field-differentiated word list would also improve realism.

- **Gift revenue** — model one-off and recurring donations from alumni and external benefactors as an additional income stream. Gifts should be recorded as inflow transactions with a distinct expense type code and reflected in the budget stage so that the tuition rate accounts for expected gift income.
