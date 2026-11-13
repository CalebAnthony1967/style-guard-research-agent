import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch } from '@/lib/db';

const AuthContext = createContext();

function buildUserObject(authUser, profile) {
  if (!authUser) return null;
  const meta = authUser.user_metadata || {};
  const kippraRole = profile?.role || meta.role || 'RESEARCHER';
  return {
    id: authUser.id,
    email: authUser.email || profile?.email || '',
    full_name: profile?.full_name || meta.full_name || (authUser.email || '').split('@')[0],
    role: kippraRole,
    kippra_role: kippraRole,
    directorate: profile?.directorate || meta.directorate || '',
    department: profile?.department || meta.department || '',
    is_active: profile?.is_active ?? true,
    data: {
      kippra_role: kippraRole,
      directorate: profile?.directorate || meta.directorate || '',
      department: profile?.department || meta.department || '',
    },
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const hydrateSession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setAuthError(null);
      return;
    }

    try {
      const { user: profile } = await apiFetch('/api/auth/profile', { method: 'POST', body: {} }).catch(async () => {
        const { data } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
        return { user: data };
      });
      setUser(buildUserObject(session.user, profile));
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (err) {
      setUser(buildUserObject(session.user, null));
      setIsAuthenticated(true);
      setAuthError(null);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    if (!supabase) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      return;
    }
    setIsLoadingAuth(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      await hydrateSession(data?.session || null);
    } catch (error) {
      console.error('Supabase session check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [hydrateSession]);

  useEffect(() => {
    checkUserAuth();
    if (!supabase) return undefined;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateSession(session);
    });
    return () => subscription.unsubscribe();
  }, [checkUserAuth, hydrateSession]);

  const logout = async (shouldRedirect = true) => {
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    if (window.location.pathname !== '/login') {
      const returnTo = window.location.pathname + window.location.search;
      window.location.href =
        returnTo && returnTo !== '/' && returnTo !== '/login'
          ? `/login?returnTo=${encodeURIComponent(returnTo)}`
          : '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: { name: 'KIPPRA StyleGuard' },
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};