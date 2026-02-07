export interface FixedExpense {
  id: string;
  title: string;
  amount: number;
  isPaid: boolean;
}

export type ExpenseType = 'NAKIT' | 'YK';

export interface DailyExpense {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  type: ExpenseType;
}

export interface CCDebt {
  id: string;
  description: string;
  amount: number;
}

export interface Limits {
  nakit: number;
  yk: number;
}

export interface BudgetState {
  version?: number;
  income: number;
  rollover: number;
  limits: Limits;
  fixedExpenses: FixedExpense[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
}
