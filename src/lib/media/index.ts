import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { createId } from '@/lib/id';

const ROOT = `${FileSystem.documentDirectory ?? ''}fintrack-media`;

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

export async function pickImage(options?: {
  allowsMultiple?: boolean;
}): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: options?.allowsMultiple ?? false,
    selectionLimit: options?.allowsMultiple ? 6 : 1,
  });
  if (result.canceled) return [];
  return result.assets;
}

export async function takePhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required');
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.85,
  });
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

/** Copy a picked URI into durable app documents storage. */
export async function persistImage(
  sourceUri: string,
  kind: 'profile' | 'receipt'
): Promise<string> {
  const dir = `${ROOT}/${kind}`;
  await ensureDir(dir);
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${dir}/${createId()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export type ResolvedImage =
  | { status: 'ok'; uri: string }
  | { status: 'missing'; path: string };

export async function resolveLocalImage(
  path: string | null | undefined
): Promise<ResolvedImage | null> {
  if (!path) return null;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return { status: 'missing', path };
  return { status: 'ok', uri: path };
}

export async function deleteLocalImage(path: string | null | undefined) {
  if (!path) return;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}
