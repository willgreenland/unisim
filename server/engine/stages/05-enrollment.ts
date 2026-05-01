import path from 'path';
import { existsSync, readdirSync } from 'fs';
import { SimContext, StageResult, Student, Course, Major } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';
import { generatePerson, loadUsedIds, savePersonRecords, PersonRecord } from '../person.js';

const COURSES_PER_STUDENT = 4;
const PASS_THRESHOLD = 1.7;
const NEW_STUDENTS_MIN = 235;
const NEW_STUDENTS_MAX = 265;
const MAJOR_WEIGHT = 3;    // courses in student's major department get 3× sampling weight
const LEVEL_TARGET = 0.20; // target ≥20% of passed courses at each level

// Minimum passed courses at level N-1 required to enroll in level-N courses
const LEVEL_PREREQS: Record<number, number> = {
  2: 4,
  3: 6,
  4: 6,
};

function weightedRandom<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function getCourseLevel(courseId: string): number {
  const m = courseId.match(/(\d+)/);
  return m ? Math.floor(parseInt(m[1], 10) / 100) : 1;
}

function getUnlockedLevels(passedByLevel: Record<number, number>): Set<number> {
  const unlocked = new Set<number>([1]);
  for (let lv = 2; lv <= 4; lv++) {
    if ((passedByLevel[lv - 1] ?? 0) >= LEVEL_PREREQS[lv]) {
      unlocked.add(lv);
    }
  }
  return unlocked;
}

function selectCourses(
  courses: Course[],
  passed: Set<string>,
  passedByLevel: Record<number, number>,
  majorDeptId: string | undefined,
  capacityMap: Record<string, number>,
  count: number,
): Course[] {
  const unlockedLevels = getUnlockedLevels(passedByLevel);
  const totalPassed = Object.values(passedByLevel).reduce((s, n) => s + n, 0);

  let pool = courses.filter(c =>
    !passed.has(c.course_id) &&
    capacityMap[c.course_id] > 0 &&
    unlockedLevels.has(getCourseLevel(c.course_id))
  );

  const selected: Course[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const weighted = pool.map(c => {
      const level = getCourseLevel(c.course_id);
      const levelShare = (passedByLevel[level] ?? 0) / Math.max(1, totalPassed);
      const levelWeight = levelShare < LEVEL_TARGET ? 2.5 : 1;
      const majorMult = c.department_id === majorDeptId ? MAJOR_WEIGHT : 1;
      return { value: c, weight: levelWeight * majorMult };
    });

    const pick = weightedRandom(weighted);
    selected.push(pick);
    pool = pool.filter(c => c !== pick);
    capacityMap[pick.course_id]--;
  }

  return selected;
}

export async function runEnrollment(ctx: SimContext): Promise<StageResult> {
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv')) as unknown as Course[];
  const majors = readCSV(path.join(ctx.inputDir, 'majors.csv')) as unknown as Major[];
  const majorDeptMap: Record<string, string> = {};
  for (const m of majors) majorDeptMap[m.major_code] = m.department_id;

  const outputFiles: string[] = [];

  // Admit a new cohort at the start of each academic year
  const newStudents: Student[] = [];
  if (ctx.isFirstTermOfYear) {
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

  // Build passed-course sets and per-level counts per student from all previous terms
  const passedByStudent: Record<string, Set<string>> = {};
  const passedByStudentLevel: Record<string, Record<number, number>> = {};
  for (const gf of readdirSync(ctx.outputDir).filter(f => /^\d{6}_grades\.csv$/.test(f))) {
    for (const row of readCSV(path.join(ctx.outputDir, gf))) {
      if (parseFloat(row.grade_points) >= PASS_THRESHOLD) {
        if (!passedByStudent[row.student_id]) passedByStudent[row.student_id] = new Set();
        passedByStudent[row.student_id].add(row.course_id);
        if (!passedByStudentLevel[row.student_id]) passedByStudentLevel[row.student_id] = {};
        const lv = getCourseLevel(row.course_id);
        passedByStudentLevel[row.student_id][lv] = (passedByStudentLevel[row.student_id][lv] ?? 0) + 1;
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
    const passed = passedByStudent[student.student_id] ?? new Set<string>();
    const passedByLevel = passedByStudentLevel[student.student_id] ?? {};
    const majorDeptId = majorDeptMap[student.specialization_1];

    const selected = selectCourses(courses, passed, passedByLevel, majorDeptId, capacityMap, COURSES_PER_STUDENT);

    for (const course of selected) {
      enrollmentRows.push({ student_id: student.student_id, course_id: course.course_id, term: ctx.termCode });
      rosterRows.push({ course_id: course.course_id, student_id: student.student_id, term: ctx.termCode });
    }
  }

  const enrollmentPath = path.join(ctx.outputDir, `${ctx.termTag}_enrollment.csv`);
  const rosterPath = path.join(ctx.outputDir, `${ctx.termTag}_course_roster.csv`);
  writeCSV(enrollmentPath, enrollmentRows);
  writeCSV(rosterPath, rosterRows);
  outputFiles.push(enrollmentPath, rosterPath);

  return { stage: 'enrollment', skipped: false, outputFiles };
}
