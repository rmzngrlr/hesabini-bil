import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { BudgetState, FixedExpense, DailyExpense, CCDebt, Limits } from '../types';

const STORAGE_KEY = 'budget_app_data';

const initialState: BudgetState = {
  version: 1,
  income: 0,
  rollover: 0,
  limits: { nakit: 250, yk: 320 },
  fixedExpenses: [],
  dailyExpenses: [],
  ccDebts: [],
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
  updateIncome: (amount: number) => void;
  updateRollover: (amount: number) => void;
  updateLimits: (limits: Limits) => void;
  resetMonth: () => void;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BudgetState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Migration logic:
        // If version is missing, it means old data where all dailyExpenses were expenses (positive numbers).
        // We need to convert them to negative numbers.
        if (!parsed.version) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const migratedDailyExpenses = (parsed.dailyExpenses || []).map((ex: any) => ({
             ...ex,
             amount: ex.amount > 0 ? -ex.amount : ex.amount
          }));

          return {
            ...initialState,
            ...parsed,
            dailyExpenses: migratedDailyExpenses,
            version: 1
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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

  const updateIncome = (income: number) => {
    setState(prev => ({ ...prev, income }));
  };

  const updateRollover = (rollover: number) => {
    setState(prev => ({ ...prev, rollover }));
  };

  const updateLimits = (limits: Limits) => {
    setState(prev => ({ ...prev, limits }));
  };

  const resetMonth = () => {
     setState(prev => ({
        ...prev,
        fixedExpenses: prev.fixedExpenses.map(ex => ({ ...ex, isPaid: false }))
     }));
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
        updateIncome,
        updateRollover,
        updateLimits,
        resetMonth
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
