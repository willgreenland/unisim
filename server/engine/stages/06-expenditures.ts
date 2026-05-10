import path from 'path';
import { existsSync } from 'fs';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

function runSalaryPayments(ctx: SimContext): string {
  const roster = readCSV(path.join(ctx.outputDir, `${ctx.termTag}_employee_roster.csv`));
  const active = roster.filter(f => f.active_status === 'AC');

  const regularPayment = (salary: number) => Math.floor(salary / ctx.termsPerYear);

  const paymentRows = active.map(f => {
    const salary = parseInt(f.salary, 10);
    const payment = ctx.isLastTermOfYear
      ? salary - (ctx.termsPerYear - 1) * regularPayment(salary)
      : regularPayment(salary);
    const payment_reference = ctx.transactions.create(ctx.termDate, -payment, 10000, 'SAL');
    return { faculty_id: f.faculty_id, department_id: f.department_id, term: ctx.termCode, salary, payment, payment_reference };
  });

  const paymentsPath = path.join(ctx.outputDir, `${ctx.termTag}_employee_payments.csv`);
  writeCSV(paymentsPath, paymentRows);
  return paymentsPath;
}

const COMPUTER_BASE_COST = 2500;

function runNonSalaryExpenditures(ctx: SimContext): string[] {
  const roster = readCSV(path.join(ctx.outputDir, `${ctx.termTag}_employee_roster.csv`));

  const countByDept: Record<string, number> = {};
  for (const e of roster) {
    if (e.active_status !== 'AC') continue;
    countByDept[e.department_id] = (countByDept[e.department_id] ?? 0) + 1;
  }

  const inflationPath = path.join(ctx.externalDir, `${ctx.termTag}_inflation.csv`);
  const inflationRows = existsSync(inflationPath) ? readCSV(inflationPath) : [];
  const cumulativeInflation = inflationRows.length > 0 ? parseFloat(inflationRows[0].cumulative_inflation) : 1.0;
  const computerUnitCost = Math.round(COMPUTER_BASE_COST * cumulativeInflation);

  const rows: Record<string, string | number>[] = [];

  for (const [deptId, employeeCount] of Object.entries(countByDept)) {
    for (let i = 0; i < employeeCount; i++) {
      if (Math.random() >= 1 / 15) continue;
      const payment_reference = ctx.transactions.create(ctx.termDate, -computerUnitCost, 10000, 'ITEQ');
      rows.push({ department_id: deptId, term: ctx.termCode, expense_type: 'ITEQ', unit_cost: computerUnitCost, payment_reference });
    }
  }

  if (rows.length === 0) return [];

  const outputPath = path.join(ctx.outputDir, `${ctx.termTag}_nonfaculty_expenditures.csv`);
  writeCSV(outputPath, rows);
  return [outputPath];
}

export async function runExpenditures(ctx: SimContext): Promise<StageResult> {
  const paymentsPath = runSalaryPayments(ctx);
  const extraPaths = runNonSalaryExpenditures(ctx);

  return { stage: 'expenditures', skipped: false, outputFiles: [paymentsPath, ...extraPaths] };
}
