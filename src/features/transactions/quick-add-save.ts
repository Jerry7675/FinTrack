export type QuickAddSaveMode = 'save' | 'saveNew';

export function shouldCloseSheetAfterSave(mode: QuickAddSaveMode): boolean {
  return mode === 'save';
}
