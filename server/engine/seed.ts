import path from 'path';
import { mkdirSync } from 'fs';
import { readCSV, writeCSV } from './csv.js';
import { generatePerson, loadUsedIds, savePersonRecords, PersonRecord } from './person.js';
import { Major, Department, FacultyRank } from './types.js';

const FACULTY_RANKS: { rank: FacultyRank; weight: number }[] = [
  { rank: 'ASST', weight: 30 },
  { rank: 'ASSO', weight: 25 },
  { rank: 'PROF', weight: 20 },
  { rank: 'LECT', weight: 15 },
  { rank: 'INST', weight: 5 },
  { rank: 'RPRO', weight: 3 },
  { rank: 'CPRO', weight: 2 },
];

const RANK_CAREER_RANGES: Record<FacultyRank, { careerMin: number; careerMax: number; rankCap: number }> = {
  ASST: { careerMin: 1,  careerMax: 8,  rankCap: 5  },
  ASSO: { careerMin: 5,  careerMax: 20, rankCap: 8  },
  PROF: { careerMin: 10, careerMax: 35, rankCap: 15 },
  LECT: { careerMin: 1,  careerMax: 15, rankCap: 10 },
  INST: { careerMin: 1,  careerMax: 10, rankCap: 5  },
  RPRO: { careerMin: 10, careerMax: 30, rankCap: 15 },
  CPRO: { careerMin: 10, careerMax: 30, rankCap: 15 },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateYears(rank: FacultyRank): { career_years: number; years_since_hire: number; years_at_rank: number } {
  const { careerMin, careerMax, rankCap } = RANK_CAREER_RANGES[rank];
  const career_years = randInt(careerMin, careerMax);
  const years_at_rank = randInt(1, Math.min(career_years, rankCap));
  const years_since_hire = randInt(years_at_rank, career_years);
  return { career_years, years_since_hire, years_at_rank };
}

function weightedRandom<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

export async function generateSeed(
  simName: string,
  numStudents: number,
  numFaculty: number
): Promise<void> {
  const root = process.cwd();
  const inputDir = path.join(root, 'data', simName, 'input');
  const outputDir = path.join(root, 'data', simName, 'output');
  mkdirSync(outputDir, { recursive: true });

  const departments = readCSV(path.join(inputDir, 'departments.csv')) as unknown as Department[];
  const majors = readCSV(path.join(inputDir, 'majors.csv')) as unknown as Major[];

  const usedIds = loadUsedIds(outputDir);
  const personRecords: PersonRecord[] = [];

  const majorWeights = majors.map(m => ({ value: m.major_code, weight: parseInt(m.weight, 10) }));

  const students: Record<string, string>[] = Array.from({ length: numStudents }, () => {
    const { id, fakename, record } = generatePerson(usedIds, 'student', 0);
    personRecords.push(record);
    return {
      student_id: id,
      fakename,
      degree_program: 'Default Degree',
      specialization_1: weightedRandom(majorWeights),
      specialization_2: '',
      specialization_3: '',
      specialization_4: '',
      gpa: '0.0',
      course_count: '0',
      year: '1',
      active_status: 'AC',
    };
  });

  const facultyRankWeights = FACULTY_RANKS.map(r => ({ value: r.rank, weight: r.weight }));

  const faculty: Record<string, string>[] = Array.from({ length: numFaculty }, (_, i) => {
    const dept = departments[i % departments.length];
    const { id, fakename, record } = generatePerson(usedIds, 'faculty', 0);
    personRecords.push(record);
    const rank = weightedRandom(facultyRankWeights);
    const { career_years, years_since_hire, years_at_rank } = generateYears(rank);
    return {
      faculty_id: id,
      fakename,
      department_id: dept.department_id,
      rank,
      salary: '100000',
      active_status: 'AC',
      career_years: String(career_years),
      years_since_hire: String(years_since_hire),
      years_at_rank: String(years_at_rank),
    };
  });

  writeCSV(path.join(outputDir, 'term_000_students.csv'), students);
  writeCSV(path.join(outputDir, 'term_000_faculty_roster.csv'), faculty);
  savePersonRecords(outputDir, personRecords);
}
