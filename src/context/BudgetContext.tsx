import React, { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import type { BudgetState, FixedExpense, DailyExpense, CCDebt, Installment, MonthlyHistory } from '../types';

const STORAGE_KEY = 'budget_app_data';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const initialState: BudgetState = {
  version: 5,
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
  earliestAllowedMonth: string;
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

// Helper: Subtract months
function subtractMonths(dateStr: string, months: number): string {
    return addMonths(dateStr, -months);
}

// Helper: Calculate diff in months between two YYYY-MM strings
function monthDiff(d1: string, d2: string): number {
    const [y1, m1] = d1.split('-').map(Number);
    const [y2, m2] = d2.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
}

// Helper: Migrate State
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateState(parsed: any): BudgetState {
    if (!parsed.version) {
      // Version 0 -> 1
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
      const migratedDebts = (parsed.ccDebts || []).map((d: any) => ({
        ...d,
        amount: d.amount > 0 ? -d.amount : d.amount
      }));

      const migratedInstallments = (parsed.installments || []).map((i: any) => ({
        ...i,
        monthlyAmount: i.monthlyAmount > 0 ? -i.monthlyAmount : i.monthlyAmount,
        totalAmount: i.totalAmount > 0 ? -i.totalAmount : i.totalAmount
      }));

      parsed = {
        ...initialState,
        ...parsed,
        ccDebts: migratedDebts,
        installments: migratedInstallments,
        version: 3
      };
    }

    if (parsed.version === 3) {
       // Version 3 -> 4
       parsed = {
         ...initialState,
         ...parsed,
         futureData: {},
         version: 4
       };
    }

    if (parsed.version === 4) {
      // Version 4 -> 5 (Cleanup duplicate CC debts from fixedExpenses)
      const ccDebtTitle = 'Kredi Kartı Borcu (Geçen Ay)';
      const otherExpenses = (parsed.fixedExpenses || []).filter((e: any) => e.title !== ccDebtTitle);
      const ccDebts = (parsed.fixedExpenses || []).filter((e: any) => e.title === ccDebtTitle);

      let newFixedExpenses = otherExpenses;
      if (ccDebts.length > 0) {
         newFixedExpenses = [...otherExpenses, ccDebts[ccDebts.length - 1]];
      }

      parsed = {
        ...initialState,
        ...parsed,
        fixedExpenses: newFixedExpenses,
        version: 5
      };
    }

    return { ...initialState, ...parsed };
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
        return migrateState(parsed);
      }
      return initialState;
    } catch (e) {
      console.error("Failed to parse local storage", e);
      return initialState;
    }
  });

  const [viewDate, setViewDate] = useState<string>(() => realState.currentMonth || getCurrentMonth());

  const earliestAllowedMonth = useMemo(() => {
      const historyMonths = realState.history.map(h => h.month);
      const allMonths = [realState.currentMonth, ...historyMonths];
      const minMonth = allMonths.reduce((min, m) => m < min ? m : min, allMonths[0]);
      // Allow going one month before the earliest data
      return subtractMonths(minMonth, 1);
  }, [realState.history, realState.currentMonth]);

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

        const [year, month] = (prev.currentMonth || getCurrentMonth()).split('-').map(Number);
        const nextDate = new Date(year, month, 1);
        const nextMonthStr = nextDate.toISOString().slice(0, 7);

        // New Fixed Expenses list
        // Remove old 'Kredi Kartı Borcu (Geçen Ay)' entries to prevent accumulation
        const nextFixedExpenses = prev.fixedExpenses
            .filter(ex => ex.title !== 'Kredi Kartı Borcu (Geçen Ay)')
            .map(ex => ({ ...ex, isPaid: false }));

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
          version: 5,
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

    // Initial CC Debt (from current month)
    let lastMonthCCDebt = Math.abs(realState.ccDebts.reduce((sum, d) => sum + d.amount, 0));

    // Iterate intervening months
    let iterMonth = addMonths(realState.currentMonth, 1);

    while (iterMonth <= viewDate) {
        const isTarget = iterMonth === viewDate;
        const future = realState.futureData[iterMonth] || {};

        // Income
        const monthIncome = future.income !== undefined ? future.income : realState.income;
        const monthYkIncome = future.ykIncome !== undefined ? future.ykIncome : realState.ykIncome;

        // Fixed Expenses
        // Filter out any existing 'Kredi Kartı Borcu (Geçen Ay)' to avoid duplication/stale data
        // and inject the calculated one from previous iteration
        let monthFixedExpenses: FixedExpense[] = [];

        // Use user-defined future expenses if available
        if (future.fixedExpenses) {
             monthFixedExpenses = future.fixedExpenses.map(e => ({ ...e }));
        } else {
             // Default Projection: Only Rent and Dues, reset to 0
             monthFixedExpenses = [
                {
                    id: `proj-rent-${iterMonth}`,
                    title: 'Ev Kirası',
                    amount: 0,
                    isPaid: false
                },
                {
                    id: `proj-dues-${iterMonth}`,
                    title: 'Aidat',
                    amount: 0,
                    isPaid: false
                }
             ];
        }

        // Apply CC Debt Adjustment if exists
        const ccDebtAdjustment = future.ccDebtAdjustment || 0;
        const adjustedCCDebt = lastMonthCCDebt + ccDebtAdjustment;

        // Ensure "Kredi Kartı Borcu (Geçen Ay)" is present with adjusted value
        // Note: If user previously edited it, it might be in `monthFixedExpenses` via `future.fixedExpenses`.
        // However, we want "Smart Update" where we apply adjustment to CURRENT calculated base.
        // So we should find the item (or create it) and set amount to `adjustedCCDebt`.

        // Filter out any stale entry first (to replace with fresh calculation + adjustment)
        monthFixedExpenses = monthFixedExpenses.filter(e => e.title !== 'Kredi Kartı Borcu (Geçen Ay)');

        if (adjustedCCDebt > 0 || ccDebtAdjustment !== 0) {
             monthFixedExpenses.push({
                id: `proj-cc-debt-${iterMonth}`,
                title: 'Kredi Kartı Borcu (Geçen Ay)',
                amount: adjustedCCDebt > 0 ? adjustedCCDebt : 0, // Ensure non-negative display
                isPaid: false
            });
        }

        // Installments for this month (to calculate CC Debt for NEXT month)
        const monthsAway = monthDiff(realState.currentMonth, iterMonth);

        // Start with Manual Future Debts if any
        let allCCDebts: CCDebt[] = [];
        if (future.ccDebts) {
            allCCDebts = [...future.ccDebts];
        }

        const projectedCCDebts: CCDebt[] = [];

        realState.installments.forEach(inst => {
            // remainingInstallments is relative to currentMonth start.
            // For iterMonth, we subtract monthsAway.
            // But if monthsAway >= remaining, it's done.
            const effectiveRemaining = inst.remainingInstallments - monthsAway;

            if (effectiveRemaining > 0) {
                 // Check for override
                 let amount = inst.monthlyAmount;
                 if (future.installmentOverrides && future.installmentOverrides[inst.id] !== undefined) {
                     amount = future.installmentOverrides[inst.id];
                 }

                 // Add to projected CC Debts list (for display if target)
                 const currentInstNum = (inst.installmentCount - effectiveRemaining) + 1;
                 const projDebt = {
                    id: `proj-${inst.id}-${iterMonth}`, // Unique ID for projection
                    description: `${inst.description} (${currentInstNum}/${inst.installmentCount})`,
                    amount: amount,
                    installmentId: inst.id, // Keep link to original
                    currentInstallment: currentInstNum,
                    totalInstallments: inst.installmentCount
                 };
                 projectedCCDebts.push(projDebt);
            }
        });

        // Combine Manual + Projected for Total Calculation and Display
        // User requested "Newest Last". Projected installments are "old/automatic". Manual additions are "new".
        // So Projected first, then Manual.
        allCCDebts = [...projectedCCDebts, ...allCCDebts];

        // Calculate total CC Debt for THIS month (to become Fixed Expense in NEXT month)
        // Includes Projected Installments AND Manual Future Debts
        lastMonthCCDebt = Math.abs(allCCDebts.reduce((sum, d) => sum + d.amount, 0));

        if (isTarget) {
            // Filter and project installments for view (Active Installments List)
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
                rollover: 0, // Future rollover is always 0
                ykRollover: 0, // Future YK rollover is always 0
                fixedExpenses: monthFixedExpenses,
                dailyExpenses: [],
                ccDebts: allCCDebts, // Show merged list
                installments: projectedInstallments,
                futureData: realState.futureData,
            };
        }

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

            // Base on displayed expenses (Projected List)
            const projectedExpenses = derivedState.fixedExpenses || [];
            // We need a fresh copy to modify
            const currentList = projectedExpenses.map(e => ({...e}));

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
             const future = prev.futureData[viewDate] || {};

             // Base on displayed expenses
             const projectedExpenses = derivedState.fixedExpenses || [];
             const newList = projectedExpenses.map(e => ({...e}));

             const index = newList.findIndex(ex => ex.id === id);
             if (index !== -1) {
                 newList[index].isPaid = !newList[index].isPaid;
             } else {
                 return prev;
             }

             return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: newList
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

            const projectedExpenses = derivedState.fixedExpenses || [];

            // Filter returns a new array
            const newList = projectedExpenses.filter(ex => ex.id !== id);

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: newList
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
    if (viewDate === realState.currentMonth) {
        const newDebt: CCDebt = {
          ...debt,
          id: generateId(),
        };
        setRealState(prev => ({ ...prev, ccDebts: [...prev.ccDebts, newDebt] }));
    } else if (viewDate > realState.currentMonth) {
        // Add to future data
        setRealState(prev => {
            const future = prev.futureData[viewDate] || {};
            const currentDebts = future.ccDebts || [];

            const newDebt: CCDebt = {
                ...debt,
                id: generateId(),
            };

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        ccDebts: [...currentDebts, newDebt]
                    }
                }
            };
        });
    }
  };

  const deleteCCDebt = (id: string) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({
          ...prev,
          ccDebts: prev.ccDebts.filter(d => d.id !== id),
        }));
    } else if (viewDate > realState.currentMonth) {
        setRealState(prev => {
            const future = prev.futureData[viewDate] || {};
            const currentDebts = future.ccDebts || [];

            // If it's a projected installment, we can't "delete" it easily (it comes from prev month).
            // Maybe we can "hide" it? But for now, let's only support deleting manually added future debts.
            // If ID is not in currentDebts, it might be projected.

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        ccDebts: currentDebts.filter(d => d.id !== id)
                    }
                }
            };
        });
    }
  };

  const updateCCDebt = (id: string, debt: Partial<CCDebt>) => {
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({
          ...prev,
          ccDebts: prev.ccDebts.map(d =>
            d.id === id ? { ...d, ...debt } : d
          ),
        }));
    } else if (viewDate > realState.currentMonth) {
        // Handle override for projected installment
        // Check if ID is projected installment ID: proj-{instId}-{month}
        if (id.startsWith('proj-') && debt.amount !== undefined) {
             // Extract installment ID? Or just use the fact that `derivedState` has it mapped.
             // We need to store: `futureData[viewDate].installmentOverrides[originalInstallmentId] = amount`

             // Find the item in derivedState to get original installmentId
             const item = derivedState.ccDebts.find(d => d.id === id);
             if (item && item.installmentId) {
                 setRealState(prev => {
                     const future = prev.futureData[viewDate] || {};
                     const overrides = future.installmentOverrides || {};

                     return {
                         ...prev,
                         futureData: {
                             ...prev.futureData,
                             [viewDate]: {
                                 ...future,
                                 installmentOverrides: {
                                     ...overrides,
                                     [item.installmentId as string]: debt.amount as number
                                 }
                             }
                         }
                     };
                 });
             }
        } else {
            // Handle Manual Future Debt Update
            setRealState(prev => {
                const future = prev.futureData[viewDate] || {};
                const currentDebts = future.ccDebts || [];

                const updatedDebts = currentDebts.map(d => d.id === id ? { ...d, ...debt } : d);

                return {
                    ...prev,
                    futureData: {
                        ...prev.futureData,
                        [viewDate]: {
                            ...future,
                            ccDebts: updatedDebts
                        }
                    }
                };
            });
        }
    }
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

            // Handle CC Debt Override separately
            // Need to identify if this update is for "Kredi Kartı Borcu (Geçen Ay)"
            // We can check title or ID pattern? ID pattern `proj-cc-debt-` is reliable if generated by `derivedState`.

            const isCCDebt = id.startsWith('proj-cc-debt-');

            if (isCCDebt && expense.amount !== undefined) {
                // Calculate adjustment
                // We need the *calculated base* to determine adjustment.
                // The current value in `derivedState` is `base + previousAdjustment`.
                // We want to find `newAdjustment` such that `base + newAdjustment = newAmount`.
                // `derivedState` has the `currentDisplayedAmount`.
                // So `base = currentDisplayedAmount - previousAdjustment`.
                // `newAdjustment = newAmount - base`.

                const previousAdjustment = future.ccDebtAdjustment || 0;
                const currentItem = derivedState.fixedExpenses.find(e => e.id === id);
                const currentDisplayedAmount = currentItem ? currentItem.amount : 0;

                const base = currentDisplayedAmount - previousAdjustment;
                const newAdjustment = expense.amount - base;

                return {
                    ...prev,
                    futureData: {
                        ...prev.futureData,
                        [viewDate]: {
                            ...future,
                            ccDebtAdjustment: newAdjustment
                        }
                    }
                };
            }

            // Normal Fixed Expense Update
            const projectedExpenses = derivedState.fixedExpenses || [];

            const newList = projectedExpenses.map(e => ({...e}));

            const index = newList.findIndex(ex => ex.id === id);
            if (index !== -1) {
                newList[index] = { ...newList[index], ...expense };
            } else {
                return prev;
            }

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: newList
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

        // New Fixed Expenses list
        // Remove old 'Kredi Kartı Borcu (Geçen Ay)' entries to prevent accumulation
        const nextFixedExpenses = prev.fixedExpenses
            .filter(ex => ex.title !== 'Kredi Kartı Borcu (Geçen Ay)')
            .map(ex => ({ ...ex, isPaid: false }));

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
          version: 5,
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
    const migrated = migrateState(newState);
    setRealState(migrated);
  };

  return (
    <BudgetContext.Provider
        value={{
            state: derivedState,
            viewDate,
            earliestAllowedMonth,
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
