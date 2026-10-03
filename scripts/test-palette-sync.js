#!/usr/bin/env node

/**
 * Unit test: Ensure palette.ts and tailwind.config.js hold identical hex values
 * so they cannot drift.
 */

const fs = require('node:fs');
const path = require('node:path');

const paletteTs = fs.readFileSync(
  path.join(__dirname, '../src/constants/palette.ts'),
  'utf-8'
);
const tailwindJs = fs.readFileSync(
  path.join(__dirname, '../tailwind.config.js'),
  'utf-8'
);

const hexPattern = /#[0-9A-Fa-f]{6}/g;

const paletteColors = [...paletteTs.matchAll(hexPattern)].map((m) =>
  m[0].toUpperCase()
);
const tailwindColors = [...tailwindJs.matchAll(hexPattern)].map((m) =>
  m[0].toUpperCase()
);

const paletteSet = new Set(paletteColors);
const tailwindSet = new Set(tailwindColors);

let passed = true;
const errors = [];

for (const color of paletteSet) {
  if (!tailwindSet.has(color)) {
    errors.push(
      `Color ${color} is in palette.ts but not in tailwind.config.js`
    );
    passed = false;
  }
}

for (const color of tailwindSet) {
  if (!paletteSet.has(color)) {
    errors.push(
      `Color ${color} is in tailwind.config.js but not in palette.ts`
    );
    passed = false;
  }
}

if (passed) {
  console.log('✓ palette.ts and tailwind.config.js are in sync');
  console.log(`  Found ${paletteSet.size} unique colors in both files`);
  process.exit(0);
} else {
  console.error('✗ palette.ts and tailwind.config.js have drifted:');
  for (const error of errors) {
    console.error(`  ${error}`);
  }
  process.exit(1);
}
