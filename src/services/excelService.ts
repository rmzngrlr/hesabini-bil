import * as XLSX from 'xlsx';
import type { BudgetState, MonthlyHistory } from '../types';

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

        // Initial empty state
        const newState: BudgetState = {
            currentMonth: new Date().toISOString().slice(0, 7),
            income: 0,
            rollover: 0,
            ykIncome: 0,
            ykRollover: 0,
            fixedExpenses: [],
            dailyExpenses: [],
            ccDebts: [],
            installments: [],
            history: []
        };

        // Process sheets
        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(ws);

          if (sheetName.startsWith('Mevcut')) {
             parseSheetData(json, newState, true);
          } else {
             // It's a history sheet (YYYY-MM)
             // Check if it matches YYYY-MM format roughly
             if (/^\d{4}-\d{2}$/.test(sheetName)) {
                const histEntry: MonthlyHistory = {
                    month: sheetName,
                    income: 0,
                    rollover: 0,
                    ykIncome: 0,
                    ykRollover: 0,
                    fixedExpenses: [],
                    dailyExpenses: [],
                    ccDebts: []
                };
                // We create a temp object that looks like BudgetState to reuse parse logic,
                // but really we just want the specific fields
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tempState: any = { ...histEntry, installments: [] };
                parseSheetData(json, tempState, false);

                // Copy back to history entry
                histEntry.income = tempState.income;
                histEntry.rollover = tempState.rollover;
                histEntry.ykIncome = tempState.ykIncome;
                histEntry.ykRollover = tempState.ykRollover;
                histEntry.fixedExpenses = tempState.fixedExpenses;
                histEntry.dailyExpenses = tempState.dailyExpenses;
                histEntry.ccDebts = tempState.ccDebts;

                newState.history.push(histEntry);
             }
          }
        });

        // Ensure history is sorted?
        // Or just trust the excel order. Let's sort by month descending to be safe.
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
    // We iterate through rows. Since it's a flat list with "Section" headers or "Type" rows.

    // First pass: Global info
    // The format from export is: { Section: '...', Value: '...' } for globals
    // And for lists: { Type: '...', ID: '...', ... }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json.forEach((row: any) => {
        // Parse Generals
        if (row.Section === 'Ay' && isCurrent) targetState.currentMonth = row.Value;
        if (row.Section === 'Gelir (Nakit)') targetState.income = Number(row.Value) || 0;
        if (row.Section === 'Devreden (Nakit)') targetState.rollover = Number(row.Value) || 0;
        if (row.Section === 'Yemek Kartı Geliri') targetState.ykIncome = Number(row.Value) || 0;
        if (row.Section === 'Yemek Kartı Devreden') targetState.ykRollover = Number(row.Value) || 0;

        // Parse Arrays based on 'Type' column
        if (row.Type === 'FixedExpense') {
            targetState.fixedExpenses.push({
                id: row.ID || crypto.randomUUID(),
                title: row.Title,
                amount: Number(row.Amount) || 0,
                isPaid: row.IsPaid === 'Evet'
            });
        }

        if (row.Type === 'DailyExpense') {
            targetState.dailyExpenses.push({
                id: row.ID || crypto.randomUUID(),
                date: row.Date,
                description: row.Description,
                amount: Number(row.Amount) || 0,
                type: row.ExpenseType
            });
        }

        if (row.Type === 'CCDebt') {
            targetState.ccDebts.push({
                id: row.ID || crypto.randomUUID(),
                description: row.Description,
                amount: Number(row.Amount) || 0,
                installmentId: row.InstallmentId,
                currentInstallment: row.CurrentInstallment ? Number(row.CurrentInstallment) : undefined,
                totalInstallments: row.TotalInstallments ? Number(row.TotalInstallments) : undefined
            });
        }

        // Only parse installments if it's the current state (they are global)
        if (isCurrent && row.Type === 'Installment') {
            targetState.installments.push({
                id: row.ID || crypto.randomUUID(),
                description: row.Description,
                totalAmount: Number(row.TotalAmount) || 0,
                installmentCount: Number(row.InstallmentCount) || 1,
                remainingInstallments: Number(row.RemainingInstallments) || 0,
                monthlyAmount: Number(row.MonthlyAmount) || 0,
                startDate: row.StartDate
            });
        }
    });
}
