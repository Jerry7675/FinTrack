import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, type FieldErrors, useForm } from 'react-hook-form';
import {
  BackHandler,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { ReceiptThumb } from '@/components/media/images';
import { SurfaceCard } from '@/components/ui/cards';
import {
  AppText,
  Button,
  CategoryGlyph,
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  ListRow,
  Select,
  useThemeColors,
} from '@/components/ui/primitives';
import { SegmentedControl } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ModalToastProvider, useToast } from '@/components/ui/toast';
import { AiFilledBadge } from '@/features/receipt-scan/ai-filled-badge';
import {
  type ApplyScanResult,
  fillAmountAfterAccountSwitch,
} from '@/features/receipt-scan/apply';
import { ReceiptScanConsentSheet } from '@/features/receipt-scan/consent-sheet';
import { ReceiptScanBanner } from '@/features/receipt-scan/scan-banner';
import { ReceiptScanPanel } from '@/features/receipt-scan/scan-panel';
import { ReceiptScanSourceSheet } from '@/features/receipt-scan/source-sheet';
import type { AiFilledField } from '@/features/receipt-scan/types';
import { useQuickAddReceiptScan } from '@/features/receipt-scan/use-quick-add-receipt-scan';
import { db } from '@/lib/db/client';
import {
  addAttachments,
  createTransaction,
  createTransfer,
  getAccountBalance,
  getLastEntry,
  getLastEntryForCategory,
  listCategories,
  listCategoryUsage,
} from '@/lib/db/queries';
import type { Category } from '@/lib/db/schema';
import { layout, scale } from '@/lib/layout';
import {
  deleteLocalImage,
  persistImage,
  pickImage,
  takePhoto,
} from '@/lib/media';
import {
  formatMinorToDecimal,
  formatMoney,
  fromMinorUnits,
  getCurrency,
  parseAmountToMinor,
} from '@/lib/money';
import { TRANSACTION_LIMITS } from '@/lib/validation';
import { useApp } from '@/providers/app-provider';

