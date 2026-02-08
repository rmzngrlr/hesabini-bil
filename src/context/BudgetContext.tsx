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
  deleteInstallment: (id: string) => void;
  updateDailyExpense: (id: string, expense: Partial<DailyExpense>) => void;
  updateCCDebt: (id: string, debt: Partial<CCDebt>) => void;
  updateFixedExpense: (id: string, expense: Partial<FixedExpense>) => void;
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
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
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
          parsed.currentMonth = initialState.currentMonth;
          parsed.installments = [];
          parsed.history = [];
          parsed.version = 2;
        }

        if (parsed.version === 2) {
          // Version 2 -> 3 (Convert positive debts to negative for consistency)
          // Also check installments' monthlyAmount and convert if positive
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const migratedDebts = (parsed.ccDebts || []).map((d: any) => ({
            ...d,
            amount: d.amount > 0 ? -d.amount : d.amount
          }));

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const migratedInstallments = (parsed.installments || []).map((i: any) => ({
            ...i,
            monthlyAmount: i.monthlyAmount > 0 ? -i.monthlyAmount : i.monthlyAmount,
            totalAmount: i.totalAmount > 0 ? -i.totalAmount : i.totalAmount
          }));

          return {
            ...initialState,
            ...parsed,
            ccDebts: migratedDebts,
            installments: migratedInstallments,
            version: 3
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
        // Guard clause: If month is already updated (by a parallel run), do nothing
        if (prev.currentMonth === actualCurrentMonth) {
            return prev;
        }

        // Calculate remaining resources from current month to carry over
        const ykSpent = prev.dailyExpenses
          .filter(e => e.type === 'YK' && e.amount < 0)
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        const ykDailyIncome = prev.dailyExpenses
          .filter(e => e.type === 'YK' && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);
        const totalYk = (prev.ykIncome || 0) + (prev.ykRollover || 0) + ykDailyIncome;
        const remainingYk = totalYk - ykSpent;

        const cashSpent = prev.dailyExpenses
          .filter(e => e.type === 'NAKIT' && e.amount < 0)
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        const cashDailyIncome = prev.dailyExpenses
          .filter(e => e.type === 'NAKIT' && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);
        const paidFixed = prev.fixedExpenses
          .filter(e => e.isPaid)
          .reduce((sum, e) => sum + e.amount, 0);
        const totalCash = prev.income + prev.rollover + cashDailyIncome;
        const remainingCash = totalCash - (paidFixed + cashSpent);

        // Total CC Debt to carry as fixed expense
        const totalCCDebt = Math.abs(prev.ccDebts.reduce((sum, d) => sum + d.amount, 0));

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

        // New Fixed Expenses list
        const nextFixedExpenses = prev.fixedExpenses.map(ex => ({ ...ex, isPaid: false }));
        if (totalCCDebt > 0) {
          nextFixedExpenses.push({
            id: generateId(),
            title: 'Kredi Kartı Borcu (Geçen Ay)',
            amount: totalCCDebt,
            isPaid: false
          });
        }

        return {
          ...prev,
          version: 3,
          currentMonth: actualCurrentMonth, // Update to actual current system month
          history: [...prev.history, historyEntry],
          installments: nextMonthInstallments,
          ccDebts: nextMonthDebts,
          dailyExpenses: [],
          fixedExpenses: nextFixedExpenses,
          rollover: remainingCash > 0 ? remainingCash : 0,
          ykRollover: remainingYk > 0 ? remainingYk : 0,
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

  const deleteInstallment = (id: string) => {
    setState(prev => ({
      ...prev,
      installments: prev.installments.filter(i => i.id !== id)
    }));
  };

  const updateDailyExpense = (id: string, expense: Partial<DailyExpense>) => {
    setState(prev => ({
      ...prev,
      dailyExpenses: prev.dailyExpenses.map(ex =>
        ex.id === id ? { ...ex, ...expense } : ex
      ),
    }));
  };

  const updateCCDebt = (id: string, debt: Partial<CCDebt>) => {
    setState(prev => ({
      ...prev,
      ccDebts: prev.ccDebts.map(d =>
        d.id === id ? { ...d, ...debt } : d
      ),
    }));
  };

  const updateFixedExpense = (id: string, expense: Partial<FixedExpense>) => {
    setState(prev => ({
      ...prev,
      fixedExpenses: prev.fixedExpenses.map(ex =>
        ex.id === id ? { ...ex, ...expense } : ex
      ),
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
        // Calculate remaining resources from current month to carry over
        const ykSpent = prev.dailyExpenses
          .filter(e => e.type === 'YK' && e.amount < 0)
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        const ykDailyIncome = prev.dailyExpenses
          .filter(e => e.type === 'YK' && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);
        const totalYk = (prev.ykIncome || 0) + (prev.ykRollover || 0) + ykDailyIncome;
        const remainingYk = totalYk - ykSpent;

        const cashSpent = prev.dailyExpenses
          .filter(e => e.type === 'NAKIT' && e.amount < 0)
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        const cashDailyIncome = prev.dailyExpenses
          .filter(e => e.type === 'NAKIT' && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);
        const paidFixed = prev.fixedExpenses
          .filter(e => e.isPaid)
          .reduce((sum, e) => sum + e.amount, 0);
        const totalCash = prev.income + prev.rollover + cashDailyIncome;
        const remainingCash = totalCash - (paidFixed + cashSpent);

        // Total CC Debt to carry as fixed expense
        const totalCCDebt = Math.abs(prev.ccDebts.reduce((sum, d) => sum + d.amount, 0));

        // Archive current month
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        // Determine next month string
        const [year, month] = (prev.currentMonth || getCurrentMonth()).split('-').map(Number);
        const nextDate = new Date(year, month, 1);
        const nextMonthStr = nextDate.toISOString().slice(0, 7);

        // New Fixed Expenses list
        const nextFixedExpenses = prev.fixedExpenses.map(ex => ({ ...ex, isPaid: false }));
        if (totalCCDebt > 0) {
          nextFixedExpenses.push({
            id: generateId(),
            title: 'Kredi Kartı Borcu (Geçen Ay)',
            amount: totalCCDebt,
            isPaid: false
          });
        }

        return {
          ...prev,
          version: 3,
          currentMonth: nextMonthStr,
          history: [...prev.history, historyEntry],
          installments: nextMonthInstallments,
          ccDebts: nextMonthDebts,
          dailyExpenses: [],
          fixedExpenses: nextFixedExpenses,
          rollover: remainingCash > 0 ? remainingCash : 0,
          ykRollover: remainingYk > 0 ? remainingYk : 0,
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
        deleteInstallment,
        updateDailyExpense,
        updateCCDebt,
        updateFixedExpense,
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
