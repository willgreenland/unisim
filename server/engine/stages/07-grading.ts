import path from 'path';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

const GRADE_SCALE = [
  { letter: 'A',  points: 4.0, minScore: 93 },
  { letter: 'A-', points: 3.7, minScore: 90 },
  { letter: 'B+', points: 3.3, minScore: 87 },
  { letter: 'B',  points: 3.0, minScore: 83 },
  { letter: 'B-', points: 2.7, minScore: 80 },
  { letter: 'C+', points: 2.3, minScore: 77 },
  { letter: 'C',  points: 2.0, minScore: 73 },
  { letter: 'C-', points: 1.7, minScore: 70 },
  { letter: 'D',  points: 1.0, minScore: 60 },
  { letter: 'F',  points: 0.0, minScore: 0  },
];

function scoreToGrade(score: number) {
  return GRADE_SCALE.find(g => score >= g.minScore) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

function randomNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.min(100, mean + z * stdDev));
}

export async function runGrading(ctx: SimContext): Promise<StageResult> {
  const enrollmentPath = path.join(ctx.outputDir, `${ctx.termTag}_enrollment.csv`);
  const enrollments = readCSV(enrollmentPath);

  const students = readCSV(path.join(ctx.outputDir, `${ctx.prevTermTag}_students.csv`));
  const gpaMap: Record<string, number> = {};
  // GPA is 0.0 for new students; default to 2.5 as a neutral starting mean
  for (const s of students) gpaMap[s.student_id] = parseFloat(s.gpa) || 2.5;

  const gradeRows = enrollments.map(e => {
    const gpa = gpaMap[e.student_id] ?? 2.5;
    const score = randomNormal(50 + (gpa / 4) * 45, 10);
    const { letter, points } = scoreToGrade(score);
    return {
      student_id: e.student_id,
      course_id: e.course_id,
      score: Math.round(score),
      grade: letter,
      grade_points: points,
      term: ctx.termNumber,
    };
  });

  const gradesPath = path.join(ctx.outputDir, `${ctx.termTag}_grades.csv`);
  writeCSV(gradesPath, gradeRows);

  return { stage: 'grading', skipped: false, outputFiles: [gradesPath] };
}
