import { useEffect, useRef } from 'react';
import { useBudget } from '../context/BudgetContext';
import { syncReminders } from '../services/push';

/**
 * Vade mantığıyla hesaplanan hatırlatıcıları (BudgetContext.pushReminders) sunucuya eşitler.
 * Sunucu, vadesi gelen hatırlatıcıları uygulama kapalı olsa bile push ile gönderir.
 * Kullanıcı bildirimlere izin vermemişse / abone değilse syncReminders zaten erken çıkar.
 * Görünür bir çıktısı yoktur (null döner).
 */
export function PushSync() {
  const { pushReminders } = useBudget();
  const lastJson = useRef<string>('');

  useEffect(() => {
    const json = JSON.stringify(pushReminders);
    if (json === lastJson.current) return;
    lastJson.current = json;
    // Küçük bir gecikme: ardışık state değişikliklerinde tek istek gitsin.
    const id = setTimeout(() => {
      void syncReminders(pushReminders);
    }, 1500);
    return () => clearTimeout(id);
  }, [pushReminders]);

  return null;
}
