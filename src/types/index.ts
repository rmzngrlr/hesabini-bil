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

export interface GoldPortfolio {
  g22: number; // grams
  g24: number; // grams
  resat: number; // count
}

export interface GoldPrices {
  g22: number;
  g24: number;
  resat: number;
  lastUpdated?: string;
}

export interface Limits {
  nakit: number;
  yk: number;
}

export interface BudgetState {
  income: number;
  rollover: number;
  limits: Limits;
  fixedExpenses: FixedExpense[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
  gold: GoldPortfolio;
  goldPrices: GoldPrices;
}
