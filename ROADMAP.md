# ROADMAP.md

Development roadmap for UniSim. Phases are ordered by dependency — Phase 1 must come first, but Phase 2 can run in parallel with it.

---

## Phase 1 — Foundations
*Prerequisite for Phases 3–5*

- Add `departments.csv` as a first-class seed file (department name, headcount targets, courses per department)
- Implement a **procedural seed generator** — a new API endpoint that builds the initial population (students, faculty, courses) from parameters and writes it to `data/{simName}/output/` as `term_000_*` files; scale target is thousands of students and hundreds of faculty
- Refactor the pipeline so each term reads its starting state from the previous term's `term_NNN_*` outputs rather than from a fixed `input/` directory

## Phase 2 — Reporting stage
*First stub to implement; independent of Phase 1*

- Implement stage 8 to write a final set of clean per-term record files, collecting the term's outputs (enrollment, grades, faculty assignment) into a consistent structure
- No aggregation or analysis yet — well-formed output files only

## Phase 3 — Multi-term chaining
*Near-term requirement; depends on Phase 1*

- Students carry forward their course history and are not re-enrolled in courses they have already passed
- Cumulative GPA recalculates each term from the full grade history
- Students increment year level each term
- Students accumulate credits and graduate once they reach a defined threshold, exiting the active population

## Phase 4 — Faculty assignment
*Second stub to implement; depends on Phase 1*

- Assign faculty to courses within their own department, replacing the fixture-based stub
- Respect a per-faculty maximum course load per term

## Phase 5 — Faculty hiring
*Third stub to implement; depends on Phase 1*

- Simulate attrition each term (retirements, departures) based on configurable rates
- Generate replacement hires to maintain department headcount targets