import {
  defaultCategoryIdFromOrder,
  orderCategoriesForQuickAdd,
} from './category-order';
import { AmountDisplay, formatMaxAmountLabel, Keypad } from './keypad';
import { QuickAddDatePicker } from './quick-add-date-picker';
import { isQuickAddUserDirty } from './quick-add-dirty';
import {
  type QuickAddSaveMode,
  shouldCloseSheetAfterSave,
} from './quick-add-save';
import {
  type AddTransactionField,
  defaultTransactionDateString,
  firstAddTransactionFieldWithError,
  formatQuickAddDateLabel,
  getAddTransactionSaveAvailability,
  resolveQuickAddAccountId,
  submitAddTransaction,
} from './submit-add-transaction';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const formSchema = z
  .object({
    mode: z.enum(['expense', 'income', 'transfer']),
    amount: z.string().min(1, 'Enter an amount'),
    date: z.string().min(1, 'Enter a date'),
    title: z
      .string()
      .max(
        TRANSACTION_LIMITS.titleMax,
        `Title must be ${TRANSACTION_LIMITS.titleMax} characters or fewer`
      ),
    note: z
      .string()
      .max(
        TRANSACTION_LIMITS.noteMax,
        `Note must be ${TRANSACTION_LIMITS.noteMax} characters or fewer`
      )
      .optional(),
    tags: z.string().optional(),
    accountId: z.string().min(1, 'Select an account'),
    toAccountId: z.string().optional(),
    categoryId: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const tagNames = (data.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagNames.length > TRANSACTION_LIMITS.tagCountMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Use at most ${TRANSACTION_LIMITS.tagCountMax} tags`,
        path: ['tags'],
      });
    }
    if (tagNames.some((tag) => tag.length > TRANSACTION_LIMITS.tagMax)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Each tag must be ${TRANSACTION_LIMITS.tagMax} characters or fewer`,
        path: ['tags'],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type BodyProps = Props & {
  showRootToast: (
    message: string,
    tone?: 'default' | 'success' | 'error'
  ) => void;
  bindRequestClose: (handler: () => void) => void;
};

type LoadContextReason = 'open' | 'mode' | 'refresh';

function AddTransactionSheetBody({
  visible,
  onClose,
  onSaved,
  showRootToast,
  bindRequestClose,
}: BodyProps) {
  const { accounts, settings, colorScheme, bumpData, ready } = useApp();
  const { showToast } = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const locale =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().locale
      : 'en-US';

  const [categories, setCategories] = useState<Category[]>([]);
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [contextError, setContextError] = useState(false);
  const [continueWithoutCategory, setContinueWithoutCategory] = useState(false);
  const [lastEntry, setLastEntry] = useState<Awaited<
    ReturnType<typeof getLastEntry>
  > | null>(null);
  const [lastCategoryTitle, setLastCategoryTitle] = useState<string | null>(
    null
  );
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSaveMode, setActiveSaveMode] = useState<QuickAddSaveMode | null>(
    null
  );
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [keypadVisible, setKeypadVisible] = useState(true);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [transferReceiptsOpen, setTransferReceiptsOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<FormValues['mode'] | null>(
    null
  );
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [amountBlocked, setAmountBlocked] = useState(false);
  const [aiFilled, setAiFilled] = useState<Set<AiFilledField>>(new Set());
  const [currencyMismatch, setCurrencyMismatch] = useState<
    ApplyScanResult['currencyMismatch'] | null
  >(null);

  const scrollRef = useRef<ScrollView>(null);
  const categoryScrollRef = useRef<ScrollView>(null);
  const wasVisibleRef = useRef(false);
  const openedDateRef = useRef(defaultTransactionDateString());
  const prevModeRef = useRef<FormValues['mode']>('expense');
  const userPickedAccountRef = useRef(false);
  const userPickedCategoryRef = useRef(false);
  const userPickedToAccountRef = useRef(false);
  const categorySelectGenerationRef = useRef(0);
  const savingRef = useRef(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setFocus,
    setError,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: 'expense',
      amount: '',
      date: defaultTransactionDateString(),
      title: '',
      note: '',
      tags: '',
      accountId: '',
      toAccountId: '',
      categoryId: null,
    },
  });

  const mode = watch('mode');
  const accountId = watch('accountId');
  const categoryId = watch('categoryId');
  const amountText = watch('amount');
  const dateValue = watch('date');
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currencyCode ?? settings?.defaultCurrency ?? 'USD';
  const prevCurrencyRef = useRef(currency);

  const saveAvailability = getAddTransactionSaveAvailability(
    Boolean(ready),
    accounts.length
  );

  const amountMinor = parseAmountToMinor(amountText, currency);
  const amountHelper = useMemo(() => {
    if (amountBlocked || (amountText.length > 0 && amountMinor === null)) {
      return `Largest amount is ${formatMaxAmountLabel(currency, locale)}`;
    }
    if (
      (amountTouched || saveAttempted) &&
      amountText.length > 0 &&
      amountMinor === 0
    ) {
      return 'Amount must be more than 0';
    }
    return '';
  }, [
    amountBlocked,
    amountText,
    amountMinor,
    amountTouched,
    saveAttempted,
    currency,
    locale,
  ]);

  const loadContext = useCallback(
    async (reason: LoadContextReason) => {
      if (!ready) return;
      setContextLoading(true);
      setContextError(false);
      if (reason === 'open') {
        setContinueWithoutCategory(false);
      }
      if (reason === 'mode') {
        setCategories([]);
        setOrderedCategories([]);
        setLastCategoryTitle(null);
        userPickedCategoryRef.current = false;
        userPickedToAccountRef.current = false;
      }
      try {
        const kind =
          mode === 'transfer'
            ? undefined
            : mode === 'income'
              ? 'income'
              : 'expense';
        const [rows, usage, last] = await Promise.all([
          kind ? listCategories(db, kind) : Promise.resolve([]),
          kind ? listCategoryUsage(db, kind, 90) : Promise.resolve([]),
          getLastEntry(db, mode),
        ]);
        setCategories(rows);
        setLastEntry(last);
        const lastCatId =
          mode !== 'transfer' && last?.categoryId ? last.categoryId : null;
        const ordered = orderCategoriesForQuickAdd(rows, usage, lastCatId);
        setOrderedCategories(ordered);
        const defaultCat = defaultCategoryIdFromOrder(ordered, lastCatId);

        if (reason === 'open' || reason === 'mode') {
          setValue('categoryId', defaultCat);
          if (defaultCat && mode !== 'transfer') {
            try {
              const row = await getLastEntryForCategory(db, defaultCat);
              setLastCategoryTitle(row?.title ?? null);
            } catch {
              setLastCategoryTitle(null);
            }
          } else {
            setLastCategoryTitle(null);
          }
        }

        if (
          reason !== 'refresh' &&
          (reason === 'open' || !userPickedAccountRef.current)
        ) {
          const preferredAccount = last?.accountId ?? null;
          const nextAccount = resolveQuickAddAccountId(
            accounts,
            settings?.activeAccountId,
            preferredAccount
          );
          setValue('accountId', nextAccount);

          if (mode === 'transfer' && accounts.length >= 2) {
            const preferredTo = last?.toAccountId ?? null;
            const validPreferredTo =
              preferredTo &&
              preferredTo !== nextAccount &&
              accounts.some((a) => a.id === preferredTo);
            if (validPreferredTo) {
              setValue('toAccountId', preferredTo);
            } else {
              const other = accounts.find((a) => a.id !== nextAccount);
              if (other) {
                setValue('toAccountId', other.id);
              }
            }
          }
        }

        setContextReady(true);
      } catch (e) {
        console.error('Quick Add context load failed', e);
        setContextError(true);
        setContextReady(false);
      } finally {
        setContextLoading(false);
      }
    },
    [ready, mode, accounts, settings?.activeAccountId, setValue]
  );

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      const today = defaultTransactionDateString();
      userPickedAccountRef.current = false;
      userPickedCategoryRef.current = false;
      openedDateRef.current = today;
      setSaveAttempted(false);
      setAmountTouched(false);
      setValue('date', today);
      setMoreDetailsOpen(false);
      setKeypadVisible(true);
      setPendingImages([]);
      setAiFilled(new Set());
      setCurrencyMismatch(null);
      prevModeRef.current = mode;
      void loadContext('open');
    }
    if (!visible) {
      setContextReady(false);
      wasVisibleRef.current = false;
    } else {
      wasVisibleRef.current = visible;
    }
  }, [visible, setValue, loadContext, mode]);

  useEffect(() => {
    if (!visible || !ready) return;
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    void loadContext('mode');
  }, [mode, visible, ready, loadContext]);

  useEffect(() => {
    if (!accountId || !visible) return;
    getAccountBalance(db, accountId)
      .then(setAccountBalance)
      .catch(() => setAccountBalance(null));
  }, [accountId, visible]);

  useEffect(() => {
    if (!categoryId || mode === 'transfer') return;
    const idx = orderedCategories.findIndex((c) => c.id === categoryId);
    if (idx > 0) {
      categoryScrollRef.current?.scrollTo({
        x: Math.max(0, idx * 100 - 48),
        animated: true,
      });
    }
  }, [categoryId, mode, orderedCategories]);

  const isDirty = useCallback(() => {
    const values = getValues();
    return isQuickAddUserDirty({
      amount: values.amount,
      title: values.title,
      note: values.note,
      tags: values.tags,
      date: values.date,
      openedDate: openedDateRef.current,
      pendingImageCount: pendingImages.length,
      userPickedAccount: userPickedAccountRef.current,
      userPickedCategory: userPickedCategoryRef.current,
      userPickedToAccount: userPickedToAccountRef.current,
    });
  }, [getValues, pendingImages]);

  const resetDirtyBaseline = useCallback(() => {
    openedDateRef.current = getValues('date');
    userPickedAccountRef.current = false;
    userPickedCategoryRef.current = false;
    userPickedToAccountRef.current = false;
  }, [getValues]);

  const selectCategory = useCallback(
    async (id: string) => {
      const requestId = ++categorySelectGenerationRef.current;
      userPickedCategoryRef.current = true;
      setAiFilled((prev) => {
        if (!prev.has('categoryId')) return prev;
        const next = new Set(prev);
        next.delete('categoryId');
        return next;
      });
      setValue('categoryId', id);
      if (mode === 'transfer') return;
      try {
        const row = await getLastEntryForCategory(db, id);
        if (requestId !== categorySelectGenerationRef.current) return;
        setLastCategoryTitle(row?.title ?? null);
        if (
          row?.accountId &&
          !userPickedAccountRef.current &&
          accounts.some((a) => a.id === row.accountId)
        ) {
          setValue('accountId', row.accountId);
        }
      } catch (e) {
        console.error('getLastEntryForCategory failed', e);
        if (requestId !== categorySelectGenerationRef.current) return;
        setLastCategoryTitle(null);
      }
    },
    [accounts, mode, setValue]
  );

  const requestModeChange = useCallback(
    (next: FormValues['mode']) => {
      if (next === mode) return;
      if (
        next === 'transfer' &&
        mode !== 'transfer' &&
        pendingImages.length > 0
      ) {
        setPendingMode(next);
        setTransferReceiptsOpen(true);
        return;
      }
      setValue('mode', next);
    },
    [mode, pendingImages.length, setValue]
  );

  const confirmTransferWithoutReceipts = useCallback(async () => {
    setTransferReceiptsOpen(false);
    const next = pendingMode;
    setPendingMode(null);
    if (!next) return;
    await Promise.all(pendingImages.map((path) => deleteLocalImage(path)));
    setPendingImages([]);
    setValue('mode', next);
  }, [pendingImages, pendingMode, setValue]);

  const removePendingReceipt = useCallback(async (path: string) => {
    try {
      await deleteLocalImage(path);
    } catch (e) {
      console.warn('Failed to delete receipt file', path, e);
    }
    setPendingImages((prev) => prev.filter((p) => p !== path));
  }, []);

  const buildScanContext = useCallback(() => {
    const values = getValues();
    return {
      account: {
        id: account?.id ?? values.accountId,
        name: account?.name ?? 'Account',
        currencyCode: currency,
      },
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        currencyCode: a.currencyCode,
      })),
      expenseCategories: categories.map((c) => ({
        id: c.id,
        iconKey: c.iconKey,
        sortOrder: c.sortOrder,
      })),
      today: defaultTransactionDateString(),
      userTouched: {
        amount: amountTouched || values.amount.trim() !== '',
        title: values.title.trim() !== '',
        date: values.date !== openedDateRef.current,
        category: userPickedCategoryRef.current,
      },
    };
  }, [account, accounts, amountTouched, categories, currency, getValues]);

  const onScanApply = useCallback(
    (result: ApplyScanResult) => {
      const nextAi = new Set(aiFilled);
      const values = getValues();
      if (
        result.patch.amount != null &&
        (nextAi.has('amount') || values.amount.trim() === '')
      ) {
        setValue('amount', result.patch.amount);
        setAmountTouched(false);
        nextAi.add('amount');
        setCurrencyMismatch(null);
      }
      if (
        result.patch.date != null &&
        (nextAi.has('date') || values.date === openedDateRef.current)
      ) {
        setValue('date', result.patch.date);
        nextAi.add('date');
      }
      if (
        result.patch.title != null &&
        (nextAi.has('title') || values.title.trim() === '')
      ) {
        setValue('title', result.patch.title);
        nextAi.add('title');
      }
      if (
        result.patch.categoryId != null &&
        (nextAi.has('categoryId') || !userPickedCategoryRef.current)
      ) {
        void selectCategory(result.patch.categoryId);
        nextAi.add('categoryId');
      }
      if (result.currencyMismatch) {
        setCurrencyMismatch(result.currencyMismatch);
      }
      setAiFilled(nextAi);
    },
    [aiFilled, getValues, selectCategory, setValue]
  );

  const clearAiField = useCallback((field: AiFilledField) => {
    setAiFilled((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  const receiptScan = useQuickAddReceiptScan({
    visible,
    mode,
    buildApplyContext: buildScanContext,
    onApplyResult: onScanApply,
    onPendingReceipt: (path) => {
      setPendingImages((prev) => [...prev, path].slice(0, 8));
      setMoreDetailsOpen(true);
    },
    onRemoveReceipt: removePendingReceipt,
    onFocusAmount: () => {
      setKeypadVisible(true);
      Keyboard.dismiss();
    },
    showToast,
  });

  const requestClose = useCallback(() => {
    void (async () => {
      if (await receiptScan.requestCloseInterrupt()) return;
      if (isDirty()) {
        setDiscardOpen(true);
        return;
      }
      onClose();
    })();
  }, [isDirty, onClose, receiptScan]);

  useEffect(() => {
    bindRequestClose(requestClose);
  }, [bindRequestClose, requestClose]);

  useEffect(() => {
    if (prevCurrencyRef.current === currency) return;
    prevCurrencyRef.current = currency;
    const amount = getValues('amount');
    if (!amount.includes('.')) return;
    const { decimals } = getCurrency(currency);
    if (decimals === 0) {
      setValue('amount', amount.split('.')[0] ?? '');
      showToast(`${currency} has no decimals, amount adjusted`);
    }
  }, [currency, getValues, setValue, showToast]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, requestClose]);

  const focusField = useCallback(
    (field: AddTransactionField) => {
      setFocus(field);
      setKeypadVisible(false);
    },
    [setFocus]
  );

  const onInvalid = useCallback(
    (formErrors: FieldErrors<FormValues>) => {
      const first = firstAddTransactionFieldWithError(
        formErrors as Partial<Record<AddTransactionField, { message?: string }>>
      );
      if (first) focusField(first);
    },
    [focusField]
  );

  const discardPendingImages = async () => {
    for (const path of pendingImages) {
      await deleteLocalImage(path);
    }
  };

  const onConfirmDiscard = async () => {
    setDiscardOpen(false);
    await discardPendingImages();
    onClose();
  };

  const onPickReceipts = async () => {
    try {
      const assets = await pickImage({ allowsMultiple: true });
      const paths: string[] = [];
      for (const asset of assets) {
        paths.push(await persistImage(asset.uri, 'receipt'));
      }
      setPendingImages((prev) => [...prev, ...paths].slice(0, 8));
    } catch (_e) {
      showToast('Could not add photos', 'error');
    }
  };

  const onTakeReceipt = async () => {
    try {
      const asset = await takePhoto();
      if (!asset) return;
      const path = await persistImage(asset.uri, 'receipt');
      setPendingImages((prev) => [...prev, path].slice(0, 8));
    } catch (_e) {
      showToast('Could not take photo', 'error');
    }
  };

  const performSave = useCallback(
    async (values: FormValues, saveMode: QuickAddSaveMode) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      setActiveSaveMode(saveMode);
      const closingAfter = shouldCloseSheetAfterSave(saveMode);
      try {
        if (
          values.mode !== 'transfer' &&
          categories.length > 0 &&
          !values.categoryId &&
          !continueWithoutCategory
        ) {
          showToast('Select a category', 'error');
          return;
        }

        const result = await submitAddTransaction(values, {
          accounts,
          categories: categories.map((cat) => ({ id: cat.id, name: cat.name })),
          currency,
          now: new Date(),
          parseAmountToMinor,
          createTransaction: (input) => createTransaction(db, input),
          createTransfer: async (input) => {
            const from = accounts.find((a) => a.id === input.fromAccountId);
            const to = accounts.find((a) => a.id === input.toAccountId);
            if (!from || !to) {
              throw new Error('Pick a different destination account');
            }
            await createTransfer(db, {
              fromAccountId: input.fromAccountId,
              toAccountId: input.toAccountId,
              ...(from.currencyCode === to.currencyCode
                ? { amountMinor: input.amountMinor }
                : {
                    amount: fromMinorUnits(
                      input.amountMinor,
                      from.currencyCode
                    ),
                  }),
              fromCurrency: from.currencyCode,
              toCurrency: to.currencyCode,
              title: input.title,
              note: input.note,
              occurredAt: input.occurredAt,
            });
          },
        });

        if (!result.ok) {
          if (result.error.type === 'field') {
            setError(result.error.field, { message: result.error.message });
            focusField(result.error.field);
            return;
          }
          showToast("Couldn't save. Your entry is still here.", 'error');
          return;
        }

        const imagesToAttach = [...pendingImages];
        let attachmentsFailed = false;
        if (result.transactionId && imagesToAttach.length) {
          try {
            await addAttachments(
              db,
              result.transactionId,
              imagesToAttach.map((localPath) => ({ localPath }))
            );
          } catch (attachError) {
            console.error('Add attachments failed:', attachError);
            attachmentsFailed = true;
          }
        }

        const attachmentMessage = 'Saved, but receipts could not be attached.';
        if (attachmentsFailed) {
          if (closingAfter) {
            showRootToast(attachmentMessage, 'error');
            await Promise.all(imagesToAttach.map((p) => deleteLocalImage(p)));
          } else {
            showToast(attachmentMessage, 'error');
            await Promise.all(imagesToAttach.map((p) => deleteLocalImage(p)));
          }
        } else {
          showRootToast('Saved', 'success');
        }
        bumpData();
        if (accountId) {
          getAccountBalance(db, accountId)
            .then(setAccountBalance)
            .catch(() => setAccountBalance(null));
        }

        const finishSuccess = (keepCategoryPick: boolean) => {
          setValue('amount', '');
          setValue('title', '');
          setValue('note', '');
          setValue('tags', '');
          setPendingImages([]);
          setAmountTouched(false);
          setSaveAttempted(false);
          setKeypadVisible(true);
          if (!keepCategoryPick) {
            userPickedCategoryRef.current = false;
          }
        };

        if (closingAfter) {
          finishSuccess(false);
          onSaved();
          onClose();
          return;
        }

        finishSuccess(true);
        resetDirtyBaseline();
        const refreshedLast = await getLastEntry(db, mode);
        setLastEntry(refreshedLast);
      } catch (e) {
        console.error('Add transaction failed:', e);
        showToast("Couldn't save. Your entry is still here.", 'error');
      } finally {
        setSaving(false);
        setActiveSaveMode(null);
        savingRef.current = false;
      }
    },
    [
      accounts,
      categories,
      currency,
      accountId,
      pendingImages,
      continueWithoutCategory,
      mode,
      setError,
      focusField,
      showToast,
      showRootToast,
      bumpData,
      onSaved,
      onClose,
      setValue,
      resetDirtyBaseline,
    ]
  );

  const runSave = (saveMode: QuickAddSaveMode) => {
    setSaveAttempted(true);
    handleSubmit((values) => performSave(values, saveMode), onInvalid)();
  };

  const saveDisabled =
    saveAvailability.disabled ||
    saving ||
    receiptScan.scanning ||
    !contextReady ||
    !amountText ||
    amountMinor === null ||
    amountMinor <= 0 ||
    (mode !== 'transfer' &&
      categories.length > 0 &&
      !categoryId &&
      !continueWithoutCategory);

  const repeatLastLabel = useMemo(() => {
    if (!lastEntry) return null;
    const amt = formatMoney(
      Math.abs(lastEntry.amountMinor),
      lastEntry.currencyCode
    );
    const title = lastEntry.title.trim() || 'Entry';
    return `Repeat last · ${title} ${amt}`;
  }, [lastEntry]);

  const onRepeatLast = () => {
    if (!lastEntry) return;
    setAmountTouched(true);
    setValue(
      'amount',
      formatMinorToDecimal(
        Math.abs(lastEntry.amountMinor),
        lastEntry.currencyCode
      )
    );
    if (accounts.some((a) => a.id === lastEntry.accountId)) {
      userPickedAccountRef.current = true;
      setValue('accountId', lastEntry.accountId);
    }
    if (
      lastEntry.toAccountId &&
      accounts.some((a) => a.id === lastEntry.toAccountId)
    ) {
      setValue('toAccountId', lastEntry.toAccountId);
    }
    if (lastEntry.categoryId && mode !== 'transfer') {
      void selectCategory(lastEntry.categoryId);
    }
    setValue('title', lastEntry.title);
    setKeypadVisible(true);
    Keyboard.dismiss();
  };

  const segmentedOptions = [
    {
      value: 'expense',
      label: 'Expense',
      icon: 'arrow-down-circle-outline' as const,
    },
    {
      value: 'income',
      label: 'Income',
      icon: 'arrow-up-circle-outline' as const,
    },
    {
      value: 'transfer',
      label: 'Transfer',
      icon: 'swap-horizontal-outline' as const,
    },
  ];

  const showEmptyNoAccounts =
    saveAvailability.disabled && saveAvailability.reason === 'no_accounts';
  const showEmptyTransfer =
    mode === 'transfer' && accounts.length > 0 && accounts.length < 2;

  return (
    <View
      className={`flex-1 ${
        colorScheme === 'dark' ? 'bg-surface-dark' : 'bg-surface'
      }`}
      style={{
        paddingHorizontal: layout.gutter,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 8,
      }}
    >
      <View className='mb-3 min-h-[48px] flex-row items-center justify-between'>
        <IconButton
          name='close-outline'
          onPress={requestClose}
          accessibilityLabel='Close'
        />
        <AppText size='lg' weight='bold'>
          Add
        </AppText>
        {receiptScan.showScanButton ? (
          <Pressable
            onPress={() => void receiptScan.onScanPress()}
            disabled={receiptScan.scanning}
            accessibilityRole='button'
            accessibilityLabel='Scan a receipt'
            accessibilityHint={
              receiptScan.consentEnabled
                ? 'Fills amount, date, merchant and category from a photo. Sends the photo to an AI service.'
                : 'Asks before turning on receipt scanning.'
            }
            accessibilityState={{ disabled: receiptScan.scanning }}
            className='min-h-[44px] min-w-[44px] items-center justify-center'
          >
            <Button
              label='Scan'
              variant='ghost'
              icon='scan-outline'
              disabled={receiptScan.scanning}
            />
          </Pressable>
        ) : (
          <View style={{ width: scale(44) }} />
        )}
      </View>

      {showEmptyNoAccounts ? (
        <View className='flex-1 justify-center gap-4'>
          <EmptyState title='Add an account to start' />
          <Button
            label='Add account'
            onPress={() => {
              onClose();
              router.push('/(tabs)/accounts' as Href);
            }}
          />
        </View>
      ) : (
        <>
          <View className='mb-3'>
            <SegmentedControl
              options={segmentedOptions}
              value={mode}
              onChange={(v) => requestModeChange(v as FormValues['mode'])}
            />
          </View>

          {showEmptyTransfer ? (
            <View className='flex-1 justify-center gap-4'>
              <EmptyState title='You need two accounts to transfer' />
              <Button
                label='Add account'
                onPress={() => {
                  onClose();
                  router.push('/(tabs)/accounts' as Href);
                }}
              />
            </View>
          ) : (
            <>
              <View className='mb-2 flex-row items-start gap-3'>
                <Pressable
                  onPress={() => setAccountPickerOpen(true)}
                  className='rounded-full px-3 py-2'
                  style={{
                    backgroundColor: c.surfaceHigh,
                    minHeight: Math.max(44, scale(44)),
                    justifyContent: 'center',
                  }}
                  accessibilityRole='button'
                  accessibilityLabel={`Currency ${currency}, from ${account?.name ?? 'account'}. Double tap to change account`}
                >
                  <AppText size='sm' weight='semibold' numeric>
                    {currency}
                  </AppText>
                </Pressable>
                <View className='flex-1'>
                  <AmountDisplay
                    amountText={amountText}
                    currencyCode={currency}
                    locale={locale}
                    aiFilledFromScan={aiFilled.has('amount')}
                    badge={
                      aiFilled.has('amount') ? <AiFilledBadge /> : undefined
                    }
                    onPress={() => {
                      setKeypadVisible(true);
                      Keyboard.dismiss();
                    }}
                    errorMessage={
                      errors.amount?.message ||
                      (amountHelper ? amountHelper : undefined)
                    }
                  />
                </View>
              </View>

              {currencyMismatch ? (
                <View className='mb-2 gap-2'>
                  <View className='flex-row items-start gap-2'>
                    <Ionicons
                      name='warning-outline'
                      size={scale(18)}
                      color={c.warning}
                    />
                    <AppText size='sm' style={{ color: c.warning, flex: 1 }}>
                      This receipt is in {currencyMismatch.receiptCurrency}.{' '}
                      {currencyMismatch.accountName} uses{' '}
                      {currencyMismatch.accountCurrency}, so the amount
                      wasn&apos;t filled.
                    </AppText>
                  </View>
                  {currencyMismatch.alternateAccount ? (
                    <Chip
                      label={`Use ${currencyMismatch.alternateAccount.name} · ${currencyMismatch.alternateAccount.currencyCode}`}
                      onPress={() => {
                        const alt = currencyMismatch.alternateAccount;
                        if (!alt) return;
                        userPickedAccountRef.current = true;
                        setValue('accountId', alt.id);
                        const filled = fillAmountAfterAccountSwitch(
                          currencyMismatch.scannedAmount,
                          alt.currencyCode
                        );
                        if (filled) {
                          setValue('amount', filled);
                          setAiFilled((prev) => new Set(prev).add('amount'));
                        }
                        setCurrencyMismatch(null);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}

              <ReceiptScanBanner
                model={receiptScan.errorModel}
                successFilled={receiptScan.successBanner?.filled}
                successNotes={receiptScan.successBanner?.notes}
                onAction={(action) => void receiptScan.onBannerAction(action)}
                onCloseSuccess={() => receiptScan.setSuccessBanner(null)}
              />

              <View className='relative flex-1'>
                <ReceiptScanPanel
                  visible={receiptScan.scanning}
                  receiptUri={receiptScan.panelThumb}
                  phase={receiptScan.scanPhase}
                  onCancel={() => void receiptScan.cancelScan()}
                />
                <ScrollView
                  ref={scrollRef}
                  className='flex-1'
                  keyboardShouldPersistTaps='handled'
                  keyboardDismissMode='on-drag'
                  contentContainerStyle={{ gap: 14, paddingBottom: 12 }}
                >
                  {repeatLastLabel ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <Chip
                        label={repeatLastLabel}
                        icon='repeat-outline'
                        onPress={onRepeatLast}
                      />
                    </ScrollView>
                  ) : null}

                  {mode !== 'transfer' ? (
                    <View className='gap-2'>
                      <AppText size='sm' muted weight='medium'>
                        Category
                      </AppText>
                      {contextError ? (
                        <View
                          className='gap-2 rounded-2xl p-3'
                          style={{ backgroundColor: c.expenseSoft }}
                        >
                          <AppText size='sm'>
                            Couldn&apos;t load your categories.
                          </AppText>
                          <View className='flex-row gap-2'>
                            <Button
                              label='Try again'
                              variant='secondary'
                              onPress={() => void loadContext('refresh')}
                            />
                            <Button
                              label='Continue without category'
                              variant='ghost'
                              onPress={() => {
                                setContinueWithoutCategory(true);
                                setContextReady(true);
                                setContextError(false);
                              }}
                            />
                          </View>
                        </View>
                      ) : contextLoading ? (
                        <View className='flex-row gap-2'>
                          {(['a', 'b', 'c', 'd'] as const).map((id) => (
                            <Skeleton
                              key={`chip-skel-${id}`}
                              width={88}
                              height={44}
                            />
                          ))}
                        </View>
                      ) : categories.length === 0 ? (
                        <View className='gap-2'>
                          <AppText size='sm' muted>
                            No categories yet
                          </AppText>
                          <Button
                            label='Add category'
                            variant='secondary'
                            onPress={() => {
                              onClose();
                              router.push('/categories' as Href);
                            }}
                          />
                        </View>
                      ) : (
                        <ScrollView
                          ref={categoryScrollRef}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          <View className='flex-row gap-2'>
                            {orderedCategories.map((cat) => {
                              const selected = categoryId === cat.id;
                              return (
                                <Pressable
                                  key={cat.id}
                                  onPress={() => void selectCategory(cat.id)}
                                  className='flex-row items-center gap-2 rounded-full px-3'
                                  style={{
                                    minHeight: Math.max(44, scale(44)),
                                    backgroundColor: selected
                                      ? c.accentSoft
                                      : c.surfaceHigh,
                                    borderWidth: selected ? 1 : 0,
                                    borderColor: selected
                                      ? c.accent
                                      : 'transparent',
                                  }}
                                  accessibilityRole='button'
                                  accessibilityState={{ selected }}
                                  accessibilityLabel={
                                    selected && aiFilled.has('categoryId')
                                      ? `${cat.name}, suggested by AI, selected`
                                      : cat.name
                                  }
                                >
                                  <CategoryGlyph
                                    iconKey={cat.iconKey}
                                    color={cat.color}
                                    size={28}
                                  />
                                  <AppText size='sm' weight='medium'>
                                    {cat.name}
                                  </AppText>
                                  {selected && aiFilled.has('categoryId') ? (
                                    <AiFilledBadge />
                                  ) : null}
                                  {selected ? (
                                    <Ionicons
                                      name='checkmark'
                                      size={scale(16)}
                                      color={c.accent}
                                    />
                                  ) : null}
                                </Pressable>
                              );
                            })}
                            <Pressable
                              onPress={() => setAllCategoriesOpen(true)}
                              className='items-center justify-center rounded-full px-4'
                              style={{
                                minHeight: Math.max(44, scale(44)),
                                backgroundColor: c.surfaceHigh,
                              }}
                              accessibilityRole='button'
                              accessibilityLabel='All categories'
                            >
                              <AppText size='sm' weight='medium'>
                                All categories
                              </AppText>
                            </Pressable>
                          </View>
                        </ScrollView>
                      )}
                    </View>
                  ) : null}

                  {mode === 'transfer' ? (
                    <View className='gap-3'>
                      <Controller
                        control={control}
                        name='accountId'
                        render={({ field: { value, onChange } }) => (
                          <Select
                            label='From account'
                            value={value}
                            onChange={(v) => {
                              userPickedAccountRef.current = true;
                              onChange(v);
                            }}
                            options={accounts.map((a) => ({
                              label: `${a.name} · ${a.currencyCode}`,
                              value: a.id,
                            }))}
                            error={errors.accountId?.message}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name='toAccountId'
                        render={({ field: { value, onChange } }) => (
                          <Select
                            label='To account'
                            value={value}
                            onChange={(v) => {
                              userPickedToAccountRef.current = true;
                              onChange(v);
                            }}
                            options={accounts
                              .filter((a) => a.id !== accountId)
                              .map((a) => ({
                                label: `${a.name} · ${a.currencyCode}`,
                                value: a.id,
                              }))}
                            placeholder='Select destination'
                            error={errors.toAccountId?.message}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name='date'
                        render={({ field: { value, onChange } }) => (
                          <Field
                            label='Date'
                            value={value}
                            onChangeText={onChange}
                            placeholder='YYYY-MM-DD'
                            error={errors.date?.message}
                            onFocus={() => setKeypadVisible(false)}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name='title'
                        render={({ field: { value, onChange, ref } }) => (
                          <Field
                            ref={ref}
                            label='Title (optional)'
                            value={value}
                            onChangeText={onChange}
                            placeholder='Transfer'
                            error={errors.title?.message}
                            onFocus={() => setKeypadVisible(false)}
                          />
                        )}
                      />
                      <Field
                        label='Note'
                        value={watch('note') ?? ''}
                        onChangeText={(t) => setValue('note', t)}
                        placeholder='Optional note'
                        multiline
                        onFocus={() => setKeypadVisible(false)}
                      />
                    </View>
                  ) : (
                    <SurfaceCard padded={false}>
                      <ListRow
                        title={mode === 'income' ? 'Deposit to' : 'Paid from'}
                        subtitle={
                          account
                            ? `${account.name} · ${account.currencyCode}${
                                accountBalance != null
                                  ? ` · ${formatMoney(accountBalance, account.currencyCode)}`
                                  : ''
                              }`
                            : undefined
                        }
                        onPress={() => setAccountPickerOpen(true)}
                        right={
                          <Ionicons
                            name='chevron-forward'
                            size={scale(18)}
                            color={c.inkMuted}
                          />
                        }
                      />
                      <ListRow
                        title='Date'
                        subtitle={formatQuickAddDateLabel(
                          dateValue,
                          new Date()
                        )}
                        onPress={() => {
                          clearAiField('date');
                          setDatePickerOpen(true);
                        }}
                        right={
                          <Ionicons
                            name='chevron-forward'
                            size={scale(18)}
                            color={c.inkMuted}
                          />
                        }
                      />
                      <View className='px-4 py-2'>
                        <Controller
                          control={control}
                          name='title'
                          render={({ field: { value, onChange, ref } }) => (
                            <Field
                              ref={ref}
                              value={value}
                              onChangeText={(t) => {
                                clearAiField('title');
                                onChange(t);
                              }}
                              placeholder='Where or what? (optional)'
                              error={errors.title?.message}
                              onFocus={() => setKeypadVisible(false)}
                            />
                          )}
                        />
                        {aiFilled.has('title') ? (
                          <View className='mt-1 self-start'>
                            <AiFilledBadge />
                          </View>
                        ) : null}
                        {lastCategoryTitle ? (
                          <Pressable
                            onPress={() => setValue('title', lastCategoryTitle)}
                            className='mt-2 self-start rounded-full px-3 py-2'
                            style={{
                              backgroundColor: c.surfaceHigh,
                              minHeight: Math.max(44, scale(36)),
                            }}
                            accessibilityRole='button'
                            accessibilityLabel={`Last time: ${lastCategoryTitle}`}
                          >
                            <AppText size='sm' muted>
                              Last time: {lastCategoryTitle}
                            </AppText>
                          </Pressable>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => setMoreDetailsOpen((o) => !o)}
                        className='flex-row items-center justify-between px-4 py-3.5'
                        style={{ borderTopWidth: 1, borderTopColor: c.line }}
                        accessibilityRole='button'
                        accessibilityLabel='More details'
                      >
                        <AppText size='base' weight='medium'>
                          More details
                        </AppText>
                        <Ionicons
                          name={moreDetailsOpen ? 'chevron-up' : 'chevron-down'}
                          size={scale(18)}
                          color={c.inkMuted}
                        />
                      </Pressable>
                      {moreDetailsOpen ? (
                        <View className='gap-3 px-4 pb-4'>
                          <Controller
                            control={control}
                            name='note'
                            render={({ field: { value, onChange, ref } }) => (
                              <Field
                                ref={ref}
                                label='Note'
                                value={value}
                                onChangeText={onChange}
                                placeholder='Optional note'
                                multiline
                                error={errors.note?.message}
                                onFocus={() => setKeypadVisible(false)}
                              />
                            )}
                          />
                          <Controller
                            control={control}
                            name='tags'
                            render={({ field: { value, onChange, ref } }) => (
                              <Field
                                ref={ref}
                                label='Tags'
                                value={value}
                                onChangeText={onChange}
                                placeholder='e.g. trip, work'
                                error={errors.tags?.message}
                                onFocus={() => setKeypadVisible(false)}
                              />
                            )}
                          />
                          <View className='gap-2'>
                            <AppText size='sm' muted weight='medium'>
                              Receipts
                            </AppText>
                            <View className='flex-row gap-2'>
                              <View className='flex-1'>
                                <Button
                                  label='Gallery'
                                  variant='secondary'
                                  icon='images-outline'
                                  onPress={onPickReceipts}
                                />
                              </View>
                              <View className='flex-1'>
                                <Button
                                  label='Camera'
                                  variant='secondary'
                                  icon='camera-outline'
                                  onPress={onTakeReceipt}
                                />
                              </View>
                            </View>
                            {pendingImages.length ? (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                              >
                                <View className='flex-row gap-2'>
                                  {pendingImages.map((path) => (
                                    <ReceiptThumb
                                      key={path}
                                      path={path}
                                      onPress={() =>
                                        void removePendingReceipt(path)
                                      }
                                    />
                                  ))}
                                </View>
                              </ScrollView>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                    </SurfaceCard>
                  )}
                </ScrollView>
              </View>

              <Controller
                control={control}
                name='amount'
                render={({ field: { value, onChange } }) => (
                  <Keypad
                    visible={keypadVisible && !receiptScan.scanning}
                    currencyCode={currency}
                    locale={locale}
                    amountText={value}
                    onAmountTextChange={(text) => {
                      setAmountBlocked(false);
                      setAmountTouched(true);
                      clearAiField('amount');
                      onChange(text);
                    }}
                    onBlockedPress={() => setAmountBlocked(true)}
                  />
                )}
              />

              <View className='mt-2 flex-row items-center gap-2'>
                <Button
                  label='Save & new'
                  variant='secondary'
                  onPress={() => runSave('saveNew')}
                  disabled={saveDisabled}
                  loading={saving && activeSaveMode === 'saveNew'}
                  className='w-[110px]'
                />
                <View className='flex-1'>
                  <Button
                    label='Save'
                    prominent
                    onPress={() => runSave('save')}
                    disabled={saveDisabled}
                    loading={saving && activeSaveMode === 'save'}
                  />
                </View>
              </View>
            </>
          )}
        </>
      )}

      <QuickAddDatePicker
        visible={datePickerOpen}
        value={dateValue}
        now={new Date()}
        onClose={() => setDatePickerOpen(false)}
        onChange={(d) => {
          clearAiField('date');
          setValue('date', d);
        }}
      />

      <ReceiptScanConsentSheet
        visible={receiptScan.consentOpen}
        onTurnOn={() => void receiptScan.onConsentTurnOn()}
        onNotNow={() => receiptScan.setConsentOpen(false)}
      />
      <ReceiptScanSourceSheet
        visible={receiptScan.sourceOpen}
        onTakePhoto={() => void receiptScan.pickFromCamera()}
        onChooseLibrary={() => void receiptScan.pickFromLibrary()}
        onCancel={() => receiptScan.setSourceOpen(false)}
      />

      <Modal visible={accountPickerOpen} transparent animationType='fade'>
        <Pressable
          className='flex-1 justify-end bg-black/50'
          onPress={() => setAccountPickerOpen(false)}
        >
          <Pressable
            className='max-h-[70%] rounded-t-3xl px-4 pb-8 pt-3'
            style={{ backgroundColor: c.surfaceOverlay }}
            onPress={(e) => e.stopPropagation()}
          >
            <AppText size='lg' weight='semibold' className='mb-2'>
              Account
            </AppText>
            <FlatList
              data={accounts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = item.id === accountId;
                return (
                  <Pressable
                    onPress={() => {
                      userPickedAccountRef.current = true;
                      setValue('accountId', item.id);
                      setAccountPickerOpen(false);
                    }}
                    accessibilityRole='button'
                    accessibilityState={{ selected }}
                    className='flex-row items-center justify-between py-3.5'
                    style={{ minHeight: Math.max(44, scale(44)) }}
                  >
                    <AppText>
                      {item.name} · {item.currencyCode}
                    </AppText>
                    {selected ? (
                      <Ionicons
                        name='checkmark'
                        size={scale(20)}
                        color={c.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={allCategoriesOpen} transparent animationType='fade'>
        <Pressable
          className='flex-1 justify-end bg-black/50'
          onPress={() => setAllCategoriesOpen(false)}
        >
          <Pressable
            className='max-h-[70%] rounded-t-3xl px-4 pb-8 pt-3'
            style={{ backgroundColor: c.surfaceOverlay }}
            onPress={(e) => e.stopPropagation()}
          >
            <AppText size='lg' weight='semibold' className='mb-2'>
              Categories
            </AppText>
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = item.id === categoryId;
                return (
                  <Pressable
                    onPress={() => {
                      void selectCategory(item.id);
                      setAllCategoriesOpen(false);
                    }}
                    accessibilityRole='button'
                    accessibilityState={{ selected }}
                    className='flex-row items-center gap-3 py-3.5'
                    style={{ minHeight: Math.max(44, scale(44)) }}
                  >
                    <CategoryGlyph
                      iconKey={item.iconKey}
                      color={item.color}
                      size={32}
                    />
                    <AppText className='flex-1'>{item.name}</AppText>
                    {selected ? (
                      <Ionicons
                        name='checkmark'
                        size={scale(20)}
                        color={c.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={transferReceiptsOpen}
        title='Remove receipts?'
        message={`Remove ${pendingImages.length} receipt${
          pendingImages.length === 1 ? '' : 's'
        }? Transfers can't have receipts.`}
        confirmLabel='Remove'
        onConfirm={() => void confirmTransferWithoutReceipts()}
        onCancel={() => {
          setTransferReceiptsOpen(false);
          setPendingMode(null);
        }}
      />

      <ConfirmDialog
        visible={discardOpen}
        title='Discard this entry?'
        message='Your changes will be lost.'
        confirmLabel='Discard'
        onConfirm={onConfirmDiscard}
        onCancel={() => setDiscardOpen(false)}
      />
    </View>
  );
}

export function AddTransactionSheet({ visible, onClose, onSaved }: Props) {
  const { showToast: showRootToast } = useToast();
  const requestCloseRef = useRef(() => {
    onClose();
  });

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={() => requestCloseRef.current()}
    >
      <ModalToastProvider>
        {visible ? (
          <AddTransactionSheetBody
            visible={visible}
            onClose={onClose}
            onSaved={onSaved}
            showRootToast={showRootToast}
            bindRequestClose={(handler) => {
              requestCloseRef.current = handler;
            }}
          />
        ) : null}
      </ModalToastProvider>
    </Modal>
  );
}
