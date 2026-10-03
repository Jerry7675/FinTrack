// Mock expo-sqlite for test environment
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

// Mock expo-crypto for test environment
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  let saltCounter = 0;
  let uuidCounter = 0;
  const mockAuthTagLen = 16;

  function mockDigestHex(data) {
    return nodeCrypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  function mockHexToKeyBytes(keyHex) {
    const hex = keyHex.padEnd(64, '0').slice(0, 64);
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  function mockXorWithKeyBytes(data, keyBytes) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      out[i] = data[i] ^ keyBytes[i % keyBytes.length];
    }
    return out;
  }

  function mockAuthTag(keyHex, ciphertextBody) {
    return nodeCrypto
      .createHash('sha256')
      .update(keyHex, 'utf8')
      .update(ciphertextBody)
      .digest()
      .subarray(0, mockAuthTagLen);
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
      const keyBytes = mockHexToKeyBytes(key.hex);
      const body = mockXorWithKeyBytes(plaintext, keyBytes);
      const tag = mockAuthTag(key.hex, body);
      const combined = new Uint8Array(body.length + mockAuthTagLen);
      combined.set(body);
      combined.set(tag, body.length);
      return Promise.resolve({
        combined: () => Promise.resolve(combined),
      });
    }),
    aesDecryptAsync: jest.fn((sealed, key) => {
      const combined = sealed.combined;
      if (combined.length < mockAuthTagLen) {
        return Promise.reject(new Error('Invalid ciphertext'));
      }
      const body = combined.subarray(0, combined.length - mockAuthTagLen);
      const tag = combined.subarray(combined.length - mockAuthTagLen);
      const expected = mockAuthTag(key.hex, body);
      for (let i = 0; i < mockAuthTagLen; i++) {
        if (tag[i] !== expected[i]) {
          return Promise.reject(new Error('Authentication failed'));
        }
      }
      const keyBytes = mockHexToKeyBytes(key.hex);
      return Promise.resolve(mockXorWithKeyBytes(body, keyBytes));
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
