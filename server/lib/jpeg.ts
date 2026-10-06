const JPEG_MAGIC = [0xff, 0xd8, 0xff];

export function isJpegBuffer(bytes: Uint8Array): boolean {
  if (bytes.length < 3) {
    return false;
  }
  return (
    bytes[0] === JPEG_MAGIC[0] &&
    bytes[1] === JPEG_MAGIC[1] &&
    bytes[2] === JPEG_MAGIC[2]
  );
}

export function decodeBase64Image(base64: string): Uint8Array | null {
  try {
    const binary = Buffer.from(base64, 'base64');
    return new Uint8Array(binary);
  } catch {
    return null;
  }
}
