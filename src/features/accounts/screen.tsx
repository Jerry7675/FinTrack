import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AccountCard } from '@/components/ui/cards';
import {
  AppText,
  Button,
  ConfirmDialog,
  Field,
  FormScroll,
  IconButton,
  Screen,
  SectionHeader,
  Select,
  useThemeColors,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { db } from '@/lib/db/client';
import {
  createAccount,
  createGroup,
  softDeleteAccount,
  softDeleteGroup,
} from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import { CURRENCIES } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function AccountsScreen() {
  const { groups, accounts, refresh, bumpData, colorScheme, settings } =
    useApp();
  const { showToast } = useToast();
  const c = useThemeColors();
  const [groupName, setGroupName] = useState('');
  const [ledgerName, setLedgerName] = useState('');
  const [ledgerGroupId, setLedgerGroupId] = useState('');
  const [currency, setCurrency] = useState(settings?.defaultCurrency ?? 'USD');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateLedger, setShowCreateLedger] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'group' | 'account';
    id: string;
    name: string;
  } | null>(null);

  const currencyOptions = useMemo(
    () =>
      CURRENCIES.map((cur) => ({
        label: `${cur.code} — ${cur.name}`,
        value: cur.code,
      })),
    []
  );

  const onCreateGroup = async () => {
    if (!groupName.trim()) return;
    const id = await createGroup(db, { name: groupName.trim() });
    setGroupName('');
    setShowCreateGroup(false);
    setLedgerGroupId(id);
    bumpData();
    await refresh();
  };

  const onCreateLedger = async () => {
    const gid = ledgerGroupId || groups[0]?.id;
    if (!gid) {
      showToast('Create a group first', 'error');
      return;
    }
    if (!ledgerName.trim()) return;
    await createAccount(db, {
      groupId: gid,
      name: ledgerName.trim(),
      currencyCode: currency,
      type: 'cash',
    });
    setLedgerName('');
    setShowCreateLedger(false);
    bumpData();
    await refresh();
    showToast('Account created', 'success');
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === 'group') {
      await softDeleteGroup(db, pendingDelete.id);
    } else {
      await softDeleteAccount(db, pendingDelete.id);
    }
    setPendingDelete(null);
    bumpData();
    await refresh();
    showToast('Removed', 'success');
  };

  return (
    <Screen>
      <FormScroll
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
        }}
      >
        <AppText size='xl' weight='bold' className='mt-2'>
          Accounts
        </AppText>
        <AppText muted className='mt-1'>
          Groups hold ledgers. Only ledgers track money.
        </AppText>

        <View className='mt-4 flex-row gap-2'>
          <View className='flex-1'>
            <Button
              label='Add group'
              variant='secondary'
              onPress={() => setShowCreateGroup(true)}
            />
          </View>
          <View className='flex-1'>
            <Button
              label='Add account'
              onPress={() => setShowCreateLedger(true)}
            />
          </View>
        </View>

        {showCreateGroup ? (
          <View className='mt-4 gap-3'>
            <Field
              label='Group name'
              value={groupName}
              onChangeText={setGroupName}
              placeholder='Personal, Acme Co…'
            />
            <Button label='Create group' onPress={onCreateGroup} />
          </View>
        ) : null}

        {showCreateLedger ? (
          <View className='mt-4 gap-3'>
            <Field
              label='Account name'
              value={ledgerName}
              onChangeText={setLedgerName}
              placeholder='Cash, Checking…'
            />
            <AppText size='sm' muted>
              Group
            </AppText>
            <ScrollView horizontal>
              <View className='flex-row gap-2'>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setLedgerGroupId(g.id)}
                    className={`rounded-full px-3 py-1.5 ${
                      (ledgerGroupId || groups[0]?.id) === g.id
                        ? 'bg-accent'
                        : colorScheme === 'dark'
                          ? 'bg-surface-dark-raised'
                          : 'bg-surface-raised'
                    }`}
                  >
                    <AppText size='sm' weight='medium'>
                      {g.name}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Select
              label='Currency'
              value={currency}
              options={currencyOptions}
              onChange={setCurrency}
            />
            <Button label='Create account' onPress={onCreateLedger} />
          </View>
        ) : null}

        {groups.length === 0 ? (
          <AppText muted className='mt-10 text-center'>
            Create a group to get started
          </AppText>
        ) : (
          groups.map((g) => (
            <View key={g.id}>
              <SectionHeader
                title={g.name}
                action={
                  <IconButton
                    name='trash-outline'
                    color={c.expense}
                    onPress={() =>
                      setPendingDelete({
                        type: 'group',
                        id: g.id,
                        name: g.name,
                      })
                    }
                  />
                }
              />
              {accounts
                .filter((a) => a.groupId === g.id)
                .map((a) => (
                  <View key={a.id} className='mb-2'>
                    <AccountCard
                      name={a.name}
                      meta={`${a.currencyCode} · ${a.type}`}
                      onPress={() => router.push(`/account/${a.id}`)}
                      onLongPress={() =>
                        setPendingDelete({
                          type: 'account',
                          id: a.id,
                          name: a.name,
                        })
                      }
                    />
                    <View className='mt-1 flex-row justify-end gap-1 px-1'>
                      <IconButton
                        name='create-outline'
                        color={c.accent}
                        onPress={() => router.push(`/account/${a.id}`)}
                      />
                      <IconButton
                        name='trash-outline'
                        color={c.expense}
                        onPress={() =>
                          setPendingDelete({
                            type: 'account',
                            id: a.id,
                            name: a.name,
                          })
                        }
                      />
                    </View>
                  </View>
                ))}
              {accounts.filter((a) => a.groupId === g.id).length === 0 ? (
                <AppText size='sm' muted className='py-2'>
                  No ledgers in this group
                </AppText>
              ) : null}
            </View>
          ))
        )}
      </FormScroll>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={`Remove ${pendingDelete?.name}?`}
        message={
          pendingDelete?.type === 'group'
            ? 'This removes the group and all nested accounts. This cannot be undone from the UI.'
            : 'This removes the account and hides its transactions.'
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </Screen>
  );
}
