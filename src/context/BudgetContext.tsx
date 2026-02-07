import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { BudgetState, FixedExpense, DailyExpense, CCDebt, Installment, MonthlyHistory } from '../types';

const STORAGE_KEY = 'budget_app_data';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const initialState: BudgetState = {
  version: 2,
  currentMonth: getCurrentMonth(),
  income: 0,
  rollover: 0,
  ykIncome: 0,
  ykRollover: 0,
  fixedExpenses: [],
  dailyExpenses: [],
  ccDebts: [],
  installments: [],
  history: [],
};

interface BudgetContextType {
  state: BudgetState;
  addFixedExpense: (expense: Omit<FixedExpense, 'id' | 'isPaid'>) => void;
  toggleFixedExpense: (id: string) => void;
  deleteFixedExpense: (id: string) => void;
  addDailyExpense: (expense: Omit<DailyExpense, 'id'>) => void;
  deleteDailyExpense: (id: string) => void;
  addCCDebt: (debt: Omit<CCDebt, 'id'>) => void;
  deleteCCDebt: (id: string) => void;
  addInstallment: (installment: Omit<Installment, 'id' | 'remainingInstallments'>) => void;
  updateIncome: (amount: number) => void;
  updateRollover: (amount: number) => void;
  updateYkIncome: (amount: number) => void;
  updateYkRollover: (amount: number) => void;
  resetMonth: () => void;
  loadState: (newState: BudgetState) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [state, setState] = useState<BudgetState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Migration logic:
        if (!parsed.version) {
          // Version 0 -> 1
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const migratedDailyExpenses = (parsed.dailyExpenses || []).map((ex: any) => ({
             ...ex,
             amount: ex.amount > 0 ? -ex.amount : ex.amount
          }));

          parsed.dailyExpenses = migratedDailyExpenses;
          parsed.version = 1;
        }

        if (parsed.version === 1) {
          // Version 1 -> 2 (Add installments, history, currentMonth)
          return {
            ...initialState,
            ...parsed,
            currentMonth: initialState.currentMonth,
            installments: [],
            history: [],
            version: 2
          };
        }

