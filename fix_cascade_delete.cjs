const fs = require('fs');

let content = fs.readFileSync('src/pages/DailyExpenses.tsx', 'utf8');

const target = `            if (vaultMatch && vaultMatch.id) {
              await deleteVaultRecord(vaultMatch.id);
            }
          }
        }
      }
      deleteDailyExpense(expense.id);
    }
  };`;

const code = `            if (vaultMatch && vaultMatch.id) {
              await deleteVaultRecord(vaultMatch.id);
            }
          }
        }

        // Check if this is an exchange record
        const matchExchange = descStr.match(/^Dönüşüm (Çıkışı|Girişi):\\s+([\\d.]+)\\s+(.*?)\\s+->\\s+([\\d.]+)\\s+(.*?)(?:\\s+-|$)/);
        if (matchExchange) {
          const isOutflow = matchExchange[1] === 'Çıkışı';
          const oppTypeStr = isOutflow ? 'Girişi' : 'Çıkışı';
          const partnerDescPrefix = \`Dönüşüm \${oppTypeStr}: \${matchExchange[2]} \${matchExchange[3]} -> \${matchExchange[4]} \${matchExchange[5]}\`;

          const targetCurrency = isOutflow ? matchExchange[5].trim() : matchExchange[3].trim();
          const targetAmount = parseFloat(isOutflow ? matchExchange[4] : matchExchange[2]);

          if (isGoldType(targetCurrency)) {
             const vaultMatch = vaultRecords.find(r =>
                r.gold_type === targetCurrency &&
                Number(r.amount) === targetAmount &&
                r.record_date === expense.date &&
                (r.note || '').startsWith(partnerDescPrefix)
             );
             if (vaultMatch && vaultMatch.id) {
               await deleteVaultRecord(vaultMatch.id);
             }
          } else {
             const partnerExpense = activeExpenses.find(e => e.date === expense.date && (e.description || '').startsWith(partnerDescPrefix));
             if (partnerExpense) {
               await deleteDailyExpense(partnerExpense.id);
             }
          }
        }
      }
      deleteDailyExpense(expense.id);
    }
  };`;

content = content.replace(target, code);
fs.writeFileSync('src/pages/DailyExpenses.tsx', content);
