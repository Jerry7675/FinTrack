// Mock expo-sqlite for test environment
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

const mockSecureStoreMemory = new Map();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn((key) =>
    Promise.resolve(mockSecureStoreMemory.get(key) ?? null)
  ),
  setItemAsync: jest.fn((key, value) => {
    mockSecureStoreMemory.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key) => {
    mockSecureStoreMemory.delete(key);
    return Promise.resolve();
  }),
}));

// Mock expo-crypto for test environment
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  let saltCounter = 0;
  let uuidCounter = 0;
  const IV_LENGTH = 12;
  const TAG_LENGTH = 16;

  function mockDigestHex(data) {
    return nodeCrypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  function keyBufferFromHex(keyHex) {
    return Buffer.from(keyHex, 'hex');
  }

  function toUint8Array(buf) {
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  return {
    randomUUID: jest.fn(() => {
      uuidCounter += 1;
      const suffix = uuidCounter.toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${suffix}`;
    }),
    AESEncryptionKey: {
      import: jest.fn((keyHex) =>
        Promise.resolve({
          hex: keyHex,
        })
      ),
    },
    AESSealedData: {
      fromCombined: jest.fn((combined) => ({
        combined,
      })),
    },
    aesEncryptAsync: jest.fn((plaintext, key) => {
      const iv = nodeCrypto.randomBytes(IV_LENGTH);
      const keyBuf = keyBufferFromHex(key.hex);
      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyBuf, iv);
      const plainBuf = Buffer.from(plaintext);
      const encrypted = Buffer.concat([
        cipher.update(plainBuf),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      const combined = Buffer.concat([iv, encrypted, tag]);
      return Promise.resolve({
        combined: () => Promise.resolve(toUint8Array(combined)),
      });
    }),
    aesDecryptAsync: jest.fn((sealed, key) => {
      const combined = Buffer.from(sealed.combined);
      if (combined.length < IV_LENGTH + TAG_LENGTH) {
        return Promise.reject(new Error('Authentication failed'));
      }
      const iv = combined.subarray(0, IV_LENGTH);
      const tag = combined.subarray(combined.length - TAG_LENGTH);
      const ciphertext = combined.subarray(
        IV_LENGTH,
        combined.length - TAG_LENGTH
      );
      const keyBuf = keyBufferFromHex(key.hex);
      try {
        const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        return Promise.resolve(toUint8Array(decrypted));
      } catch {
        return Promise.reject(new Error('Authentication failed'));
      }
    }),
    CryptoDigestAlgorithm: {
      SHA256: 'SHA256',
    },
    digestStringAsync: jest.fn((...args) =>
      Promise.resolve(mockDigestHex(args[1]))
    ),
    getRandomBytesAsync: jest.fn((count) => {
      const bytes = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        bytes[i] = (saltCounter + i) % 256;
      }
      saltCounter += count;
      return Promise.resolve(bytes);
    }),
  };
});
