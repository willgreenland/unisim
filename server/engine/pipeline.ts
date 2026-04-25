import { mkdirSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import { SimContext } from './types.js'
import { runBudget } from './stages/01-budget.js'
import { runFacultyHiring } from './stages/02-faculty-hiring.js'
import { runFacultyAssignment } from './stages/03-faculty-assignment.js'
import { runTuitionPayment } from './stages/04-tuition-payment.js'
import { runEnrollment } from './stages/05-enrollment.js'
import { runFacultyPayment } from './stages/06-faculty-payment.js'
import { runGrading } from './stages/07-grading.js'
import { runReporting } from './stages/08-reporting.js'

function getNextTermNumber(outputDir: string): number {
  if (!existsSync(outputDir)) return 1
  const existing = readdirSync(outputDir)
    .map(f => f.match(/^term_(\d+)_/))
    .filter(Boolean)
    .map(m => parseInt(m![1], 10))
  const max = existing.length > 0 ? Math.max(...existing) : -1
  return max + 1
}

export async function runPipeline(simName: string): Promise<void> {
  const root = process.cwd()
  const inputDir = path.join(root, 'data', simName, 'input')
  const outputDir = path.join(root, 'data', simName, 'output')
  const fixturesDir = path.join(root, 'fixtures')

  if (!existsSync(path.join(outputDir, 'term_000_students.csv'))) {
    throw new Error('Seed data not found. Generate a seed first via POST /api/seed/:simName.')
  }

  mkdirSync(outputDir, { recursive: true })

  const termNumber = getNextTermNumber(outputDir)
  const termTag = `term_${String(termNumber).padStart(3, '0')}`
  const prevTermTag = `term_${String(termNumber - 1).padStart(3, '0')}`

  const ctx: SimContext = { simName, inputDir, outputDir, fixturesDir, termNumber, termTag, prevTermTag }

  await runBudget(ctx)
  await runFacultyHiring(ctx)
  await runFacultyAssignment(ctx)
  await runTuitionPayment(ctx)
  await runEnrollment(ctx)
  await runFacultyPayment(ctx)
  await runGrading(ctx)
  await runReporting(ctx)
}
