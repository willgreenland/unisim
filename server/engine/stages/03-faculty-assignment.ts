import path from 'path'
import { SimContext, StageResult, FacultyRank } from '../types.js'
import { readCSV, writeCSV } from '../csv.js'

const MAX_LOAD: Record<FacultyRank, number> = {
  PROF: 2, ASSO: 2, ASST: 2,
  LECT: 3, INST: 3,
  RPRO: 1, CPRO: 1,
}

export async function runFacultyAssignment(ctx: SimContext): Promise<StageResult> {
  const faculty = readCSV(path.join(ctx.outputDir, `${ctx.termTag}_faculty_roster.csv`))
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv'))

  const coursesByDept: Record<string, string[]> = {}
  for (const c of courses) {
    if (!coursesByDept[c.department_id]) coursesByDept[c.department_id] = []
    coursesByDept[c.department_id].push(c.course_id)
  }

  const facultyByDept: Record<string, typeof faculty> = {}
  for (const f of faculty) {
    if (f.active_status !== 'AC') continue
    if (!facultyByDept[f.department_id]) facultyByDept[f.department_id] = []
    facultyByDept[f.department_id].push(f)
  }

  const assignments: Record<string, string | number>[] = []

  for (const deptId of Object.keys(coursesByDept)) {
    const deptCourses = [...coursesByDept[deptId]].sort(() => Math.random() - 0.5)
    const deptFaculty = facultyByDept[deptId] ?? []

    const loadPool = deptFaculty.map(f => ({
      faculty_id: f.faculty_id,
      remaining: MAX_LOAD[f.rank as FacultyRank] ?? 2,
    }))

    for (const courseId of deptCourses) {
      const available = loadPool.filter(fp => fp.remaining > 0)
      if (available.length === 0) break
      const pick = available[Math.floor(Math.random() * available.length)]
      assignments.push({ faculty_id: pick.faculty_id, course_id: courseId, term: ctx.termNumber })
      pick.remaining--
    }
  }

  const outputPath = path.join(ctx.outputDir, `${ctx.termTag}_faculty_assignment.csv`)
  writeCSV(outputPath, assignments)
  return { stage: 'faculty-assignment', skipped: false, outputFiles: [outputPath] }
}
