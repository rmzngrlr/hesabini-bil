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
  installmentId?: string; // Link to parent installment if applicable
  currentInstallment?: number; // e.g. 1 (of 6)
  totalInstallments?: number; // e.g. 6
}

export interface Installment {
  id: string;
  description: string;
  totalAmount: number;
  installmentCount: number;
  remainingInstallments: number;
  monthlyAmount: number;
  startDate: string; // ISO string
}

export interface MonthlyHistory {
  month: string; // YYYY-MM
  income: number;
  rollover: number;
  ykIncome: number;
  ykRollover: number;
  fixedExpenses: FixedExpense[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
}

export interface BudgetState {
  version?: number;
  currentMonth: string; // YYYY-MM
  income: number;
  rollover: number;
  ykIncome: number;
  ykRollover: number;
  fixedExpenses: FixedExpense[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
  installments: Installment[];
  history: MonthlyHistory[];
}
