import path from 'path';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

export async function runFacultyPayment(ctx: SimContext): Promise<StageResult> {
  const roster = readCSV(path.join(ctx.outputDir, `${ctx.termTag}_faculty_roster.csv`));
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

  const paymentsPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_payments.csv`);
  writeCSV(paymentsPath, paymentRows);

  return { stage: 'faculty-payment', skipped: false, outputFiles: [paymentsPath] };
}
