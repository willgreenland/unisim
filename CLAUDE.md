# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UniSim** is a university term simulation engine that generates synthetic CSV datasets for trainee analysts to use when building reporting tools. It simulates one academic term at a time, running through an ordered pipeline of sub-stages and writing multiple output CSV files per term.

The app has two parts:
- **`server/`** — Express API that drives the simulation and reads/writes files
- **`src/`** — Vite + React frontend: displays current input files and provides a one-click "Run Next Term" button

## Setup & Commands

```bash
npm install

# Development — starts Vite (port 5173) and Express (port 3001) concurrently
npm run dev

# Type check both frontend and server
npm run typecheck

# Run all tests
npm test

# Run a single test file
npx vitest run server/engine/stages/05-enrollment.test.ts

# Generate a seed population (required before first simulation run)
curl -X POST http://localhost:3001/api/seed/koona_university \
  -H "Content-Type: application/json" \
  -d '{"numStudents":1000,"numFaculty":100}'
```

## Architecture

### Request flow

```
Browser (Vite :5173)  →  /api/*  →  Express (:3001)  →  Simulation pipeline  →  CSV files
```

Vite proxies all `/api` requests to Express in development (see `vite.config.ts`).

### Simulation pipeline

Stages run in a fixed order because each stage may depend on outputs from the prior one. The pipeline is orchestrated in `server/engine/pipeline.ts`, which determines the next term number by scanning for existing `term_NNN_*` files in the output directory.

| # | Stage | Status |
|---|-------|--------|
| 1 | Budget setting | stub (no output) |
| 2 | Faculty hiring | stub (reads `fixtures/faculty.csv`) |
| 3 | Faculty assignment | **active** |
| 4 | Tuition payment | stub (no output) |
| 5 | Course enrollment | **active** |
| 6 | Faculty payment | stub (no output) |
| 7 | Grading | **active** |
| 8 | Reporting | **active** |

Stub stages that need to provide data to downstream stages read from `fixtures/` and write output CSVs. Stub stages with no downstream dependencies contain only a comment and return `skipped: true`.

### Output files per term

Each term run writes files named `term_NNN_<type>.csv` into `data/{simName}/output/`:
- `term_NNN_enrollment.csv` — one row per student-course pair
- `term_NNN_course_roster.csv` — same data, keyed by course
- `term_NNN_faculty_roster.csv` — faculty list for this term (from fixture)
- `term_NNN_faculty_assignment.csv` — faculty-course assignments (from fixture)
- `term_NNN_grades.csv` — grade, score, and grade_points per student-course pair

### Data directories

```
data/{simName}/input/    # students.csv, courses.csv — simulation-specific seed data
data/{simName}/output/   # generated per run, never overwritten
fixtures/                # shared stub CSVs (faculty.csv, faculty_assignments.csv)
```

`data/koona_university/` is the example simulation included in the repo.

### CSV helpers

`server/engine/csv.ts` exports `readCSV` and `writeCSV`. All stage files use these — do not inline CSV parsing in stages.

### Key design constraint

Output CSV schemas are the contract that analysts build reporting tools against. Column names and types should not change without a deliberate decision.

## Code style

Always terminate statements with semicolons.

## Roadmap

See `ROADMAP.md` for the full development plan. In brief:

- **Phase 1** — Department seed file, procedural population generator, multi-term data flow
- **Phase 2** — Reporting stage (active)
- **Phase 3** — Multi-term chaining (GPA carry-over, course history, graduation)
- **Phase 4** — Faculty assignment (active)
- **Phase 5** — Faculty hiring (active)
