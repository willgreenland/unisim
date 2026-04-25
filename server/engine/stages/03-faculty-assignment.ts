import path from 'path'
import { SimContext, StageResult } from '../types.js'
import { readCSV, writeCSV } from '../csv.js'

export async function runFacultyAssignment(ctx: SimContext): Promise<StageResult> {
  // STUB: Assign faculty to courses based on departmental load limits.
  // Loading hardcoded faculty-course assignments from fixtures as a stand-in.
  const assignments = readCSV(path.join(ctx.fixturesDir, 'faculty_assignments.csv'))
  const outputPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_assignment.csv`)
  writeCSV(outputPath, assignments.map(a => ({ ...a, term: ctx.termNumber })))
  return { stage: 'faculty-assignment', skipped: true, outputFiles: [outputPath] }
}
