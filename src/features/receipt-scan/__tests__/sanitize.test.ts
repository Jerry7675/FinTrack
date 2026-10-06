import { cleanMerchantInput } from '../sanitize';

describe('cleanMerchantInput', () => {
  it('removes bidi and control characters', () => {
    expect(cleanMerchantInput('A\u200bB')).toBe('AB');
    expect(cleanMerchantInput('<b>x</b>')).toBe('<b>x</b>');
  });
});
