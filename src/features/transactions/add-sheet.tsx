import { zodResolver } from '@hookform/resolvers/zod';
import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, type FieldErrors, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ReceiptThumb } from '@/components/media/images';
import {
  AppText,
  Button,
  CategoryGlyph,
  Chip,
  Field,
  IconButton,
  Select,
  useThemeColors,
} from '@/components/ui/primitives';
import { ModalToastProvider, useToast } from '@/components/ui/toast';
import { db } from '@/lib/db/client';
import {
  addAttachments,
  createTransaction,
  createTransfer,
  listCategories,
} from '@/lib/db/queries';
import type { Category } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { persistImage, pickImage, takePhoto } from '@/lib/media';
import { fromMinorUnits, parseAmountToMinor } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

import {
  type AddTransactionField,
  firstAddTransactionFieldWithError,
  getAddTransactionSaveAvailability,
  submitAddTransaction,
} from './submit-add-transaction';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const formSchema = z.object({
  mode: z.enum(['expense', 'income', 'transfer']),
  amount: z.string().min(1, 'Enter an amount'),
  title: z.string(),
  note: z.string().optional(),
  tags: z.string().optional(),
  accountId: z.string().min(1, 'Select an account'),
  toAccountId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function AddTransactionSheetBody({ visible, onClose, onSaved }: Props) {
  const { accounts, settings, colorScheme, bumpData, ready } = useApp();
  const { showToast } = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Partial<Record<AddTransactionField, number>>>({});

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: 'expense',
      amount: '',
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
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currencyCode ?? settings?.defaultCurrency ?? 'USD';

  const saveAvailability = getAddTransactionSaveAvailability(
    Boolean(ready),
    accounts.length
  );

  useEffect(() => {
    if (!visible || !ready) return;
    const nextId = settings?.activeAccountId || accounts[0]?.id || '';
    if (nextId) {
      setValue('accountId', nextId);
    }
    listCategories(
      db,
      mode === 'transfer' ? undefined : mode === 'income' ? 'income' : 'expense'
    ).then((rows) => {
      setCategories(rows);
      setValue('categoryId', rows[0]?.id ?? null);
    });
  }, [visible, ready, mode, settings?.activeAccountId, accounts, setValue]);

  const registerFieldOffset = useCallback(
    (field: AddTransactionField, y: number) => {
      fieldOffsets.current[field] = y;
    },
    []
  );

  const focusField = useCallback(
    (field: AddTransactionField) => {
      setFocus(field);
      const y = fieldOffsets.current[field];
      if (y != null) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, y - 12),
          animated: true,
        });
      }
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

  const save = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const result = await submitAddTransaction(values, {
        accounts,
        currency,
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
                  amount: fromMinorUnits(input.amountMinor, from.currencyCode),
                }),
            fromCurrency: from.currencyCode,
            toCurrency: to.currencyCode,
            title: input.title,
            note: input.note,
          });
        },
      });

      if (!result.ok) {
        if (result.error.type === 'field') {
          setError(result.error.field, { message: result.error.message });
          focusField(result.error.field);
          return;
        }
        console.error('Add transaction failed:', result.error.message);
        showToast(result.error.message, 'error');
        return;
      }

      if (result.transactionId && pendingImages.length) {
        await addAttachments(
          db,
          result.transactionId,
          pendingImages.map((localPath) => ({ localPath }))
        );
      }

      reset({
        mode: 'expense',
        amount: '',
        title: '',
        note: '',
        tags: '',
        accountId: settings?.activeAccountId || accounts[0]?.id || '',
        toAccountId: '',
        categoryId: null,
      });
      setPendingImages([]);
      showToast('Saved', 'success');
      bumpData();
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Add transaction failed:', message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, onInvalid);

  const saveDisabled = saveAvailability.disabled || saving;

  return (
    <View
      className={`flex-1 ${
        colorScheme === 'dark' ? 'bg-surface-dark' : 'bg-surface'
      }`}
      style={{
        paddingHorizontal: layout.gutter,
        paddingTop: insets.top + 8,
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View className='mb-4 flex-row items-center justify-between'>
          <AppText size='xl' weight='bold'>
            Add
          </AppText>
          <IconButton name='close-outline' onPress={onClose} />
        </View>

        <View className='mb-4 flex-row gap-2'>
          {(['expense', 'income', 'transfer'] as const).map((m) => (
            <View key={m} className='flex-1'>
              <Chip
                label={m[0].toUpperCase() + m.slice(1)}
                active={mode === m}
                onPress={() => setValue('mode', m)}
              />
            </View>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode='on-drag'
          contentContainerStyle={{ gap: 14, paddingBottom: 80 }}
        >
          <View
            onLayout={(e) =>
              registerFieldOffset('amount', e.nativeEvent.layout.y)
            }
          >
            <Controller
              control={control}
              name='amount'
              render={({ field: { value, onChange } }) => (
                <Field
                  label='Amount'
                  value={value}
                  onChangeText={onChange}
                  keyboardType='decimal-pad'
                  placeholder='0.00'
                  error={errors.amount?.message}
                />
              )}
            />
          </View>
          <View
            onLayout={(e) =>
              registerFieldOffset('title', e.nativeEvent.layout.y)
            }
          >
            <Controller
              control={control}
              name='title'
              render={({ field: { value, onChange } }) => (
                <Field
                  label='Title'
                  value={value}
                  onChangeText={onChange}
                  placeholder={
                    mode === 'transfer' ? 'Transfer' : 'Coffee, AWS invoice…'
                  }
                  error={errors.title?.message}
                />
              )}
            />
          </View>

          <View
            onLayout={(e) =>
              registerFieldOffset('accountId', e.nativeEvent.layout.y)
            }
          >
            <Controller
              control={control}
              name='accountId'
              render={({ field: { value, onChange } }) => (
                <Select
                  label='Account'
                  value={value}
                  onChange={onChange}
                  options={accounts.map((a) => ({
                    label: `${a.name} · ${a.currencyCode}`,
                    value: a.id,
                  }))}
                  error={errors.accountId?.message}
                />
              )}
            />
          </View>

          {mode === 'transfer' ? (
            <View
              onLayout={(e) =>
                registerFieldOffset('toAccountId', e.nativeEvent.layout.y)
              }
            >
              <Controller
                control={control}
                name='toAccountId'
                render={({ field: { value, onChange } }) => (
                  <Select
                    label='To account'
                    value={value}
                    onChange={onChange}
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
            </View>
          ) : (
            <>
              <AppText size='sm' muted weight='medium'>
                Category
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className='flex-row gap-2'>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setValue('categoryId', cat.id)}
                      className={`items-center gap-1 rounded-2xl px-3 py-2 ${
                        categoryId === cat.id
                          ? 'bg-accent/20'
                          : colorScheme === 'dark'
                            ? 'bg-surface-dark-raised'
                            : 'bg-surface-raised'
                      }`}
                    >
                      <CategoryGlyph
                        iconKey={cat.iconKey}
                        color={cat.color}
                        size={32}
                      />
                      <AppText size='xs'>{cat.name}</AppText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          <Controller
            control={control}
            name='note'
            render={({ field: { value, onChange } }) => (
              <Field
                label='Note'
                value={value}
                onChangeText={onChange}
                placeholder='Optional note'
                multiline
              />
            )}
          />
          {mode !== 'transfer' ? (
            <Controller
              control={control}
              name='tags'
              render={({ field: { value, onChange } }) => (
                <Field
                  label='Tags'
                  value={value}
                  onChangeText={onChange}
                  placeholder='saas, aws (comma separated)'
                />
              )}
            />
          ) : null}

          {mode !== 'transfer' ? (
            <View className='gap-2'>
              <AppText size='sm' muted weight='medium'>
                Receipts / bills
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
              <Button
                label='Scan receipt (OCR soon)'
                variant='ghost'
                icon='scan-outline'
                onPress={() =>
                  showToast(
                    'On-device OCR is planned — attach a photo for now',
                    'default'
                  )
                }
              />
              {pendingImages.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className='flex-row gap-2'>
                    {pendingImages.map((path) => (
                      <ReceiptThumb
                        key={path}
                        path={path}
                        onPress={() =>
                          setPendingImages((prev) =>
                            prev.filter((p) => p !== path)
                          )
                        }
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <AppText size='xs' muted>
                  Multiple images per expense — stored on this device
                </AppText>
              )}
            </View>
          ) : null}

          <AppText size='xs' muted>
            Currency: {currency}
          </AppText>

          {saveAvailability.disabled &&
          saveAvailability.reason === 'no_accounts' ? (
            <View className='gap-1'>
              <AppText size='sm' style={{ color: c.expense }}>
                {saveAvailability.message}
              </AppText>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/(tabs)/accounts' as Href);
                }}
              >
                <AppText size='sm' style={{ color: c.accent }}>
                  Add an account
                </AppText>
              </Pressable>
            </View>
          ) : null}

          {saveAvailability.disabled &&
          saveAvailability.reason === 'loading' ? (
            <AppText size='sm' muted>
              Loading accounts…
            </AppText>
          ) : null}

          <Button
            label='Save'
            onPress={save}
            loading={saving}
            disabled={saveDisabled}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AddTransactionSheet({ visible, onClose, onSaved }: Props) {
  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
    >
      <ModalToastProvider>
        <AddTransactionSheetBody
          visible={visible}
          onClose={onClose}
          onSaved={onSaved}
        />
      </ModalToastProvider>
    </Modal>
  );
}