        return { ...initialState, ...parsed };
      }
      return initialState;
    } catch (e) {
      console.error("Failed to parse local storage", e);
      return initialState;
    }
  });

  // Auto-Reset Month Logic
  useEffect(() => {
    const actualCurrentMonth = getCurrentMonth();
    if (state.currentMonth && state.currentMonth !== actualCurrentMonth) {
       // Perform reset logic directly here to avoid dependency issues
       setState(prev => {
        // Archive current month
        const historyEntry: MonthlyHistory = {
          month: prev.currentMonth || getCurrentMonth(),
          income: prev.income,
          rollover: prev.rollover,
          ykIncome: prev.ykIncome,
          ykRollover: prev.ykRollover,
          fixedExpenses: prev.fixedExpenses,
          dailyExpenses: prev.dailyExpenses,
          ccDebts: prev.ccDebts,
        };

        const nextMonthDebts: CCDebt[] = [];
        const nextMonthInstallments = prev.installments.map(inst => {
           if (inst.remainingInstallments > 1) {
             const nextInstallmentNumber = (inst.installmentCount - inst.remainingInstallments) + 2;

             nextMonthDebts.push({
               id: generateId(),
               description: `${inst.description} (${nextInstallmentNumber}/${inst.installmentCount})`,
               amount: inst.monthlyAmount,
               installmentId: inst.id,
               currentInstallment: nextInstallmentNumber,
               totalInstallments: inst.installmentCount
             });

             return { ...inst, remainingInstallments: inst.remainingInstallments - 1 };
           } else {
             return { ...inst, remainingInstallments: 0 };
           }
        }).filter(inst => inst.remainingInstallments > 0);

        return {
          ...prev,
          version: 2,
          currentMonth: actualCurrentMonth, // Update to actual current system month
          history: [...prev.history, historyEntry],
          installments: nextMonthInstallments,
          ccDebts: nextMonthDebts,
          dailyExpenses: [],
          fixedExpenses: prev.fixedExpenses.map(ex => ({ ...ex, isPaid: false })),
        };
     });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const addFixedExpense = (expense: Omit<FixedExpense, 'id' | 'isPaid'>) => {
    const newExpense: FixedExpense = {
      id: generateId(),
      title: expense.title,
      amount: expense.amount,
      isPaid: false,
    };
    setState(prev => ({ ...prev, fixedExpenses: [...prev.fixedExpenses, newExpense] }));
  };

  const toggleFixedExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      fixedExpenses: prev.fixedExpenses.map(ex =>
        ex.id === id ? { ...ex, isPaid: !ex.isPaid } : ex
      ),
    }));
  };

  const deleteFixedExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      fixedExpenses: prev.fixedExpenses.filter(ex => ex.id !== id),
    }));
  };

  const addDailyExpense = (expense: Omit<DailyExpense, 'id'>) => {
    const newExpense: DailyExpense = {
      ...expense,
      id: generateId(),
    };
    setState(prev => ({ ...prev, dailyExpenses: [...prev.dailyExpenses, newExpense] }));
  };

  const deleteDailyExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      dailyExpenses: prev.dailyExpenses.filter(ex => ex.id !== id),
    }));
  };

  const addCCDebt = (debt: Omit<CCDebt, 'id'>) => {
    const newDebt: CCDebt = {
      ...debt,
      id: generateId(),
    };
    setState(prev => ({ ...prev, ccDebts: [...prev.ccDebts, newDebt] }));
  };

  const deleteCCDebt = (id: string) => {
    setState(prev => ({
      ...prev,
      ccDebts: prev.ccDebts.filter(d => d.id !== id),
    }));
  };

  const addInstallment = (installment: Omit<Installment, 'id' | 'remainingInstallments'>) => {
    const newInstallment: Installment = {
      ...installment,
      id: generateId(),
      remainingInstallments: installment.installmentCount,
    };

    // Also add the first month's debt immediately to current month
    const newDebt: CCDebt = {
      id: generateId(),
      description: `${newInstallment.description} (1/${newInstallment.installmentCount})`,
      amount: newInstallment.monthlyAmount,
      installmentId: newInstallment.id,
      currentInstallment: 1,
      totalInstallments: newInstallment.installmentCount
    };

    setState(prev => ({
      ...prev,
      installments: [...prev.installments, newInstallment],
      ccDebts: [...prev.ccDebts, newDebt]
    }));
  };

  const updateIncome = (income: number) => {
    setState(prev => ({ ...prev, income }));
  };

  const updateRollover = (rollover: number) => {
    setState(prev => ({ ...prev, rollover }));
  };

  const updateYkIncome = (ykIncome: number) => {
    setState(prev => ({ ...prev, ykIncome }));
  };

  const updateYkRollover = (ykRollover: number) => {
    setState(prev => ({ ...prev, ykRollover }));
  };

  const resetMonth = () => {
     setState(prev => {
        // Archive current month
        const historyEntry: MonthlyHistory = {
          month: prev.currentMonth || getCurrentMonth(),
          income: prev.income,
          rollover: prev.rollover,
          ykIncome: prev.ykIncome,
          ykRollover: prev.ykRollover,
          fixedExpenses: prev.fixedExpenses,
          dailyExpenses: prev.dailyExpenses,
          ccDebts: prev.ccDebts,
        };

        // Process installments for next month
        const nextMonthDebts: CCDebt[] = [];
        // Logic fix:
        // We are moving TO a new month.

        const nextMonthInstallments = prev.installments.map(inst => {
           if (inst.remainingInstallments > 1) {
             // It will have at least 1 more payment in the NEW month
             const nextInstallmentNumber = (inst.installmentCount - inst.remainingInstallments) + 2;

             nextMonthDebts.push({
               id: generateId(),
               description: `${inst.description} (${nextInstallmentNumber}/${inst.installmentCount})`,
               amount: inst.monthlyAmount,
               installmentId: inst.id,
               currentInstallment: nextInstallmentNumber,
               totalInstallments: inst.installmentCount
             });

             return { ...inst, remainingInstallments: inst.remainingInstallments - 1 };
           } else {
             // Remaining is 1 (this was the last month). Next month it is 0. No debt added.
             // We can filter these out or keep them with 0 remaining.
             return { ...inst, remainingInstallments: 0 };
           }
        }).filter(inst => inst.remainingInstallments > 0);

        // Determine next month string (logic to increment YYYY-MM)
        const [year, month] = (prev.currentMonth || getCurrentMonth()).split('-').map(Number);
        const nextDate = new Date(year, month, 1); // month is 0-indexed in Date? No, '2023-10' -> split gives 10. Date(2023, 10, 1) is Nov (Index 10).
        // Actually Date(year, monthIndex) where monthIndex 0=Jan.
        // '2023-01' -> 1. Date(2023, 1) is Feb. Correct.
        // So passing the parsed number directly increments month by 1.
        const nextMonthStr = nextDate.toISOString().slice(0, 7);

        return {
          ...prev,
          version: 2,
          currentMonth: nextMonthStr,
          history: [...prev.history, historyEntry],
          installments: nextMonthInstallments,
          ccDebts: nextMonthDebts, // Start with only installment debts
          dailyExpenses: [], // Clear daily expenses
          fixedExpenses: prev.fixedExpenses.map(ex => ({ ...ex, isPaid: false })), // Reset paid status
          // Income/Rollover stays same? Usually users might want to update, but we keep values.
        };
     });
  };

  const loadState = (newState: BudgetState) => {
    setState(newState);
  };

  return (
    <BudgetContext.Provider
      value={{
        state,
        addFixedExpense,
        toggleFixedExpense,
        deleteFixedExpense,
        addDailyExpense,
        deleteDailyExpense,
        addCCDebt,
        deleteCCDebt,
        addInstallment,
        updateIncome,
        updateRollover,
        updateYkIncome,
        updateYkRollover,
        resetMonth,
        loadState,
        theme,
        toggleTheme
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};
