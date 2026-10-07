// /context/AuthContext.js
import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabase-client';
import { observeAuthSession } from '../lib/authSessionState.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({ user: null, session: null, loading: true, error: null });
  const observerRef = useRef(null);
  const retryAuth = useCallback(() => observerRef.current?.retry(), []);

  useEffect(() => {
    const observer = observeAuthSession(supabase.auth, setAuthState);
    observerRef.current = observer;
    return () => {
      observer.dispose();
      observerRef.current = null;
    };
  }, []);
  const value = useMemo(() => ({ ...authState, retryAuth }), [authState, retryAuth]);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
