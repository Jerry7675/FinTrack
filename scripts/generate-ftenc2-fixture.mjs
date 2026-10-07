/**
 * One-shot generator for FTENC2 compatibility fixtures (pre-hardening algorithm).
 * Run from repo root: node scripts/generate-ftenc2-fixture.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENC_PREFIX = 'FTENC2';
const KDF_ROUNDS = 2000;
const FIXTURE_PASSWORD = 'fixture-pass-12345';

const payload = {
  schemaVersion: 1,
  exportedAt: '2024-01-15T10:00:00.000Z',
  data: {
    accountGroups: [
      {
        id: 'grp-fixture',
        name: 'Fixture',
        icon: 'business',
        sortOrder: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
    ],
    accounts: [
      {
        id: 'acc-fixture',
        groupId: 'grp-fixture',
        name: 'Wallet',
        currencyCode: 'USD',
        type: 'cash',
        sortOrder: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
    ],
    categories: [],
    tags: [],
    transactions: [],
    transactionTags: [],
    budgets: [],
    recurringTemplates: [],
    goals: [],
    subscriptions: [],
    debts: [],
    settings: [],
  },
};

function deriveKeyHex(password, saltHex) {
  let material = `${password}:${saltHex}`;
  for (let i = 0; i < KDF_ROUNDS; i++) {
    material = crypto
      .createHash('sha256')
      .update(material, 'utf8')
      .digest('hex');
  }
  return material;
}

// Fixed salt for deterministic fixture (matches pre-change structure; IV fixed for reproducibility)
function encryptFtenc2Deterministic(payload, password, saltHex, ivHex) {
  const keyHex = deriveKeyHex(password, saltHex);
  const key = Buffer.from(keyHex.slice(0, 64), 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, tag]);
  const cipherB64 = combined.toString('base64');
  return `${ENC_PREFIX}.${saltHex}.${cipherB64}`;
}

const saltHex = 'a1b2c3d4e5f6071829304a5b6c7d8e9f';
const ivHex = '0102030405060708090a0b0c';
const blob = encryptFtenc2Deterministic(
  payload,
  FIXTURE_PASSWORD,
  saltHex,
  ivHex
);

const outDir = path.join(
  __dirname,
  '..',
  'src',
  'lib',
  'backup',
  '__fixtures__'
);
fs.mkdirSync(outDir, { recursive: true });
const meta = {
  password: FIXTURE_PASSWORD,
  encPrefix: ENC_PREFIX,
  kdfRounds: KDF_ROUNDS,
  description:
    'Encrypted with pre-hardening FTENC2 (SHA-256 x2000 KDF, expo-compatible AES-GCM layout)',
};
fs.writeFileSync(
  path.join(outDir, 'ftenc2-backup.meta.json'),
  `${JSON.stringify(meta, null, 2)}\n`
);
fs.writeFileSync(path.join(outDir, 'ftenc2-backup.ftenc'), `${blob}\n`);

console.log('Wrote fixture to', outDir);
