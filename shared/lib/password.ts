/**
 * SALGA Trust Engine — Password Validation Utilities
 * Shared password validation and HIBP leaked password checking for both dashboards.
 */

/**
 * Validate password complexity against backend policy.
 * SEC-01: Client-side validation mirrors src/schemas/user.py validate_password_complexity
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 12) errors.push('At least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/\d/.test(password)) errors.push('At least one digit');
  return { valid: errors.length === 0, errors };
}

/**
 * Check if a password appears in known data breaches using the
 * HaveIBeenPwned Pwned Passwords API with k-anonymity.
 *
 * Only the first 5 characters of the SHA-1 hash prefix are sent to the API.
 * The full password never leaves the client.
 *
 * @returns Number of times the password was found in breaches (0 = safe).
 *          Returns -1 if the API is unreachable (fail-open).
 */
export async function checkPasswordLeaked(password: string): Promise<number> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      { headers: { 'Add-Padding': 'true' } }
    );

    if (!response.ok) return -1;

    const text = await response.text();
    for (const line of text.split('\n')) {
      const [lineSuffix, count] = line.trim().split(':');
      if (lineSuffix === suffix) {
        return parseInt(count, 10);
      }
    }

    return 0;
  } catch {
    return -1;
  }
}
