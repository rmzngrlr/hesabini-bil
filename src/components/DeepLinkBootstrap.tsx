import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBudget } from '../context/BudgetContext';

/**
 * Bildirim (veya dis link) deep-link'i: uygulama DISINDAN gelindiginde React Router
 * `state` tasinamaz, bu yuzden hedef URL parametre tasir:
 *   ?dlk=<search key>  [&dls=<alt sekme>]  [&dlc=<kart id>]  [&dlm=<YYYY-MM>]
 * Bu bilesen, ilk yuklemede bu parametreleri okuyup global aramanin kullandigi
 * `state.deepLink` yapisina cevirir ve replace ile tekrar navige eder -> hedef sayfanin
 * mevcut deep-link effect'i (sekme/kart gecisi + kaydirma) devreye girer, URL temizlenir.
 */
export function DeepLinkBootstrap() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setViewDate } = useBudget();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const params = new URLSearchParams(location.search);
    const key = params.get('dlk');
    if (!key) return;
    done.current = true;

    const month = params.get('dlm');
    const subTab = params.get('dls');
    const cardId = params.get('dlc');

    // Dogru ayin verisi render olsun (kalem o ayda); kalemler cari aydan gelir ama viewDate bayatsa diye.
    if (month) setViewDate(month);

    navigate(location.pathname, {
      replace: true,
      state: { deepLink: { key, subTab: subTab || null, cardId: cardId || null } },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
