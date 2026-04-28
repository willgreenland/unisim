export interface UniversitySettings {
  startYear: number;
  termsPerYear: number;
}

export interface SimContext {
  simName: string;
  inputDir: string;
  outputDir: string;
  termCode: number;      // YYYYTT, e.g. 202001
  termTag: string;       // '202001'
  prevTermTag: string;   // '202003' or '000000' for first term
  termsPerYear: number;  // from settings.json
  isFirstTermOfYear: boolean;
  isLastTermOfYear: boolean;
}

export interface StageResult {
  stage: string;
  skipped: boolean;
  outputFiles: string[];
}

export type ActiveStatus = 'AC' | 'OL' | 'SA';

export type FacultyRank = 'PROF' | 'ASSO' | 'ASST' | 'LECT' | 'INST' | 'RPRO' | 'CPRO';

export const MAX_LOAD: Record<FacultyRank, number> = {
  PROF: 2, ASSO: 2, ASST: 2,
  LECT: 3, INST: 3,
  RPRO: 1, CPRO: 1,
};

export interface Student {
  student_id: string;
  fakename: string;
  degree_program: string;
  specialization_1: string;
  specialization_2: string;
  specialization_3: string;
  specialization_4: string;
  gpa: string;
  course_count: string;
  year: string;
  active_status: ActiveStatus;
}

export interface Major {
  major_code: string;
  major_name: string;
  department_id: string;
  weight: string;
}

export interface Faculty {
  faculty_id: string;
  fakename: string;
  department_id: string;
  rank: FacultyRank;
  salary: string;
  active_status: ActiveStatus;
  career_years: string;
  years_since_hire: string;
  years_at_rank: string;
}

export interface Department {
  department_id: string;   // 6-digit, first digit always 8
  short_name: string;      // primary key used as department_code in other entities
  long_name: string;
  unit_code: string;
  annual_budget: string;
  annual_expenditures: string;
}

export interface Course {
  course_id: string;
  name: string;
  department_id: string;
  capacity: string;
  credits: string;
  units: string;
}
