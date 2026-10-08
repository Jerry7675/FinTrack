import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

import { createId } from '@/lib/id';
import { runWithRelockSuppressed } from '@/lib/lock';

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
  return runWithRelockSuppressed(async () => {
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
  });
}

export async function takePhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  return runWithRelockSuppressed(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission is required');
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
    });
    if (result.canceled) return null;
    return result.assets[0] ?? null;
  });
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

const MAX_UPLOAD_BASE64_BYTES = Math.floor(1.5 * 1024 * 1024);

async function imageDimensions(
  uri: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

function base64ByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

async function encodeReceiptJpeg(
  uri: string,
  longEdge: number
): Promise<{ uri: string; base64: string }> {
  const { width, height } = await imageDimensions(uri);
  const resize =
    width >= height
      ? { resize: { width: longEdge } }
      : { resize: { height: longEdge } };
  const result = await ImageManipulator.manipulateAsync(uri, [resize], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) {
    throw new Error('Failed to encode receipt image');
  }
  return { uri: result.uri, base64: result.base64 };
}

/**
 * Resize, strip EXIF (re-encode), and write a JPEG upload copy under cache.
 */
export async function prepareReceiptForUpload(
  sourceUri: string
): Promise<{ cachePath: string; base64: string }> {
  const cacheDir = FileSystem.cacheDirectory ?? '';
  if (!cacheDir) {
    throw new Error('Cache directory unavailable');
  }
  let encoded = await encodeReceiptJpeg(sourceUri, 1600);
  if (base64ByteLength(encoded.base64) > MAX_UPLOAD_BASE64_BYTES) {
    await FileSystem.deleteAsync(encoded.uri, { idempotent: true });
    encoded = await encodeReceiptJpeg(sourceUri, 1200);
  }
  const dest = `${cacheDir}fintrack-receipt-upload-${createId()}.jpg`;
  await FileSystem.copyAsync({ from: encoded.uri, to: dest });
  await FileSystem.deleteAsync(encoded.uri, { idempotent: true });
  return { cachePath: dest, base64: encoded.base64 };
}

export async function deleteUploadCopy(path: string | null | undefined) {
  await deleteLocalImage(path);
}
