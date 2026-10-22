/**
 * Encryption and merging for the finance document. Pure (WebCrypto only).
 *
 * The key comes from your passphrase with PBKDF2-SHA-256 and encrypts with
 * AES-GCM. The passphrase and the key never leave the device; the cloud
 * only receives what `seal` returns.
 */
import type { FinanceDoc, Stamped } from './model';

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 10;

export interface KdfParams {
  name: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  /** base64 */
  salt: string;
}

export interface Sealed {
  /** base64 AES-GCM ciphertext (includes the auth tag). */
  ciphertext: string;
  /** base64, 12 bytes, fresh for every save. */
  iv: string;
  kdf: KdfParams;
  formatVersion: 1;
}

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function newKdfParams(iterations = KDF_ITERATIONS): KdfParams {
  return { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: b64(crypto.getRandomValues(new Uint8Array(16))) };
}

/** Non-extractable AES-GCM key from the passphrase (slow on purpose). */
export async function deriveKey(passphrase: string, kdf: KdfParams): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: kdf.hash, iterations: kdf.iterations, salt: unb64(kdf.salt) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(doc: unknown, key: CryptoKey, kdf: KdfParams): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(doc));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return { ciphertext: b64(ct), iv: b64(iv), kdf, formatVersion: 1 };
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('That passphrase doesn’t open your finance data.');
  }
}

/** Decrypts; a wrong passphrase (or tampered data) fails the AES-GCM check. */
export async function open(sealed: Pick<Sealed, 'ciphertext' | 'iv'>, key: CryptoKey): Promise<unknown> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.ciphertext));
  } catch {
    throw new WrongPassphraseError();
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

export function passphraseProblem(p: string, confirm?: string): string | null {
  if (p.length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters. A few unrelated words work well.`;
  if (/^(.)\1+$/.test(p) || /^(0123456789|1234567890|password\d*)$/i.test(p)) return 'That’s too easy to guess.';
  if (confirm !== undefined && confirm !== p) return 'The two entries don’t match.';
  return null;
}

// ---------- merging ----------

/** Union by id; when both sides have a record, the newer `updatedAt` wins (ties: remote). */
export function mergeRecords<T extends Stamped>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of remote) byId.set(r.id, r);
  for (const l of local) {
    const r = byId.get(l.id);
    if (!r || l.updatedAt > r.updatedAt) byId.set(l.id, l);
  }
  return [...byId.values()];
}

/**
 * Two edited copies of the document → one, losing nothing: records merge
 * by id, settings take the newer block. Deterministic, so every device
 * arrives at the same result.
 */
export function mergeDocs(local: FinanceDoc, remote: FinanceDoc): FinanceDoc {
  return {
    schema: remote.schema,
    version: Math.max(local.version, remote.version),
    settings: local.settings.updatedAt > remote.settings.updatedAt ? local.settings : remote.settings,
    transactions: mergeRecords(local.transactions, remote.transactions).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    balances: mergeRecords(local.balances, remote.balances).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    vouchers: mergeRecords(local.vouchers ?? [], remote.vouchers ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    events: mergeRecords(local.events ?? [], remote.events ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    incomes: mergeRecords(local.incomes ?? [], remote.incomes ?? []).sort((a, b) => a.month.localeCompare(b.month) || a.id.localeCompare(b.id)),
    lists: mergeRecords(local.lists ?? [], remote.lists ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
  };
}

/**
 * The same key as `deriveKey`, as raw bytes, so it can be wrapped for
 * fingerprint unlock. (PBKDF2 → 256 bits is exactly what deriveKey uses.)
 */
export async function deriveRawKey(passphrase: string, kdf: KdfParams): Promise<Uint8Array<ArrayBuffer>> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: kdf.hash, iterations: kdf.iterations, salt: unb64(kdf.salt) }, base, 256));
}

/** Raw bytes → the usable, non-extractable vault key. */
export const importVaultKey = (raw: Uint8Array<ArrayBuffer>) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

export { b64 as toBase64, unb64 as fromBase64 };
