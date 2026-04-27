import path from 'path';
import { SimContext, StageResult, Faculty } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

export async function runFacultyHiring(ctx: SimContext): Promise<StageResult> {
  // STUB: Simulate contract renewals, retirements, and new hires.
  // Carries forward the previous term's faculty roster as a stand-in.
  const faculty = readCSV(path.join(ctx.outputDir, `${ctx.prevTermTag}_faculty_roster.csv`)) as unknown as Faculty[];
  const outputPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_roster.csv`);
  writeCSV(outputPath, faculty.map(f => ({
    ...f,
    term: ctx.termNumber,
    career_years: String(parseInt(f.career_years, 10) + 1),
    years_since_hire: String(parseInt(f.years_since_hire, 10) + 1),
    years_at_rank: String(parseInt(f.years_at_rank, 10) + 1),
  })));
  return { stage: 'faculty-hiring', skipped: true, outputFiles: [outputPath] };
}
