import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { GoldPrices } from '../types';

export function useGoldPrices() {
  const { state, updateGoldPrices } = useBudget();
  const [loading, setLoading] = useState(false);

  const prices = state.goldPrices || { g22: 0, g24: 0, resat: 0, lastUpdated: '' };
  const lastUpdated = prices.lastUpdated || null;

  const fetchPrices = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockPrices: GoldPrices = {
        g22: 2450 + Math.floor(Math.random() * 50),
        g24: 2700 + Math.floor(Math.random() * 50),
        resat: 18000 + Math.floor(Math.random() * 200),
        lastUpdated: new Date().toLocaleString('tr-TR')
      };
      
      updateGoldPrices(mockPrices);
    } catch (error) {
      console.error("Failed to fetch gold prices", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePrices = (newPrices: GoldPrices) => {
     updateGoldPrices({
       ...newPrices,
       lastUpdated: new Date().toLocaleString('tr-TR')
     });
  };

  // Auto-fetch if prices are empty
  useEffect(() => {
    if (prices.g22 === 0 && prices.g24 === 0) {
      fetchPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { prices, loading, lastUpdated, fetchPrices, updatePrices };
}
