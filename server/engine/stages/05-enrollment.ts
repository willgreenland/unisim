import path from 'path';
import { readdirSync } from 'fs';
import { SimContext, StageResult, Student, Course } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

const COURSES_PER_STUDENT = 4;
const PASS_THRESHOLD = 1.7; // C- or above

export async function runEnrollment(ctx: SimContext): Promise<StageResult> {
  const students = readCSV(path.join(ctx.outputDir, `${ctx.prevTermTag}_students.csv`)) as unknown as Student[];
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv')) as unknown as Course[];

  // Build passed-course set per student from all previous terms
  const passedByStudent: Record<string, Set<string>> = {};
  const gradeFiles = readdirSync(ctx.outputDir)
    .filter(f => /^term_\d+_grades\.csv$/.test(f));
  for (const gf of gradeFiles) {
    for (const row of readCSV(path.join(ctx.outputDir, gf))) {
      if (parseFloat(row.grade_points) >= PASS_THRESHOLD) {
        if (!passedByStudent[row.student_id]) passedByStudent[row.student_id] = new Set();
        passedByStudent[row.student_id].add(row.course_id);
      }
    }
  }

  const capacityMap: Record<string, number> = {};
  for (const course of courses) {
    capacityMap[course.course_id] = parseInt(course.capacity, 10);
  }

  const enrollmentRows: Record<string, string | number>[] = [];
  const rosterRows: Record<string, string | number>[] = [];

  for (const student of students) {
    const passed = passedByStudent[student.student_id] ?? new Set();
    const available = courses.filter(c => capacityMap[c.course_id] > 0 && !passed.has(c.course_id));
    const selected = [...available]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(COURSES_PER_STUDENT, available.length));

    for (const course of selected) {
      enrollmentRows.push({ student_id: student.student_id, course_id: course.course_id, term: ctx.termNumber });
      rosterRows.push({ course_id: course.course_id, student_id: student.student_id, term: ctx.termNumber });
      capacityMap[course.course_id]--;
    }
  }

  const enrollmentPath = path.join(ctx.outputDir, `${ctx.termTag}_enrollment.csv`);
  const rosterPath = path.join(ctx.outputDir, `${ctx.termTag}_course_roster.csv`);
  writeCSV(enrollmentPath, enrollmentRows);
  writeCSV(rosterPath, rosterRows);

  return { stage: 'enrollment', skipped: false, outputFiles: [enrollmentPath, rosterPath] };
}
