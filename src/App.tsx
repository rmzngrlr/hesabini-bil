import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import FixedExpenses from './pages/FixedExpenses';
import DailyExpenses from './pages/DailyExpenses';
import Debt from './pages/Debt';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fixed" element={<FixedExpenses />} />
          <Route path="/daily" element={<DailyExpenses />} />
          <Route path="/debt" element={<Debt />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
