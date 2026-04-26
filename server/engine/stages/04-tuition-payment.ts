import { SimContext, StageResult } from '../types.js';

export async function runTuitionPayment(_ctx: SimContext): Promise<StageResult> {
  // STUB: Calculate and record tuition payments per enrolled student.
  return { stage: 'tuition-payment', skipped: true, outputFiles: [] };
}
