import type { RateLimitScope, ScanBannerKind } from './types';

export type ScanBannerAction =
  | 'try_again'
  | 'enter_manually'
  | 'retake'
  | 'choose_library'
  | 'take_photo'
  | 'close';

export type ScanBannerModel = {
  message: string;
  actions: { id: ScanBannerAction; label: string; disabled?: boolean }[];
  tone: 'negative' | 'accent';
};

export function rateLimitMessage(scope?: RateLimitScope): string {
  if (scope === 'ip') {
    return 'Too many scans from this connection. Wait a minute, then try again, or enter the details yourself.';
  }
  return 'Scanning is busy right now (free AI limit reached). Try again later, or enter the details yourself.';
}

export function bannerForKind(
  kind: ScanBannerKind,
  opts?: { scope?: RateLimitScope; retryLabel?: string }
): ScanBannerModel {
  switch (kind) {
    case 'offline_precheck':
    case 'offline':
      return {
        tone: 'negative',
        message:
          kind === 'offline_precheck'
            ? "You're offline. Scanning needs an internet connection."
            : 'Connection lost while scanning. Your photo is kept as a receipt.',
        actions: [
          { id: 'try_again', label: opts?.retryLabel ?? 'Try again' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'rate_limited':
      return {
        tone: 'negative',
        message: rateLimitMessage(opts?.scope),
        actions: [
          {
            id: 'try_again',
            label: opts?.retryLabel ?? 'Try again',
            disabled: opts?.retryLabel?.includes('in ') ?? false,
          },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'timeout':
      return {
        tone: 'negative',
        message:
          'Reading the receipt took too long. Try again, or enter the details yourself.',
        actions: [
          { id: 'try_again', label: opts?.retryLabel ?? 'Try again' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'unreadable':
      return {
        tone: 'negative',
        message:
          "Couldn't read this receipt. Try a sharper photo with the whole receipt in view.",
        actions: [
          { id: 'retake', label: 'Retake photo' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'too_large':
      return {
        tone: 'negative',
        message:
          'This photo is too large to scan. Try again with a closer photo of just the receipt.',
        actions: [
          { id: 'retake', label: 'Retake photo' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'server':
      return {
        tone: 'negative',
        message:
          "Scanning isn't working right now. Try again later, or enter the details yourself.",
        actions: [
          { id: 'try_again', label: opts?.retryLabel ?? 'Try again' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'photo_open':
      return {
        tone: 'negative',
        message: "Couldn't open this photo. Try another one.",
        actions: [
          { id: 'retake', label: 'Retake photo' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'camera_permission':
      return {
        tone: 'negative',
        message:
          "Camera access is off for FinTrack. Allow it in your phone's Settings, or choose a photo from your library.",
        actions: [
          { id: 'choose_library', label: 'Choose from library' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'library_permission':
      return {
        tone: 'negative',
        message:
          "Photo access is off for FinTrack. Allow it in your phone's Settings, or take a photo instead.",
        actions: [
          { id: 'take_photo', label: 'Take photo' },
          { id: 'enter_manually', label: 'Enter manually' },
        ],
      };
    case 'success':
      return {
        tone: 'accent',
        message: '',
        actions: [],
      };
    default:
      return {
        tone: 'negative',
        message: 'Something went wrong.',
        actions: [{ id: 'enter_manually', label: 'Enter manually' }],
      };
  }
}

export function successBannerMessage(filled: number): string {
  return `Filled ${filled} of 4 details from the receipt. Check them before saving.`;
}
