import { mkdirSync, readdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { SimContext, UniversitySettings } from './types.js';
import { TransactionLog } from './financials.js';
import { runBudget } from './stages/01-budget.js';
import { runFacultyHiring } from './stages/02-faculty-hiring.js';
import { runFacultyAssignment } from './stages/03-faculty-assignment.js';
import { runTuitionPayment } from './stages/04-tuition-payment.js';
import { runEnrollment } from './stages/05-enrollment.js';
import { runFacultyPayment } from './stages/06-faculty-payment.js';
import { runGrading } from './stages/07-grading.js';
import { runReporting } from './stages/08-reporting.js';

function loadSettings(inputDir: string): UniversitySettings {
  const settingsPath = path.join(inputDir, 'settings.json');
  return JSON.parse(readFileSync(settingsPath, 'utf-8')) as UniversitySettings;
}

function nextTermCode(outputDir: string, startYear: number, termsPerYear: number): { termCode: number; prevTermTag: string } {
  const existing = existsSync(outputDir)
    ? readdirSync(outputDir)
        .map(f => f.match(/^(\d{6})_/))
        .filter(Boolean)
        .map(m => parseInt(m![1], 10))
        .filter(code => code > 0)
    : [];

  if (existing.length === 0) {
    return { termCode: startYear * 100 + 1, prevTermTag: '000000' };
  }

  const maxCode = Math.max(...existing);
  const maxYear = Math.floor(maxCode / 100);
  const maxTermWithinYear = maxCode % 100;

  let nextYear = maxYear;
  let nextTermWithinYear = maxTermWithinYear + 1;
  if (nextTermWithinYear > termsPerYear) {
    nextYear++;
    nextTermWithinYear = 1;
  }

  return { termCode: nextYear * 100 + nextTermWithinYear, prevTermTag: String(maxCode) };
}

export async function runPipeline(simName: string): Promise<void> {
  const root = process.cwd();
  const inputDir = path.join(root, 'data', simName, 'input');
  const outputDir = path.join(root, 'data', simName, 'output');

  mkdirSync(outputDir, { recursive: true });

  const { startYear, termsPerYear, termStartMonths, targetEnrollment } = loadSettings(inputDir);
  const { termCode, prevTermTag } = nextTermCode(outputDir, startYear, termsPerYear);
  const termTag = String(termCode);

  const termWithinYear = termCode % 100;
  const month = termStartMonths[termWithinYear - 1];
  const year = Math.floor(termCode / 100);
  const termDate = `${year}${String(month).padStart(2, '0')}01`;

  const prevTransactionsPath = path.join(outputDir, `${prevTermTag}_transactions.csv`);
  const transactions = new TransactionLog(prevTransactionsPath);

  const ctx: SimContext = {
    simName, inputDir, outputDir, termCode, termTag, prevTermTag,
    termsPerYear,
    startYear,
    targetEnrollment,
    isFirstTermOfYear: termWithinYear === 1,
    isLastTermOfYear: termWithinYear === termsPerYear,
    termDate,
    transactions,
  };

  await runBudget(ctx);
  await runFacultyHiring(ctx);
  await runFacultyAssignment(ctx);
  await runTuitionPayment(ctx);
  await runEnrollment(ctx);
  await runFacultyPayment(ctx);
  await runGrading(ctx);
  await runReporting(ctx);

  transactions.write(path.join(outputDir, `${termTag}_transactions.csv`));
}
