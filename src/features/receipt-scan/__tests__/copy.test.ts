import * as fs from 'node:fs';
import * as path from 'node:path';

const FORBIDDEN = /\b(secure|private|encrypted|accurate|smart)\b/i;

const files = [
  'consent-sheet.tsx',
  'settings-row.tsx',
  'scan-banner.tsx',
  'banner-copy.ts',
  'scan-panel.tsx',
  'source-sheet.tsx',
  'ai-filled-badge.tsx',
];

describe('receipt scan copy', () => {
  it('does not use forbidden marketing words in scan UI copy', () => {
    const root = path.join(__dirname, '..');
    for (const file of files) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      expect(text).not.toMatch(FORBIDDEN);
    }
  });
});
