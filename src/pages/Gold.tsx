import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useGoldPrices } from '../hooks/useGoldPrices';
import { Card } from '../components/ui/Card';
import { RefreshCw } from 'lucide-react';

export default function Gold() {
  const { state, updateGold } = useBudget();
  const { prices, loading, lastUpdated, fetchPrices, updatePrices } = useGoldPrices();
  
  // Local state for inputs to allow smooth typing
  const [portfolio, setPortfolio] = useState(state.gold);

  useEffect(() => {
    setPortfolio(state.gold);
  }, [state.gold]);

  const handlePortfolioChange = (field: keyof typeof portfolio, value: string) => {
    const numValue = parseFloat(value);
    setPortfolio(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
  };

  const savePortfolio = () => {
    updateGold(portfolio);
  };

  const handlePriceChange = (field: keyof typeof prices, value: string) => {
    const numValue = parseFloat(value);
    updatePrices({ ...prices, [field]: isNaN(numValue) ? 0 : numValue });
  };

  const totalValue = 
    (portfolio.g22 * prices.g22) + 
    (portfolio.g24 * prices.g24) + 
    (portfolio.resat * prices.resat);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Altın Portföyü</h1>
        <button 
          onClick={fetchPrices} 
          disabled={loading}
          className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <Card title="Toplam Değer" className="bg-yellow-950/20 border-yellow-900/20">
        <div className="text-3xl font-bold text-yellow-500 mt-2">
          {totalValue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Son Güncelleme: {lastUpdated || 'Yok'}
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Varlıklarım</h2>
        
        <Card title="22 Ayar Altın">
           <div className="flex gap-4 items-center mt-2">
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Gram</label>
               <input 
                 type="number" 
                 value={portfolio.g22 || ''} 
                 onChange={(e) => handlePortfolioChange('g22', e.target.value)}
                 onBlur={savePortfolio}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Birim Fiyat (TL)</label>
               <input 
                 type="number" 
                 value={prices.g22 || ''} 
                 onChange={(e) => handlePriceChange('g22', e.target.value)}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
           </div>
           <div className="text-right mt-2 text-sm font-medium">
             {(portfolio.g22 * prices.g22).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>

        <Card title="24 Ayar Altın (Gram)">
           <div className="flex gap-4 items-center mt-2">
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Gram</label>
               <input 
                 type="number" 
                 value={portfolio.g24 || ''} 
                 onChange={(e) => handlePortfolioChange('g24', e.target.value)}
                 onBlur={savePortfolio}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Birim Fiyat (TL)</label>
               <input 
                 type="number" 
                 value={prices.g24 || ''} 
                 onChange={(e) => handlePriceChange('g24', e.target.value)}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
           </div>
           <div className="text-right mt-2 text-sm font-medium">
             {(portfolio.g24 * prices.g24).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>

        <Card title="Reşat Altın">
           <div className="flex gap-4 items-center mt-2">
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Adet</label>
               <input 
                 type="number" 
                 value={portfolio.resat || ''} 
                 onChange={(e) => handlePortfolioChange('resat', e.target.value)}
                 onBlur={savePortfolio}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Birim Fiyat (TL)</label>
               <input 
                 type="number" 
                 value={prices.resat || ''} 
                 onChange={(e) => handlePriceChange('resat', e.target.value)}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
           </div>
           <div className="text-right mt-2 text-sm font-medium">
             {(portfolio.resat * prices.resat).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>
      </div>
    </div>
  );
}
