import { describe, expect, it } from '@jest/globals';

import { isQuickAddUserDirty } from '@/features/transactions/quick-add-dirty';

const base = {
  amount: '',
  title: '',
  note: '',
  tags: '',
  date: '2024-06-15',
  openedDate: '2024-06-15',
  pendingImageCount: 0,
  userPickedAccount: false,
  userPickedCategory: false,
};

describe('isQuickAddUserDirty', () => {
  it('is clean when only defaults are applied', () => {
    expect(isQuickAddUserDirty(base)).toBe(false);
  });

  it('detects amount entry', () => {
    expect(isQuickAddUserDirty({ ...base, amount: '12' })).toBe(true);
  });

  it('detects explicit category pick', () => {
    expect(isQuickAddUserDirty({ ...base, userPickedCategory: true })).toBe(
      true
    );
  });

  it('detects date change from opened default', () => {
    expect(
      isQuickAddUserDirty({
        ...base,
        date: '2024-06-14',
        openedDate: '2024-06-15',
      })
    ).toBe(true);
  });
});
