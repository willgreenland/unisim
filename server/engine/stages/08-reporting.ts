import { SimContext, StageResult } from '../types.js'

export async function runReporting(_ctx: SimContext): Promise<StageResult> {
  // STUB: Aggregate enrollment, grade, and financial data into a summary CSV.
  return { stage: 'reporting', skipped: true, outputFiles: [] }
}
