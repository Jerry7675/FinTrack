import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, useThemeColors } from '@/components/ui/primitives';
import { characters } from '@/constants/characters';
import { scale } from '@/lib/layout';
import { resolveLocalImage } from '@/lib/media';

export function ProfileAvatar({
  path,
  size = 48,
  onPress,
  fallback = characters.hero,
}: {
  path?: string | null;
  size?: number;
  onPress?: () => void;
  fallback?: number;
}) {
  const c = useThemeColors();
  const dim = scale(size);
  const [uri, setUri] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await resolveLocalImage(path);
      if (cancelled) return;
      if (!resolved) {
        setUri(null);
        setMissing(false);
        return;
      }
      if (resolved.status === 'missing') {
        setUri(null);
        setMissing(true);
        return;
      }
      setUri(resolved.uri);
      setMissing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Image
        source={uri ? { uri } : fallback}
        style={{
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          borderWidth: 2,
          borderColor: c.accent,
        }}
        contentFit='cover'
      />
      {missing ? (
        <AppText size='xs' muted className='mt-1 text-center'>
          Photo missing
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function ReceiptThumb({
  path,
  size = 72,
  onPress,
}: {
  path: string;
  size?: number;
  onPress?: () => void;
}) {
  const c = useThemeColors();
  const dim = scale(size);
  const [uri, setUri] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await resolveLocalImage(path);
      if (cancelled) return;
      if (!resolved || resolved.status === 'missing') {
        setUri(null);
        setMissing(true);
        return;
      }
      setUri(resolved.uri);
      setMissing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: dim,
          height: dim,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: c.surfaceSunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {uri && !missing ? (
          <Image
            source={{ uri }}
            style={{ width: dim, height: dim }}
            contentFit='cover'
          />
        ) : (
          <AppText size='xs' muted className='px-1 text-center'>
            Missing
          </AppText>
        )}
      </View>
    </Pressable>
  );
}
