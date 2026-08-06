import React, { createContext, useContext, useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import { getTodayStr, toLocalMonthStr, statementMonth } from '../lib/utils';
import type { BudgetState, FixedExpense, CustomIncome, DailyExpense, CCDebt, Installment, MonthlyHistory, GoldRecord } from '../types';
import { fetchWithAuth } from '../services/api';
import { useAuth } from './AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';

const getCurrentMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/** Otomatik olusturulan sabit gider basliklari. Tek dogruluk kaynagi. */
export const RENT_AND_DUES_TITLE = 'Ev Kirası ve Aidat';
export const CC_DEBT_TITLE = 'Kredi Kartı Borcu (Geçen Ay)';

/**
 * Odenmedigi surece uyari verilecek sabit giderler.
 * Bunlarda tarih alani yoktur; ayin 1'inden itibaren odenmemisse uyari verilir.
 */
export const WARNED_FIXED_EXPENSE_TITLES = [RENT_AND_DUES_TITLE, CC_DEBT_TITLE];

/**
 * Bir sabit gider "odenmedi" uyarisi vermeli mi?
 * Tutar > 0 sarti onemli: 'Ev Kirasi ve Aidat' her ay 0 tutarla otomatik
 * acildigi icin, tutar girilmeden uyari vermek anlamsiz olurdu.
 * Kart cercevesi ve menu rozeti AYNI bu fonksiyonu kullanir.
 */
/** 'YYYY-MM' icin o ayin gun sayisi. new Date(y, m, 0) => o ayin son gunu. */
export const daysInMonth = (monthStr: string): number => {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/**
 * 'YYYY-MM' icin Turkce ay adi (bas harfi buyuk).
 * Sabit dizi kullaniliyor: toLocaleDateString('tr-TR') ay adlarini kucuk harfle
 * dondurur ve bas harfi buyutmek Turkce'de ozel durumlar dogurabilir.
 */
const TR_MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];
export const monthNameTr = (monthStr: string): string => {
  const m = Number(monthStr.split('-')[1]);
  return TR_MONTH_NAMES[m - 1] ?? '';
};

/**
 * Gelecek ay icin ayrilan nakit harclik kalemini uretir.
 * Turetilmis satirdir; kaynagi futureData[ay].dailyAllowance'dir.
 * Eslesme BASLIGA gore degil isAllowance BAYRAGINA gore yapilir, boylece
 * baslik bilgilendirici olabilir ve degisse bile mantik bozulmaz.
 */
export const buildAllowanceExpense = (monthStr: string, daily: number): FixedExpense => {
  const days = daysInMonth(monthStr);
  return {
    id: `allowance-${monthStr}`,
    title: `${monthNameTr(monthStr)} Ayı Harçlığım (${daily.toLocaleString('tr-TR')} ₺/gün × ${days} gün)`,
    amount: daily * days,
    isPaid: false,
    isAllowance: true,
  };
};

export const isFixedExpenseOverdue = (e: FixedExpense): boolean =>
  WARNED_FIXED_EXPENSE_TITLES.includes(e.title)
  && !e.isPaid
  && (Number(e.amount) || 0) > 0;

const initialState: BudgetState = {
  version: 6,
  currentMonth: getCurrentMonth(),
  income: 0,
  rollover: 0,
  ykIncome: 0,
  ykRollover: 0,
  fixedExpenses: [],
  customIncomes: [],
  dailyExpenses: [],
  ccDebts: [],
  installments: [],
  history: [],
  futureData: {},
};

/**
 * Bir taksitin k. ayinin odeme tarihini hesaplar.
 * startDate'in GUNU odeme gunu olarak kabul edilir (taksit 1'in ayindan
 * baslar, her taksit +1 ay). Ornek: startDate 2026-02-01, k=7 -> 2026-08-01.
 * startDate ISO ('...T...Z') veya 'YYYY-MM-DD' olabilir; sadece tarih kismi alinir.
 * startDate yoksa undefined doner (borc tarihsiz kalir, mevcut davranis korunur).
 */
export const installmentDate = (startDate: string | undefined, k: number): string | undefined => {
  if (!startDate) return undefined;
  const ymd = String(startDate).substring(0, 10);
  const [y, mo, d] = ymd.split('-').map(Number);
  if (!y || !mo) return undefined;
  const idx = (mo - 1) + (k - 1);
  const ny = y + Math.floor(idx / 12);
  const nm = ((idx % 12) + 12) % 12 + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  const nd = Math.min(d || 1, lastDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
};

interface BudgetContextType {
  state: BudgetState;
  viewDate: string;
  earliestAllowedMonth: string;
  setViewDate: (date: string) => void;
  addFixedExpense: (expense: Omit<FixedExpense, 'id' | 'isPaid'>) => void;
  toggleFixedExpense: (id: string) => void;
  deleteFixedExpense: (id: string) => void;
  addCustomIncome: (income: Omit<CustomIncome, 'id'>) => void;
  deleteCustomIncome: (id: string) => void;
  addDailyExpense: (expense: Omit<DailyExpense, 'id'>) => void;
  deleteDailyExpense: (id: string) => void;
  addCCDebt: (debt: Omit<CCDebt, 'id'>) => void;
  deleteCCDebt: (id: string) => void;
  /** Kredi kartı hesap kesim günü (1-31) veya kapalı (null). */
  statementCutoffDay: number | null;
  setStatementCutoffDay: (day: number | null) => void;
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
  showVault: boolean;
  toggleShowVault: () => void;
  // Vault state & operations
  vaultRecords: GoldRecord[];
  vaultOrder: string[];
  addVaultRecord: (record: Omit<GoldRecord, 'id'>) => Promise<void>;
  deleteVaultRecord: (id: number) => Promise<void>;
  updateVaultRecord: (id: number, record: Partial<GoldRecord>) => Promise<void>;
  updateVaultOrder: (order: string[]) => Promise<void>;
  updateAssetIncome: (assetType: string, amount: number) => void;
  updateAssetRollover: (assetType: string, amount: number) => void;
  activeCurrencies: string[];
  dueBillsCount: number;
  /** Ödenmemiş Kira / Kredi Kartı sayısı (Varlıklarım rozeti). */
  dueFixedExpensesCount: number;
  /** Otomatik ödenmiş, bildirimi kapatılmamış KK faturaları (bildirim kartı için). */
  autoPaidBills: FixedExpense[];
  /** Günü gelmiş, ekstre bildirimi henüz kapatılmamış KK borçları. */
  ccDueNotices: CCDebt[];
  ccDueNoticeCount: number;
  dismissCCDueNotice: (id: string) => void;
  /** Aynı faturaların sayısı (mavi bilgi rozeti için). */
  autoPaidBillsCount: number;
  /** Bir otomatik ödeme bildirimini kapatır (X). */
  dismissAutoPaidBill: (id: string) => void;
  /** Goruntulenen ay icin belirlenmis gunluk nakit harclik (yoksa 0). */
  dailyAllowance: number;
  updateDailyAllowance: (daily: number) => void;
  /** Yerel "bugün" (YYYY-MM-DD). Gece yarısı geçince canlı olarak güncellenir. */
  todayStr: string;
  askConfirmation: (message: string, title?: string) => Promise<boolean>;
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

let globalVaultRecords: GoldRecord[] = [];

const isGoldType = (type: string) => {
  const lower = type.toLowerCase();
  const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
  return goldKeywords.some(kw => lower.includes(kw));
};

const getKasaSum = (records: GoldRecord[], type: string, filterFn: (date: string) => boolean) => {
  return records
    .filter(r => r.gold_type === type && filterFn(r.record_date))
    .reduce((sum, r) => {
      const amt = Number(r.amount);
      const tType = r.transaction_type || 'Birikim';
      if (tType === 'Birikim' || tType === 'Giriş' || tType === 'Bütçe Geliri') {
        return sum + amt;
      } else {
        return sum - amt;
      }
    }, 0);
};

const getCurrencyVaultExpenses = (records: GoldRecord[]): DailyExpense[] => {
  return (records || [])
    .filter(r => r && r.gold_type && !isGoldType(r.gold_type) && r.record_date && typeof r.record_date === 'string')
    .map(r => {
      const isExpense = r.transaction_type === 'Borç Verdim' || r.transaction_type === 'Bozdurma' || r.transaction_type === 'Çıkış';
      const amt = Number(r.amount);
      return {
        id: `vault-curr-${r.id}`,
        date: r.record_date,
        description: r.note ? `${r.owner}: ${r.note}` : r.owner || 'Kasa Kaydı',
        amount: isExpense ? -Math.abs(amt) : Math.abs(amt),
        type: r.gold_type
      };
    });
};

const syncCCDebtsForList = (fixedExpenses: FixedExpense[], ccDebts: CCDebt[]): CCDebt[] => {
  const activePaidBills = (fixedExpenses || []).filter(e => e.isBill && e.paymentMethod === 'KK' && e.isPaid);
  const activeBillIds = new Set(activePaidBills.map(e => `bill-cc-${e.id}`));

  let updatedDebts = (ccDebts || []).filter(d => {
    if (!d.id.startsWith('bill-cc-')) return true;
    return activeBillIds.has(d.id);
  });

  activePaidBills.forEach(e => {
    const debtId = `bill-cc-${e.id}`;
    const existingIndex = updatedDebts.findIndex(d => d.id === debtId);

    if (existingIndex !== -1) {
      updatedDebts[existingIndex] = {
        ...updatedDebts[existingIndex],
        description: e.title,
        amount: -Math.abs(e.amount),
        date: e.date || updatedDebts[existingIndex].date || getTodayStr()
      };
    } else {
      updatedDebts.push({
        id: debtId,
        description: e.title,
        amount: -Math.abs(e.amount),
        date: e.date || getTodayStr()
      });
    }
  });

  return updatedDebts;
};

const syncDailyExpensesForList = (
  fixedExpenses: FixedExpense[],
  dailyExpenses: DailyExpense[],
  viewDate: string,
  currentMonth: string
): DailyExpense[] => {
  const activePaidBills = (fixedExpenses || []).filter(e => e.isBill && e.paymentMethod === 'NAKIT' && e.isPaid);
  const activeBillIds = new Set(activePaidBills.map(e => `bill-cash-${e.id}`));

  let updatedDaily = (dailyExpenses || []).filter(d => {
    if (!d.id.startsWith('bill-cash-')) return true;
    return activeBillIds.has(d.id);
  });

  activePaidBills.forEach(e => {
    const dailyId = `bill-cash-${e.id}`;
    const existingIndex = updatedDaily.findIndex(d => d.id === dailyId);

    if (existingIndex !== -1) {
      updatedDaily[existingIndex] = {
        ...updatedDaily[existingIndex],
        description: e.title,
        amount: -Math.abs(e.amount),
        date: e.date || updatedDaily[existingIndex].date || (viewDate === currentMonth ? getTodayStr() : `${viewDate}-01`)
      };
    } else {
      const today = getTodayStr();
      const targetDate = e.date || (viewDate === currentMonth ? today : `${viewDate}-01`);
      updatedDaily.push({
        id: dailyId,
        description: e.title,
        amount: -Math.abs(e.amount),
        type: 'NAKIT',
        date: targetDate
      });
    }
  });

  return updatedDaily;
};

const getActiveCurrencies = (state: BudgetState, vaultRecs: GoldRecord[]) => {
  const found = new Set<string>();
  
  // Scan vault records
  (vaultRecs || []).forEach(r => {
    if (!isGoldType(r.gold_type)) found.add(r.gold_type);
  });

  if (state) {
    // Scan current daily expenses
    (state.dailyExpenses || []).forEach(e => {
      if (e.type !== 'NAKIT' && e.type !== 'YK' && !isGoldType(e.type)) {
        found.add(e.type);
      }
    });

    // Scan history
    (state.history || []).forEach(h => {
      (h.dailyExpenses || []).forEach(e => {
        if (e.type !== 'NAKIT' && e.type !== 'YK' && !isGoldType(e.type)) {
          found.add(e.type);
        }
      });
      (h.fixedExpenses || []).forEach(e => {
        if (e.type === 'PLANNED_VAULT') {
          if (e.vault_gold_type && e.vault_gold_type !== 'NAKIT' && e.vault_gold_type !== 'YK' && !isGoldType(e.vault_gold_type)) {
            found.add(e.vault_gold_type);
          }
        } else if (e.type && e.type !== 'NAKIT' && e.type !== 'YK' && !isGoldType(e.type)) {
          found.add(e.type);
        }
      });
      (h.customIncomes || []).forEach(i => {
        if (i.type === 'PLANNED_VAULT') {
          if (i.vault_gold_type && i.vault_gold_type !== 'NAKIT' && i.vault_gold_type !== 'YK' && !isGoldType(i.vault_gold_type)) {
            found.add(i.vault_gold_type);
          }
        } else if (i.type && i.type !== 'NAKIT' && i.type !== 'YK' && !isGoldType(i.type)) {
          found.add(i.type);
        }
      });
    });

    // Scan current month fixed expenses and custom incomes
    (state.fixedExpenses || []).forEach(e => {
      if (e.type === 'PLANNED_VAULT') {
        if (e.vault_gold_type && e.vault_gold_type !== 'NAKIT' && e.vault_gold_type !== 'YK' && !isGoldType(e.vault_gold_type)) {
          found.add(e.vault_gold_type);
        }
      } else if (e.type && e.type !== 'NAKIT' && e.type !== 'YK' && !isGoldType(e.type)) {
        found.add(e.type);
      }
    });
    (state.customIncomes || []).forEach(i => {
      if (i.type === 'PLANNED_VAULT') {
        if (i.vault_gold_type && i.vault_gold_type !== 'NAKIT' && i.vault_gold_type !== 'YK' && !isGoldType(i.vault_gold_type)) {
          found.add(i.vault_gold_type);
        }
      } else if (i.type && i.type !== 'NAKIT' && i.type !== 'YK' && !isGoldType(i.type)) {
        found.add(i.type);
      }
    });

    // Scan future data
    Object.values(state.futureData || {}).forEach((f: any) => {
      if (f.fixedExpenses) {
        f.fixedExpenses.forEach((e: any) => {
          if (e.type === 'PLANNED_VAULT') {
            if (e.vault_gold_type && e.vault_gold_type !== 'NAKIT' && e.vault_gold_type !== 'YK' && !isGoldType(e.vault_gold_type)) {
              found.add(e.vault_gold_type);
            }
          } else if (e.type && e.type !== 'NAKIT' && e.type !== 'YK' && !isGoldType(e.type)) {
            found.add(e.type);
          }
        });
      }
      if (f.customIncomes) {
        f.customIncomes.forEach((i: any) => {
          if (i.type === 'PLANNED_VAULT') {
            if (i.vault_gold_type && i.vault_gold_type !== 'NAKIT' && i.vault_gold_type !== 'YK' && !isGoldType(i.vault_gold_type)) {
              found.add(i.vault_gold_type);
            }
          } else if (i.type && i.type !== 'NAKIT' && i.type !== 'YK' && !isGoldType(i.type)) {
            found.add(i.type);
          }
        });
      }
      if (f.assetBudgets) {
        Object.keys(f.assetBudgets).forEach(curr => {
          if (!isGoldType(curr)) found.add(curr);
        });
      }
    });
  }

  return Array.from(found);
};

// Helper: Recalculate all subsequent months (Ripple Effect)
function recalculateHistoryAndCurrent(state: BudgetState): BudgetState {
    const vaultExpenses = getCurrencyVaultExpenses(globalVaultRecords);

    const newState: BudgetState = { 
        ...state, 
        dailyExpenses: [
            ...(state.dailyExpenses || [])
                .filter(e => e && e.id && typeof e.id === 'string' && !e.id.startsWith('vault-curr-')),
            ...vaultExpenses.filter(e => e && e.date && typeof e.date === 'string' && e.date.startsWith(state.currentMonth))
        ],
        history: (state.history || []).map(hist => ({
            ...hist,
            dailyExpenses: [
                ...(hist.dailyExpenses || [])
                    .filter(e => e && e.id && typeof e.id === 'string' && !e.id.startsWith('vault-curr-')),
                ...vaultExpenses.filter(e => e && e.date && typeof e.date === 'string' && e.date.startsWith(hist.month))
            ]
        }))
    };

    // Sort history chronologically just in case
    newState.history.sort((a, b) => a.month.localeCompare(b.month));

    let runningRollover = 0;
    let runningYkRollover = 0;
    let runningCCDebt = 0;

    // Track running rollovers for other currencies
    const activeCurrencies = getActiveCurrencies(newState, globalVaultRecords);

    const runningAssetRollovers: Record<string, number> = {};

    // For the very first month, starting asset rollovers are computed from vault records before that month
    const firstMonth = newState.history.length > 0 ? newState.history[0].month : newState.currentMonth;
    activeCurrencies.forEach(curr => {
      runningAssetRollovers[curr] = getKasaSum(globalVaultRecords, curr, d => d < `${firstMonth}-01`);
    });

    for (let i = 0; i < newState.history.length; i++) {
        const hist = newState.history[i];
        hist.assetBudgets = hist.assetBudgets || {};

        // Apply starting rollovers from previous iteration
        if (i > 0) {
            hist.rollover = runningRollover;
            hist.ykRollover = runningYkRollover;

            activeCurrencies.forEach(curr => {
                hist.assetBudgets = hist.assetBudgets || {};
                hist.assetBudgets[curr] = {
                    income: hist.assetBudgets[curr]?.income || 0,
                    rollover: runningAssetRollovers[curr] || 0
                };
            });

            // Update CC Debt Fixed Expense for this month based on previous month's total debt
            // Filter out old debt
            hist.fixedExpenses = hist.fixedExpenses.filter(e => e.title !== CC_DEBT_TITLE);
            if (runningCCDebt > 0) {
                hist.fixedExpenses.push({
                    id: generateId(),
                    title: CC_DEBT_TITLE,
                    amount: runningCCDebt,
                    isPaid: true // Historical debts are assumed paid
                });
            }
        } else {
            // For the first history entry, set initial rollovers
            activeCurrencies.forEach(curr => {
                hist.assetBudgets = hist.assetBudgets || {};
                hist.assetBudgets[curr] = {
                    income: hist.assetBudgets[curr]?.income || 0,
                    rollover: runningAssetRollovers[curr] || 0
                };
            });
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
          .filter(e => e.isPaid && (e.type === 'NAKIT' || !e.type) && !e.isBill)
          .reduce((sum, e) => sum + e.amount, 0);
        const customIncomeTotal = (hist.customIncomes || [])
          .filter(i => i.type === 'NAKIT' || !i.type)
          .reduce((sum, e) => sum + e.amount, 0);

        const totalCash = hist.income + hist.rollover + cashDailyIncome + customIncomeTotal;
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

        // Other active currencies
        activeCurrencies.forEach(curr => {
            const assetBudget = hist.assetBudgets?.[curr];
            const startRollover = assetBudget?.rollover || 0;
            const monthIncome = assetBudget?.income || 0;

            const kasaChanges = 0; // Vault currency records are merged into dailyExpenses

            const assetCustomIncome = (hist.customIncomes || [])
              .filter(i => i.type === curr)
              .reduce((sum, i) => sum + i.amount, 0);
            const assetDailyIncome = hist.dailyExpenses
              .filter(e => e.type === curr && e.amount > 0)
              .reduce((sum, e) => sum + e.amount, 0);
            const assetDailySpent = hist.dailyExpenses
              .filter(e => e.type === curr && e.amount < 0)
              .reduce((sum, e) => sum + Math.abs(e.amount), 0);
            const assetFixedSpent = hist.fixedExpenses
              .filter(e => e.isPaid && e.type === curr && !e.isBill)
              .reduce((sum, e) => sum + e.amount, 0);

            const totalAsset = startRollover + kasaChanges + monthIncome + assetCustomIncome + assetDailyIncome;
            const remainingAsset = totalAsset - (assetFixedSpent + assetDailySpent);
            runningAssetRollovers[curr] = remainingAsset > 0 ? remainingAsset : 0;
        });

        // CC Debt
        runningCCDebt = Math.abs(hist.ccDebts.reduce((sum, d) => sum + d.amount, 0));
    }

    // Finally, apply to Current Month
    newState.rollover = runningRollover;
    newState.ykRollover = runningYkRollover;
    newState.assetBudgets = newState.assetBudgets || {};
    activeCurrencies.forEach(curr => {
        newState.assetBudgets = newState.assetBudgets || {};
        newState.assetBudgets[curr] = {
            income: newState.assetBudgets[curr]?.income || 0,
            rollover: runningAssetRollovers[curr] || 0
        };
    });

    if (newState.history.length > 0) {
        // Propagate CC Debt to Current Month
        const existingCCDebtIdx = newState.fixedExpenses.findIndex(e => e.title === CC_DEBT_TITLE);
        if (runningCCDebt > 0) {
            if (existingCCDebtIdx !== -1) {
                newState.fixedExpenses[existingCCDebtIdx].amount = runningCCDebt;
            } else {
                newState.fixedExpenses.push({
                    id: generateId(),
                    title: CC_DEBT_TITLE,
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
      const ccDebtTitle = CC_DEBT_TITLE;
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

    if (parsed.version === 5) {
      parsed = {
        ...initialState,
        ...parsed,
        customIncomes: parsed.customIncomes || [],
        version: 6
      };
    }

    if (parsed.version === 6) {
      parsed = {
        ...parsed,
        version: 7
      };
    }

    if (parsed.version === 7) {
      // Version 7 -> 8: 'Ev Kirası' ve 'Aidat' tek kalemde birlestirilir.
      // Tutarlar toplanir; ikisi de odenmisse birlesik kalem odenmis sayilir.
      // Listedeki konum korunur (ilk eslesmenin yerine yazilir).
      const RENT = 'Ev Kirası';
      const DUES = 'Aidat';
      const MERGED = RENT_AND_DUES_TITLE;

      const mergeRentAndDues = (list: any): any => {
        if (!Array.isArray(list)) return list;
        const targets = list.filter((e: any) => e && (e.title === RENT || e.title === DUES));
        if (targets.length === 0) return list;

        const total = targets.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        const allPaid = targets.every((e: any) => !!e.isPaid);

        let placed = false;
        const out: any[] = [];
        for (const e of list) {
          if (e && (e.title === RENT || e.title === DUES)) {
            if (!placed) {
              out.push({ ...e, title: MERGED, amount: total, isPaid: allPaid });
              placed = true;
            }
            // sonraki eslesmeler duser
          } else {
            out.push(e);
          }
        }
        return out;
      };

      parsed.fixedExpenses = mergeRentAndDues(parsed.fixedExpenses);

      if (Array.isArray(parsed.history)) {
        parsed.history = parsed.history.map((h: any) => (
          h ? { ...h, fixedExpenses: mergeRentAndDues(h.fixedExpenses) } : h
        ));
      }

      if (parsed.futureData && typeof parsed.futureData === 'object') {
        Object.keys(parsed.futureData).forEach((key) => {
          const fd = parsed.futureData[key];
          if (fd && Array.isArray(fd.fixedExpenses)) {
            fd.fixedExpenses = mergeRentAndDues(fd.fixedExpenses);
          }
        });
      }

      parsed.version = 8;
    }

    // Unconditional cleanup of PLANNED_VAULT daily expenses
    if (parsed) {
      if (parsed.dailyExpenses) {
        parsed.dailyExpenses = parsed.dailyExpenses.filter((e: any) => e.type !== 'PLANNED_VAULT');
      }
      if (parsed.history && Array.isArray(parsed.history)) {
        parsed.history = parsed.history.map((h: any) => {
          if (h.dailyExpenses) {
            return {
              ...h,
              dailyExpenses: h.dailyExpenses.filter((e: any) => e.type !== 'PLANNED_VAULT')
            };
          }
          return h;
        });
      }
    }

    return { ...initialState, ...parsed };
}

export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const isInitialMount = useRef(true);
  const [isLoading, setIsLoading] = useState(true);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    resolve: ((value: boolean) => void) | null;
  } | null>(null);

  const askConfirmation = (message: string, title = 'Emin misiniz?'): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    if (confirmState?.resolve) {
      confirmState.resolve(true);
    }
    setConfirmState(null);
  };

  const handleCancel = () => {
    if (confirmState?.resolve) {
      confirmState.resolve(false);
    }
    setConfirmState(null);
  };

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

  const { isAuthenticated, isAdmin } = useAuth();
  const [vaultRecords, setVaultRecords] = useState<GoldRecord[]>([]);
  const [vaultOrder, setVaultOrder] = useState<string[]>([]);

  // Update module-level variable for recalculateHistoryAndCurrent
  useEffect(() => {
    globalVaultRecords = vaultRecords;
  }, [vaultRecords]);

  const loadVaultRecords = async () => {
    if (!isAuthenticated || !isAdmin) return;
    try {
      const res = await fetchWithAuth('/vault');
      if (res.ok) {
        const data = await res.json();
        const cleanRecords = (data.records || []).filter((r: any) => r.gold_type !== 'PLANNED_VAULT');
        setVaultRecords(cleanRecords);
        if (data.vaultOrder && Array.isArray(data.vaultOrder)) {
          setVaultOrder(data.vaultOrder);
        }
      }
    } catch (err) {
      console.error("Error loading vault records", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadVaultRecords();
    }
  }, [isAuthenticated, isAdmin]);

  const addVaultRecord = async (record: Omit<GoldRecord, 'id'>) => {
    try {
      const res = await fetchWithAuth('/vault', {
        method: 'POST',
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error('Kayıt eklenemedi.');
      await loadVaultRecords();
      setRealState(prev => recalculateHistoryAndCurrent(prev));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteVaultRecord = async (id: number) => {
    try {
      // Find the record before deleting it so we can clean up daily expenses
      const recordToDelete = vaultRecords.find(r => r.id === id);

      const res = await fetchWithAuth(`/vault/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Kayıt silinemedi.');
      await loadVaultRecords();

      if (recordToDelete) {
        // If we deleted a vault record, find and delete the associated daily expenses
        setRealState(prev => {
          const updatedState = { ...prev };
          const goldAmount = Number(recordToDelete.amount);

          const isGoldMatch = (exp: DailyExpense) =>
            exp.date === recordToDelete.record_date &&
            exp.type === recordToDelete.gold_type &&
            Math.abs(exp.amount) === goldAmount &&
            exp.description.startsWith(`Kime Ait: ${recordToDelete.owner}`);

          const isTLMatch = (exp: DailyExpense) =>
            exp.date === recordToDelete.record_date &&
            exp.type === 'NAKIT' &&
            (exp.description.startsWith(`Altın Alımı: ${goldAmount} ${recordToDelete.gold_type}`) ||
             exp.description.startsWith(`Altın Satışı: ${goldAmount} ${recordToDelete.gold_type}`));


          // Remove from current month
          updatedState.dailyExpenses = updatedState.dailyExpenses.filter(exp => !isGoldMatch(exp) && !isTLMatch(exp));

          // Remove from history
          updatedState.history = updatedState.history.map(h => ({
            ...h,
            dailyExpenses: h.dailyExpenses.filter(exp => !isGoldMatch(exp) && !isTLMatch(exp))
          }));

          return recalculateHistoryAndCurrent(updatedState);
        });

        // Safe API call outside the setState updater
        setRealState(current => {
          fetchWithAuth('/budget', {
             method: 'POST',
             body: JSON.stringify(current)
          }).catch(console.error);
          return current;
        });
      } else {
        setRealState(prev => recalculateHistoryAndCurrent(prev));
      }

    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateVaultRecord = async (id: number, record: Partial<GoldRecord>) => {
    try {
      const res = await fetchWithAuth(`/vault/${id}`, {
        method: 'PUT',
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error('Kayıt güncellenemedi.');
      await loadVaultRecords();
      setRealState(prev => recalculateHistoryAndCurrent(prev));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateVaultOrder = async (order: string[]) => {
    try {
      setVaultOrder(order); // Optimistic
      const res = await fetchWithAuth('/vault/order', {
        method: 'PUT',
        body: JSON.stringify({ order })
      });
      if (!res.ok) throw new Error('Sıralama güncellenemedi.');
    } catch (err) {
      console.error(err);
      await loadVaultRecords();
      throw err;
    }
  };

  const updateAssetIncome = (assetType: string, amount: number) => {
    setRealState(prev => {
      if (viewDate === prev.currentMonth) {
        const assetBudgets = { ...prev.assetBudgets };
        assetBudgets[assetType] = {
          income: amount,
          rollover: assetBudgets[assetType]?.rollover || 0
        };
        return recalculateHistoryAndCurrent({ ...prev, assetBudgets });
      } else if (viewDate > prev.currentMonth) {
        const future = prev.futureData[viewDate] || {};
        const assetBudgets = { ...future.assetBudgets };
        assetBudgets[assetType] = {
          income: amount,
          rollover: assetBudgets[assetType]?.rollover || 0
        };
        return {
          ...prev,
          futureData: {
            ...prev.futureData,
            [viewDate]: { ...future, assetBudgets }
          }
        };
      }
      return prev;
    });
  };

  const updateAssetRollover = (assetType: string, amount: number) => {
    setRealState(prev => {
      if (viewDate === prev.currentMonth) {
        const assetBudgets = { ...prev.assetBudgets };
        assetBudgets[assetType] = {
          income: assetBudgets[assetType]?.income || 0,
          rollover: amount
        };
        return recalculateHistoryAndCurrent({ ...prev, assetBudgets });
      }
      return prev;
    });
  };

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
        .then(async data => {
          if (data) {
             // Load vault records first to ensure globalVaultRecords is set before migrateState/recalculate
             if (isAdmin) {
               const vaultRes = await fetchWithAuth('/vault');
               if (vaultRes.ok) {
                 const vaultData = await vaultRes.json();
                 const cleanRecords = (vaultData.records || []).filter((r: any) => r.gold_type !== 'PLANNED_VAULT');
                 setVaultRecords(cleanRecords);
                 globalVaultRecords = cleanRecords;

                 // Delete corrupt vault records from database
                 const corruptRecords = (vaultData.records || []).filter((r: any) => r.gold_type === 'PLANNED_VAULT');
                 for (const r of corruptRecords) {
                   if (r.id) {
                     fetchWithAuth(`/vault/${r.id}`, { method: 'DELETE' }).catch(err => console.error(err));
                   }
                 }

                 if (vaultData.vaultOrder && Array.isArray(vaultData.vaultOrder)) {
                   setVaultOrder(vaultData.vaultOrder);
                 }
               }
             }
             const migrated = migrateState(data);
             setRealState(recalculateHistoryAndCurrent(migrated));
             setViewDate(migrated.currentMonth || getCurrentMonth());
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to load budget data from server", err);
          setLoadError("Sunucu ile iletişim kurulamadı. Verileriniz korunması için uygulama durduruldu.");
        });
    }
  }, [isAuthenticated, isAdmin]);

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
          .filter(e => e.isPaid && (e.type === 'NAKIT' || !e.type) && !e.isBill)
          .reduce((sum, e) => sum + e.amount, 0);
        const customIncomeTotal = (prev.customIncomes || []).reduce((sum, e) => sum + e.amount, 0);
        const totalCash = prev.income + prev.rollover + cashDailyIncome + customIncomeTotal;
        const remainingCash = totalCash - (paidFixed + cashSpent);

        const totalCCDebt = Math.abs(prev.ccDebts.reduce((sum, d) => sum + d.amount, 0));

        const historyEntry: MonthlyHistory = {
          month: prev.currentMonth || getCurrentMonth(),
          income: prev.income,
          rollover: prev.rollover,
          ykIncome: prev.ykIncome,
          ykRollover: prev.ykRollover,
          fixedExpenses: prev.fixedExpenses,
          customIncomes: prev.customIncomes,
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
               date: installmentDate(inst.startDate, nextInstallmentNumber),
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
            { id: generateId(), title: RENT_AND_DUES_TITLE, amount: 0, isPaid: false }
        ];

        // 2. Check for Future Plan (Overrides)
        const futurePlan = prev.futureData[nextMonthStr] || {};

        if (futurePlan.fixedExpenses) {
            // Nakit harclik kalemi burada "cozulur": aya gecildiginde gider olmaktan
            // cikar, tutari kendiliginden Kalan Turk Lirasi'na doner. Planlanan
            // fixedExpenses'a sizmis bir kopyasi olsa bile burada elenir.
            nextFixedExpenses = futurePlan.fixedExpenses
                .filter(e => !e.isAllowance)
                .map(e => ({ ...e, isPaid: false }));
        }

        // 3. Self-healing: Inject any missing bills into nextFixedExpenses
        (prev.fixedExpenses || []).forEach(e => {
            if (e.isBill) {
                const exists = nextFixedExpenses.some(ne => ne.title === e.title && ne.isBill);
                if (!exists) {
                    nextFixedExpenses.push({
                        id: generateId(),
                        title: e.title,
                        amount: 0,
                        isPaid: false,
                        isBill: true,
                        paymentMethod: e.paymentMethod || 'NAKIT',
                        type: e.type
                    });
                }
            }
        });

        // 3. Handle CC Debt (Calculated + Adjustment)
        // Check if there is an adjustment in the plan
        const ccDebtAdjustment = futurePlan.ccDebtAdjustment || 0;
        const finalCCDebt = totalCCDebt + ccDebtAdjustment;

        // Check if "Kredi Kartı Borcu (Geçen Ay)" is already in the list (e.g. from plan)
        const hasCCDebt = nextFixedExpenses.some(e => e.title === CC_DEBT_TITLE);

        if (!hasCCDebt && (finalCCDebt > 0 || ccDebtAdjustment !== 0)) {
             nextFixedExpenses.push({
                id: generateId(),
                title: CC_DEBT_TITLE,
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
             nextFixedExpenses = nextFixedExpenses.filter(e => e.title !== CC_DEBT_TITLE);

             if (finalCCDebt > 0 || ccDebtAdjustment !== 0) {
                 nextFixedExpenses.push({
                    id: generateId(),
                    title: CC_DEBT_TITLE,
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

    // 1. Calculate running rollovers starting from the current month's actual ending balances
    let runningProjRollover = 0;
    let runningProjYkRollover = 0;
    const runningProjAssetBudgets: Record<string, { income: number; rollover: number }> = {};

    const currentFixedTotal = realState.fixedExpenses.filter(e => e.isPaid && (e.type === 'NAKIT' || !e.type) && !e.isBill).reduce((sum, e) => sum + e.amount, 0);
    const currentCustomIncomes = realState.customIncomes.filter(i => i.type === 'NAKIT' || !i.type).reduce((sum, i) => sum + i.amount, 0);
    const totalCashResources = realState.income + realState.rollover + currentCustomIncomes;

    const cashExpenses = realState.dailyExpenses.filter(e => e.type === 'NAKIT' || !e.type);
    const ykExpenses = realState.dailyExpenses.filter(e => e.type === 'YK');

    const totalCashDaily = Math.abs(cashExpenses.filter(e => e.amount < 0).reduce((sum, e) => sum + e.amount, 0));
    const totalCashDailyIncome = cashExpenses.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);

    const totalYkDaily = Math.abs(ykExpenses.filter(e => e.amount < 0).reduce((sum, e) => sum + e.amount, 0));
    const totalYkDailyIncome = ykExpenses.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);

    runningProjRollover = totalCashResources + totalCashDailyIncome - currentFixedTotal - totalCashDaily;
    if (runningProjRollover < 0) runningProjRollover = 0;

    runningProjYkRollover = (realState.ykIncome + realState.ykRollover + totalYkDailyIncome) - totalYkDaily;
    if (runningProjYkRollover < 0) runningProjYkRollover = 0;

    const activeCurrencies = getActiveCurrencies(realState, globalVaultRecords);

    activeCurrencies.forEach(curr => {
        const assetBudget = realState.assetBudgets?.[curr];
        const startRollover = assetBudget?.rollover || 0;
        const monthInc = assetBudget?.income || 0;

        const kasaChanges = 0; // Vault currency records are merged into dailyExpenses

        const assetCustomIncome = realState.customIncomes
          .filter(i => i.type === curr)
          .reduce((sum, i) => sum + i.amount, 0);
        const assetDailyIncome = realState.dailyExpenses
          .filter(e => e.type === curr && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);
        const assetDailySpent = realState.dailyExpenses
          .filter(e => e.type === curr && e.amount < 0)
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        const assetFixedSpent = realState.fixedExpenses
          .filter(e => e.isPaid && e.type === curr && !e.isBill)
          .reduce((sum, e) => sum + e.amount, 0);

        const totalAsset = startRollover + kasaChanges + monthInc + assetCustomIncome + assetDailyIncome;
        const remainingAsset = totalAsset - (assetFixedSpent + assetDailySpent);
        runningProjAssetBudgets[curr] = {
            income: realState.assetBudgets?.[curr]?.income || 0,
            rollover: remainingAsset > 0 ? remainingAsset : 0
        };
    });

    // 2. Initial CC Debt (from current month)
    let lastMonthCCDebt = Math.abs(realState.ccDebts.reduce((sum, d) => sum + d.amount, 0));

    // Iterate intervening months
    let iterMonth = addMonths(realState.currentMonth, 1);

    while (iterMonth <= viewDate) {
        const isTarget = iterMonth === viewDate;
        const future = realState.futureData[iterMonth] || {};

        // Income
        const monthIncome = future.income !== undefined ? future.income : realState.income;
        const monthYkIncome = future.ykIncome !== undefined ? future.ykIncome : realState.ykIncome;

        // Custom Incomes (Always empty in future unless explicitly added for that month)
        const monthCustomIncomes = future.customIncomes || [];

        // Fixed Expenses
        // Filter out any existing CC_DEBT_TITLE to avoid duplication/stale data
        // and inject the calculated one from previous iteration
        let monthFixedExpenses: FixedExpense[] = [];

        // Use user-defined future expenses if available.
        // Harclik kalemi TURETILMISTIR: futureData'ya yazilmis eski bir kopyasi
        // varsa atilir ve asagida dailyAllowance'tan yeniden uretilir. (KK borcunda
        // kullanilan "filtrele-sonra-yeniden-uret" deseninin aynisi.)
        if (future.fixedExpenses) {
             monthFixedExpenses = future.fixedExpenses
                .filter(e => !e.isAllowance)
                .map(e => ({ ...e }));
        } else {
             // Default Projection: Rent, Dues, and all active bills with 0 amount
             monthFixedExpenses = [
                {
                    id: `proj-rent-${iterMonth}`,
                    title: RENT_AND_DUES_TITLE,
                    amount: 0,
                    isPaid: false
                }
             ];
        }

        // Nakit harclik: o ay icin belirlenmisse turetilmis kalemi ekle.
        // Sadece gelecek aylarda gorunur; o aya gecilince devirde haric tutulur.
        if (future.dailyAllowance && future.dailyAllowance > 0) {
            monthFixedExpenses.push(buildAllowanceExpense(iterMonth, future.dailyAllowance));
        }

        // Self-healing: Inject any missing bills into monthFixedExpenses
        (realState.fixedExpenses || []).forEach(e => {
            if (e.isBill) {
                const exists = monthFixedExpenses.some(ne => ne.title === e.title && ne.isBill);
                if (!exists) {
                    monthFixedExpenses.push({
                        id: `proj-bill-${e.id}-${iterMonth}`,
                        title: e.title,
                        amount: 0,
                        isPaid: false,
                        isBill: true,
                        paymentMethod: e.paymentMethod || 'NAKIT',
                        type: e.type
                    });
                }
            }
        });

        // Apply CC Debt Adjustment if exists
        const ccDebtAdjustment = future.ccDebtAdjustment || 0;
        const adjustedCCDebt = lastMonthCCDebt + ccDebtAdjustment;

        // Ensure "Kredi Kartı Borcu (Geçen Ay)" is present with adjusted value
        monthFixedExpenses = monthFixedExpenses.filter(e => e.title !== CC_DEBT_TITLE);

        if (adjustedCCDebt > 0 || ccDebtAdjustment !== 0) {
             monthFixedExpenses.push({
                id: `proj-cc-debt-${iterMonth}`,
                title: CC_DEBT_TITLE,
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
                    date: installmentDate(inst.startDate, currentInstNum),
                    installmentId: inst.id, // Keep link to original
                    currentInstallment: currentInstNum,
                    totalInstallments: inst.installmentCount
                 };
                 projectedCCDebts.push(projDebt);
            }
        });

        // Gather paid KK bills for this iteration month
        const monthlyKKBillDebts: CCDebt[] = monthFixedExpenses
          .filter(e => e.isBill && e.paymentMethod === 'KK' && e.isPaid)
          .map(e => ({
            id: `proj-bill-cc-${e.id}`,
            description: `Fatura: ${e.title}`,
            amount: -Math.abs(e.amount)
          }));

        // Combine Manual + Projected + Monthly KK Bills for Total Calculation and Display
        allCCDebts = [...projectedCCDebts, ...allCCDebts, ...monthlyKKBillDebts];

        // Calculate total CC Debt for THIS month (to become Fixed Expense in NEXT month)
        lastMonthCCDebt = Math.abs(allCCDebts.reduce((sum, d) => sum + d.amount, 0));

        if (isTarget) {
            // Filter and project installments for view (Active Installments List)
            const projectedInstallments = realState.installments
                .map(inst => ({
                    ...inst,
                    remainingInstallments: inst.remainingInstallments - monthsAway
                }))
                .filter(inst => inst.remainingInstallments > 0);

            // Construct final dynamicAssetBudgets for target month
            const finalAssetBudgets: Record<string, { income: number; rollover: number }> = {};
            activeCurrencies.forEach(curr => {
                const futAsset = future.assetBudgets?.[curr];
                finalAssetBudgets[curr] = {
                    income: futAsset?.income !== undefined ? futAsset.income : (realState.assetBudgets?.[curr]?.income || 0),
                    rollover: runningProjAssetBudgets[curr]?.rollover || 0
                };
            });

            return {
                ...realState,
                currentMonth: viewDate,
                income: monthIncome,
                ykIncome: monthYkIncome,
                rollover: monthsAway === 1 ? runningProjRollover : 0,
                ykRollover: monthsAway === 1 ? runningProjYkRollover : 0,
                fixedExpenses: monthFixedExpenses,
                customIncomes: monthCustomIncomes,
                dailyExpenses: [],
                ccDebts: allCCDebts, // Show merged list
                installments: projectedInstallments,
                futureData: realState.futureData,
                assetBudgets: finalAssetBudgets
            };
        }

        // For intervening months, cascade asset currency budgets
        activeCurrencies.forEach(curr => {
            const futAsset = future.assetBudgets?.[curr];
            const monthInc = futAsset?.income !== undefined ? futAsset.income : (realState.assetBudgets?.[curr]?.income || 0);
            const startRollover = runningProjAssetBudgets[curr]?.rollover || 0;

            const kasaChanges = 0; // Vault currency records are merged into dailyExpenses

            const assetCustomIncome = monthCustomIncomes
              .filter(i => i.type === curr)
              .reduce((sum, i) => sum + i.amount, 0);
            const assetFixedSpent = monthFixedExpenses
              .filter(e => e.type === curr)
              .reduce((sum, e) => sum + e.amount, 0);

            const totalAsset = startRollover + kasaChanges + monthInc + assetCustomIncome;
            const remainingAsset = totalAsset - assetFixedSpent;

            runningProjAssetBudgets[curr] = {
                income: monthInc,
                rollover: remainingAsset > 0 ? remainingAsset : 0
            };
        });

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

  const [showVault, setShowVault] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('settings_showVault');
      return stored !== 'false'; // Default true
    } catch {
      return true;
    }
  });

  const toggleShowVault = () => {
    setShowVault(prev => !prev);
  };

  useEffect(() => {
    localStorage.setItem('settings_showVault', String(showVault));
  }, [showVault]);

  const addCustomIncome = (income: Omit<CustomIncome, 'id'>) => {
    const newIncome: CustomIncome = {
        id: generateId(),
        title: income.title,
        amount: income.amount,
    };

    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return { ...prev, customIncomes: [...(prev.customIncomes || []), newIncome] };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            const currentIncomes = future.customIncomes || [];
            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        customIncomes: [...currentIncomes, newIncome]
                    }
                }
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    customIncomes: [...(newHistory[histIndex].customIncomes || []), newIncome]
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
        }
        return prev;
    });
  };

  const deleteCustomIncome = (id: string) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            return { ...prev, customIncomes: (prev.customIncomes || []).filter(i => i.id !== id) };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            const currentIncomes = future.customIncomes || [];
            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        customIncomes: currentIncomes.filter(i => i.id !== id)
                    }
                }
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    customIncomes: (newHistory[histIndex].customIncomes || []).filter(i => i.id !== id)
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
        }
        return prev;
    });
  };

  const addFixedExpense = (expense: Omit<FixedExpense, 'id' | 'isPaid'>) => {
    const newExpense: FixedExpense = {
        ...expense,
        id: generateId(),
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
            const newFixedExpenses = prev.fixedExpenses.map(ex =>
              ex.id === id ? { ...ex, isPaid: !ex.isPaid } : ex
            );
            const updatedCCDebts = syncCCDebtsForList(newFixedExpenses, prev.ccDebts);
            const updatedDaily = syncDailyExpensesForList(newFixedExpenses, prev.dailyExpenses, viewDate, prev.currentMonth);
            return {
              ...prev,
              fixedExpenses: newFixedExpenses,
              ccDebts: updatedCCDebts,
              dailyExpenses: updatedDaily
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

             const updatedCCDebts = syncCCDebtsForList(newList, future.ccDebts || []);
             return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: newList,
                        ccDebts: updatedCCDebts
                    }
                }
             };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                const newFixedExpenses = newHistory[histIndex].fixedExpenses.map(ex =>
                    ex.id === id ? { ...ex, isPaid: !ex.isPaid } : ex
                );
                const updatedCCDebts = syncCCDebtsForList(newFixedExpenses, newHistory[histIndex].ccDebts || []);
                const updatedDaily = syncDailyExpensesForList(newFixedExpenses, newHistory[histIndex].dailyExpenses || [], viewDate, prev.currentMonth);
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    fixedExpenses: newFixedExpenses,
                    ccDebts: updatedCCDebts,
                    dailyExpenses: updatedDaily
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
            const newFixedExpenses = prev.fixedExpenses.filter(ex => ex.id !== id);
            const updatedCCDebts = syncCCDebtsForList(newFixedExpenses, prev.ccDebts);
            const updatedDaily = syncDailyExpensesForList(newFixedExpenses, prev.dailyExpenses, viewDate, prev.currentMonth);
            return {
              ...prev,
              fixedExpenses: newFixedExpenses,
              ccDebts: updatedCCDebts,
              dailyExpenses: updatedDaily
            };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            const projectedExpenses = derivedState.fixedExpenses || [];
            const newList = projectedExpenses.filter(ex => ex.id !== id);
            const updatedCCDebts = syncCCDebtsForList(newList, future.ccDebts || []);

            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: newList,
                        ccDebts: updatedCCDebts
                    }
                }
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                const newFixedExpenses = newHistory[histIndex].fixedExpenses.filter(ex => ex.id !== id);
                const updatedCCDebts = syncCCDebtsForList(newFixedExpenses, newHistory[histIndex].ccDebts || []);
                const updatedDaily = syncDailyExpensesForList(newFixedExpenses, newHistory[histIndex].dailyExpenses || [], viewDate, prev.currentMonth);
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    fixedExpenses: newFixedExpenses,
                    ccDebts: updatedCCDebts,
                    dailyExpenses: updatedDaily
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
        // Kaydin ayi GORUNTULENEN aydan degil, secilen TARIHTEN belirlenir.
        const targetMonth = (newExpense.date && String(newExpense.date).substring(0, 7)) || prev.currentMonth;

        if (targetMonth < prev.currentMonth) {
            // Gecmis ay: ilgili history ayina ekle.
            const histIndex = prev.history.findIndex(h => h.month === targetMonth);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    dailyExpenses: [...newHistory[histIndex].dailyExpenses, newExpense]
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            // O gecmis ay kaydi yoksa guvenli sekilde bu aya ekle.
            return { ...prev, dailyExpenses: [...prev.dailyExpenses, newExpense] };
        }
        // Bu ay veya (gunluk islem ileride tutulmadigi icin) ileri tarih -> bu ay.
        return { ...prev, dailyExpenses: [...prev.dailyExpenses, newExpense] };
    });
  };

  const deleteDailyExpense = (id: string) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            let updatedFixed = prev.fixedExpenses;
            if (id.startsWith('bill-cash-')) {
                const billId = id.replace('bill-cash-', '');
                updatedFixed = prev.fixedExpenses.map(ex =>
                    ex.id === billId ? { ...ex, isPaid: false } : ex
                );
            }
            return {
              ...prev,
              dailyExpenses: prev.dailyExpenses.filter(ex => ex.id !== id),
              fixedExpenses: updatedFixed
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                let updatedFixed = newHistory[histIndex].fixedExpenses;
                if (id.startsWith('bill-cash-')) {
                    const billId = id.replace('bill-cash-', '');
                    updatedFixed = newHistory[histIndex].fixedExpenses.map(ex =>
                        ex.id === billId ? { ...ex, isPaid: false } : ex
                    );
                }
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    dailyExpenses: newHistory[histIndex].dailyExpenses.filter(ex => ex.id !== id),
                    fixedExpenses: updatedFixed
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
        // Hedef ekstre ayi: kesim gunu ACIKSA tarihe gore hesaplanir (kesimden
        // sonraki harcamalar sonraki aya). Kapaliysa eski davranis: goruntulenen ay.
        const targetMonth = prev.statementCutoffDay
          ? (statementMonth(newDebt.date, prev.statementCutoffDay) || viewDate)
          : viewDate;

        if (targetMonth === prev.currentMonth) {
            return { ...prev, ccDebts: [...prev.ccDebts, newDebt] };
        } else if (targetMonth > prev.currentMonth) {
            // Add to future data
            const future = prev.futureData[targetMonth] || {};
            const currentDebts = future.ccDebts || [];
            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [targetMonth]: {
                        ...future,
                        ccDebts: [...currentDebts, newDebt]
                    }
                }
            };
        } else if (targetMonth < prev.currentMonth) {
            // Edit History
            const histIndex = prev.history.findIndex(h => h.month === targetMonth);
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

  // Kredi karti hesap kesim gununu ayarla. Ayarlaninca, bu ayin borclarindan
  // kesim gununden SONRA tarihli olanlari sonraki ayin ekstresine tasir
  // (kapanmis gecmis aylara ve mevcut gelecek planlarina dokunulmaz).
  const setStatementCutoffDay = (day: number | null) => {
    const cutoff = (day && day >= 1 && day <= 31) ? day : null;
    setRealState(prev => {
      let ccDebts = prev.ccDebts;
      let futureData = prev.futureData;

      if (cutoff) {
        const stay: CCDebt[] = [];
        const moves: Record<string, CCDebt[]> = {};
        for (const d of prev.ccDebts) {
          const t = d.date ? statementMonth(d.date, cutoff) : prev.currentMonth;
          if (t && t > prev.currentMonth) {
            if (!moves[t]) moves[t] = [];
            moves[t].push(d);
          } else {
            stay.push(d);
          }
        }
        if (Object.keys(moves).length > 0) {
          ccDebts = stay;
          futureData = { ...prev.futureData };
          for (const [m, debts] of Object.entries(moves)) {
            const fd = futureData[m] || {};
            futureData[m] = { ...fd, ccDebts: [...(fd.ccDebts || []), ...debts] };
          }
        }
      }

      return { ...prev, statementCutoffDay: cutoff, ccDebts, futureData };
    });
  };

  const deleteCCDebt = (id: string) => {
    setRealState(prev => {
        if (viewDate === prev.currentMonth) {
            let updatedFixed = prev.fixedExpenses;
            if (id.startsWith('bill-cc-')) {
                const billId = id.replace('bill-cc-', '');
                updatedFixed = prev.fixedExpenses.map(ex =>
                    ex.id === billId ? { ...ex, isPaid: false } : ex
                );
            }
            return {
              ...prev,
              ccDebts: prev.ccDebts.filter(d => d.id !== id),
              fixedExpenses: updatedFixed
            };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};
            const currentDebts = future.ccDebts || [];
            let updatedFixed = future.fixedExpenses || [];
            if (id.startsWith('bill-cc-')) {
                const billId = id.replace('bill-cc-', '');
                updatedFixed = updatedFixed.map(ex =>
                    ex.id === billId ? { ...ex, isPaid: false } : ex
                );
            }
            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        ccDebts: currentDebts.filter(d => d.id !== id),
                        fixedExpenses: updatedFixed
                    }
                }
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                let updatedFixed = newHistory[histIndex].fixedExpenses;
                if (id.startsWith('bill-cc-')) {
                    const billId = id.replace('bill-cc-', '');
                    updatedFixed = newHistory[histIndex].fixedExpenses.map(ex =>
                        ex.id === billId ? { ...ex, isPaid: false } : ex
                    );
                }
                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    ccDebts: newHistory[histIndex].ccDebts.filter(d => d.id !== id),
                    fixedExpenses: updatedFixed
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
      date: installmentDate(newInstallment.startDate, 1),
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
            const newFixedExpenses = prev.fixedExpenses.map(ex =>
              ex.id === id ? { ...ex, ...expense } : ex
            );
            const updatedCCDebts = syncCCDebtsForList(newFixedExpenses, prev.ccDebts);
            const updatedDaily = syncDailyExpensesForList(newFixedExpenses, prev.dailyExpenses, viewDate, prev.currentMonth);
            return {
              ...prev,
              fixedExpenses: newFixedExpenses,
              ccDebts: updatedCCDebts,
              dailyExpenses: updatedDaily
            };
        } else if (viewDate > prev.currentMonth) {
            const future = prev.futureData[viewDate] || {};

            const isCCDebt = id.startsWith('proj-cc-debt-') || expense.title === CC_DEBT_TITLE;

            if (isCCDebt && expense.amount !== undefined) {
                const previousAdjustment = future.ccDebtAdjustment || 0;
                const currentItem = derivedState.fixedExpenses.find(e => e.id === id || e.title === CC_DEBT_TITLE);
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

            const updatedCCDebts = syncCCDebtsForList(newList, future.ccDebts || []);
            return {
                ...prev,
                futureData: {
                    ...prev.futureData,
                    [viewDate]: {
                        ...future,
                        fixedExpenses: newList,
                        ccDebts: updatedCCDebts
                    }
                }
            };
        } else if (viewDate < prev.currentMonth) {
            const histIndex = prev.history.findIndex(h => h.month === viewDate);
            if (histIndex !== -1) {
                const newHistory = [...prev.history];
                const newFixedExpenses = newHistory[histIndex].fixedExpenses.map(ex =>
                    ex.id === id ? { ...ex, ...expense } : ex
                );
                const updatedCCDebts = syncCCDebtsForList(newFixedExpenses, newHistory[histIndex].ccDebts || []);
                const updatedDaily = syncDailyExpensesForList(newFixedExpenses, newHistory[histIndex].dailyExpenses || [], viewDate, prev.currentMonth);

                newHistory[histIndex] = {
                    ...newHistory[histIndex],
                    fixedExpenses: newFixedExpenses,
                    ccDebts: updatedCCDebts,
                    dailyExpenses: updatedDaily
                };
                return recalculateHistoryAndCurrent({ ...prev, history: newHistory });
            }
            return prev;
        }
        return prev;
    });
  };

  /**
   * O ay icin gunluk nakit harcligi belirler. Yalnizca GELECEK aylar icin
   * anlamlidir: icinde bulunulan ay veya gecmiste harclik "cozulmus" olur,
   * ayrilacak bir sey kalmaz. 0 verilirse harclik kaldirilir.
   */
  const updateDailyAllowance = (daily: number) => {
    setRealState(prev => {
        if (viewDate <= prev.currentMonth) return prev;
        const future = prev.futureData[viewDate] || {};
        return {
            ...prev,
            futureData: {
                ...prev.futureData,
                [viewDate]: { ...future, dailyAllowance: daily > 0 ? daily : undefined }
            }
        };
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
        const customIncomeTotal = (prev.customIncomes || []).reduce((sum, e) => sum + e.amount, 0);
        const totalCash = prev.income + prev.rollover + cashDailyIncome + customIncomeTotal;
        const remainingCash = totalCash - (paidFixed + cashSpent);

        const totalCCDebt = Math.abs(prev.ccDebts.reduce((sum, d) => sum + d.amount, 0));

        const historyEntry: MonthlyHistory = {
          month: prev.currentMonth || getCurrentMonth(),
          income: prev.income,
          rollover: prev.rollover,
          ykIncome: prev.ykIncome,
          ykRollover: prev.ykRollover,
          fixedExpenses: prev.fixedExpenses,
          customIncomes: prev.customIncomes,
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
               date: installmentDate(inst.startDate, nextInstallmentNumber),
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
        // nextDate yerel saatte oluşturuluyor; toISOString() UTC'ye çevirdiği için
        // UTC+3'te bir önceki ayı döndürüyordu. Yerel ay hesabı kullanılmalı.
        const nextMonthStr = toLocalMonthStr(nextDate);

        // New Fixed Expenses list
        // Remove old CC_DEBT_TITLE entries to prevent accumulation
        const nextFixedExpenses = prev.fixedExpenses
            .filter(ex => ex.title !== CC_DEBT_TITLE)
            .map(ex => ({ ...ex, isPaid: false }));

        if (totalCCDebt > 0) {
          nextFixedExpenses.push({
            id: generateId(),
            title: CC_DEBT_TITLE,
            amount: totalCCDebt,
            isPaid: false
          });
        }

        return {
          ...prev,
          version: 6,
          currentMonth: nextMonthStr,
          history: [...prev.history, historyEntry],
          installments: nextMonthInstallments,
          ccDebts: nextMonthDebts,
          dailyExpenses: [],
          fixedExpenses: nextFixedExpenses,
          customIncomes: [], // "önceki ay eklediğiniz bu özel sabit gelir kalemleri tamamen silinip 0'dan başlasın"
          rollover: remainingCash > 0 ? remainingCash : 0,
          ykRollover: remainingYk > 0 ? remainingYk : 0,
        };
    });
  };

  const loadState = (newState: BudgetState) => {
    const migrated = migrateState(newState);
    setRealState(recalculateHistoryAndCurrent(migrated));
  };

  const activeCurrencies = useMemo(() => {
    return getActiveCurrencies(realState, vaultRecords);
  }, [realState, vaultRecords]);

  // "Bugün"ü canlı tut: uygulama (PWA) gece yarısını geçerek açık kalabildiği için
  // sabit bir değer kullanılamaz. Dakikada bir ve sekmeye geri dönüldüğünde tazelenir.
  const [todayStr, setTodayStr] = useState(getTodayStr);
  useEffect(() => {
    const sync = () => setTodayStr(prev => {
      const now = getTodayStr();
      return prev === now ? prev : now; // aynıysa referansı koru, gereksiz render olmasın
    });
    const id = setInterval(sync, 60_000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  // Vakti gelmiş (bugün veya öncesi) ve hâlâ ödenmemiş fatura sayısı.
  // Gerçek içinde bulunulan aya (realState) göre hesaplanır; görüntülenen aydan bağımsızdır.
  const dueBillsCount = useMemo(() => {
    return (realState.fixedExpenses || []).filter(
      e => e.isBill && e.type !== 'PLANNED_VAULT' && !e.isPaid && !!e.date && e.date <= todayStr
    ).length;
  }, [realState.fixedExpenses, todayStr]);

  // Odenmemis Kira / Kredi Karti sayisi (Varliklarim rozeti).
  // Bu kalemlerde tarih yok; kural ayin 1'inden itibaren gecerli oldugu icin
  // icinde bulunulan ayda odenmemis olmalari yeterli.
  // Goruntulenen ay icin belirlenmis gunluk harclik (UI'nin okumasi icin).
  const dailyAllowance = realState.futureData[viewDate]?.dailyAllowance ?? 0;

  const dueFixedExpensesCount = useMemo(() => {
    return (realState.fixedExpenses || []).filter(isFixedExpenseOverdue).length;
  }, [realState.fixedExpenses]);

  // KK ödeme yöntemli faturalar: günü gelince (bugün >= tarih) OTOMATIK "ödendi"
  // işaretlenir; syncCCDebtsForList sayesinde Kredi Kartı sayfasında faturanın
  // tarihiyle borç olarak belirir. autoPaidPending, Faturalar sekmesindeki bildirim
  // kartı X ile kapatılana kadar sürer. Sadece içinde bulunulan ay (realState).
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const hasDue = (realState.fixedExpenses || []).some(
      e => e.isBill && e.paymentMethod === 'KK' && !e.isPaid && !!e.date && e.date <= todayStr
    );
    if (!hasDue) return;
    setRealState(prev => {
      const newFixed = (prev.fixedExpenses || []).map(e =>
        (e.isBill && e.paymentMethod === 'KK' && !e.isPaid && !!e.date && e.date <= todayStr)
          ? { ...e, isPaid: true, autoPaidPending: true }
          : e
      );
      const updatedCCDebts = syncCCDebtsForList(newFixed, prev.ccDebts);
      return { ...prev, fixedExpenses: newFixed, ccDebts: updatedCCDebts };
    });
  }, [realState.fixedExpenses, todayStr, isLoading, isAuthenticated]);

  // Otomatik ödenmiş, bildirimi henüz kapatılmamış KK faturaları.
  // isPaid şartı: ay devrinde isPaid sıfırlanınca eski bir autoPaidPending kalsa
  // bile bildirim gösterilmesin; yeni ayda günü gelince yeniden tetiklenir.
  const autoPaidBills = useMemo(
    () => (realState.fixedExpenses || []).filter(e => e.isBill && e.autoPaidPending && e.isPaid),
    [realState.fixedExpenses]
  );
  const autoPaidBillsCount = autoPaidBills.length;

  // Bildirim kartını X ile kapat: sadece bildirim işaretini kaldırır, ödemeyi bozmaz.
  const dismissAutoPaidBill = (id: string) => {
    setRealState(prev => ({
      ...prev,
      fixedExpenses: (prev.fixedExpenses || []).map(e =>
        e.id === id ? { ...e, autoPaidPending: false } : e
      )
    }));
  };

  // --- Kredi karti ekstre bildirimi ---
  // Ileri tarihli (gunu gelmemis) KK borclarini "bildirime uygun" isaretle (dueNoticeSeen=false).
  // Boylece gunu gelince (tarih <= bugun) bildirim gosterilir. Bugun/gecmis dogan veya
  // KK faturasindan gelen (bill-cc-) kalemler isaretlenmez => onlar icin bildirim cikmaz.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const needsMark = (realState.ccDebts || []).some(d =>
      d.dueNoticeSeen === undefined && !!d.date && d.date > todayStr && !String(d.id).startsWith('bill-cc-')
    );
    if (!needsMark) return;
    setRealState(prev => ({
      ...prev,
      ccDebts: (prev.ccDebts || []).map(d =>
        (d.dueNoticeSeen === undefined && !!d.date && d.date > todayStr && !String(d.id).startsWith('bill-cc-'))
          ? { ...d, dueNoticeSeen: false }
          : d
      )
    }));
  }, [realState.ccDebts, todayStr, isLoading, isAuthenticated]);

  // Gunu gelmis (tarih <= bugun) ve bildirimi henuz kapatilmamis (dueNoticeSeen===false) borclar.
  const ccDueNotices = useMemo(
    () => (realState.ccDebts || []).filter(d => d.dueNoticeSeen === false && !!d.date && d.date <= todayStr),
    [realState.ccDebts, todayStr]
  );
  const ccDueNoticeCount = ccDueNotices.length;

  // Ekstre bildirimini X ile kapat: sadece isareti kaldirir, borcu/toplami bozmaz.
  const dismissCCDueNotice = (id: string) => {
    setRealState(prev => ({
      ...prev,
      ccDebts: (prev.ccDebts || []).map(d =>
        d.id === id ? { ...d, dueNoticeSeen: true } : d
      )
    }));
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
            addCustomIncome,
            deleteCustomIncome,
            addDailyExpense,
            deleteDailyExpense,
            addCCDebt,
            deleteCCDebt,
            statementCutoffDay: realState.statementCutoffDay ?? null,
            setStatementCutoffDay,
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
            toggleShowMealCard,
            showVault,
            toggleShowVault,
            vaultRecords,
            vaultOrder,
            addVaultRecord,
            deleteVaultRecord,
            updateVaultRecord,
            updateVaultOrder,
            updateAssetIncome,
            updateAssetRollover,
            activeCurrencies,
            dueBillsCount,
            dueFixedExpensesCount,
            autoPaidBills,
            autoPaidBillsCount,
            dismissAutoPaidBill,
            ccDueNotices,
            ccDueNoticeCount,
            dismissCCDueNotice,
            dailyAllowance,
            updateDailyAllowance,
            todayStr,
            askConfirmation
        }}
    >
        {children}
        {confirmState && (
          <ConfirmationModal
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            message={confirmState.message}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
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
