export interface GoldRecord {
  id?: number;
  record_date: string;
  owner: string;
  gold_type: string;
  amount: number;
  note?: string;
  transaction_type?: string;
  secondary?: {
    amount: number;
    transaction_type: string;
    note?: string;
    record_date?: string;
  };
  // --- Coklu-kullanici altin emaneti (backend gold_records + GET annotate) ---
  owner_user_id?: number | null;      // altinin gercek sahibi (kabul edilince onun toplamina)
  owner_status?: 'pending' | 'accepted' | 'rejected' | null;
  creator_username?: string;          // kaydi ekleyen
  owner_username?: string | null;     // emanet edilen kullanici adi
  relation?: 'own' | 'sent' | 'incoming';  // isteyene gore: kendi / emanet ettigim / bana gelen
  counts_for_me?: boolean;            // bu kayit BENIM toplamima giriyor mu
}

export interface FixedExpense {
  id: string;
  title: string;
  amount: number;
  isPaid: boolean;
  type?: string; // e.g. 'NAKIT', 'YK', 'Dolar', 'Euro', 'PLANNED_VAULT'
  vault_gold_type?: string;
  vault_amount?: number;
  vault_owner?: string;
  vault_note?: string;
  isBill?: boolean;
  /**
   * Gelecek ay icin ayrilan nakit harclik kalemi.
   * Turetilmis bir satirdir: kaynagi FutureMonthData.dailyAllowance'dir.
   * O aya gecildiginde devirde haric tutulur ("cozulur"), tutari kalan nakde doner.
   */
  isAllowance?: boolean;
  paymentMethod?: 'NAKIT' | 'KK';
  date?: string;
  /**
   * KK ödeme yöntemli fatura günü gelince otomatik ödendiğinde true olur.
   * Faturalar sekmesindeki bildirim kartı X ile kapatılınca false'a döner.
   */
  autoPaidPending?: boolean;
  /**
   * KK odemeli fatura, kesim gunune gore bir SONRAKI ekstreye dustuyse o ekstrenin ayi
   * (YYYY-MM). Set ise: kart borcu cari aya degil o aya yazilir (futureData'da 'stmtbill-'
   * olarak) ve syncCCDebtsForList bu faturayi atlar (cari aya cift yazilmasin).
   */
  ccStatementRouted?: string;
  /** KK ödemeli fatura ise, doğan kart borcunun yazılacağı kredi kartı (undefined => varsayılan). */
  cardId?: string;
}

export interface CustomIncome {
  id: string;
  title: string;
  amount: number;
  type?: string; // e.g. 'NAKIT', 'YK', 'Dolar', 'Euro', 'PLANNED_VAULT'
  vault_gold_type?: string;
  vault_amount?: number;
  vault_owner?: string;
  vault_note?: string;
}

export type ExpenseType = 'NAKIT' | 'YK' | string;

export interface DailyExpense {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  type: ExpenseType;
  /** KK ödemesiyle birlikte oluşan TL çıkışını, ilgili KK borç kaydına bağlar. */
  paymentLinkId?: string;
}

/** Bir kredi kartı (çoklu kart). Bilanço tüm kartların TOPLAMINI tek sayı gösterir;
 *  kartlar yalnız Borç sayfasında gruplama + karta özel kesim günü içindir. */
export interface CreditCard {
  id: string;
  name: string;
  color?: string;          // rozet/başlık rengi (hex)
  cutoffDay?: number | null; // karta özel hesap kesim günü (1-31); null => global statementCutoffDay'e düşer
}

export interface CCDebt {
  id: string;
  description: string;
  amount: number;
  date?: string; // ISO string for the date the debt was incurred or paid
  cardId?: string; // hangi kredi kartına ait (undefined => varsayılan kart)
  installmentId?: string; // Link to parent installment if applicable
  currentInstallment?: number; // e.g. 1 (of 6)
  totalInstallments?: number; // e.g. 6
  /**
   * Kredi karti ekstre bildirimi durumu:
   *  - undefined => bildirime uygun degil (bugün/gecmis dogmus veya bill-cc kalemi).
   *  - false     => ileri tarihli dogdu, gunu gelince bildirim gosterilecek.
   *  - true      => bildirim kullanici tarafindan (X) kapatildi.
   */
  dueNoticeSeen?: boolean;
  /** KK ödemesi (PAY) ise, birlikte oluşan TL çıkışıyla ortak bağ. Silme/düzenlemede eşlenir. */
  paymentLinkId?: string;
}

export interface Installment {
  id: string;
  description: string;
  cardId?: string; // taksitin ait olduğu kredi kartı (undefined => varsayılan kart)
  totalAmount: number;
  installmentCount: number;
  remainingInstallments: number;
  monthlyAmount: number;
  startDate: string; // ISO string
}

export interface MonthlyHistory {
  month: string; // YYYY-MM
  income: number;
  rollover: number;
  ykIncome: number;
  ykRollover: number;
  fixedExpenses: FixedExpense[];
  customIncomes?: CustomIncome[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
  assetBudgets?: Record<string, { income: number; rollover: number }>;
}

export interface FutureMonthData {
  /** O ay icin gunluk nakit harclik (TL). Toplam = bu deger x ayin gun sayisi. */
  dailyAllowance?: number;
  income?: number;
  ykIncome?: number;
  fixedExpenses?: FixedExpense[];
  customIncomes?: CustomIncome[];
  // For CC Debt override (adjustment amount)
  ccDebtAdjustment?: number;
  // For specific installment overrides (id -> amount)
  installmentOverrides?: Record<string, number>;
  // For manually added CC Debts in future
  ccDebts?: CCDebt[];
  assetBudgets?: Record<string, { income: number; rollover: number }>;
}

export interface BudgetState {
  version?: number;
  currentMonth: string; // YYYY-MM
  /**
   * Kredi kartı hesap kesim günü (1-31). Bu günden SONRA yapılan harcamalar
   * bir sonraki ayın ekstresine sayılır. null/undefined => kapalı (takvim ayı).
   */
  statementCutoffDay?: number | null;
  /** Kullanıcının kredi kartları. Bilanço TOPLAMI tek sayı; kartlar Borç sayfasında ayrışır. */
  creditCards?: CreditCard[];
  /** Hesap-bazli UI tercihleri (tarayici degil, hesaba senkronlanir). */
  showMealCard?: boolean;
  showVault?: boolean;
  /** Hesap-bazli uygulama kilidi ayarlari (tum cihazlarda senkron). */
  lockPin?: { salt: string; hash: string; len: number } | null; // paylasilan PIN (salt+hash)
  lockOnMobile?: boolean;   // mobil cihazlarda kilit acik mi
  lockOnDesktop?: boolean;  // masaustunde kilit acik mi
  lockRelockMinutes?: number; // kullanilmazsa kilit gecikmesi (dk); 0=hemen
  income: number;
  rollover: number;
  ykIncome: number;
  ykRollover: number;
  fixedExpenses: FixedExpense[];
  customIncomes: CustomIncome[];
  dailyExpenses: DailyExpense[];
  ccDebts: CCDebt[];
  installments: Installment[];
  history: MonthlyHistory[];
  futureData: Record<string, FutureMonthData>;
  assetBudgets?: Record<string, { income: number; rollover: number }>;
}
