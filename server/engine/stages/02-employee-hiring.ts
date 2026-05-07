import path from 'path';
import { existsSync } from 'fs';
import { SimContext, StageResult, Faculty, FacultyRank, MAX_LOAD } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';
import { generatePerson, loadUsedIds, savePersonRecords, PersonRecord } from '../person.js';

const ADMIN_RANKS = new Set<FacultyRank>(['AD01', 'AD02', 'AD03']);
const ADMN_DEPT_ID = '890001';
const HR_DEPT_ID = '890002';

const REMAINDER_RANKS: FacultyRank[] = ['PROF', 'ASSO', 'RPRO', 'CPRO'];

function loadInflation(ctx: SimContext): { inflationRate: number; cumulativeInflation: number } {
  const inflationPath = path.join(ctx.externalDir, `${ctx.termTag}_inflation.csv`);
  const rows = existsSync(inflationPath) ? readCSV(inflationPath) : [];
  return {
    inflationRate: rows.length > 0 ? parseFloat(rows[0].inflation_rate) : 0,
    cumulativeInflation: rows.length > 0 ? parseFloat(rows[0].cumulative_inflation) : 1.0,
  };
}

function pickNewFacultyRank(): FacultyRank {
  const r = Math.random();
  if (r < 0.10) return 'INST';
  if (r < 0.30) return 'LECT';
  if (r < 0.60) return 'ASST';
  return REMAINDER_RANKS[Math.floor(Math.random() * REMAINDER_RANKS.length)];
}

function facultyDepartureProbability(careerYears: number): number {
  if (careerYears < 25) return 0.02;
  if (careerYears >= 45) return 0.99;
  return 0.02 + (careerYears - 25) * (0.97 / 20);
}

function adminDepartureProbability(careerYears: number): number {
  if (careerYears < 25) return 0.10;
  if (careerYears >= 50) return 1.00;
  return 0.10 + (careerYears - 25) * (0.90 / 25);
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

  return Math.random() >= facultyDepartureProbability(careerYears)
    ? { keep: true }
    : { keep: false };
}

function computeHireSalary(
  rank: FacultyRank,
  deptId: string,
  rankSalaries: Record<string, number>,
  deptFactors: Record<string, number>,
  cumulativeInflation: number,
): number {
  const base = rankSalaries[rank] ?? 90000;
  const factor = deptFactors[deptId] ?? 1;
  const random = 0.9 + Math.random() * 0.2;
  return Math.round(base * factor * random * cumulativeInflation);
}

function adminTargets(
  deptId: string,
  facultyCountByDept: Record<string, number>,
  totalContinuingEmployees: number,
): Record<string, number> {
  if (deptId === ADMN_DEPT_ID) {
    return { AD03: 1, AD02: 5, AD01: 7 };
  }
  if (deptId === HR_DEPT_ID) {
    return { AD03: 1, AD02: 2, AD01: Math.ceil(totalContinuingEmployees / 20) };
  }
  const facultyCount = facultyCountByDept[deptId] ?? 0;
  return { AD02: 1, AD01: Math.ceil(facultyCount / 5) };
}

