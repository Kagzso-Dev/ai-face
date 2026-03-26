/**
 * Per-user biometric / fingerprint via WebAuthn.
 * Credential IDs are stored in localStorage, keyed by user ID.
 * The OS handles the actual biometric — nothing leaves the device.
 */

const RP_NAME     = 'Kagzso';
const RP_ID       = window.location.hostname || 'localhost';
const STORAGE_KEY = 'fa_user_fingerprints'; // { [userId]: base64CredentialId }

// ── Encoding helpers ────────────────────────────────────────────────────────
const toBase64   = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const challenge  = ()  => crypto.getRandomValues(new Uint8Array(32));

// ── Storage helpers ─────────────────────────────────────────────────────────
const getAll = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};

const save = (userId, credId) => {
  const all = getAll();
  all[userId] = credId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

const remove = (userId) => {
  const all = getAll();
  delete all[userId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

// ── Public API ──────────────────────────────────────────────────────────────

/** True if the browser has a platform authenticator (fingerprint / Face ID / Windows Hello) */
export const isBiometricAvailable = async () => {
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

/** True if this user already has a fingerprint registered */
export const hasFingerprint = (userId) => !!getAll()[userId];

/** Return list of all user IDs that have a fingerprint registered */
export const getUsersWithFingerprint = () => Object.keys(getAll());

/**
 * Register a fingerprint for a specific user.
 * Triggers the OS biometric prompt.
 */
export const registerFingerprint = async (userId, userName) => {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { id: RP_ID, name: RP_NAME },
      user: {
        id: new TextEncoder().encode(userId),
        name: `${userName}@faceattend`,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7,   type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });

  save(userId, toBase64(credential.rawId));
  return true;
};

/**
 * Verify the fingerprint for a specific user.
 * Returns true if the OS confirms the biometric.
 */
export const verifyFingerprint = async (userId) => {
  const credId = getAll()[userId];
  if (!credId) throw new Error('No fingerprint registered for this user.');

  await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      rpId: RP_ID,
      allowCredentials: [{ id: fromBase64(credId), type: 'public-key', transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  return true;
};

/** Remove a user's registered fingerprint */
export const removeFingerprint = (userId) => remove(userId);
