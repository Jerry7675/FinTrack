import { describe, expect, it } from '@jest/globals';

import { shouldCloseSheetAfterSave } from '@/features/transactions/quick-add-save';

describe('shouldCloseSheetAfterSave', () => {
  it('closes after Save only', () => {
    expect(shouldCloseSheetAfterSave('save')).toBe(true);
    expect(shouldCloseSheetAfterSave('saveNew')).toBe(false);
  });
});
