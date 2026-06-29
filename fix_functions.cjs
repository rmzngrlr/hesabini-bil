const fs = require('fs');

let content = fs.readFileSync('src/pages/DailyExpenses.tsx', 'utf8');

// Insert handleExchangeSubmit
const target1 = "  const handleDeleteClick = async (expense: DailyExpense) => {";
const handler = `
  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fAmount = parseFloat(exchangeFromAmount);
    const tAmount = parseFloat(exchangeToAmount);

    if (isNaN(fAmount) || fAmount <= 0 || isNaN(tAmount) || tAmount <= 0) {
      return; // Invalid amounts
    }

    let finalFromType = exchangeFromType;
    if (finalFromType === 'NEW_CURRENCY') {
      if (!exchangeFromCustomCode) return;
      finalFromType = detectCurrencyCode(exchangeFromCustomCode);
    }

    let finalToType = exchangeToType;
    if (finalToType === 'NEW_CURRENCY') {
      if (!exchangeToCustomCode) return;
      finalToType = detectCurrencyCode(exchangeToCustomCode);
    }

    if (finalFromType === finalToType) return; // Same type, ignore

    const note = exchangeNote.trim() ? \` - \${exchangeNote}\` : '';
    const fDesc = \`Dönüşüm Çıkışı: \${fAmount} \${finalFromType} -> \${tAmount} \${finalToType}\${note}\`;
    const tDesc = \`Dönüşüm Girişi: \${fAmount} \${finalFromType} -> \${tAmount} \${finalToType}\${note}\`;

    addDailyExpense({
      date: exchangeDate,
      description: fDesc,
      amount: -fAmount,
      type: finalFromType
    });

    if (isGoldType(finalFromType)) {
      await addVaultRecord({ record_date: exchangeDate, owner: 'Ortak', amount: fAmount, note: fDesc, transaction_type: 'Bozdurma', gold_type: finalFromType });
    }

    addDailyExpense({
      date: exchangeDate,
      description: tDesc,
      amount: tAmount,
      type: finalToType
    });

    if (isGoldType(finalToType)) {
      await addVaultRecord({ record_date: exchangeDate, owner: 'Ortak', amount: tAmount, note: tDesc, transaction_type: 'Birikim', gold_type: finalToType });
    }

    setShowExchangeForm(false);
    setExchangeFromAmount('');
    setExchangeToAmount('');
    setExchangeNote('');
    setExchangeFromCustomCode('');
    setExchangeToCustomCode('');
    setActiveTab(finalToType);
  };

  const handleDeleteClick = async (expense: DailyExpense) => {`;
content = content.replace(target1, handler);

// Add assetOptions
const target2 = `  return (
    <div className="space-y-6 pb-20 p-4">`;

const options = `  const assetOptions = (
    <>
      <option value="NAKIT">Türk Lirası</option>
      {showMealCard && <option value="YK">Yemek Kartı</option>}
      {activeCurrencies.map(curr => (<option key={curr} value={curr}>{getAssetFullTitle(curr)}</option>))}
      <option value="NEW_CURRENCY">+ Diğer Para Birimi Ekle...</option>
    </>
  );

  return (
    <div className="space-y-6 pb-20 p-4">`;
content = content.replace(target2, options);

fs.writeFileSync('src/pages/DailyExpenses.tsx', content);
