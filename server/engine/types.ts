export interface SimContext {
  simName: string
  inputDir: string
  outputDir: string
  fixturesDir: string
  termNumber: number
  termTag: string
  prevTermTag: string
}

export interface StageResult {
  stage: string
  skipped: boolean
  outputFiles: string[]
}

export type ActiveStatus = 'AC' | 'OL' | 'SA'

export type FacultyRank = 'PROF' | 'ASSO' | 'ASST' | 'LECT' | 'INST' | 'RPRO' | 'CPRO'

export interface Student {
  student_id: string
  fakename: string
  degree_program: string
  specialization_1: string
  specialization_2: string
  specialization_3: string
  specialization_4: string
  gpa: string
  course_count: string
  year: string
  active_status: ActiveStatus
}

export interface Major {
  major_code: string
  major_name: string
  department_id: string
  weight: string
}

export interface Faculty {
  faculty_id: string
  fakename: string
  department_id: string
  rank: FacultyRank
  salary: string
  active_status: ActiveStatus
}

export interface Department {
  department_id: string   // 6-digit, first digit always 8
  short_name: string      // primary key used as department_code in other entities
  long_name: string
  unit_code: string
  annual_budget: string
  annual_expenditures: string
}

export interface Course {
  course_id: string
  name: string
  department_id: string
  capacity: string
  credits: string
  units: string
  max_enrollment: string
}
