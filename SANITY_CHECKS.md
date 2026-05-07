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
