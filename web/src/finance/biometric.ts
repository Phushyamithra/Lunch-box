/**
 * Fingerprint lock for Finance, through the phone's passkey (WebAuthn).
 *
 * - 'prf' (strongest; Chrome on Android with a Google Password Manager
 *   passkey): the passkey releases a secret only after your fingerprint.
 *   That secret encrypts the finance key, so without the fingerprint the
 *   key on this device is unreadable.
 * - 'gate' (when the phone can't do PRF): the key stays stored on this
 *   device (non-extractable) and the app asks for a fingerprint check
 *   before using it.
 *
 * Your passphrase always still works, and the passkey only exists for this
 * site's address (a new address means turning it on again).
 */
import { fromBase64, importVaultKey, toBase64 } from './vault';

export type BioMode = 'prf' | 'gate';

export interface BioRecord {
  mode: BioMode;
  /** base64 credential id */
  credentialId: string;
  /** base64; the PRF input (prf mode). */
  prfSalt: string | null;
  /** The finance key, encrypted with the fingerprint secret (prf mode). */
  wrapped: { iv: string; data: string } | null;
  createdAt: string;
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

/** Creates the passkey (fingerprint prompt). Reports whether the phone offers PRF. */
export async function registerPasskey(): Promise<{ credentialId: string; prf: boolean }> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Tracker', id: location.hostname },
      user: { id: random(16), name: 'Tracker finance', displayName: 'Tracker finance lock' },
      challenge: random(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('No passkey was created.');
  const ext = cred.getClientExtensionResults() as PrfResults;
  return { credentialId: toBase64(new Uint8Array(cred.rawId)), prf: !!ext.prf?.enabled };
}

/** Fingerprint check. With a salt, returns the PRF secret (or null if the phone gave none). */
export async function verifyFingerprint(credentialId: string, prfSalt: string | null): Promise<Uint8Array<ArrayBuffer> | null> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromBase64(credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
      ...(prfSalt ? { extensions: { prf: { eval: { first: fromBase64(prfSalt) } } } as AuthenticationExtensionsClientInputs } : {}),
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint check cancelled.');
  const first = (cred.getClientExtensionResults() as PrfResults).prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

/** PRF secret → the key that wraps the finance key (HKDF-SHA-256). */
async function wrappingKey(secret: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('tracker-finance-fingerprint-v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapVaultKey(raw: Uint8Array<ArrayBuffer>, secret: Uint8Array<ArrayBuffer>): Promise<{ iv: string; data: string }> {
  const iv = random(12);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrappingKey(secret), raw));
  return { iv: toBase64(iv), data: toBase64(data) };
}

export async function unwrapVaultKey(w: { iv: string; data: string }, secret: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  let raw: ArrayBuffer;
  try {
    raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(w.iv) }, await wrappingKey(secret), fromBase64(w.data));
  } catch {
    throw new Error('The fingerprint passkey didn’t match this device’s lock. Unlock with your passphrase, then turn fingerprint on again.');
  }
  return importVaultKey(new Uint8Array(raw));
}

export const newPrfSalt = () => toBase64(random(32));

/** Plain words for a WebAuthn failure. */
export function fingerprintError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Fingerprint check was cancelled or timed out.';
  if (name === 'InvalidStateError') return 'A passkey for this already exists on the phone.';
  if (name === 'SecurityError') return 'Fingerprint needs the app opened over https (or localhost).';
  if (name === 'NotSupportedError') return 'This device or browser can’t do fingerprint passkeys.';
  return e instanceof Error ? e.message : 'Fingerprint check failed.';
}
