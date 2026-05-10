# SANITY_CHECKS.md

This file records sanity checks used to verify that the simulation is producing financially and operationally coherent results. Run these checks after resetting and running the simulation for several years.

---

## 1 — Budget and tuition

These checks confirm that the annual budget projection is accurate and that tuition revenue covers projected expenditures.

**Setup:** After running at least 7+ terms, identify the most recent fully completed year (all `termsPerYear` terms run). Aggregate that year's transaction files and compare to the budget set at its first term.

### 1.a — Budget vs actual expenditures

For the most recent completed year, compare budgeted spend to actual spend by category:

- **Salaries (`SAL`):** Actual should be within a few percent below the projection. The budget projects forward using the prior year's salary total × inflation; attrition during the year means actuals typically come in slightly under.
- **Computers (`ITEQ`):** Actual should be close to the projection. The budget projects `inflationAdjustedCost × employeeCount / 15 × termsPerYear`. Random variance per term is expected; the annual total should converge near the projection.
- **Total spend:** Expect actuals within ~2–3% of budget in a stable year.

*Example result (Year 2026, 22 terms in):* salaries 1.2% under, computers 3.4% over, total 1.2% under budget.

### 1.b — Tuition revenue vs budgeted expenditures

For the same year, compare total tuition revenue to the total budget:

- Revenue should be close to the total budget. The tuition rate is set using the 3-term enrollment average; if enrollment is stable the match will be tight. During ramp-up years, expect a larger gap.
- A small surplus (0–5%) is healthy. A persistent large surplus or deficit indicates a calibration issue with `targetEnrollment`, the tuition adjustment cap, or the budget projection.

*Example result (Year 2026, 22 terms in):* tuition revenue $79k short of budget (-0.7%), net surplus $57k — effectively break-even.

### 1.c — Multi-year budget, revenue, and expenditure trend

For the five most recent completed years, build a summary table showing how budget, revenue, and spend relate over time. This makes ramp-up gaps, drift, and calibration improvements visible at a glance.

| Year | Budget | Revenue | Expenditures | Rev vs Budget | Rev vs Expenditures |
|------|--------|---------|--------------|---------------|---------------------|
| 2022 | $X,XXX,XXX | $X,XXX,XXX | $X,XXX,XXX | +X.X% | +X.X% |
| 2023 | … | … | … | … | … |
| 2024 | … | … | … | … | … |
| 2025 | … | … | … | … | … |
| 2026 | … | … | … | … | … |

**Column definitions:**
- **Rev vs Budget** — `(revenue − budget) / budget × 100`. Positive means a surplus relative to plan; negative means revenue fell short of what was budgeted.
- **Rev vs Expenditures** — `(revenue − expenditures) / expenditures × 100`. Positive means the institution took in more than it spent; negative means it ran a deficit.

**What to look for:**
- Both percentages should converge toward zero in mature years as enrollment stabilises — small positive or negative variances are fine, but a consistent lean in either direction is a calibration signal.
- A persistently negative **Rev vs Budget** suggests the tuition adjustment cap is too tight or `targetEnrollment` is set too high relative to actual demand; persistently positive suggests the inverse.
- A widening gap between **Rev vs Budget** and **Rev vs Expenditures** (i.e. actuals drifting far from the budget projection) suggests the salary inflation factor or computer-replacement rate needs recalibration.

---

## 2 — Output file and simulation complexity

These checks catch unbounded growth that would make the simulation impractical to run over many years.

**Setup:** Run the simulation for at least 10 years (30+ terms). Record the row count of each output file type across all terms.

---

### 2.a — Output file size

Most per-term files represent a snapshot of state for that term and should reach a steady size once the student population stabilises. The ramp-up period lasts roughly as long as a typical degree (4–5 years / 12–15 terms): new students are added each term but the graduation rate doesn't match intake until the first cohorts finish. After ramp-up, inflow and outflow balance, and file sizes plateau.

**Files that should be roughly constant after ramp-up:**

| File | Driven by | Expected stable size (koona_university, 1000-student seed) |
|------|-----------|-------------------------------------------------------------|
| `enrollment.csv` | enrolled student × course pairs | ~3,500–3,900 rows |
| `course_roster.csv` | same as enrollment | ~3,500–3,900 rows |
| `grades.csv` | same as enrollment | ~3,500–3,900 rows |
| `tuition_payments.csv` | enrolled students | ~3,500–3,900 rows |
| `students.csv` | active student roster | ~950–1,050 rows |
| `transactions.csv` | salary + tuition transactions per term | ~880–1,100 rows |
| `employee_roster.csv` | current employee count | ~80–95 rows |
| `employee_payments.csv` | same as employee roster | ~80–95 rows |
| `faculty_assignment.csv` | course count | ~20–30 rows |
| `nonfaculty_expenditures.csv` | computer purchases per term | ~2–10 rows |
| `account_balances.csv` | always one balance row | 1 row |
| `budget.csv` | annual (term 1 only) | 1 row |
| `programs.csv` | program count | 1 row |

**Files that grow at a slow linear rate (expected and acceptable):**

| File | Why it grows | Expected growth rate |
|------|--------------|----------------------|
| `used_person_ids.csv` | Global deduplication ledger; every person ever simulated is retained permanently | ~250–300 rows per simulated year |

**What to look for:**

- After year 10+, plot row counts for `enrollment.csv`, `students.csv`, and `transactions.csv` across terms. All three should have stabilised — flat or within a ±5% band around their mean.
- If any of the "constant" files are still growing monotonically at year 10, check whether the graduation stage is correctly retiring students and whether `targetEnrollment` is higher than the seed population can sustain.
- `used_person_ids.csv` growing faster than ~300 rows/year suggests student IDs are not being reused correctly on re-seeds or that the seed population is being regenerated unintentionally.
- Super-linear (accelerating) growth in any file is a bug. File sizes should never double year-over-year in a mature simulation.

*Example result (koona_university, year 9 / term 27):* all snapshot files stable; `used_person_ids.csv` at 2,482 rows after 27 terms — consistent with ~91 rows/term × 27 terms.

---

### 2.b — Per-term simulation runtime

Each pipeline stage reads the previous term's output and writes the current term's output. If any stage accidentally reads a file that grows with the number of prior terms (rather than just the current term's snapshot), runtime will grow super-linearly and the simulation will become impractical.

**What to measure:** Record wall-clock time for each full pipeline run across at least 10 years of simulated terms. Plot time vs term number.

**Expected behaviour:**

- **Ramp-up period (years 1–5):** Runtime may grow as student and employee populations grow toward their stable sizes.
- **Mature period (years 5+):** Runtime should be roughly flat. Per-term snapshot files stabilise, so each term's pipeline does the same amount of work.
- A slow linear trend (e.g. runtime growing 1–2% per year) is acceptable if driven by `used_person_ids.csv` reads, which is O(n) in the number of prior people simulated.

**Warning signs:**

- Runtime doubling over a multi-year window in the mature period indicates a quadratic bottleneck — most likely a stage that scans all prior output files instead of only the current term's files.
- Check each stage individually: add per-stage timing to `pipeline.ts` and identify which stage's time is growing.
- Common cause: reading `used_person_ids.csv` into a data structure with O(n) lookup (e.g., an array `.includes()` check) instead of a Set. Switch to a Set for O(1) membership tests.

*Example result (koona_university):* Runtime not yet formally measured. Establish a baseline timing run and record it here once done.
