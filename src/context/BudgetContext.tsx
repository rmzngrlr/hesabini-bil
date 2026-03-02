import React, { createContext, useContext, useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import type { BudgetState, FixedExpense, DailyExpense, CCDebt, Installment, MonthlyHistory } from '../types';
import { fetchWithAuth } from '../services/api';
import { useAuth } from './AuthContext';

const getCurrentMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

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
  showMealCard: boolean;
  toggleShowMealCard: () => void;
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

// Helper: Recalculate all subsequent months (Ripple Effect)
function recalculateHistoryAndCurrent(state: BudgetState): BudgetState {
    const newState = { ...state, history: [...state.history] };

    // Sort history chronologically just in case
    newState.history.sort((a, b) => a.month.localeCompare(b.month));

    let runningRollover = 0;
    let runningYkRollover = 0;
    let runningCCDebt = 0;

    // We assume the first history entry's starting rollover is correct (or 0).
    // Actually, we should propagate from the first entry to the current month.

    for (let i = 0; i < newState.history.length; i++) {
        const hist = newState.history[i];

        // Apply starting rollovers from previous iteration
        if (i > 0) {
            hist.rollover = runningRollover;
            hist.ykRollover = runningYkRollover;

            // Update CC Debt Fixed Expense for this month based on previous month's total debt
            // Filter out old debt
            hist.fixedExpenses = hist.fixedExpenses.filter(e => e.title !== 'Kredi Kartı Borcu (Geçen Ay)');
            if (runningCCDebt > 0) {
                hist.fixedExpenses.push({
                    id: generateId(),
                    title: 'Kredi Kartı Borcu (Geçen Ay)',
                    amount: runningCCDebt,
                    isPaid: true // Historical debts are assumed paid to not mess up historical cash flow, or maybe keep their original state?
                    // Actually, if we re-inject it, we might lose the 'isPaid' state the user set.
                    // Better approach: Find the existing item, update its amount, keep its isPaid state.
                });
            }
        }

        // Wait, if I just replace the CC Debt fixed expense, I lose `isPaid` state.
        // Let's refine CC Debt injection for History:
        if (i > 0) {
            hist.rollover = runningRollover;
            hist.ykRollover = runningYkRollover;

            const existingCCDebtIdx = hist.fixedExpenses.findIndex(e => e.title === 'Kredi Kartı Borcu (Geçen Ay)');
            if (runningCCDebt > 0) {
                if (existingCCDebtIdx !== -1) {
                    hist.fixedExpenses[existingCCDebtIdx].amount = runningCCDebt;
                } else {
                    hist.fixedExpenses.push({
                        id: generateId(),
                        title: 'Kredi Kartı Borcu (Geçen Ay)',
                        amount: runningCCDebt,
                        isPaid: true // default true for generated historical
                    });
                }
            } else {
                // If runningCCDebt is 0, remove it if exists
                if (existingCCDebtIdx !== -1) {
                    hist.fixedExpenses.splice(existingCCDebtIdx, 1);
                }
            }
        }

        // Calculate end-of-month balances for hist
        // Nakit
        const cashSpent = hist.dailyExpenses
          .filter(e => e.type === 'NAKIT' && e.amount < 0)
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        const cashDailyIncome = hist.dailyExpenses
          .filter(e => e.type === 'NAKIT' && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);
        const paidFixed = hist.fixedExpenses
          .filter(e => e.isPaid)
          .reduce((sum, e) => sum + e.amount, 0);

        const totalCash = hist.income + hist.rollover + cashDailyIncome;
        runningRollover = totalCash - (paidFixed + cashSpent);
        if (runningRollover < 0) runningRollover = 0;

        // YK
        const ykSpent = hist.dailyExpenses
          .filter(e => e.type === 'YK' && e.amount < 0)
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        const ykDailyIncome = hist.dailyExpenses
          .filter(e => e.type === 'YK' && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);

        const totalYk = (hist.ykIncome || 0) + (hist.ykRollover || 0) + ykDailyIncome;
        runningYkRollover = totalYk - ykSpent;
        if (runningYkRollover < 0) runningYkRollover = 0;

        // CC Debt
        runningCCDebt = Math.abs(hist.ccDebts.reduce((sum, d) => sum + d.amount, 0));
    }

    // Finally, apply to Current Month
    if (newState.history.length > 0) {
        newState.rollover = runningRollover;
        newState.ykRollover = runningYkRollover;

        // Propagate CC Debt to Current Month
        const existingCCDebtIdx = newState.fixedExpenses.findIndex(e => e.title === 'Kredi Kartı Borcu (Geçen Ay)');
        if (runningCCDebt > 0) {
            if (existingCCDebtIdx !== -1) {
                newState.fixedExpenses[existingCCDebtIdx].amount = runningCCDebt;
            } else {
                newState.fixedExpenses.push({
                    id: generateId(),
                    title: 'Kredi Kartı Borcu (Geçen Ay)',
                    amount: runningCCDebt,
                    isPaid: false // default false for current month
                });
            }
        } else {
            if (existingCCDebtIdx !== -1) {
                newState.fixedExpenses.splice(existingCCDebtIdx, 1);
            }
        }
    }

    return newState;
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
  const { isAuthenticated } = useAuth();
  const isInitialMount = useRef(true);
  const [isLoading, setIsLoading] = useState(true);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [showMealCard, setShowMealCard] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('settings_showMealCard');
      return stored !== 'false'; // Default true
    } catch {
      return true;
    }
  });

  const [realState, setRealState] = useState<BudgetState>(initialState);

  const [viewDate, setViewDate] = useState<string>(getCurrentMonth());

  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch initial state from server when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      setLoadError(null);
      fetchWithAuth('/budget')
        .then(async res => {
          if (!res.ok) {
            if (res.status === 404) {
               // New user, no data yet. That's fine, we use initialState
               return null;
            }
            throw new Error(`Server returned ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data) {
             const migrated = migrateState(data);
             setRealState(migrated);
             setViewDate(migrated.currentMonth || getCurrentMonth());
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to load budget data from server", err);
          setLoadError("Sunucu ile iletişim kurulamadı. Verileriniz korunması için uygulama durduruldu.");
          // Do NOT set isLoading to false if it's a critical error to prevent syncing empty state
        });
    }
  }, [isAuthenticated]);

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

    // Only trigger if we moved FORWARD in time.
    // If user changes system clock backwards, do nothing.
    if (realState.currentMonth && actualCurrentMonth > realState.currentMonth) {
       // Also snap the viewDate to the new actual month if it was pointing to the old current month
       if (viewDate === realState.currentMonth) {
           setViewDate(actualCurrentMonth);
       }

       setRealState(prevState => {
        // Fast-forward catch-up loop
        // We process all missing months sequentially to ensure correct rollover
        // without causing a React render cascade or infinite loops.
        let currentState = { ...prevState };

        while (currentState.currentMonth < actualCurrentMonth) {
            const prev = currentState;

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

        const nextMonthStr = addMonths(prev.currentMonth || getCurrentMonth(), 1);

        // New Fixed Expenses list
        // 1. Start with defaults (Rent, Dues) as 0, similar to projection logic
        let nextFixedExpenses: FixedExpense[] = [
            { id: generateId(), title: 'Ev Kirası', amount: 0, isPaid: false },
            { id: generateId(), title: 'Aidat', amount: 0, isPaid: false }
        ];

        // 2. Check for Future Plan (Overrides)
        const futurePlan = prev.futureData[nextMonthStr] || {};

        if (futurePlan.fixedExpenses) {
            // Use the planned expenses if available (user edited specific items)
            // Note: If user planned, the list might already include Rent/Dues with modified values.
            // We should trust the plan.
            nextFixedExpenses = futurePlan.fixedExpenses.map(e => ({ ...e, isPaid: false }));
        }

        // 3. Handle CC Debt (Calculated + Adjustment)
        // Check if there is an adjustment in the plan
        const ccDebtAdjustment = futurePlan.ccDebtAdjustment || 0;
        const finalCCDebt = totalCCDebt + ccDebtAdjustment;

        // Check if "Kredi Kartı Borcu (Geçen Ay)" is already in the list (e.g. from plan)
        const hasCCDebt = nextFixedExpenses.some(e => e.title === 'Kredi Kartı Borcu (Geçen Ay)');

        if (!hasCCDebt && (finalCCDebt > 0 || ccDebtAdjustment !== 0)) {
             nextFixedExpenses.push({
                id: generateId(),
                title: 'Kredi Kartı Borcu (Geçen Ay)',
                amount: finalCCDebt > 0 ? finalCCDebt : 0,
                isPaid: false
             });
        } else if (hasCCDebt) {
             // If it exists (user override in plan), we might want to update it with the REAL total?
             // If the user modified it in the plan, they modified the AMOUNT.
             // But in `updateFixedExpense`, we stored the ADJUSTMENT.
             // So if `futurePlan.fixedExpenses` contains the debt item, it contains the *Projected* amount at that time.
             // But now `totalCCDebt` (Real) might be different from `lastMonthCCDebt` (Projected).
             // So we should re-calculate using the adjustment.

             // Remove the static entry from the plan and inject the dynamic one
             nextFixedExpenses = nextFixedExpenses.filter(e => e.title !== 'Kredi Kartı Borcu (Geçen Ay)');

             if (finalCCDebt > 0 || ccDebtAdjustment !== 0) {
                 nextFixedExpenses.push({
                    id: generateId(),
                    title: 'Kredi Kartı Borcu (Geçen Ay)',
                    amount: finalCCDebt > 0 ? finalCCDebt : 0,
                    isPaid: false
                 });
             }
        }

        // 4. Handle Future Manual Debts (Add to CC Debts list)
        // If the user added manual CC debts in the future month, they are in `futurePlan.ccDebts`.
        // We need to append them to `nextMonthDebts` (which currently contains installments).
        if (futurePlan.ccDebts) {
            // Need to generate new IDs or keep existing?
            // Usually keeping IDs is fine, but they might conflict if we are not careful.
            // `futurePlan.ccDebts` are independent.
            nextMonthDebts.push(...futurePlan.ccDebts);
        }

        // 5. Apply Installment Overrides from Plan
        if (futurePlan.installmentOverrides) {
             nextMonthDebts.forEach(debt => {
                 if (debt.installmentId && futurePlan.installmentOverrides![debt.installmentId] !== undefined) {
                     debt.amount = futurePlan.installmentOverrides![debt.installmentId];
                 }
             });
        }

        // 6. Merge planned income if available
        const finalIncome = futurePlan.income !== undefined ? futurePlan.income : prev.income;
        const finalYkIncome = futurePlan.ykIncome !== undefined ? futurePlan.ykIncome : prev.ykIncome;

        currentState = {
          ...prev,
          version: 5,
          currentMonth: nextMonthStr,
          income: finalIncome,
          ykIncome: finalYkIncome,
          history: [...prev.history, historyEntry],
          installments: nextMonthInstallments,
          ccDebts: nextMonthDebts,
          dailyExpenses: [],
          fixedExpenses: nextFixedExpenses,
          rollover: remainingCash > 0 ? remainingCash : 0,
          ykRollover: remainingYk > 0 ? remainingYk : 0,
        };
      }
      return currentState;
     });
    }
  }, [realState.currentMonth]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Skip sync if we are just loading from the server
    if (isLoading || !isAuthenticated) return;

    const syncState = async () => {
      try {
        await fetchWithAuth('/budget', {
          method: 'POST',
          body: JSON.stringify(realState)
        });
      } catch (e) {
        console.error("Failed to sync budget data to server", e);
      }
    };

    // Debounce the sync to avoid spamming the server
    const timeoutId = setTimeout(syncState, 500);
    return () => clearTimeout(timeoutId);
  }, [realState, isAuthenticated, isLoading]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('settings_showMealCard', String(showMealCard));
  }, [showMealCard]);

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

  const toggleShowMealCard = () => {
    setShowMealCard(prev => !prev);
  };

  const addFixedExpense = (expense: Omit<FixedExpense, 'id' | 'isPaid'>) => {
    const newExpense: FixedExpense = {
        id: generateId(),
        title: expense.title,
        amount: expense.amount,
        isPaid: false,
    };

    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return { ...prev, fixedExpenses: [...prev.fixedExpenses, newExpense] };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            const projectedExpenses = derivedState.fixedExpenses || [];
            const currentList = projectedExpenses.map(e => ({...e}));

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
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    fixedExpenses: [...newHistory[histIndex].fixedExpenses, newExpense]
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const toggleFixedExpense = (id: string) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return {
              ...prev,
              fixedExpenses: prev.fixedExpenses.map(ex =>
                ex.id === id ? { ...ex, isPaid: !ex.isPaid } : ex
              ),
            };
        } else if (viewDate > prev.currentMonth) {
             const future = prev.futureData[viewDate] || {};
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
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    fixedExpenses: newHistory[histIndex].fixedExpenses.map(ex =>
                        ex.id === id ? { ...ex, isPaid: !ex.isPaid } : ex
                    )
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const deleteFixedExpense = (id: string) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return {
              ...prev,
              fixedExpenses: prev.fixedExpenses.filter(ex => ex.id !== id),
            };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            const projectedExpenses = derivedState.fixedExpenses || [];
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
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    fixedExpenses: newHistory[histIndex].fixedExpenses.filter(ex => ex.id !== id)
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const addDailyExpense = (expense: Omit<DailyExpense, 'id'>) => {
    const newExpense: DailyExpense = {
      ...expense,
      id: generateId(),
    };

    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return { ...prev, dailyExpenses: [...prev.dailyExpenses, newExpense] };
        } else if (viewDate < prev.currentMonth) {
            // Edit History
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    dailyExpenses: [...newHistory[histIndex].dailyExpenses, newExpense]
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const deleteDailyExpense = (id: string) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return {
              ...prev,
              dailyExpenses: prev.dailyExpenses.filter(ex => ex.id !== id),
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    dailyExpenses: newHistory[histIndex].dailyExpenses.filter(ex => ex.id !== id)
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const updateDailyExpense = (id: string, expense: Partial<DailyExpense>) => {
     setRealState(prev => {
        if (viewDate === prev.currentMonth) {
             return {
              ...prev,
              dailyExpenses: prev.dailyExpenses.map(ex =>
                ex.id === id ? { ...ex, ...expense } : ex
              ),
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    dailyExpenses: newHistory[histIndex].dailyExpenses.map(ex =>
                        ex.id === id ? { ...ex, ...expense } : ex
                    )
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const addCCDebt = (debt: Omit<CCDebt, 'id'>) => {
    const newDebt: CCDebt = {
        ...debt,
        id: generateId(),
    };

    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return { ...prev, ccDebts: [...prev.ccDebts, newDebt] };
        } else if (viewDate > prev.currentMonth) {
            // Add to future data
            const future = prev.futureData[viewDate] || {};
            const currentDebts = future.ccDebts || [];
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
        } else if (viewDate < prev.currentMonth) {
            // Edit History
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    ccDebts: [...newHistory[histIndex].ccDebts, newDebt]
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const deleteCCDebt = (id: string) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return {
              ...prev,
              ccDebts: prev.ccDebts.filter(d => d.id !== id),
            };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            const currentDebts = future.ccDebts || [];
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
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    ccDebts: newHistory[histIndex].ccDebts.filter(d => d.id !== id)
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
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
    } else if (viewDate < realState.currentMonth) {
        setRealState(prev => {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    ccDebts: newHistory[histIndex].ccDebts.map(d =>
                        d.id === id ? { ...d, ...debt } : d
                    )
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        });
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
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return {
              ...prev,
              fixedExpenses: prev.fixedExpenses.map(ex =>
                ex.id === id ? { ...ex, ...expense } : ex
              ),
            };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};

            const isCCDebt = id.startsWith('proj-cc-debt-') || expense.title === 'Kredi Kartı Borcu (Geçen Ay)';

            if (isCCDebt && expense.amount !== undefined) {
                const previousAdjustment = future.ccDebtAdjustment || 0;
                const currentItem = derivedState.fixedExpenses.find(e => e.id === id || e.title === 'Kredi Kartı Borcu (Geçen Ay)');
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
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];

                // If it's a CC Debt update in history, we should allow it but note that
                // it might be overwritten by recalculateHistoryAndCurrent unless we treat it as an adjustment there too.
                // For simplicity, let's just update the list and let the engine recalculate.
                // Wait! If they edit CC Debt in history, it shouldn't be recalculated/overwritten?
                // The prompt says "Geçtiğimiz aylarda ... düzenleme yapmama fırsat ver. O bugünü de etkilesin".
                // If I edit "Rent", the rollover changes.
                // If I edit "CC Debt" in history, well, CC Debt in history is calculated from the *previous* month.
                // If they manually edit it, and then the recalculation engine runs, it will overwrite it based on the previous month.
                // Is this desired? Usually yes, because CC debt is strictly derived from transactions.
                // If they want to change CC debt, they should add a transaction in the previous month.
                // However, we allow editing Fixed Expenses.

                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    fixedExpenses: newHistory[histIndex].fixedExpenses.map(ex =>
                        ex.id === id ? { ...ex, ...expense } : ex
                    )
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const updateIncome = (income: number) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return { ...prev, income };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: { ...future, income }
                }
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = { ...newHistory[histIndex], income };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  const updateRollover = (rollover: number) => {
    // Rollover is dynamic. Allow manual override only for current month or history if really needed.
    // Actually, setting rollover in history will just be overwritten by recalculateHistoryAndCurrent.
    if (viewDate === realState.currentMonth) {
        setRealState(prev => ({ ...prev, rollover }));
    }
  };

  const updateYkIncome = (ykIncome: number) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return { ...prev, ykIncome };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: { ...future, ykIncome }
                }
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = { ...newHistory[histIndex], ykIncome };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
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

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
         <div className="text-red-500 text-xl font-bold">Hata</div>
         <p className="text-center max-w-md">{loadError}</p>
         <button
           onClick={() => window.location.reload()}
           className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
         >
           Yeniden Dene
         </button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Veriler yükleniyor...</div>;
  }

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
            toggleTheme,
            showMealCard,
            toggleShowMealCard
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
