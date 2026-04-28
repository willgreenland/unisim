import path from 'path';
import { existsSync, readdirSync } from 'fs';
import { SimContext, StageResult, Student, Course, Major } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';
import { generatePerson, loadUsedIds, savePersonRecords, PersonRecord } from '../person.js';

const COURSES_PER_STUDENT = 4;
const PASS_THRESHOLD = 1.7;
const NEW_STUDENTS_MIN = 235;
const NEW_STUDENTS_MAX = 265;

function weightedRandom<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

export async function runEnrollment(ctx: SimContext): Promise<StageResult> {
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv')) as unknown as Course[];
  const outputFiles: string[] = [];

  // Admit a new cohort at the start of each academic year
  const newStudents: Student[] = [];
  if (ctx.isFirstTermOfYear) {
    const majors = readCSV(path.join(ctx.inputDir, 'majors.csv')) as unknown as Major[];
    const majorWeights = majors.map(m => ({ value: m.major_code, weight: parseInt(m.weight, 10) }));
    const count = Math.floor(Math.random() * (NEW_STUDENTS_MAX - NEW_STUDENTS_MIN + 1)) + NEW_STUDENTS_MIN;
    const usedIds = loadUsedIds(ctx.outputDir);
    const newPersonRecords: PersonRecord[] = [];

    for (let i = 0; i < count; i++) {
      const { id, fakename, record } = generatePerson(usedIds, 'student', ctx.termCode);
      newPersonRecords.push(record);
      newStudents.push({
        student_id: id,
        fakename,
        degree_program: 'Default Degree',
        specialization_1: weightedRandom(majorWeights),
        specialization_2: '',
        specialization_3: '',
        specialization_4: '',
        gpa: '0.00',
        course_count: '0',
        year: '1',
        active_status: 'AC',
      });
    }

    savePersonRecords(ctx.outputDir, newPersonRecords);
    const intakePath = path.join(ctx.outputDir, `${ctx.termTag}_new_students.csv`);
    writeCSV(intakePath, newStudents as unknown as Record<string, string | number>[]);
    outputFiles.push(intakePath);
  }

  // Load continuing students (none on the very first term)
  const prevStudentsPath = path.join(ctx.outputDir, `${ctx.prevTermTag}_students.csv`);
  const prevStudents: Student[] = existsSync(prevStudentsPath)
    ? readCSV(prevStudentsPath) as unknown as Student[]
    : [];

  const students = [...prevStudents, ...newStudents];

  // Build passed-course set per student from all previous terms
  const passedByStudent: Record<string, Set<string>> = {};
  for (const gf of readdirSync(ctx.outputDir).filter(f => /^\d{6}_grades\.csv$/.test(f))) {
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
      enrollmentRows.push({ student_id: student.student_id, course_id: course.course_id, term: ctx.termCode });
      rosterRows.push({ course_id: course.course_id, student_id: student.student_id, term: ctx.termCode });
      capacityMap[course.course_id]--;
    }
  }

  const enrollmentPath = path.join(ctx.outputDir, `${ctx.termTag}_enrollment.csv`);
  const rosterPath = path.join(ctx.outputDir, `${ctx.termTag}_course_roster.csv`);
  writeCSV(enrollmentPath, enrollmentRows);
  writeCSV(rosterPath, rosterRows);
  outputFiles.push(enrollmentPath, rosterPath);

  return { stage: 'enrollment', skipped: false, outputFiles };
}
