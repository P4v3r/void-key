/**
 * Crypto utilities - OpenPGP key management and message operations
 */
import { 
  generateKey, 
  readKey, 
  readPrivateKey, 
  decryptKey, 
  encrypt, 
  decrypt, 
  readMessage, 
  createMessage, 
  sign, 
  verify 
} from 'openpgp';

/**
 * Generate a new RSA-4096 key pair
 * @param {string} name - User name
 * @param {string} email - User email
 * @param {string} passphrase - Key passphrase
 * @returns {Promise<{publicKey: string, privateKey: string}>}
 */
export async function generateKeyPair(name, email, passphrase) {
  const result = await generateKey({
    type: 'rsa',
    rsaBits: 4096,
    userIDs: [{ name, email }],
    passphrase: passphrase
  });
  
  return {
    publicKey: result.publicKey,
    privateKey: result.privateKey
  };
}

/**
 * Read and parse a public key from armored string
 * @param {string} armoredKey - Armored PGP public key
 * @returns {Promise<object>}
 */
export async function parsePublicKey(armoredKey) {
  return await readKey({ armoredKey: armoredKey.trim() });
}

/**
 * Read and decrypt a private key
 * @param {string} armoredKey - Armored PGP private key
 * @param {string} passphrase - Passphrase to decrypt
 * @returns {Promise<object>}
 */
export async function unlockPrivateKey(armoredKey, passphrase) {
  const privateKey = await readPrivateKey({ armoredKey: armoredKey.trim() });
  return await decryptKey({ privateKey, passphrase });
}

/**
 * Encrypt a message for a recipient
 * @param {string} message - Plain text message
 * @param {string} publicKeyArmored - Recipient's public key
 * @returns {Promise<string>}
 */
export async function encryptMessage(message, publicKeyArmored) {
  const publicKey = await readKey({ armoredKey: publicKeyArmored.trim() });
  const encrypted = await encrypt({
    message: await createMessage({ text: message }),
    encryptionKeys: publicKey
  });
  return encrypted;
}

/**
 * Decrypt a message
 * @param {string} armoredMessage - PGP encrypted message
 * @param {object} privateKey - Decrypted private key
 * @returns {Promise<string>}
 */
export async function decryptMessage(armoredMessage, privateKey) {
  const message = await readMessage({ armoredMessage: armoredMessage.trim() });
  const { data } = await decrypt({ message, decryptionKeys: privateKey });
  return data;
}

/**
 * Sign a message
 * @param {string} message - Plain text message
 * @param {object} privateKey - Decrypted private key
 * @returns {Promise<string>}
 */
export async function signMessage(message, privateKey) {
  const msg = await createMessage({ text: message });
  const signed = await sign({ message: msg, signingKeys: privateKey });
  return signed;
}

/**
 * Verify a signed message
 * @param {string} signature - PGP signature block
 * @param {string} publicKeyArmored - Sender's public key
 * @returns {Promise<{isValid: boolean, data: string, author: string}>}
 */
export async function verifySignature(signature, publicKeyArmored) {
  const verificationKey = await readKey({ armoredKey: publicKeyArmored });
  const message = await readMessage({ armoredMessage: signature });
  const { data, signatures } = await verify({ message, verificationKeys: verificationKey });
  
  // Check if signature exists
  if (signatures.length === 0) {
    return { isValid: false, data: null, author: null };
  }
  
  // Verify mathematical signature
  let isValid = false;
  try {
    isValid = await signatures[0].verified;
  } catch (e) {
    isValid = false;
  }
  
  // Get author info
  let author = 'Unknown Key';
  if (verificationKey.users && verificationKey.users.length > 0) {
    const uid = verificationKey.users[0].userID;
    if (typeof uid === 'string') {
      author = uid;
    } else if (uid && typeof uid === 'object') {
      author = (uid.name || '') + (uid.email ? ` <${uid.email}>` : '');
    }
  }
  
  return { isValid, data, author };
}

/**
 * Extract user info from a private key
 * @param {string} armoredKey - Armored private key
 * @returns {Promise<{name: string, email: string}>}
 */
export async function extractKeyInfo(armoredKey) {
  const privateKey = await readPrivateKey({ armoredKey });
  
  let name = 'Unknown';
  let email = 'unknown@email.com';
  
  if (privateKey.users && privateKey.users.length > 0) {
    const uid = privateKey.users[0].userID;
    if (typeof uid === 'string') {
      const match = uid.match(/^(.*?)<(.*?)>$/);
      if (match) {
        name = match[1].trim();
        email = match[2].trim();
      } else {
        name = uid;
      }
    } else if (uid && typeof uid === 'object') {
      name = uid.name || 'Unknown';
      email = uid.email || 'unknown@email.com';
    }
  }
  
  return { name, email };
}

/**
 * Convert key to public key
 * @param {string} privateKeyArmored - Armored private key
 * @returns {Promise<string>}
 */
export async function getPublicKeyFromPrivate(privateKeyArmored) {
  const privateKey = await readPrivateKey({ armoredKey: privateKeyArmored });
  const publicKey = await privateKey.toPublic();
  return await publicKey.armor();
}