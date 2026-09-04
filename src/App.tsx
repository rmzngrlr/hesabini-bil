import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import FixedExpenses from './pages/FixedExpenses';
import DailyExpenses from './pages/DailyExpenses';
import Debt from './pages/Debt';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BudgetProvider } from './context/BudgetContext';
import { SearchProvider } from './context/SearchContext';
import { PrivacyProvider } from './context/PrivacyContext';
import { DeviceLockGate } from './components/DeviceLockGate';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Yükleniyor...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DeviceLockGate>
      <BudgetProvider>
        <SearchProvider>
          <PrivacyProvider>
            <Layout>{children}</Layout>
          </PrivacyProvider>
        </SearchProvider>
      </BudgetProvider>
    </DeviceLockGate>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/varliklarim" element={
        <ProtectedRoute>
          <FixedExpenses />
        </ProtectedRoute>
      } />
      <Route path="/islemler" element={
        <ProtectedRoute>
          <DailyExpenses />
        </ProtectedRoute>
      } />
      <Route path="/borc" element={
        <ProtectedRoute>
          <Debt />
        </ProtectedRoute>
      } />
      <Route path="/ayarlar" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
