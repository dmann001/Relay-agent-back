// AES-256-GCM encryption for Gmail OAuth tokens and OAuth state payloads.
// Requires TOKEN_ENCRYPTION_KEY in the environment (any reasonably long
// secret string; it is hashed to a 32-byte key).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const getKey = (): Buffer => {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY (or SESSION_SECRET) must be set to encrypt Gmail tokens');
  }
  return createHash('sha256').update(secret).digest();
};

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

const isEncrypted = (value: string) => value.startsWith('v1:');

// Tolerates legacy plaintext tokens stored before encryption existed.
export function decryptSecretOrPassthrough(value: string): string {
  return isEncrypted(value) ? decryptSecret(value) : value;
}

// OAuth `state` helpers: binds the Google OAuth callback to the Relay user
// who initiated the connect flow (the callback request has no Supabase session).
export type OAuthStateContext = {
  purpose?: 'mail' | 'calendar';
  accountId?: string;
  provider?: 'gmail' | 'outlook';
};

export function createOAuthState(userId: string, context: OAuthStateContext = {}): string {
  return encodeURIComponent(
    encryptSecret(JSON.stringify({ userId, issuedAt: Date.now(), ...context }))
  );
}

export function parseOAuthState(state: string): { userId: string } & OAuthStateContext {
  const decoded = JSON.parse(decryptSecret(decodeURIComponent(state)));
  const MAX_AGE_MS = 15 * 60 * 1000;
  if (!decoded.userId || Date.now() - decoded.issuedAt > MAX_AGE_MS) {
    throw new Error('OAuth state expired or invalid');
  }
  return {
    userId: decoded.userId,
    ...(decoded.purpose ? { purpose: decoded.purpose } : {}),
    ...(decoded.accountId ? { accountId: decoded.accountId } : {}),
    ...(decoded.provider ? { provider: decoded.provider } : {}),
  };
}