export async function runEmployeeHiring(ctx: SimContext): Promise<StageResult> {
  const prevRosterPath = path.join(ctx.outputDir, `${ctx.prevTermTag}_employee_roster.csv`);
  const allPrev: Faculty[] = existsSync(prevRosterPath)
    ? readCSV(prevRosterPath) as unknown as Faculty[]
    : [];
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv'));
  const departments = readCSV(path.join(ctx.inputDir, 'departments.csv'));

  const rankSalaries: Record<string, number> = {};
  for (const row of readCSV(path.join(ctx.inputDir, 'rank_salaries.csv'))) {
    rankSalaries[row.rank] = parseInt(row.base_salary, 10);
  }

  const deptFactors: Record<string, number> = {};
  for (const row of readCSV(path.join(ctx.inputDir, 'department_salary_factors.csv'))) {
    deptFactors[row.department_id] = parseFloat(row.salary_factor);
  }

  const { inflationRate, cumulativeInflation } = loadInflation(ctx);

  const year = Math.floor(ctx.termCode / 100);
  const term = ctx.termCode % 100;
  const events: Record<string, string | number>[] = [];

  const yearIncrement = ctx.isLastTermOfYear ? 1 : 0;
  const aged = allPrev.map(f => {
    const currentSalary = parseInt(f.salary, 10);
    const newSalary = ctx.isLastTermOfYear
      ? Math.round(currentSalary * (1 + inflationRate + (Math.random() * 0.02 - 0.01)))
      : currentSalary;
    return {
      ...f,
      term: ctx.termCode,
      salary: String(newSalary),
      career_years: String(parseInt(f.career_years, 10) + yearIncrement),
      years_since_hire: String(parseInt(f.years_since_hire, 10) + yearIncrement),
      years_at_rank: String(parseInt(f.years_at_rank, 10) + yearIncrement),
    };
  });

  const continuingFaculty: typeof aged = [];
  const continuingAdmin: typeof aged = [];

  for (const f of aged) {
    const careerYears = parseInt(f.career_years, 10);
    if (ADMIN_RANKS.has(f.rank)) {
      if (Math.random() < adminDepartureProbability(careerYears)) {
        events.push({ year, term, faculty_id: f.faculty_id, fakename: f.fakename, event: 'DEP' });
      } else {
        continuingAdmin.push(f);
      }
    } else {
      const outcome = resolveOutcome(f.rank, careerYears, ctx.isLastTermOfYear);
      if (!outcome.keep) {
        events.push({ year, term, faculty_id: f.faculty_id, fakename: f.fakename, event: 'DEP' });
      } else if (outcome.newRank) {
        events.push({ year, term, faculty_id: f.faculty_id, fakename: f.fakename, event: 'PROM' });
        continuingFaculty.push({ ...f, rank: outcome.newRank, years_at_rank: '0' });
      } else {
        continuingFaculty.push(f);
      }
    }
  }

  // Faculty hiring: fill teaching capacity deficit per academic department
  const courseCountByDept: Record<string, number> = {};
  for (const course of courses) {
    courseCountByDept[course.department_id] = (courseCountByDept[course.department_id] ?? 0) + 1;
  }

  const capacityByDept: Record<string, number> = {};
  for (const f of continuingFaculty) {
    if (f.active_status !== 'AC') continue;
    capacityByDept[f.department_id] = (capacityByDept[f.department_id] ?? 0) + (MAX_LOAD[f.rank] ?? 0);
  }

  const usedIds = loadUsedIds(ctx.outputDir);
  const newPersonRecords: PersonRecord[] = [];
  const newHires: Record<string, string | number>[] = [];

  for (const [deptId, courseCount] of Object.entries(courseCountByDept)) {
    let deficit = courseCount - (capacityByDept[deptId] ?? 0);
    while (deficit > 0) {
      const rank = pickNewFacultyRank();
      const { id, fakename, record } = generatePerson(usedIds, 'faculty', ctx.termCode);
      newPersonRecords.push(record);
      newHires.push({
        faculty_id: id,
        fakename,
        department_id: deptId,
        rank,
        salary: String(computeHireSalary(rank, deptId, rankSalaries, deptFactors, cumulativeInflation)),
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

  // Admin hiring: fill headcount deficit per rank per department
  const facultyCountByDept: Record<string, number> = {};
  for (const f of continuingFaculty) {
    if (f.active_status !== 'AC') continue;
    facultyCountByDept[f.department_id] = (facultyCountByDept[f.department_id] ?? 0) + 1;
  }
  for (const h of newHires) {
    const deptId = h.department_id as string;
    facultyCountByDept[deptId] = (facultyCountByDept[deptId] ?? 0) + 1;
  }

  const adminCountByDeptRank: Record<string, Record<string, number>> = {};
  for (const f of continuingAdmin) {
    if (f.active_status !== 'AC') continue;
    if (!adminCountByDeptRank[f.department_id]) adminCountByDeptRank[f.department_id] = {};
    adminCountByDeptRank[f.department_id][f.rank] =
      (adminCountByDeptRank[f.department_id][f.rank] ?? 0) + 1;
  }

  const totalContinuingEmployees =
    continuingFaculty.filter(f => f.active_status === 'AC').length +
    continuingAdmin.filter(f => f.active_status === 'AC').length;

  for (const dept of departments) {
    const deptId = dept.department_id;
    const targets = adminTargets(deptId, facultyCountByDept, totalContinuingEmployees);
    for (const [rank, target] of Object.entries(targets)) {
      const current = adminCountByDeptRank[deptId]?.[rank] ?? 0;
      let deficit = target - current;
      while (deficit > 0) {
        const { id, fakename, record } = generatePerson(usedIds, 'faculty', ctx.termCode);
        newPersonRecords.push(record);
        newHires.push({
          faculty_id: id,
          fakename,
          department_id: deptId,
          rank,
          salary: String(computeHireSalary(rank as FacultyRank, deptId, rankSalaries, {}, cumulativeInflation)),
          active_status: 'AC',
          career_years: '1',
          years_since_hire: '1',
          years_at_rank: '1',
          term: ctx.termCode,
        });
        events.push({ year, term, faculty_id: id, fakename, event: 'HIRE' });
        deficit--;
      }
    }
  }

  savePersonRecords(ctx.outputDir, newPersonRecords);

  const rosterPath = path.join(ctx.outputDir, `${ctx.termTag}_employee_roster.csv`);
  writeCSV(rosterPath, [...continuingFaculty, ...continuingAdmin, ...newHires]);

  const eventsPath = path.join(ctx.outputDir, `${ctx.termTag}_employee_events.csv`);
  writeCSV(eventsPath, events);

  return { stage: 'employee-hiring', skipped: false, outputFiles: [rosterPath, eventsPath] };
}
