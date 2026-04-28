import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export interface PersonRecord {
  person_id: string;
  type: 'student' | 'faculty';
  term_created: number;
}

export function loadUsedIds(outputDir: string): Set<string> {
  const filePath = path.join(outputDir, 'used_person_ids.csv');
  if (!existsSync(filePath)) return new Set();
  const lines = readFileSync(filePath, 'utf-8').trim().split('\n').slice(1);
  return new Set(lines.map(l => l.split(',')[0].trim()).filter(Boolean));
}

export function savePersonRecords(outputDir: string, newRecords: PersonRecord[]): void {
  const filePath = path.join(outputDir, 'used_person_ids.csv');
  const existing: PersonRecord[] = [];

  if (existsSync(filePath)) {
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n').slice(1);
    for (const line of lines) {
      const [person_id, type, term_created] = line.split(',').map(v => v.trim());
      if (person_id) existing.push({ person_id, type: type as 'student' | 'faculty', term_created: parseInt(term_created, 10) });
    }
  }

  const existingIds = new Set(existing.map(r => r.person_id));
  const toAdd = newRecords.filter(r => !existingIds.has(r.person_id));
  const all = [...existing, ...toAdd];

  const lines = [
    'person_id,type,term_created',
    ...all.map(r => `${r.person_id},${r.type},${r.term_created}`),
  ];
  writeFileSync(filePath, lines.join('\n'));
}

function generateId(usedIds: Set<string>): string {
  let id: string;
  do {
    const suffix = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
    id = `9${suffix}`;
  } while (usedIds.has(id));
  return id;
}

function generateFakename(): string {
  const length = Math.floor(Math.random() * 6) + 3; // 3 to 8 letters
  const letters = Array.from({ length }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `Fakename, ${letters}`;
}

export function generatePerson(
  usedIds: Set<string>,
  type: 'student' | 'faculty',
  termCode: number
): { id: string; fakename: string; record: PersonRecord } {
  const id = generateId(usedIds);
  usedIds.add(id);
  return {
    id,
    fakename: generateFakename(),
    record: { person_id: id, type, term_created: termCode },
  };
}
