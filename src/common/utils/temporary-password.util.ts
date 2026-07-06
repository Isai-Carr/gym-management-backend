import { randomInt } from 'crypto';

// 7-digit numeric temporary password, generated with a CSPRNG (not Math.random())
// since this is emailed directly to new admins/clients as their initial credential.
export function generateTemporaryPassword(): string {
  return String(randomInt(1_000_000, 10_000_000));
}
