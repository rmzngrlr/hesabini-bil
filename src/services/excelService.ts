import * as XLSX from 'xlsx';
import type { BudgetState, MonthlyHistory, FixedExpense, DailyExpense, CCDebt, Installment } from '../types';

interface SheetData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export const exportToExcel = (state: BudgetState) => {
  const wb = XLSX.utils.book_new();

  // --- 1. Current Month Sheet ---
  const currentMonthData: SheetData[] = [];

  // General Info Section
  currentMonthData.push({ Section: 'GENEL BİLGİLER', Value: '' });
  currentMonthData.push({ Section: 'Ay', Value: state.currentMonth });
  currentMonthData.push({ Section: 'Gelir (Nakit)', Value: state.income });
  currentMonthData.push({ Section: 'Devreden (Nakit)', Value: state.rollover });
  currentMonthData.push({ Section: 'Yemek Kartı Geliri', Value: state.ykIncome || 0 });
  currentMonthData.push({ Section: 'Yemek Kartı Devreden', Value: state.ykRollover || 0 });
  currentMonthData.push({ Section: '', Value: '' }); // Spacer

  // Fixed Expenses
  currentMonthData.push({ Section: 'SABİT GİDERLER', Value: '' });
  if (state.fixedExpenses.length > 0) {
    state.fixedExpenses.forEach(exp => {
      currentMonthData.push({
        Type: 'FixedExpense',
        ID: exp.id,
        Title: exp.title,
        Amount: exp.amount,
        IsPaid: exp.isPaid ? 'Evet' : 'Hayır'
      });
    });
  } else {
      currentMonthData.push({ Note: 'Sabit gider bulunmuyor.' });
  }
  currentMonthData.push({ Section: '', Value: '' }); // Spacer

  // Daily Expenses
  currentMonthData.push({ Section: 'GÜNLÜK HARCAMALAR', Value: '' });
  if (state.dailyExpenses.length > 0) {
    state.dailyExpenses.forEach(exp => {
      currentMonthData.push({
        Type: 'DailyExpense',
        ID: exp.id,
        Date: exp.date,
        Description: exp.description,
        Amount: exp.amount,
        ExpenseType: exp.type // NAKIT or YK
      });
    });
  } else {
      currentMonthData.push({ Note: 'Günlük harcama bulunmuyor.' });
  }
  currentMonthData.push({ Section: '', Value: '' }); // Spacer

  // Credit Card Debts
  currentMonthData.push({ Section: 'KREDİ KARTI BORÇLARI', Value: '' });
  if (state.ccDebts.length > 0) {
    state.ccDebts.forEach(debt => {
      currentMonthData.push({
        Type: 'CCDebt',
        ID: debt.id,
        Description: debt.description,
        Amount: debt.amount,
        InstallmentId: debt.installmentId || '',
        CurrentInstallment: debt.currentInstallment || '',
        TotalInstallments: debt.totalInstallments || ''
      });
    });
  } else {
      currentMonthData.push({ Note: 'Kredi kartı borcu bulunmuyor.' });
  }
  currentMonthData.push({ Section: '', Value: '' }); // Spacer

  // Installments (Global list, but put in current month sheet for visibility)
  currentMonthData.push({ Section: 'TAKSİTLER (Aktif)', Value: '' });
  if (state.installments.length > 0) {
    state.installments.forEach(inst => {
      currentMonthData.push({
        Type: 'Installment',
        ID: inst.id,
        Description: inst.description,
        TotalAmount: inst.totalAmount,
        InstallmentCount: inst.installmentCount,
        RemainingInstallments: inst.remainingInstallments,
        MonthlyAmount: inst.monthlyAmount,
        StartDate: inst.startDate
      });
    });
  } else {
      currentMonthData.push({ Note: 'Aktif taksit bulunmuyor.' });
  }

  const wsCurrent = XLSX.utils.json_to_sheet(currentMonthData);
  XLSX.utils.book_append_sheet(wb, wsCurrent, `Mevcut - ${state.currentMonth}`);

