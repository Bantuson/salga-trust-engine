/**
 * Supabase client configuration for public portal.
 *
 * Provides dual-purpose client:
 * 1. Anonymous public queries via anon key (RLS views)
 * 2. Citizen authentication with session persistence
 *
 * RLS policies enforce:
 * - Public views accessible to anon role (public_*)
 * - GBV tickets excluded at database level
 * - K-anonymity >= 3 for heatmap
 * - Citizen-owned tickets accessible to authenticated users
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // Citizens stay logged in across page refreshes
    autoRefreshToken: true,     // Automatic session refresh
    detectSessionInUrl: true,   // OAuth/magic link flows
  },
});
