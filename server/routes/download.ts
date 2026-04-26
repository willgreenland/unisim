import { Router } from 'express';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import archiver from 'archiver';

const router = Router();

function csvFiles(outputDir: string): string[] {
  if (!existsSync(outputDir)) return [];
  return readdirSync(outputDir).filter(f => f.endsWith('.csv'));
}

function latestTermTag(outputDir: string): string | null {
  const nums = csvFiles(outputDir)
    .map(f => f.match(/^term_(\d+)_/))
    .filter(Boolean)
    .map(m => parseInt(m![1], 10));
  if (nums.length === 0) return null;
  return `term_${String(Math.max(...nums)).padStart(3, '0')}`;
}

function sendZip(res: any, outputDir: string, files: string[], filename: string): void {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const archive = archiver('zip');
  archive.pipe(res);
  for (const file of files) {
    archive.file(path.join(outputDir, file), { name: file });
  }
  archive.finalize();
}

router.get('/:simName/all', (req, res) => {
  const outputDir = path.join(process.cwd(), 'data', req.params.simName, 'output');
  const files = csvFiles(outputDir);
  if (files.length === 0) {
    res.status(404).json({ message: 'No output files found.' });
    return;
  }
  sendZip(res, outputDir, files, `${req.params.simName}_all.zip`);
});

router.get('/:simName/latest', (req, res) => {
  const outputDir = path.join(process.cwd(), 'data', req.params.simName, 'output');
  const tag = latestTermTag(outputDir);
  if (!tag) {
    res.status(404).json({ message: 'No output files found.' });
    return;
  }
  const files = csvFiles(outputDir).filter(f => f.startsWith(`${tag}_`));
  sendZip(res, outputDir, files, `${req.params.simName}_${tag}.zip`);
});

export default router;
