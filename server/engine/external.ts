import path from 'path';
import { existsSync } from 'fs';
import { SimContext } from './types.js';
import { readCSV, writeCSV } from './csv.js';

function generateInflationRate(): number {
  return parseFloat((0.02 + Math.random() * 0.02).toFixed(4));
}

export function runExternalGeneration(ctx: SimContext): void {
  const year = Math.floor(ctx.termCode / 100);
  const prevPath = path.join(ctx.externalDir, `${ctx.prevTermTag}_inflation.csv`);
  const prev = existsSync(prevPath) ? readCSV(prevPath) : [];

  let inflationRate: number;
  let cumulativeInflation: number;

  if (ctx.isFirstTermOfYear) {
    inflationRate = generateInflationRate();
    const prevCumulative = prev.length > 0 ? parseFloat(prev[0].cumulative_inflation) : 1.0;
    cumulativeInflation = parseFloat((prevCumulative * (1 + inflationRate)).toFixed(6));
  } else {
    inflationRate = prev.length > 0 ? parseFloat(prev[0].inflation_rate) : generateInflationRate();
    cumulativeInflation = prev.length > 0 ? parseFloat(prev[0].cumulative_inflation) : 1.0;
  }

  writeCSV(path.join(ctx.externalDir, `${ctx.termTag}_inflation.csv`), [
    { year, inflation_rate: inflationRate, cumulative_inflation: cumulativeInflation },
  ]);
}
