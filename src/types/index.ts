export interface GoldRecord {
  id?: number;
  record_date: string;
  owner: string;
  gold_type: string;
  amount: number;
  note?: string;
  transaction_type?: string;
  secondary?: {
    amount: number;
    transaction_type: string;
    note?: string;
    record_date?: string;
  };
}

export interface FixedExpense {
  id: string;
  title: string;
  amount: number;
  isPaid: boolean;
  type?: string; // e.g. 'NAKIT', 'YK', 'Dolar', 'Euro', 'PLANNED_VAULT'
  vault_gold_type?: string;
  vault_amount?: number;
  vault_owner?: string;
  vault_note?: string;
  isBill?: boolean;
  paymentMethod?: 'NAKIT' | 'KK';
}

export interface CustomIncome {
  id: string;
  title: string;
  amount: number;
  type?: string; // e.g. 'NAKIT', 'YK', 'Dolar', 'Euro', 'PLANNED_VAULT'
  vault_gold_type?: string;
  vault_amount?: number;
  vault_owner?: string;
  vault_note?: string;
}

export type ExpenseType = 'NAKIT' | 'YK' | string;

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
  date?: string; // ISO string for the date the debt was incurred or paid
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
  customIncomes?: CustomIncome[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
  assetBudgets?: Record<string, { income: number; rollover: number }>;
}

export interface FutureMonthData {
  income?: number;
  ykIncome?: number;
  fixedExpenses?: FixedExpense[];
  customIncomes?: CustomIncome[];
  // For CC Debt override (adjustment amount)
  ccDebtAdjustment?: number;
  // For specific installment overrides (id -> amount)
  installmentOverrides?: Record<string, number>;
  // For manually added CC Debts in future
  ccDebts?: CCDebt[];
  assetBudgets?: Record<string, { income: number; rollover: number }>;
}

export interface BudgetState {
  version?: number;
  currentMonth: string; // YYYY-MM
  income: number;
  rollover: number;
  ykIncome: number;
  ykRollover: number;
  fixedExpenses: FixedExpense[];
  customIncomes: CustomIncome[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
  installments: Installment[];
  history: MonthlyHistory[];
  futureData: Record<string, FutureMonthData>;
  assetBudgets?: Record<string, { income: number; rollover: number }>;
}
