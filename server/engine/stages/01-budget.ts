import { SimContext, StageResult } from '../types.js';

export async function runBudget(_ctx: SimContext): Promise<StageResult> {
  // STUB: Set departmental budgets based on prior term revenue and allocations.
  return { stage: 'budget', skipped: true, outputFiles: [] };
}
