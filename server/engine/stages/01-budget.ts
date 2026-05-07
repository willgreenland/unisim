import path from 'path';
import { existsSync } from 'fs';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

function calcDeptSalaryTotals(rosterPath: string): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const f of readCSV(rosterPath)) {
    if (f.active_status !== 'AC') continue;
    totals[f.department_id] = (totals[f.department_id] ?? 0) + parseInt(f.salary, 10);
  }
  return totals;
}

export async function runBudget(ctx: SimContext): Promise<StageResult> {
  if (!ctx.isFirstTermOfYear) {
    return { stage: 'budget', skipped: true, outputFiles: [] };
  }

  const departments = readCSV(path.join(ctx.inputDir, 'departments.csv'));

  const prevRosterPath = path.join(ctx.outputDir, `${ctx.prevTermTag}_employee_roster.csv`);
  const salaryTotals = existsSync(prevRosterPath)
    ? calcDeptSalaryTotals(prevRosterPath)
    : {};

  const budgetRows = departments.map(d => ({
    department_id: d.department_id,
    faculty_salary_total: salaryTotals[d.department_id] ?? 0,
  }));

  const budgetPath = path.join(ctx.outputDir, `${ctx.termTag}_budget.csv`);
  writeCSV(budgetPath, budgetRows);

  return { stage: 'budget', skipped: false, outputFiles: [budgetPath] };
}
