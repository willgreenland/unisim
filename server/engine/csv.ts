import { readFileSync, writeFileSync } from 'fs';

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function formatValue(val: string): string {
  return val.includes(',') ? `"${val}"` : val;
}

export function readCSV(filePath: string): Record<string, string>[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

export function writeCSV(filePath: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) {
    writeFileSync(filePath, '');
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => formatValue(String(row[h] ?? ''))).join(',')),
  ];
  writeFileSync(filePath, lines.join('\n'));
}
