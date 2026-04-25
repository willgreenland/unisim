import path from 'path'
import { readdirSync } from 'fs'
import { SimContext, StageResult } from '../types.js'
import { readCSV, writeCSV } from '../csv.js'

export async function runReporting(ctx: SimContext): Promise<StageResult> {
  const courses = readCSV(path.join(ctx.inputDir, 'courses.csv'))
  const creditMap: Record<string, number> = {}
  for (const c of courses) creditMap[c.course_id] = parseInt(c.credits, 10)

  // Collect all grades across every term for cumulative GPA
  const allGradeFiles = readdirSync(ctx.outputDir)
    .filter(f => /^term_\d+_grades\.csv$/.test(f))
    .map(f => path.join(ctx.outputDir, f))

  const gradesByStudent: Record<string, { course_id: string; grade_points: number }[]> = {}
  for (const gf of allGradeFiles) {
    for (const row of readCSV(gf)) {
      const sid = row.student_id
      if (!gradesByStudent[sid]) gradesByStudent[sid] = []
      gradesByStudent[sid].push({ course_id: row.course_id, grade_points: parseFloat(row.grade_points) })
    }
  }

  const prevStudents = readCSV(path.join(ctx.outputDir, `${ctx.prevTermTag}_students.csv`))

  const updatedStudents = prevStudents.map(s => {
    const grades = gradesByStudent[s.student_id] ?? []
    let qualityPoints = 0
    let creditsAttempted = 0
    for (const g of grades) {
      const credits = creditMap[g.course_id] ?? 3
      qualityPoints += g.grade_points * credits
      creditsAttempted += credits
    }
    const gpa = creditsAttempted > 0
      ? (qualityPoints / creditsAttempted).toFixed(2)
      : '0.00'
    return {
      ...s,
      gpa,
      course_count: String(grades.length),
      year: String(parseInt(s.year, 10) + 1),
    }
  })

  const outputPath = path.join(ctx.outputDir, `${ctx.termTag}_students.csv`)
  writeCSV(outputPath, updatedStudents)

  return { stage: 'reporting', skipped: false, outputFiles: [outputPath] }
}