  // --- 2. History Sheets ---
  state.history.forEach(hist => {
    const histData: SheetData[] = [];

    // General Info
    histData.push({ Section: 'GENEL BİLGİLER', Value: '' });
    histData.push({ Section: 'Ay', Value: hist.month });
    histData.push({ Section: 'Gelir (Nakit)', Value: hist.income });
    histData.push({ Section: 'Devreden (Nakit)', Value: hist.rollover });
    histData.push({ Section: 'Yemek Kartı Geliri', Value: hist.ykIncome || 0 });
    histData.push({ Section: 'Yemek Kartı Devreden', Value: hist.ykRollover || 0 });
    histData.push({ Section: '', Value: '' });

    // Fixed Expenses
    histData.push({ Section: 'SABİT GİDERLER', Value: '' });
    hist.fixedExpenses.forEach(exp => {
      histData.push({
        Type: 'FixedExpense',
        ID: exp.id,
        Title: exp.title,
        Amount: exp.amount,
        IsPaid: exp.isPaid ? 'Evet' : 'Hayır'
      });
    });
    histData.push({ Section: '', Value: '' });

    // Daily Expenses
    histData.push({ Section: 'GÜNLÜK HARCAMALAR', Value: '' });
    hist.dailyExpenses.forEach(exp => {
      histData.push({
        Type: 'DailyExpense',
        ID: exp.id,
        Date: exp.date,
        Description: exp.description,
        Amount: exp.amount,
        ExpenseType: exp.type
      });
    });
    histData.push({ Section: '', Value: '' });

    // CC Debts
    histData.push({ Section: 'KREDİ KARTI BORÇLARI', Value: '' });
    hist.ccDebts.forEach(debt => {
      histData.push({
        Type: 'CCDebt',
        ID: debt.id,
        Description: debt.description,
        Amount: debt.amount,
        InstallmentId: debt.installmentId || '',
        CurrentInstallment: debt.currentInstallment || '',
        TotalInstallments: debt.totalInstallments || ''
      });
    });

    const wsHist = XLSX.utils.json_to_sheet(histData);
    XLSX.utils.book_append_sheet(wb, wsHist, hist.month);
  });

