import path from 'path';
import { existsSync } from 'fs';
import { readCSV, writeCSV } from './csv.js';
import { ITransactionLog } from './types.js';

interface TransactionRow extends Record<string, string | number> {
  date: string;
  amount: number;
  account: number;
  expense_type: string;
  payment_reference: string;
}

const STARTING_REF = 900000000000;

function loadLastRef(prevTransactionsPath: string): number {
  if (!existsSync(prevTransactionsPath)) return STARTING_REF;
  const rows = readCSV(prevTransactionsPath);
  if (rows.length === 0) return STARTING_REF;
  return Math.max(...rows.map(r => parseInt(r.payment_reference, 10)));
}

export class TransactionLog implements ITransactionLog {
  private rows: TransactionRow[] = [];
  private nextRef: number;

  constructor(prevTransactionsPath: string) {
    this.nextRef = loadLastRef(prevTransactionsPath) + 1;
  }

  create(date: string, amount: number, account: number, expenseType: string): string {
    const ref = String(this.nextRef++);
    this.rows.push({ date, amount, account, expense_type: expenseType, payment_reference: ref });
    return ref;
  }

  write(outputPath: string): void {
    writeCSV(outputPath, this.rows);
  }
}
