import path from 'path';
import { existsSync } from 'fs';
import { SimContext, StageResult, Faculty } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

export async function runFacultyHiring(ctx: SimContext): Promise<StageResult> {
  // STUB: Simulate contract renewals, retirements, and new hires.
  // Carries forward the previous term's faculty roster as a stand-in.
  const prevRosterPath = path.join(ctx.outputDir, `${ctx.prevTermTag}_faculty_roster.csv`);
  const sourcePath = existsSync(prevRosterPath)
    ? prevRosterPath
    : path.join(ctx.fixturesDir, 'faculty.csv');

  const faculty = readCSV(sourcePath) as unknown as Faculty[];
  const outputPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_roster.csv`);
  writeCSV(outputPath, faculty.map(f => ({ ...f, term: ctx.termNumber })));
  return { stage: 'faculty-hiring', skipped: true, outputFiles: [outputPath] };
}
