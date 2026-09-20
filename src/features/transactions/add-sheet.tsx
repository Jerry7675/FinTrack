import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { z } from 'zod';

import { ReceiptThumb } from '@/components/media/images';
import {
  AppText,
  Button,
  CategoryGlyph,
  Chip,
  Field,
  Select,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
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
import { useApp } from '@/providers/app-provider';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const formSchema = z.object({
  mode: z.enum(['expense', 'income', 'transfer']),
  amount: z.string().min(1),
  title: z.string(),
  note: z.string().optional(),
  tags: z.string().optional(),
  accountId: z.string().min(1),
  toAccountId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddTransactionSheet({ visible, onClose, onSaved }: Props) {
  const { accounts, settings, colorScheme } = useApp();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);

  const { control, handleSubmit, watch, setValue, reset } = useForm<FormValues>(
    {
      resolver: zodResolver(formSchema),
      defaultValues: {
        mode: 'expense',
        amount: '',
        title: '',
        note: '',
        tags: '',
        accountId: settings?.activeAccountId || accounts[0]?.id || '',
        toAccountId: '',
        categoryId: null,
      },
    }
  );

  const mode = watch('mode');
  const accountId = watch('accountId');
  const categoryId = watch('categoryId');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const currency = account?.currencyCode ?? settings?.defaultCurrency ?? 'USD';

  useEffect(() => {
    if (!visible) return;
    setValue('accountId', settings?.activeAccountId || accounts[0]?.id || '');
    listCategories(
      db,
      mode === 'transfer' ? undefined : mode === 'income' ? 'income' : 'expense'
    ).then((rows) => {
      setCategories(rows);
      setValue('categoryId', rows[0]?.id ?? null);
    });
  }, [visible, mode, settings?.activeAccountId, accounts, setValue]);

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
    if (!account) {
      showToast('Create an account first', 'error');
      return;
    }
    const value = Number.parseFloat(values.amount);
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    if (!values.title.trim() && values.mode !== 'transfer') {
      showToast('Add a title', 'error');
      return;
    }
    setSaving(true);
    try {
      let txId: string | null = null;
      if (values.mode === 'transfer') {
        const to = accounts.find((a) => a.id === values.toAccountId);
        if (!to || to.id === account.id) {
          showToast('Pick a different destination account', 'error');
          setSaving(false);
          return;
        }
        await createTransfer(db, {
          fromAccountId: account.id,
          toAccountId: to.id,
          amount: value,
          fromCurrency: account.currencyCode,
          toCurrency: to.currencyCode,
          title: values.title.trim() || 'Transfer',
          note: values.note,
        });
      } else {
        txId = await createTransaction(db, {
          accountId: account.id,
          categoryId: values.categoryId,
          type: values.mode,
          amount: value,
          currencyCode: account.currencyCode,
          title: values.title.trim(),
          note: values.note,
          tagNames: (values.tags ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        });
        if (txId && pendingImages.length) {
          await addAttachments(
            db,
            txId,
            pendingImages.map((localPath) => ({ localPath }))
          );
        }
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
      onSaved();
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
    >
      <View
        className={`flex-1 ${
          colorScheme === 'dark' ? 'bg-surface-dark' : 'bg-surface'
        }`}
        style={{ paddingHorizontal: layout.gutter, paddingTop: 16 }}
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
            <Pressable onPress={onClose}>
              <AppText muted>Close</AppText>
            </Pressable>
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
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='on-drag'
            contentContainerStyle={{ gap: 14, paddingBottom: 80 }}
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
                />
              )}
            />
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
                />
              )}
            />

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
                />
              )}
            />

            {mode === 'transfer' ? (
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
                  />
                )}
              />
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
            <Button label='Save' onPress={save} loading={saving} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
