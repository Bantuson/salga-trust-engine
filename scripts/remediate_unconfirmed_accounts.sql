-- Remediate stuck accounts created via frontend signUp() that never confirmed email.
-- Targets real user accounts with full_name in metadata (test profiles use email_confirm: true instead).
-- Run via: mcp__supabase__execute_sql or psql against the Supabase project.

UPDATE auth.users
SET email_confirmed_at = NOW(), updated_at = NOW()
WHERE email_confirmed_at IS NULL
  AND raw_user_meta_data->>'full_name' IS NOT NULL;

-- Verification: confirm 0 unconfirmed real accounts remain
SELECT count(*) AS remaining_unconfirmed
FROM auth.users
WHERE email_confirmed_at IS NULL
  AND raw_user_meta_data->>'full_name' IS NOT NULL;
