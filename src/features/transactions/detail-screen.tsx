import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { ReceiptThumb } from '@/components/media/images';
import {
  AppText,
  Button,
  CategoryGlyph,
  ConfirmDialog,
  Field,
  FormScroll,
  GoBack,
  IconButton,
  Screen,
  useThemeColors,
} from '@/components/ui/primitives';
import { useReloadOnFocus } from '@/hooks/use-reload-on-focus';
import { db } from '@/lib/db/client';
import {
  addAttachments,
  getTransactionById,
  listAttachments,
  softDeleteAttachment,
  softDeleteTransaction,
  updateTransaction,
} from '@/lib/db/queries';
import type { TransactionAttachment } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import {
  deleteLocalImage,
  persistImage,
  pickImage,
  takePhoto,
} from '@/lib/media';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh, bumpData } = useApp();
  const c = useThemeColors();
  const [row, setRow] = useState<Awaited<
    ReturnType<typeof getTransactionById>
  > | null>(null);
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await getTransactionById(db, id);
    setRow(data);
    setTitle(data?.transaction.title ?? '');
    setNote(data?.transaction.note ?? '');
    if (data) {
      setAttachments(await listAttachments(db, data.transaction.id));
    }
  }, [id]);

  useReloadOnFocus(load);

  const addPhotos = async (fromCamera: boolean) => {
    if (!row) return;
    try {
      const assets = fromCamera
        ? [await takePhoto()].filter(Boolean)
        : await pickImage({ allowsMultiple: true });
      const paths: string[] = [];
      for (const asset of assets) {
        if (!asset) continue;
        paths.push(await persistImage(asset.uri, 'receipt'));
      }
      if (!paths.length) return;
      await addAttachments(
        db,
        row.transaction.id,
        paths.map((localPath) => ({ localPath }))
      );
      await load();
    } catch (e) {
      Alert.alert('Could not add photo', String(e));
    }
  };

  const removeAttachment = async (att: TransactionAttachment) => {
    await softDeleteAttachment(db, att.id);
    await deleteLocalImage(att.localPath);
    await load();
  };

  if (!row) {
    return (
      <Screen>
        <AppText className='p-5'>Transaction not found</AppText>
      </Screen>
    );
  }

  const t = row.transaction;

  return (
    <Screen>
      <FormScroll
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
        }}
      >
        <GoBack />
        <View className='mt-2 flex-row items-start justify-between'>
          <View className='flex-1 flex-row items-center gap-3'>
            <CategoryGlyph
              iconKey={row.category?.iconKey ?? 'other'}
              color={row.category?.color ?? '#6B7280'}
              size={48}
            />
            <View className='flex-1'>
              <AppText size='sm' muted>
                {t.type} · {format(t.occurredAt, 'MMM d, yyyy')}
              </AppText>
              <AppText size='xl' weight='bold'>
                {formatMoney(
                  t.type === 'expense' ? -t.amountMinor : t.amountMinor,
                  t.currencyCode,
                  { sign: true }
                )}
              </AppText>
            </View>
          </View>
          <IconButton
            name='trash-outline'
            color={c.expense}
            onPress={() => setConfirmDelete(true)}
          />
        </View>

        <View className='mt-6 gap-3'>
          <Field label='Title' value={title} onChangeText={setTitle} />
          <Field label='Note' value={note} onChangeText={setNote} multiline />
          <AppText size='sm' muted>
            Account: {row.account.name}
          </AppText>
          {t.sourceType === 'recurring' || t.sourceType === 'subscription' ? (
            <Pressable
              onPress={() =>
                router.push(
                  t.sourceType === 'subscription'
                    ? '/planning/subscriptions'
                    : '/planning/recurring'
                )
              }
              className='flex-row items-center gap-2 self-start rounded-full px-3 py-1.5'
              style={{ backgroundColor: c.surfaceRaised }}
            >
              <AppText size='sm' weight='medium'>
                {t.sourceType === 'subscription' ? 'Subscription' : 'Recurring'}
              </AppText>
              <AppText size='sm' muted>
                · view plan
              </AppText>
            </Pressable>
          ) : null}

          {t.type !== 'transfer' ? (
            <View className='gap-2'>
              <AppText size='sm' muted weight='medium'>
                Receipts
              </AppText>
              <View className='flex-row gap-2'>
                <View className='flex-1'>
                  <Button
                    label='Gallery'
                    variant='secondary'
                    onPress={() => addPhotos(false)}
                  />
                </View>
                <View className='flex-1'>
                  <Button
                    label='Camera'
                    variant='secondary'
                    onPress={() => addPhotos(true)}
                  />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className='flex-row gap-2'>
                  {attachments.map((att) => (
                    <ReceiptThumb
                      key={att.id}
                      path={att.localPath}
                      onPress={() => removeAttachment(att)}
                    />
                  ))}
                </View>
              </ScrollView>
              {attachments.length === 0 ? (
                <AppText size='xs' muted>
                  Tap a receipt later to remove it
                </AppText>
              ) : (
                <AppText size='xs' muted>
                  Tap a thumbnail to remove
                </AppText>
              )}
            </View>
          ) : null}

          <Button
            label='Save'
            onPress={async () => {
              await updateTransaction(db, t.id, {
                title: title.trim(),
                note: note.trim() || null,
              });
              bumpData();
              await refresh();
              await load();
            }}
          />
        </View>
      </FormScroll>
      <ConfirmDialog
        visible={confirmDelete}
        title='Delete transaction?'
        message='This will soft-delete the transaction (and its transfer pair if any).'
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await softDeleteTransaction(db, t.id);
          setConfirmDelete(false);
          bumpData();
          await refresh();
          router.back();
        }}
      />
    </Screen>
  );
}
