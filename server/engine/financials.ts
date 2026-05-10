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

interface AccountBalanceRow extends Record<string, string | number> {
  account: number;
  term: number;
  opening_balance: number;
  total_revenue: number;
  total_expense: number;
  closing_balance: number;
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

  writeAccountBalances(outputPath: string, prevBalancesPath: string, termCode: number): void {
    const openingByAccount: Record<number, number> = {};
    if (existsSync(prevBalancesPath)) {
      for (const row of readCSV(prevBalancesPath)) {
        openingByAccount[parseInt(row.account, 10)] = parseFloat(row.closing_balance);
      }
    }

    const revenueByAccount: Record<number, number> = {};
    const expenseByAccount: Record<number, number> = {};
    for (const row of this.rows) {
      const acct = row.account;
      if (row.amount >= 0) {
        revenueByAccount[acct] = (revenueByAccount[acct] ?? 0) + row.amount;
      } else {
        expenseByAccount[acct] = (expenseByAccount[acct] ?? 0) + row.amount;
      }
    }

    const allAccounts = new Set<number>([
      ...Object.keys(openingByAccount).map(Number),
      ...Object.keys(revenueByAccount).map(Number),
      ...Object.keys(expenseByAccount).map(Number),
    ]);

    const balanceRows: AccountBalanceRow[] = [];
    for (const account of [...allAccounts].sort((a, b) => a - b)) {
      const opening_balance = openingByAccount[account] ?? 0;
      const total_revenue = revenueByAccount[account] ?? 0;
      const total_expense = expenseByAccount[account] ?? 0;
      const closing_balance = opening_balance + total_revenue + total_expense;
      balanceRows.push({ account, term: termCode, opening_balance, total_revenue, total_expense, closing_balance });
    }

    writeCSV(outputPath, balanceRows);
  }
}
