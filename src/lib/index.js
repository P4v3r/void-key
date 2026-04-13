/**
 * Void Key - Utility exports
 */

// Crypto functions
export { 
  generateKeyPair,
  unlockPrivateKey,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
  extractKeyInfo,
  getPublicKeyFromPrivate
} from './utils/crypto.js';

// Storage functions
export { 
  loadSettings,
  saveSettings,
  loadCachedIdentity,
  saveCachedIdentity,
  clearCachedIdentity,
  safeCopy,
  downloadJson,
  downloadFile
} from './utils/storage.js';