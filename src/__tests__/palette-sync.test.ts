/**
 * Test that palette.ts and tailwind.config.js stay in sync.
 */
const fs = require('fs');
const path = require('node:path');

describe('palette sync', () => {
  it('palette.ts and tailwind.config.js have matching colors and token names', () => {
    const paletteTs = fs.readFileSync(
      path.join(process.cwd(), 'src/constants/palette.ts'),
      'utf-8'
    );
    const tailwindJs = fs.readFileSync(
      path.join(process.cwd(), 'tailwind.config.js'),
      'utf-8'
    );

    const hexPattern = /#[0-9A-Fa-f]{6}/g;

    const paletteColors = [...paletteTs.matchAll(hexPattern)].map(
      (m: RegExpMatchArray) => m[0].toUpperCase()
    );
    const tailwindColors = [...tailwindJs.matchAll(hexPattern)].map(
      (m: RegExpMatchArray) => m[0].toUpperCase()
    );

    const paletteSet = new Set(paletteColors);
    const tailwindSet = new Set(tailwindColors);

    // Extract semantic token names
    const tokenNamePattern =
      /^\s*(ink|surface|accent|income|expense|warning|line)/gm;
    const paletteTokens = new Set(
      [...paletteTs.matchAll(tokenNamePattern)].map(
        (m: RegExpMatchArray) => m[1]
      )
    );
    const tailwindTokens = new Set(
      [...tailwindJs.matchAll(tokenNamePattern)].map(
        (m: RegExpMatchArray) => m[1]
      )
    );

    // Check hex values
    const missingInTailwind: string[] = [];
    const missingInPalette: string[] = [];

    for (const color of paletteSet) {
      if (!tailwindSet.has(color)) {
        missingInTailwind.push(color);
      }
    }

    for (const color of tailwindSet) {
      if (!paletteSet.has(color)) {
        missingInPalette.push(color);
      }
    }

    // Check token names
    const tokensMissingInTailwind: string[] = [];
    const tokensMissingInPalette: string[] = [];

    for (const token of paletteTokens) {
      if (!tailwindTokens.has(token)) {
        tokensMissingInTailwind.push(token);
      }
    }

    for (const token of tailwindTokens) {
      if (!paletteTokens.has(token)) {
        tokensMissingInPalette.push(token);
      }
    }

    // Build error message if any checks fail
    const errors: string[] = [];

    if (missingInTailwind.length > 0) {
      errors.push(
        `Colors in palette.ts but not in tailwind.config.js: ${missingInTailwind.join(', ')}`
      );
    }

    if (missingInPalette.length > 0) {
      errors.push(
        `Colors in tailwind.config.js but not in palette.ts: ${missingInPalette.join(', ')}`
      );
    }

    if (tokensMissingInTailwind.length > 0) {
      errors.push(
        `Tokens in palette.ts but not in tailwind.config.js: ${tokensMissingInTailwind.join(', ')}`
      );
    }

    if (tokensMissingInPalette.length > 0) {
      errors.push(
        `Tokens in tailwind.config.js but not in palette.ts: ${tokensMissingInPalette.join(', ')}`
      );
    }

    if (errors.length > 0) {
      throw new Error(
        `palette.ts and tailwind.config.js have drifted:\n${errors.join('\n')}`
      );
    }

    // Success message
    console.log(
      `✓ palette.ts and tailwind.config.js are in sync: ${paletteSet.size} unique colors and ${paletteTokens.size} token families`
    );
  });
});
