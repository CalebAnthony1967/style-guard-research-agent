import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { queryClientInstance } from '@/lib/query-client';
import PageNotFound from '@/lib/PageNotFound';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from '@/components/ScrollToTop';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Home from '@/pages/Home';
import Guidelines from '@/pages/Guidelines';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Mfa from '@/pages/Mfa';
import Researcher from '@/pages/portal/Researcher';
import Hod from '@/pages/portal/Hod';
import Director from '@/pages/portal/Director';
import Seminar from '@/pages/portal/Seminar';
import Executive from '@/pages/portal/Executive';
import Km from '@/pages/portal/Km';
import Editor from '@/pages/portal/Editor';
import Admin from '@/pages/portal/Admin';
import Vault from '@/pages/portal/Vault';

function AuthenticatedApp() {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/mfa" element={<Mfa />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<Home />} />
        <Route element={<AppShell />}>
          <Route path="/guidelines" element={<Guidelines />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/portal/researcher" element={<Researcher />} />
          <Route path="/portal/hod" element={<Hod />} />
          <Route path="/portal/director" element={<Director />} />
          <Route path="/portal/seminar" element={<Seminar />} />
          <Route path="/portal/executive" element={<Executive />} />
          <Route path="/portal/km" element={<Km />} />
          <Route path="/portal/editor" element={<Editor />} />
          <Route path="/portal/admin" element={<Admin />} />
          <Route path="/portal/vault" element={<Vault />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}