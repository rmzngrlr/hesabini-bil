import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { AlertTriangle } from 'lucide-react';

export default function Settings() {
  const { state, updateIncome, updateRollover, updateLimits, resetMonth } = useBudget();
  
  const [income, setIncome] = useState(state.income.toString());
  const [rollover, setRollover] = useState(state.rollover.toString());
  const [nakitLimit, setNakitLimit] = useState(state.limits.nakit.toString());
  const [ykLimit, setYkLimit] = useState(state.limits.yk.toString());

  useEffect(() => {
    setIncome(state.income.toString());
    setRollover(state.rollover.toString());
    setNakitLimit(state.limits.nakit.toString());
    setYkLimit(state.limits.yk.toString());
  }, [state.income, state.rollover, state.limits]);

  const handleSave = () => {
    updateIncome(parseFloat(income) || 0);
    updateRollover(parseFloat(rollover) || 0);
    updateLimits({
      nakit: parseFloat(nakitLimit) || 0,
      yk: parseFloat(ykLimit) || 0
    });
  };

  const handleResetMonth = () => {
    if (confirm("Bu işlem sabit giderlerin 'Ödendi' durumunu sıfırlayacak. Emin misiniz?")) {
      resetMonth();
    }
  };

  return (
    <div className="space-y-6 pb-20">
       <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
      </header>

      <Card title="Gelir ve Devreden">
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Aylık Gelir</label>
            <input 
              type="number" 
              value={income} 
              onChange={(e) => setIncome(e.target.value)}
              onBlur={handleSave}
              className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
             <label className="text-xs text-muted-foreground">Geçen Aydan Devreden</label>
             <input 
               type="number" 
               value={rollover} 
               onChange={(e) => setRollover(e.target.value)}
               onBlur={handleSave}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
          </div>
        </div>
      </Card>

      <Card title="Limitler">
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nakit Limiti</label>
            <input 
              type="number" 
              value={nakitLimit} 
              onChange={(e) => setNakitLimit(e.target.value)}
              onBlur={handleSave}
              className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
             <label className="text-xs text-muted-foreground">YK Limiti</label>
             <input 
               type="number" 
               value={ykLimit} 
               onChange={(e) => setYkLimit(e.target.value)}
               onBlur={handleSave}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
          </div>
        </div>
      </Card>

      <Card title="Tehlikeli Bölge" className="border-red-900/20 bg-red-950/5">
        <div className="mt-2">
           <button 
             onClick={handleResetMonth}
             className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-900/20 text-red-500 hover:bg-red-900/30 transition-colors"
           >
             <AlertTriangle size={20} />
             Yeni Ay Başlat
           </button>
           <p className="text-xs text-muted-foreground mt-2 text-center">
             Sabit giderlerin "Ödendi" durumunu sıfırlar. Bakiyeyi değiştirmez.
           </p>
        </div>
      </Card>
    </div>
  );
}
