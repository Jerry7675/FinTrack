// Mock expo-sqlite for test environment
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

// Mock expo-crypto for test environment
jest.mock('expo-crypto', () => {
  let saltCounter = 0;

  return {
    randomUUID: jest.fn(() => {
      return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
      // Simple reversible "encryption" for testing - just XOR with key
      const encrypted = new Uint8Array(plaintext.length);
      const keyBytes = new TextEncoder().encode(key.hex.slice(0, 32));
      for (let i = 0; i < plaintext.length; i++) {
        encrypted[i] = plaintext[i] ^ keyBytes[i % keyBytes.length];
      }
      return Promise.resolve({
        combined: () => Promise.resolve(encrypted),
      });
    }),
    aesDecryptAsync: jest.fn((sealed, key) => {
      // Reverse the XOR
      const combined = sealed.combined;
      const decrypted = new Uint8Array(combined.length);
      const keyBytes = new TextEncoder().encode(key.hex.slice(0, 32));
      for (let i = 0; i < combined.length; i++) {
        decrypted[i] = combined[i] ^ keyBytes[i % keyBytes.length];
      }
      return Promise.resolve(decrypted);
    }),
    CryptoDigestAlgorithm: {
      SHA256: 'SHA256',
    },
    digestStringAsync: jest.fn((algorithm, data) => {
      // Simple deterministic hash for testing
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = (hash << 5) - hash + data.charCodeAt(i);
        hash = hash & hash;
      }
      return Promise.resolve(Math.abs(hash).toString(16).padStart(64, '0'));
    }),
    getRandomBytesAsync: jest.fn((count) => {
      // Return different salts each time
      const bytes = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        bytes[i] = (saltCounter + i) % 256;
      }
      saltCounter += count;
      return Promise.resolve(bytes);
    }),
  };
});
