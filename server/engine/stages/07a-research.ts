import path from 'path';
import { existsSync } from 'fs';
import { SimContext, StageResult } from '../types.js';
import { readCSV, writeCSV } from '../csv.js';

// --- Publication probability ---

export interface ResearchProbabilities {
  article: number;
  book: number;
}

interface RankRates {
  article: number;
  book: number;
}

const BASE_RATES: Record<string, RankRates> = {
  RPRO: { article: 0.80, book: 0.10 },
  PROF: { article: 0.50, book: 0.06 },
  ASSO: { article: 0.35, book: 0.04 },
  ASST: { article: 0.20, book: 0.02 },
  LECT: { article: 0.10, book: 0.01 },
  INST: { article: 0.05, book: 0.005 },
  CPRO: { article: 0.10, book: 0.02 },
};

export const BOOK_COOLDOWN_TERMS = 6;

export function getResearchProbabilities(
  rank: string,
  publishedArticleLastTerm: boolean,
  bookCooldownTermsRemaining: number,
): ResearchProbabilities {
  const base = BASE_RATES[rank];
  if (!base) return { article: 0, book: 0 };

  const article = publishedArticleLastTerm ? base.article * 0.5 : base.article;
  const book = bookCooldownTermsRemaining > 0 ? 0 : base.book;

  return { article, book };
}

// --- Title generation ---

interface TitleWordLists {
  noun: string[];
  adjective: string[];
  gerund: string[];
  concept: string[];
}

interface TitleWordRow {
  word: string;
  type: string;
  field: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// TODO: naive vowel-letter check produces "An Unified", "An Universal" etc.
// Fix later with a phonetic lookup or exception list for u/eu words with a consonant onset.
function a(word: string): string {
  return /^[aeiou]/i.test(word) ? 'An' : 'A';
}

export function loadTitleWords(inputDir: string): TitleWordRow[] {
  return readCSV(path.join(inputDir, 'title_words.csv')) as unknown as TitleWordRow[];
}

export function filterTitleWordsByField(allWords: TitleWordRow[], field: string): TitleWordLists {
  const lists: TitleWordLists = { noun: [], adjective: [], gerund: [], concept: [] };
  for (const row of allWords) {
    if (row.field !== 'ALL' && row.field !== field) continue;
    const type = row.type as keyof TitleWordLists;
    if (type in lists) lists[type].push(row.word);
  }
  return lists;
}

export function generateTitle(words: TitleWordLists): string {
  const { noun, adjective, gerund, concept } = words;

  const patterns: Array<() => string> = [
    () => `${pick(adjective)} ${pick(noun)} for ${pick(noun)} ${pick(concept)}`,
    () => `On the ${pick(concept)} of ${pick(adjective)} ${pick(noun)}`,
    () => `${pick(gerund)} ${pick(adjective)} ${pick(noun)} via ${pick(adjective)} ${pick(noun)}`,
    () => { const adj = pick(adjective); return `${a(adj)} ${adj} ${pick(noun)} for ${pick(noun)} ${pick(concept)}`; },
    () => `${pick(noun)} ${pick(concept)} in ${pick(adjective)} ${pick(noun)}`,
    () => { const adj = pick(adjective); return `Toward ${pick(adjective)} ${pick(noun)} ${pick(concept)}: ${a(adj)} ${adj} Approach`; },
    () => `${pick(gerund)} ${pick(noun)}: ${pick(noun)} ${pick(concept)} and Beyond`,
    () => `${pick(adjective)} ${pick(noun)} with Applications to ${pick(noun)} ${pick(concept)}`,
  ];

  return pick(patterns)();
}

// --- Stage execution ---

function prevTermTags(termCode: number, termsPerYear: number, n: number): string[] {
  const tags: string[] = [];
  let code = termCode;
  for (let i = 0; i < n; i++) {
    let term = (code % 100) - 1;
    let year = Math.floor(code / 100);
    if (term < 1) { year--; term = termsPerYear; }
    code = year * 100 + term;
    tags.push(String(code));
  }
  return tags;
}

function generatePublicationId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const group = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `PUB-${group()}-${group()}-${group()}-${group()}`;
}

export async function runResearch(ctx: SimContext): Promise<StageResult> {
  const roster = readCSV(path.join(ctx.outputDir, `${ctx.termTag}_employee_roster.csv`))
    .filter(e => e.active_status === 'AC');

  const allTitleWords = loadTitleWords(ctx.inputDir);
  const journals = readCSV(path.join(ctx.inputDir, 'journals.csv'));
  const publishers = readCSV(path.join(ctx.inputDir, 'publishers.csv'));

  const deptToField: Record<string, string> = {};
  for (const d of readCSV(path.join(ctx.inputDir, 'departments.csv'))) {
    deptToField[d.department_id] = d.short_name;
  }

  const journalsByField: Record<string, typeof journals> = {};
  for (const j of journals) {
    (journalsByField[j.field] ??= []).push(j);
  }

  // Article cooldown: who published an article last term?
  const prevResearchPath = path.join(ctx.outputDir, `${ctx.prevTermTag}_research_output.csv`);
  const prevResearch = existsSync(prevResearchPath) ? readCSV(prevResearchPath) : [];
  const articleLastTerm = new Set(
    prevResearch.filter(r => r.publication_type === 'ARTICLE').map(r => r.faculty_id),
  );

  // Book cooldown: how many terms of cooldown remain per faculty member?
  const bookCooldownRemaining: Record<string, number> = {};
  for (let i = 0; i < BOOK_COOLDOWN_TERMS; i++) {
    const tag = prevTermTags(ctx.termCode, ctx.termsPerYear, i + 1).at(-1)!;
    const resPath = path.join(ctx.outputDir, `${tag}_research_output.csv`);
    if (!existsSync(resPath)) continue;
    for (const row of readCSV(resPath)) {
      if (row.publication_type !== 'BOOK') continue;
      const remaining = BOOK_COOLDOWN_TERMS - (i + 1);
      if (remaining > 0) {
        bookCooldownRemaining[row.faculty_id] = Math.max(bookCooldownRemaining[row.faculty_id] ?? 0, remaining);
      }
    }
  }

  const publications: Record<string, string | number>[] = [];

  for (const employee of roster) {
    const field = deptToField[employee.department_id] ?? 'ALL';
    const wordLists = filterTitleWordsByField(allTitleWords, field);
    const probs = getResearchProbabilities(
      employee.rank,
      articleLastTerm.has(employee.faculty_id),
      bookCooldownRemaining[employee.faculty_id] ?? 0,
    );

    if (Math.random() < probs.article) {
      const fieldJournals = journalsByField[field] ?? [];
      const venue = fieldJournals.length > 0 ? pick(fieldJournals).name : pick(journals).name;
      publications.push({
        publication_id: generatePublicationId(),
        faculty_id: employee.faculty_id,
        department_id: employee.department_id,
        publication_type: 'ARTICLE',
        term: ctx.termCode,
        title: generateTitle(wordLists),
        venue,
      });
    }

    if (Math.random() < probs.book) {
      publications.push({
        publication_id: generatePublicationId(),
        faculty_id: employee.faculty_id,
        department_id: employee.department_id,
        publication_type: 'BOOK',
        term: ctx.termCode,
        title: generateTitle(wordLists),
        venue: pick(publishers).name,
      });
    }
  }

  const outputPath = path.join(ctx.outputDir, `${ctx.termTag}_research_output.csv`);
  writeCSV(outputPath, publications);

  return { stage: 'research', skipped: false, outputFiles: [outputPath] };
}
