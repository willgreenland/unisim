import path from 'path';
import { SimContext, StageResult, Faculty, FacultyRank, MAX_LOAD } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';
import { generatePerson, loadUsedIds, savePersonRecords, PersonRecord } from '../person.js';

const REMAINDER_RANKS: FacultyRank[] = ['PROF', 'ASSO', 'RPRO', 'CPRO'];

function pickNewHireRank(): FacultyRank {
  const r = Math.random();
  if (r < 0.10) return 'INST';
  if (r < 0.30) return 'LECT';
  if (r < 0.60) return 'ASST';
  return REMAINDER_RANKS[Math.floor(Math.random() * REMAINDER_RANKS.length)];
}

function departureProbability(careerYears: number): number {
  if (careerYears < 25) return 0.02;
  if (careerYears >= 45) return 0.99;
  return 0.02 + (careerYears - 25) * (0.97 / 20);
}

function resolveOutcome(
  rank: FacultyRank,
  careerYears: number,
  isLastTermOfYear: boolean,
): { keep: false } | { keep: true; newRank?: FacultyRank } {
  if (isLastTermOfYear) {
    if (rank === 'ASST' && careerYears === 7) {
      const r = Math.random();
      if (r < 0.65) return { keep: true, newRank: 'ASSO' };
      if (r < 0.70) return { keep: true, newRank: 'PROF' };
      return { keep: false };
    }
    if (rank === 'INST' && careerYears === 4) {
      return Math.random() < 0.10
        ? { keep: true, newRank: 'ASST' }
        : { keep: false };
    }
    if (rank === 'ASSO' && careerYears >= 12 && careerYears <= 18) {
      if (Math.random() < 0.10) return { keep: true, newRank: 'PROF' };
    }
  }

  return Math.random() >= departureProbability(careerYears)
    ? { keep: true }
    : { keep: false };
}

export async function runFacultyHiring(ctx: SimContext): Promise<StageResult> {
  const faculty = readCSV(path.join(ctx.outputDir, `${ctx.prevTermTag}_faculty_roster.csv`)) as unknown as Faculty[];
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv'));

  const year = Math.floor(ctx.termCode / 100);
  const term = ctx.termCode % 100;
  const events: Record<string, string | number>[] = [];

  const yearIncrement = ctx.isLastTermOfYear ? 1 : 0;
  const aged = faculty.map(f => ({
    ...f,
    term: ctx.termCode,
    career_years: String(parseInt(f.career_years, 10) + yearIncrement),
    years_since_hire: String(parseInt(f.years_since_hire, 10) + yearIncrement),
    years_at_rank: String(parseInt(f.years_at_rank, 10) + yearIncrement),
  }));

  const continuing: typeof aged = [];
  for (const f of aged) {
    const careerYears = parseInt(f.career_years, 10);
    const outcome = resolveOutcome(f.rank, careerYears, ctx.isLastTermOfYear);
    if (!outcome.keep) {
      events.push({ year, term, faculty_id: f.faculty_id, fakename: f.fakename, event: 'DEP' });
    } else if (outcome.newRank) {
      events.push({ year, term, faculty_id: f.faculty_id, fakename: f.fakename, event: 'PROM' });
      continuing.push({ ...f, rank: outcome.newRank, years_at_rank: '0' });
    } else {
      continuing.push(f);
    }
  }

  const courseCountByDept: Record<string, number> = {};
  for (const course of courses) {
    courseCountByDept[course.department_id] = (courseCountByDept[course.department_id] ?? 0) + 1;
  }

  const capacityByDept: Record<string, number> = {};
  for (const f of continuing) {
    if (f.active_status !== 'AC') continue;
    capacityByDept[f.department_id] = (capacityByDept[f.department_id] ?? 0) + (MAX_LOAD[f.rank] ?? 2);
  }

  const usedIds = loadUsedIds(ctx.outputDir);
  const newPersonRecords: PersonRecord[] = [];
  const newHires: Record<string, string | number>[] = [];

  for (const [deptId, courseCount] of Object.entries(courseCountByDept)) {
    let deficit = courseCount - (capacityByDept[deptId] ?? 0);
    while (deficit > 0) {
      const rank = pickNewHireRank();
      const { id, fakename, record } = generatePerson(usedIds, 'faculty', ctx.termCode);
      newPersonRecords.push(record);
      newHires.push({
        faculty_id: id,
        fakename,
        department_id: deptId,
        rank,
        salary: '100000',
        active_status: 'AC',
        career_years: '1',
        years_since_hire: '1',
        years_at_rank: '1',
        term: ctx.termCode,
      });
      events.push({ year, term, faculty_id: id, fakename, event: 'HIRE' });
      deficit -= MAX_LOAD[rank];
    }
  }

  savePersonRecords(ctx.outputDir, newPersonRecords);

  const rosterPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_roster.csv`);
  writeCSV(rosterPath, [...continuing, ...newHires]);

  const eventsPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_events.csv`);
  writeCSV(eventsPath, events);

  return { stage: 'faculty-hiring', skipped: false, outputFiles: [rosterPath, eventsPath] };
}
