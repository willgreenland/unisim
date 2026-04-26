import path from 'path';
import { readdirSync } from 'fs';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

const PASS_THRESHOLD = 1.7;       // C- or above
const COURSES_TO_GRADUATE = 40;   // 40 courses × 100 units = 4000 units

export async function runReporting(ctx: SimContext): Promise<StageResult> {
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv'));
  const creditMap: Record<string, number> = {};
  for (const c of courses) creditMap[c.course_id] = parseInt(c.credits, 10);

  // Collect all grades across every term
  const allGradeFiles = readdirSync(ctx.outputDir)
    .filter(f => /^term_\d+_grades\.csv$/.test(f))
    .map(f => path.join(ctx.outputDir, f));

  const allGradesByStudent: Record<string, { course_id: string; grade_points: number }[]> = {};
  const passedCoursesByStudent: Record<string, Set<string>> = {};

  for (const gf of allGradeFiles) {
    for (const row of readCSV(gf)) {
      const sid = row.student_id;
      const gp = parseFloat(row.grade_points);
      if (!allGradesByStudent[sid]) allGradesByStudent[sid] = [];
      allGradesByStudent[sid].push({ course_id: row.course_id, grade_points: gp });
      if (gp >= PASS_THRESHOLD) {
        if (!passedCoursesByStudent[sid]) passedCoursesByStudent[sid] = new Set();
        passedCoursesByStudent[sid].add(row.course_id);
      }
    }
  }

  const prevStudents = readCSV(path.join(ctx.outputDir, `${ctx.prevTermTag}_students.csv`));

  const graduates: Record<string, string | number>[] = [];
  const continuingStudents: Record<string, string | number>[] = [];

  for (const s of prevStudents) {
    const allGrades = allGradesByStudent[s.student_id] ?? [];
    const passedCourses = passedCoursesByStudent[s.student_id] ?? new Set<string>();

    // GPA uses all attempts (passed and failed), credit-weighted
    let qualityPoints = 0;
    let creditsAttempted = 0;
    for (const g of allGrades) {
      const credits = creditMap[g.course_id] ?? 3;
      qualityPoints += g.grade_points * credits;
      creditsAttempted += credits;
    }
    const gpa = creditsAttempted > 0
      ? (qualityPoints / creditsAttempted).toFixed(2)
      : '0.00';

    // course_count tracks passed courses only (units toward degree)
    const courseCount = passedCourses.size;

    if (courseCount >= COURSES_TO_GRADUATE) {
      graduates.push({ student_id: s.student_id, gpa, term: ctx.termNumber });
    } else {
      continuingStudents.push({
        ...s,
        gpa,
        course_count: String(courseCount),
        year: String(parseInt(s.year, 10) + 1),
      });
    }
  }

  const outputFiles: string[] = [];

  if (graduates.length > 0) {
    const degreesPath = path.join(ctx.outputDir, `${ctx.termTag}_degrees_awarded.csv`);
    writeCSV(degreesPath, graduates);
    outputFiles.push(degreesPath);
  }

  const studentsPath = path.join(ctx.outputDir, `${ctx.termTag}_students.csv`);
  writeCSV(studentsPath, continuingStudents);
  outputFiles.push(studentsPath);

  return { stage: 'reporting', skipped: false, outputFiles };
}
