import { View } from 'react-native';
import { AppText } from './primitives';

export function StoredOnDevice({
  lastBackupAt,
}: {
  lastBackupAt?: number | null;
}) {
  const backupText = lastBackupAt
    ? `Last backup exported: ${new Date(lastBackupAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'No backup exported yet';

  return (
    <View className='items-center gap-1 py-4'>
      <AppText size='xs' muted>
        Stored on this device
      </AppText>
      <AppText size='xs' muted>
        {backupText}
      </AppText>
    </View>
  );
}
