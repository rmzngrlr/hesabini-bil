const fs = require('fs');

let content = fs.readFileSync('src/pages/DailyExpenses.tsx', 'utf8');

// Insert new states
content = content.replace(
  "const [goldTransactionType, setGoldTransactionType] = useDraftState<'Birikim' | 'Bozdurma'>('daily_draft_gold_tx_type', 'Birikim');",
  `const [goldTransactionType, setGoldTransactionType] = useDraftState<'Birikim' | 'Bozdurma'>('daily_draft_gold_tx_type', 'Birikim');\n\n  const [showExchangeForm, setShowExchangeForm] = useState(false);\n  const [exchangeTabMode, setExchangeTabMode] = useState<'CURRENCY' | 'GOLD'>('CURRENCY');\n  const [exchangeFromType, setExchangeFromType] = useState('NAKIT');\n  const [exchangeToType, setExchangeToType] = useState('NAKIT');\n  const [exchangeFromAmount, setExchangeFromAmount] = useState('');\n  const [exchangeToAmount, setExchangeToAmount] = useState('');\n  const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().split('T')[0]);\n  const [exchangeNote, setExchangeNote] = useState('');\n  const [exchangeFromCustomCode, setExchangeFromCustomCode] = useState('');\n  const [exchangeToCustomCode, setExchangeToCustomCode] = useState('');`
);

// Add arrow icon import
content = content.replace(
  "import { Trash2, Banknote, CreditCard, Pencil, X, Calendar } from 'lucide-react';",
  "import { Trash2, Banknote, CreditCard, Pencil, X, Calendar, ArrowRightLeft } from 'lucide-react';"
);

fs.writeFileSync('src/pages/DailyExpenses.tsx', content);
