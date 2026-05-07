import path from 'path';
import { existsSync } from 'fs';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

function getTotalSalaries(ctx: SimContext): number {
  const budgetPath = path.join(ctx.outputDir, `${ctx.termTag}_budget.csv`);
  if (existsSync(budgetPath)) {
    const total = readCSV(budgetPath).reduce((sum, row) => sum + parseInt(row.faculty_salary_total, 10), 0);
    if (total > 0) return total;
  }
  const rosterPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_roster.csv`);
  if (!existsSync(rosterPath)) {
    throw new Error(`No salary data for term ${ctx.termTag}: budget is zero and faculty roster is missing`);
  }
  return readCSV(rosterPath)
    .filter(f => f.active_status === 'AC')
    .reduce((sum, f) => sum + parseInt(f.salary, 10), 0);
}

// Sets tuition rates for all programs using targetEnrollment as the steady-state estimate.
// Later terms use adjustRates().
function computeInitialRates(
  programs: string[],
  totalBudget: number,
  targetEnrollment: number,
  termsPerYear: number,
): Record<string, number> {
  const rate = Math.round(totalBudget / (targetEnrollment * termsPerYear));
  return Object.fromEntries(programs.map(p => [p, rate]));
}

function adjustRates(
  programs: string[],
  totalBudget: number,
  studentCount: number,
  termsPerYear: number,
  prevRates: Record<string, number>,
): Record<string, number> {
  const target = studentCount > 0
    ? Math.round(totalBudget / (studentCount * termsPerYear))
    : 0;
  return Object.fromEntries(programs.map(p => {
    const prev = prevRates[p] ?? 0;
    if (prev === 0) return [p, target];
    return [p, Math.max(prev, Math.min(target, Math.floor(prev * 1.15)))];
  }));
}

function carryForwardRates(programs: string[], prevProgramsPath: string): Record<string, number> {
  const prevPrograms = existsSync(prevProgramsPath) ? readCSV(prevProgramsPath) : [];
  return Object.fromEntries(prevPrograms.map(p => [p.degree_program, parseInt(p.tuition_per_term, 10)]));
}

export async function runTuitionPayment(ctx: SimContext): Promise<StageResult> {
  const prevStudentsPath = ctx.prevTermTag === '000000'
    ? path.join(ctx.inputDir, 'students.csv')
    : path.join(ctx.outputDir, `${ctx.prevTermTag}_students.csv`);

  const allStudents = existsSync(prevStudentsPath) ? readCSV(prevStudentsPath) : [];
  const activeStudents = allStudents.filter(s => s.active_status === 'AC');
  const programs = [...new Set(activeStudents.map(s => s.degree_program))].sort();

  const prevProgramsPath = path.join(ctx.outputDir, `${ctx.prevTermTag}_programs.csv`);
  const year = Math.floor(ctx.termCode / 100);
  const isFixedPeriod = year < ctx.startYear + 4;

  let rateByProgram: Record<string, number>;

  if (!ctx.isFirstTermOfYear) {
    rateByProgram = carryForwardRates(programs, prevProgramsPath);
  } else if (ctx.prevTermTag === '000000') {
    const totalSalaries = getTotalSalaries(ctx);
    rateByProgram = computeInitialRates(programs, totalSalaries * 2, ctx.targetEnrollment, ctx.termsPerYear);
  } else if (isFixedPeriod) {
    const prevRates = carryForwardRates(programs, prevProgramsPath);
    const needsInit = programs.length > 0 && programs.every(p => (prevRates[p] ?? 0) === 0);
    if (needsInit) {
      const totalSalaries = getTotalSalaries(ctx);
      rateByProgram = computeInitialRates(programs, totalSalaries * 2, ctx.targetEnrollment, ctx.termsPerYear);
    } else {
      rateByProgram = prevRates;
    }
  } else {
    const totalSalaries = getTotalSalaries(ctx);
    const prevRates = carryForwardRates(programs, prevProgramsPath);
    rateByProgram = adjustRates(programs, totalSalaries * 2, activeStudents.length, ctx.termsPerYear, prevRates);
  }

  const programsPath = path.join(ctx.outputDir, `${ctx.termTag}_programs.csv`);
  writeCSV(programsPath, programs.map(p => ({
    degree_program: p,
    active_status: 'AC',
    tuition_per_term: rateByProgram[p] ?? 0,
  })));

  const paymentsPath = path.join(ctx.outputDir, `${ctx.termTag}_tuition_payments.csv`);
  writeCSV(paymentsPath, activeStudents.map(s => {
    const tuition = rateByProgram[s.degree_program] ?? 0;
    const payment_reference = ctx.transactions.create(ctx.termDate, tuition, 10000, 'TUIT');
    return { student_id: s.student_id, degree_program: s.degree_program, term: ctx.termCode, tuition, payment_reference };
  }));

  return { stage: 'tuition-payment', skipped: false, outputFiles: [programsPath, paymentsPath] };
}
