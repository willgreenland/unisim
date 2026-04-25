import path from 'path'
import { SimContext, StageResult, Student, Course } from '../types.js'
import { readCSV, writeCSV } from '../csv.js'

const COURSES_PER_STUDENT = 4

export async function runEnrollment(ctx: SimContext): Promise<StageResult> {
  const students = readCSV(path.join(ctx.outputDir, `${ctx.prevTermTag}_students.csv`)) as unknown as Student[]
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv')) as unknown as Course[]

  const capacityMap: Record<string, number> = {}
  for (const course of courses) {
    capacityMap[course.course_id] = parseInt(course.capacity, 10)
  }

  const enrollmentRows: Record<string, string | number>[] = []
  const rosterRows: Record<string, string | number>[] = []

  for (const student of students) {
    const available = courses.filter(c => capacityMap[c.course_id] > 0)
    const selected = [...available]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(COURSES_PER_STUDENT, available.length))

    for (const course of selected) {
      enrollmentRows.push({ student_id: student.student_id, course_id: course.course_id, term: ctx.termNumber })
      rosterRows.push({ course_id: course.course_id, student_id: student.student_id, term: ctx.termNumber })
      capacityMap[course.course_id]--
    }
  }

  const enrollmentPath = path.join(ctx.outputDir, `${ctx.termTag}_enrollment.csv`)
  const rosterPath = path.join(ctx.outputDir, `${ctx.termTag}_course_roster.csv`)
  writeCSV(enrollmentPath, enrollmentRows)
  writeCSV(rosterPath, rosterRows)

  return { stage: 'enrollment', skipped: false, outputFiles: [enrollmentPath, rosterPath] }
}
