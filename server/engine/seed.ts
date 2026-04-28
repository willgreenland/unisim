import path from 'path';
import { mkdirSync } from 'fs';

export async function generateSeed(simName: string): Promise<void> {
  const root = process.cwd();
  const outputDir = path.join(root, 'data', simName, 'output');
  mkdirSync(outputDir, { recursive: true });
}