  // Generate file name
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Butce_Yedek_${dateStr}.xlsx`);
};

export const importFromExcel = (file: File): Promise<BudgetState> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });

        const newState: BudgetState = {
            version: 5,
            currentMonth: new Date().toISOString().slice(0, 7),
            income: 0,
            rollover: 0,
            ykIncome: 0,
            ykRollover: 0,
            fixedExpenses: [],
            dailyExpenses: [],
            ccDebts: [],
            installments: [],
            history: [],
            futureData: {}
        };

        const sheetNames = wb.SheetNames;
        // Process Current Month Sheet
        // Usually the first sheet or one named "Mevcut - YYYY-MM"
        const currentSheetName = sheetNames.find(n => n.startsWith('Mevcut'));

        if (currentSheetName) {
             const ws = wb.Sheets[currentSheetName];
             const json = XLSX.utils.sheet_to_json(ws);
             parseSheetData(json, newState, true);
        } else if (sheetNames.length > 0) {
            // Fallback: If no sheet starts with "Mevcut", assume the first sheet is current
            const ws = wb.Sheets[sheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws);
            parseSheetData(json, newState, true);
        }

        // Process History Sheets
        sheetNames.forEach(name => {
            if (name === currentSheetName) return;

            // Assume YYYY-MM format for history
            if (/^\d{4}-\d{2}$/.test(name)) {
                const ws = wb.Sheets[name];
                const json = XLSX.utils.sheet_to_json(ws);

                const histEntry: MonthlyHistory = {
                    month: name,
                    income: 0,
                    rollover: 0,
                    ykIncome: 0,
                    ykRollover: 0,
                    fixedExpenses: [],
                    dailyExpenses: [],
                    ccDebts: []
                };

                // Temp state to reuse parser
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const temp: any = { ...histEntry, installments: [] };
                parseSheetData(json, temp, false);

                histEntry.income = temp.income;
                histEntry.rollover = temp.rollover;
                histEntry.ykIncome = temp.ykIncome;
                histEntry.ykRollover = temp.ykRollover;
                histEntry.fixedExpenses = temp.fixedExpenses;
                histEntry.dailyExpenses = temp.dailyExpenses;
                histEntry.ccDebts = temp.ccDebts;

                newState.history.push(histEntry);
            }
        });

        newState.history.sort((a, b) => b.month.localeCompare(a.month));
        resolve(newState);

      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSheetData(json: any[], targetState: BudgetState | any, isCurrent: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json.forEach((row: any) => {
        // Globals
        if (row.Section === 'Ay' && isCurrent) targetState.currentMonth = row.Value;
        if (row.Section === 'Gelir (Nakit)') targetState.income = Number(row.Value) || 0;
        if (row.Section === 'Devreden (Nakit)') targetState.rollover = Number(row.Value) || 0;
        if (row.Section === 'Yemek Kartı Geliri') targetState.ykIncome = Number(row.Value) || 0;
        if (row.Section === 'Yemek Kartı Devreden') targetState.ykRollover = Number(row.Value) || 0;

        // Arrays
        if (row.Type === 'FixedExpense') {
            const exp: FixedExpense = {
                id: row.ID || generateId(),
                title: row.Title,
                amount: Number(row.Amount) || 0,
                isPaid: row.IsPaid === 'Evet'
            };
            if (!targetState.fixedExpenses) targetState.fixedExpenses = [];
            targetState.fixedExpenses.push(exp);
        }

        if (row.Type === 'DailyExpense') {
            const exp: DailyExpense = {
                id: row.ID || generateId(),
                date: row.Date,
                description: row.Description,
                amount: Number(row.Amount) || 0,
                type: row.ExpenseType
            };
            if (!targetState.dailyExpenses) targetState.dailyExpenses = [];
            targetState.dailyExpenses.push(exp);
        }

        if (row.Type === 'CCDebt') {
             // For CC Debts, amounts are typically stored as positive in UI but negative in logic if expense?
             // But existing code seems to use negative for debts in daily expenses, but positive for CC Debt list items.
             // Wait, CC Debt in state: amount is usually negative?
             // Let's check BudgetContext.tsx:
             // "totalCCDebt = Math.abs(prev.ccDebts.reduce((sum, d) => sum + d.amount, 0));"
             // This implies d.amount might be negative or positive but we take abs.
             // "addCCDebt": "amount: -Math.abs(debt.amount)" usually?
             // Let's check how it's stored.
             // In migration (BudgetContext): "amount: d.amount > 0 ? -d.amount : d.amount"
             // So CC Debts should be NEGATIVE.
             // But Excel might store them as positive (visual).
             // If Excel has positive, we should flip it to negative.
             // If Excel has negative, keep it negative.
             // HOWEVER, the user said "Gelir eksi olarak geliyor". Daily Income.
             // Daily Income: type='NAKIT' amount > 0.
             // Let's look at DailyExpense block above.
             // amount: Number(row.Amount). If row.Amount is 100, it stays 100.
             // If DailyExpense is Income, amount should be positive.
             // If DailyExpense is Expense, amount should be negative.
             // Does export logic preserve sign?
             // Export: "Amount: exp.amount". Yes.
             // So if state has -50, Excel has -50.
             // If state has +100, Excel has +100.
             // Import: "Amount: Number(row.Amount)".
             // So if Excel has -50, Import has -50.
             // Why did user say "Gelir yedekten sonra eksi algılanıyor"?
             // Maybe user entered income as positive in UI, but some logic flipped it?
             // Or maybe migration logic in BudgetContext flips it?
             // BudgetContext: "const migratedDailyExpenses = ... amount > 0 ? -ex.amount : ex.amount".
             // THIS IS THE CULPRIT! The migration logic (Version 0->1) forces ALL daily expenses to be negative!
             // And loadState calls migrateState.
             // If import sets version=5, migrateState shouldn't run v0->1 logic.
             // But my importFromExcel sets "version: 5" explicitly.
             // Let's check `migrateState` in BudgetContext.tsx.
             // It checks `if (!parsed.version)`.
             // My import code sets `version: 5`. So that block is skipped.
             // What about other blocks?

             const debt: CCDebt = {
                id: row.ID || generateId(),
                description: row.Description,
                amount: Number(row.Amount) || 0,
                installmentId: row.InstallmentId,
                currentInstallment: row.CurrentInstallment ? Number(row.CurrentInstallment) : undefined,
                totalInstallments: row.TotalInstallments ? Number(row.TotalInstallments) : undefined
            };
            if (!targetState.ccDebts) targetState.ccDebts = [];
            targetState.ccDebts.push(debt);
        }

        if (isCurrent && row.Type === 'Installment') {
             const inst: Installment = {
                id: row.ID || generateId(),
                description: row.Description,
                totalAmount: Number(row.TotalAmount) || 0,
                installmentCount: Number(row.InstallmentCount) || 1,
                remainingInstallments: Number(row.RemainingInstallments) || 0,
                monthlyAmount: Number(row.MonthlyAmount) || 0,
                startDate: row.StartDate
            };
            if (!targetState.installments) targetState.installments = [];
            targetState.installments.push(inst);
        }
    });
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}
