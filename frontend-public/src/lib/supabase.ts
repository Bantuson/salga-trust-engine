import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for public dashboard.
 *
 * CRITICAL:
 * - Uses anon key (not service_role) for read-only access
 * - persistSession: false - NO authentication needed
 * - autoRefreshToken: false - NO session management
 *
 * RLS policies enforce:
 * - Only public_* views accessible to anon role
 * - GBV tickets excluded at database level
 * - K-anonymity >= 3 for heatmap
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,  // No auth needed for public dashboard
      autoRefreshToken: false,
    }
  }
);
