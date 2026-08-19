const encoder = new TextEncoder();

// Workers Free currently allows 10 ms CPU/request. Keep PBKDF2 deliberately
// parameterized so hashes remain upgradeable later without a schema change.
// Phase 9 hardening can raise this when the runtime budget changes and can
// transparently rehash accounts after successful login.
const PASSWORD_ITERATIONS = 10_000;
const MIN_SUPPORTED_PASSWORD_ITERATIONS = 10_000;
const PASSWORD_BYTES = 32;
const SALT_BYTES = 16;

export type PasswordParams = {
  version: 1;
  algorithm: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  dkLen: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    PASSWORD_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<{
  hash: string;
  salt: string;
  params: string;
}> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  const params: PasswordParams = {
    version: 1,
    algorithm: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PASSWORD_ITERATIONS,
    dkLen: PASSWORD_BYTES,
  };
  return { hash: toBase64Url(hash), salt: toBase64Url(salt), params: JSON.stringify(params) };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  storedParams: string,
): Promise<boolean> {
  let params: PasswordParams;
  try {
    params = JSON.parse(storedParams) as PasswordParams;
  } catch {
    return false;
  }
  if (
    params.version !== 1 ||
    params.algorithm !== 'PBKDF2' ||
    params.hash !== 'SHA-256' ||
    !Number.isInteger(params.iterations) ||
    params.iterations < MIN_SUPPORTED_PASSWORD_ITERATIONS ||
    params.dkLen !== PASSWORD_BYTES
  ) {
    return false;
  }

  const actual = await derivePassword(password, fromBase64Url(storedSalt), params.iterations);
  const expected = fromBase64Url(storedHash);
  if (actual.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export function createSessionToken(): string {
  return toBase64Url(randomBytes(32));
}

export function createIssuedPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let tail = '';
  for (const byte of bytes) tail += alphabet[byte % alphabet.length]!;
  return `Aa7!${tail}`;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
