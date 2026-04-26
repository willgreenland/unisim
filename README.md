# UniSim

A university term simulation engine that generates synthetic CSV datasets for trainee data analysts to practice building reporting tools against.

## What it does

UniSim simulates an academic institution one term at a time. Each run produces a set of CSV files covering student enrollment, course grades, faculty assignments, and degree awards. The data is procedurally generated from configurable seed parameters, so analysts get realistic, relational datasets without working with real personal information.

## Quick start

```bash
npm install
npm run dev
```

The app runs at **http://localhost:5173**. The Express API listens on port 3001; the Vite dev server proxies all `/api` requests to it.

Before running a simulation, generate a seed population:

```bash
curl -X POST http://localhost:3001/api/seed/koona_university \
  -H "Content-Type: application/json" \
  -d '{"numStudents":1000,"numFaculty":100}'
```

Then use the **Run Next Term** button in the browser to step through terms one at a time.

## Output files

Each term produces a set of `term_NNN_*.csv` files in `data/{simName}/output/`:

| File | Contents |
|------|----------|
| `term_NNN_students.csv` | Active student roster with cumulative GPA and course count |
| `term_NNN_enrollment.csv` | One row per student–course pair |
| `term_NNN_course_roster.csv` | Same enrollment data keyed by course |
| `term_NNN_faculty_roster.csv` | Faculty list for the term |
| `term_NNN_faculty_assignment.csv` | Faculty–course teaching assignments |
| `term_NNN_grades.csv` | Score, letter grade, and grade points per enrollment |
| `term_NNN_degrees_awarded.csv` | Students who graduated this term (only present if ≥ 1 graduate) |

`term_000_*` files are the seed population. Simulation terms start at `term_001`.

## Simulation parameters

The included simulation is `koona_university`. Its input files live in `data/koona_university/input/`:

- `departments.csv` — three departments (CS, MATH, PHYS)
- `majors.csv` — one major per department with weighted enrolment distribution
- `courses.csv` — 100 courses across all departments

Students graduate after accumulating 4000 units (40 passed courses at 100 units each), taking a minimum of 10 terms. Failed courses (below C−) do not count toward the degree and can be retaken.

## Development

```bash
npm run typecheck   # type-check frontend and server
npm test            # run all tests
```

See `ROADMAP.md` for the development plan.
