/**
 * Authentication hook using Supabase Auth.
 *
 * Provides:
 * - Email + password sign in
 * - Phone OTP sign in
 * - Sign out
 * - Session state management
 * - Access token for FastAPI calls
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signInWithPhone = async (phone: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) throw error;
    return data;
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const getAccessToken = () => {
    return authState.session?.access_token ?? null;
  };

  const getUserRole = () => {
    return authState.user?.app_metadata?.role ?? 'citizen';
  };

  const getTenantId = () => {
    return authState.user?.app_metadata?.tenant_id ?? null;
  };

  return {
    ...authState,
    signInWithEmail,
    signInWithPhone,
    verifyOtp,
    signOut,
    getAccessToken,
    getUserRole,
    getTenantId,
  };
}
