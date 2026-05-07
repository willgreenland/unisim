import path from 'path';
import { existsSync } from 'fs';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

const COMPUTER_BASE_COST = 2500;

function loadInflation(ctx: SimContext): { inflationRate: number; cumulativeInflation: number } {
  const inflationPath = path.join(ctx.externalDir, `${ctx.termTag}_inflation.csv`);
  const rows = existsSync(inflationPath) ? readCSV(inflationPath) : [];
  return {
    inflationRate: rows.length > 0 ? parseFloat(rows[0].inflation_rate) : 0,
    cumulativeInflation: rows.length > 0 ? parseFloat(rows[0].cumulative_inflation) : 1.0,
  };
}

export async function runBudget(ctx: SimContext): Promise<StageResult> {
  if (!ctx.isFirstTermOfYear) {
    return { stage: 'budget', skipped: true, outputFiles: [] };
  }

  const departments = readCSV(path.join(ctx.inputDir, 'departments.csv'));
  const { inflationRate, cumulativeInflation } = loadInflation(ctx);
  const computerUnitCost = Math.round(COMPUTER_BASE_COST * cumulativeInflation);

  const prevRosterPath = path.join(ctx.outputDir, `${ctx.prevTermTag}_employee_roster.csv`);

  const salaryByDept: Record<string, number> = {};
  const countByDept: Record<string, number> = {};
  if (existsSync(prevRosterPath)) {
    for (const e of readCSV(prevRosterPath)) {
      if (e.active_status !== 'AC') continue;
      salaryByDept[e.department_id] = (salaryByDept[e.department_id] ?? 0) + parseInt(e.salary, 10);
      countByDept[e.department_id] = (countByDept[e.department_id] ?? 0) + 1;
    }
  }

  const budgetRows = departments.map(d => {
    const currentSalaries = salaryByDept[d.department_id] ?? 0;
    const employeeCount = countByDept[d.department_id] ?? 0;
    const projected_salary_total = Math.round(currentSalaries * (1 + inflationRate));
    const computer_budget = Math.round(computerUnitCost * employeeCount / 15) * ctx.termsPerYear;
    const total_budget = projected_salary_total + computer_budget;
    return { department_id: d.department_id, projected_salary_total, computer_budget, total_budget };
  });

  const budgetPath = path.join(ctx.outputDir, `${ctx.termTag}_budget.csv`);
  writeCSV(budgetPath, budgetRows);

  return { stage: 'budget', skipped: false, outputFiles: [budgetPath] };
}
