export type QuickAddUserDirtyInput = {
  amount: string;
  title: string;
  note?: string;
  tags?: string;
  date: string;
  openedDate: string;
  pendingImageCount: number;
  userPickedAccount: boolean;
  userPickedCategory: boolean;
};

/** True when the user changed something; app-applied defaults do not count. */
export function isQuickAddUserDirty(input: QuickAddUserDirtyInput): boolean {
  if (input.amount.trim() !== '') return true;
  if (input.title.trim() !== '') return true;
  if ((input.note?.trim() ?? '') !== '') return true;
  if ((input.tags?.trim() ?? '') !== '') return true;
  if (input.pendingImageCount > 0) return true;
  if (input.userPickedAccount) return true;
  if (input.userPickedCategory) return true;
  if (input.date !== input.openedDate) return true;
  return false;
}
