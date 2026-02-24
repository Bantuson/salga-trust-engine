/**
 * Authentication context for citizen portal.
 *
 * Provides React Context API wrapper around Supabase Auth with:
 * - Email + password authentication
 * - Phone OTP authentication
 * - User registration with metadata
 * - Session state management
 * - Reactive auth state updates
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, token: string) => Promise<void>;
  signInWithEmailOtp: (email: string) => Promise<void>; // SEC-01: Passwordless email OTP login
  verifyEmailOtp: (email: string, token: string) => Promise<void>; // SEC-01: Verify email OTP and create session
  signUp: (email: string, password: string, metadata?: { full_name?: string; phone?: string; municipality?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session — handle stale refresh tokens gracefully
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Clear invalid session without throwing
        supabase.auth.signOut().catch(() => {});
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) throw error;
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: { full_name?: string; phone?: string; municipality?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
      },
    });

    if (error) throw error;
  };

  // SEC-01: Send 6-digit OTP to email for passwordless login (existing users only)
  const signInWithEmailOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // CRITICAL: login only, never create new accounts via OTP
      },
    });
    if (error) throw error;
  };

  // SEC-01: Verify 6-digit email OTP and create authenticated session
  const verifyEmailOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email', // CRITICAL: must be 'email' not 'sms' or 'signup'
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear sessionStorage
    sessionStorage.clear();

    // Reset state
    setUser(null);
    setSession(null);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signInWithEmail,
    signInWithPhone,
    verifyOtp,
    signInWithEmailOtp,
    verifyEmailOtp,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 * Must be used within AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
