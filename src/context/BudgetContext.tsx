import React, { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import type { BudgetState, FixedExpense, DailyExpense, CCDebt, Installment, MonthlyHistory } from '../types';

const STORAGE_KEY = 'budget_app_data';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const initialState: BudgetState = {
  version: 4,
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
  futureData: {},
};

interface BudgetContextType {
  state: BudgetState;
  viewDate: string;
  setViewDate: (date: string) => void;
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

// Helper to add months to a date string YYYY-MM
function addMonths(dateStr: string, months: number): string {
  let [y, m] = dateStr.split('-').map(Number);
  m += months;
  while (m > 12) {
    m -= 12;
    y++;
  }
  while (m < 1) {
    m += 12;
    y--;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// Helper: Calculate diff in months between two YYYY-MM strings
function monthDiff(d1: string, d2: string): number {
    const [y1, m1] = d1.split('-').map(Number);
    const [y2, m2] = d2.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
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

  const [realState, setRealState] = useState<BudgetState>(() => {
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
          // Version 1 -> 2
          parsed.currentMonth = initialState.currentMonth;
          parsed.installments = [];
          parsed.history = [];
          parsed.version = 2;
        }

        if (parsed.version === 2) {
          // Version 2 -> 3
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

        if (parsed.version === 3) {
           // Version 3 -> 4
           return {
             ...initialState,
             ...parsed,
             futureData: {},
             version: 4
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

  const [viewDate, setViewDate] = useState<string>(() => realState.currentMonth || getCurrentMonth());

  // Auto-Reset Month Logic (Operates on realState)
  useEffect(() => {
    const actualCurrentMonth = getCurrentMonth();
    if (realState.currentMonth && realState.currentMonth !== actualCurrentMonth) {
       setRealState(prev => {
        if (prev.currentMonth === actualCurrentMonth) return prev;

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

        const totalCCDebt = Math.abs(prev.ccDebts.reduce((sum, d) => sum + d.amount, 0));

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
          version: 4,
          currentMonth: actualCurrentMonth,
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
  }, [realState.currentMonth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(realState));
  }, [realState]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Projection Logic
  const derivedState = useMemo(() => {
    if (viewDate === realState.currentMonth) {
        return realState;
    }

    if (viewDate < realState.currentMonth) {
        // History View
        const hist = realState.history.find(h => h.month === viewDate);
        if (hist) {
            return {
                ...realState,
                ...hist,
                currentMonth: viewDate,
                installments: [],
                futureData: {},
            };
        }
        return realState;
    }

    // Future Projection
    let runningRollover = realState.rollover;
    let runningYkRollover = realState.ykRollover;

    // Calculate "End of Current Month" balance
    const currentCashSpent = realState.dailyExpenses
        .filter(e => e.type === 'NAKIT' && e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const currentCashIncome = realState.dailyExpenses
        .filter(e => e.type === 'NAKIT' && e.amount > 0)
        .reduce((sum, e) => sum + e.amount, 0);

    // Assume all fixed expenses in current month WILL be paid for projection
    const currentFixedTotal = realState.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);

    const currentTotalCash = realState.income + realState.rollover + currentCashIncome;
    runningRollover = currentTotalCash - (currentFixedTotal + currentCashSpent);
    if (runningRollover < 0) runningRollover = 0;

    // YK Rollover logic (similar)
    const currentYkSpent = realState.dailyExpenses
        .filter(e => e.type === 'YK' && e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const currentYkIncome = realState.dailyExpenses
        .filter(e => e.type === 'YK' && e.amount > 0)
        .reduce((sum, e) => sum + e.amount, 0);

    const currentTotalYk = realState.ykIncome + realState.ykRollover + currentYkIncome;
    runningYkRollover = currentTotalYk - currentYkSpent;
    if (runningYkRollover < 0) runningYkRollover = 0;

    // Iterate intervening months
    let iterMonth = addMonths(realState.currentMonth, 1);

    while (iterMonth <= viewDate) {
        const isTarget = iterMonth === viewDate;
        const future = realState.futureData[iterMonth] || {};

        // Income
        const monthIncome = future.income !== undefined ? future.income : realState.income;
        const monthYkIncome = future.ykIncome !== undefined ? future.ykIncome : realState.ykIncome;

        // Fixed Expenses
        const monthFixedExpenses = future.fixedExpenses || realState.fixedExpenses;
        const monthFixedTotal = monthFixedExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Installments for this month
        const monthsAway = monthDiff(realState.currentMonth, iterMonth);

        let monthInstallmentTotal = 0;
        const projectedCCDebts: CCDebt[] = [];

        realState.installments.forEach(inst => {
            const effectiveRemaining = inst.remainingInstallments - monthsAway;

            if (effectiveRemaining > 0) {
                 monthInstallmentTotal += inst.monthlyAmount;

                 if (isTarget) {
                     const currentInstNum = (inst.installmentCount - effectiveRemaining) + 1;
                     projectedCCDebts.push({
                        id: `proj-${inst.id}-${iterMonth}`,
                        description: `${inst.description} (${currentInstNum}/${inst.installmentCount})`,
                        amount: inst.monthlyAmount,
                        installmentId: inst.id,
                        currentInstallment: currentInstNum,
                        totalInstallments: inst.installmentCount
                     });
                 }
            }
        });

        if (isTarget) {
            // Filter and project installments for view
            const projectedInstallments = realState.installments
                .map(inst => ({
                    ...inst,
                    remainingInstallments: inst.remainingInstallments - monthsAway
                }))
                .filter(inst => inst.remainingInstallments > 0);

            return {
                ...realState,
                currentMonth: viewDate,
                income: monthIncome,
                ykIncome: monthYkIncome,
                rollover: runningRollover,
                ykRollover: runningYkRollover,
                fixedExpenses: monthFixedExpenses,
                dailyExpenses: [],
                ccDebts: projectedCCDebts,
                installments: projectedInstallments,
                futureData: realState.futureData,
            };
        }

        // Update Rollover for next iteration (Simplified: no CC debt rollover simulation)
        // New Balance = Old Balance + Income - Fixed - Installments
        const netCash = monthIncome - monthFixedTotal; // We assume installments go to CC Debt, which is a Fixed Expense NEXT month.
        // Wait, if I assume Installments go to CC Debt, they don't reduce cash NOW.
        // They reduce cash NEXT month when we pay "Kredi Kartı Borcu".
        // BUT, in my simplified projection, I don't see "Kredi Kartı Borcu" in `monthFixedExpenses` unless I add it.
        // `monthFixedExpenses` is derived from `future.fixedExpenses || realState.fixedExpenses`.
        // `realState.fixedExpenses` MIGHT contain "Kredi Kartı Borcu" from current month.
        // If we use it as template, we are effectively projecting "Paying same amount of CC Debt every month".
        // This is a rough approximation but acceptable for now without full simulation engine.

        runningRollover += netCash;
        if (runningRollover < 0) runningRollover = 0;

        // YK Rollover update
        // YK usually doesn't have debts.
        // New YK = Old YK + Income.
        // We assume 0 spending for projection unless fixed expenses include YK?
        // Fixed Expenses don't track type (Cash/YK). We assume Cash.
        runningYkRollover += monthYkIncome;

        iterMonth = addMonths(iterMonth, 1);
    }
    return realState;

  }, [realState, viewDate]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const addFixedExpense = (expense: Omit<FixedExpense, 'id' | 'isPaid'>) => {
    if (viewDate === realState.currentMonth) {
        const newExpense: FixedExpense = {
          id: generateId(),
          title: expense.title,
          amount: expense.amount,
          isPaid: false,
        };
        setRealState(prev => ({ ...prev, fixedExpenses: [...prev.fixedExpenses, newExpense] }));
    } else if (viewDate > realState.currentMonth) {
        setRealState(prev => {
            const future = prev.futureData[viewDate] || {};
            const currentList = future.fixedExpenses || prev.fixedExpenses.map(e => ({...e, isPaid: false}));

            const newExpense: FixedExpense = {
                id: generateId(),
                title: expense.title,
                amount: expense.amount,
                isPaid: false
            };

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: [...currentList, newExpense]
                    }
                }
            };
        });
    }
  };

  const toggleFixedExpense = (id: string) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({
          ...prev,
          fixedExpenses: prev.fixedExpenses.map(ex =>
            ex.id === id ? { ...ex, isPaid: !ex.isPaid } : ex
          ),
        }));
    } else if (viewDate > realState.currentMonth) {
        setRealState(prev => {
             const future = prev.futureData[viewDate];
             if (!future || !future.fixedExpenses) return prev;

             const currentList = future.fixedExpenses || prev.fixedExpenses.map(e => ({...e, isPaid: false}));
             const updatedList = currentList.map(ex => ex.id === id ? { ...ex, isPaid: !ex.isPaid } : ex);

             return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: updatedList
                    }
                }
             };
        });
    }
  };

  const deleteFixedExpense = (id: string) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({
          ...prev,
          fixedExpenses: prev.fixedExpenses.filter(ex => ex.id !== id),
        }));
    } else if (viewDate > realState.currentMonth) {
         setRealState(prev => {
            const future = prev.futureData[viewDate] || {};
            const currentList = future.fixedExpenses || prev.fixedExpenses.map(e => ({...e, isPaid: false}));

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: currentList.filter(ex => ex.id !== id)
                    }
                }
            };
        });
    }
  };

  const addDailyExpense = (expense: Omit<DailyExpense, 'id'>) => {
    if (viewDate !== realState.currentMonth) return;
    const newExpense: DailyExpense = {
      ...expense,
      id: generateId(),
    };
    setRealState(prev => ({ ...prev, dailyExpenses: [...prev.dailyExpenses, newExpense] }));
  };

  const deleteDailyExpense = (id: string) => {
    if (viewDate !== realState.currentMonth) return;
    setRealState(prev => ({
      ...prev,
      dailyExpenses: prev.dailyExpenses.filter(ex => ex.id !== id),
    }));
  };

  const updateDailyExpense = (id: string, expense: Partial<DailyExpense>) => {
     if (viewDate !== realState.currentMonth) return;
     setRealState(prev => ({
      ...prev,
      dailyExpenses: prev.dailyExpenses.map(ex =>
        ex.id === id ? { ...ex, ...expense } : ex
      ),
    }));
  };

  const addCCDebt = (debt: Omit<CCDebt, 'id'>) => {
     if (viewDate !== realState.currentMonth) return;
    const newDebt: CCDebt = {
      ...debt,
      id: generateId(),
    };
    setRealState(prev => ({ ...prev, ccDebts: [...prev.ccDebts, newDebt] }));
  };

  const deleteCCDebt = (id: string) => {
     if (viewDate !== realState.currentMonth) return;
    setRealState(prev => ({
      ...prev,
      ccDebts: prev.ccDebts.filter(d => d.id !== id),
    }));
  };

  const updateCCDebt = (id: string, debt: Partial<CCDebt>) => {
    if (viewDate !== realState.currentMonth) return;
    setRealState(prev => ({
      ...prev,
      ccDebts: prev.ccDebts.map(d =>
        d.id === id ? { ...d, ...debt } : d
      ),
    }));
  };

  const addInstallment = (installment: Omit<Installment, 'id' | 'remainingInstallments'>) => {
    const newInstallment: Installment = {
      ...installment,
      id: generateId(),
      remainingInstallments: installment.installmentCount,
    };

    const newDebt: CCDebt = {
      id: generateId(),
      description: `${newInstallment.description} (1/${newInstallment.installmentCount})`,
      amount: newInstallment.monthlyAmount,
      installmentId: newInstallment.id,
      currentInstallment: 1,
      totalInstallments: newInstallment.installmentCount
    };

    setRealState(prev => ({
      ...prev,
      installments: [...prev.installments, newInstallment],
      ccDebts: [...prev.ccDebts, newDebt]
    }));
  };

  const deleteInstallment = (id: string) => {
    setRealState(prev => ({
      ...prev,
      installments: prev.installments.filter(i => i.id !== id)
    }));
  };

  const updateFixedExpense = (id: string, expense: Partial<FixedExpense>) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({
          ...prev,
          fixedExpenses: prev.fixedExpenses.map(ex =>
            ex.id === id ? { ...ex, ...expense } : ex
          ),
        }));
    } else if (viewDate > realState.currentMonth) {
         setRealState(prev => {
            const future = prev.futureData[viewDate] || {};
            const currentList = future.fixedExpenses || prev.fixedExpenses.map(e => ({...e, isPaid: false}));

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: currentList.map(ex => ex.id === id ? { ...ex, ...expense } : ex)
                    }
                }
            };
        });
    }
  };

  const updateIncome = (income: number) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({ ...prev, income }));
    } else if (viewDate > realState.currentMonth) {
         setRealState(prev => ({
            ...prev,
            futureData: {
                ...prev.futureData,
                [viewDate]: {
                    ...(prev.futureData[viewDate] || {}),
                    income
                }
            }
        }));
    }
  };

  const updateRollover = (rollover: number) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({ ...prev, rollover }));
    }
  };

  const updateYkIncome = (ykIncome: number) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({ ...prev, ykIncome }));
    } else if (viewDate > realState.currentMonth) {
        setRealState(prev => ({
            ...prev,
            futureData: {
                ...prev.futureData,
                [viewDate]: {
                    ...(prev.futureData[viewDate] || {}),
                    ykIncome
                }
            }
        }));
    }
  };

  const updateYkRollover = (ykRollover: number) => {
     if (viewDate === realState.currentMonth) {
        setRealState(prev => ({ ...prev, ykRollover }));
    }
  };

  const resetMonth = () => {
    setRealState(prev => {
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

        const totalCCDebt = Math.abs(prev.ccDebts.reduce((sum, d) => sum + d.amount, 0));

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

        const [year, month] = (prev.currentMonth || getCurrentMonth()).split('-').map(Number);
        const nextDate = new Date(year, month, 1);
        const nextMonthStr = nextDate.toISOString().slice(0, 7);

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
          version: 4,
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
    setRealState(newState);
  };

  return (
    <BudgetContext.Provider
        value={{
            state: derivedState,
            viewDate,
            setViewDate,
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
