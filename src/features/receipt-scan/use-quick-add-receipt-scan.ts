import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  deleteUploadCopy,
  persistImage,
  pickImage,
  prepareReceiptForUpload,
  takePhoto,
} from '@/lib/media';

import {
  type ApplyScanContext,
  type ApplyScanResult,
  applyScanToForm,
  validateRawScanFields,
} from './apply';
import type { ScanBannerAction } from './banner-copy';
import { bannerForKind } from './banner-copy';
import { scanReceipt } from './client';
import { isReceiptScanConfigured } from './config';
import {
  isConsentActive,
  readReceiptScanConsent,
  setReceiptScanConsentEnabled,
} from './consent';
import type { RateLimitScope, ScanBannerKind } from './types';

export type QuickAddScanDeps = {
  visible: boolean;
  mode: 'expense' | 'income' | 'transfer';
  buildApplyContext: () => ApplyScanContext;
  onApplyResult: (result: ApplyScanResult) => void;
  onPendingReceipt: (path: string) => void;
  onRemoveReceipt: (path: string) => Promise<void>;
  onFocusAmount: () => void;
  showToast: (message: string, tone?: 'default' | 'success' | 'error') => void;
};

export function useQuickAddReceiptScan({
  visible,
  mode,
  buildApplyContext,
  onApplyResult,
  onPendingReceipt,
  onRemoveReceipt,
  onFocusAmount,
  showToast,
}: QuickAddScanDeps) {
  const scanConfigured = isReceiptScanConfigured();
  const showScanButton = scanConfigured && mode === 'expense';

  const [consentEnabled, setConsentEnabled] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<'preparing' | 'reading'>(
    'preparing'
  );
  const [activeReceiptPath, setActiveReceiptPath] = useState<string | null>(
    null
  );
  const [panelThumb, setPanelThumb] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<ScanBannerKind | null>(null);
  const [errorScope, setErrorScope] = useState<RateLimitScope | undefined>();
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    filled: number;
    notes: string[];
  } | null>(null);

  const uploadPathRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const refreshConsent = useCallback(async () => {
    const record = await readReceiptScanConsent();
    setConsentEnabled(isConsentActive(record));
  }, []);

  useEffect(() => {
    if (visible) void refreshConsent();
  }, [visible, refreshConsent]);

  useEffect(() => {
    if (!visible) {
      setConsentOpen(false);
      setSourceOpen(false);
      setErrorBanner(null);
      setSuccessBanner(null);
      setRetryAfterSec(null);
    }
  }, [visible]);

  useEffect(() => {
    if (retryAfterSec == null || retryAfterSec <= 0) return;
    const t = setTimeout(() => {
      setRetryAfterSec((s) => (s != null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearTimeout(t);
  }, [retryAfterSec]);

  const cleanupUpload = useCallback(async () => {
    if (uploadPathRef.current) {
      await deleteUploadCopy(uploadPathRef.current);
      uploadPathRef.current = null;
    }
  }, []);

  const cancelScan = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    await cleanupUpload();
    if (activeReceiptPath) {
      await onRemoveReceipt(activeReceiptPath);
      setActiveReceiptPath(null);
    }
    setScanning(false);
    setPanelThumb(null);
    AccessibilityInfo.announceForAccessibility('Scan cancelled');
  }, [activeReceiptPath, cleanupUpload, onRemoveReceipt]);

  const showError = useCallback(
    (kind: ScanBannerKind, scope?: RateLimitScope, retry?: number) => {
      setSuccessBanner(null);
      setErrorBanner(kind);
      setErrorScope(scope);
      if (retry != null) setRetryAfterSec(retry);
    },
    []
  );

  const runScanOnReceipt = useCallback(
    async (receiptPath: string) => {
      setScanning(true);
      setScanPhase('preparing');
      setPanelThumb(receiptPath);
      setErrorBanner(null);
      setSuccessBanner(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const prepared = await prepareReceiptForUpload(receiptPath);
        uploadPathRef.current = prepared.cachePath;
        setScanPhase('reading');
        AccessibilityInfo.announceForAccessibility('Reading receipt');

        const response = await scanReceipt(prepared.base64, controller.signal);
        await cleanupUpload();

        if (response.ok === false) {
          if (response.error === 'cancelled') {
            await cancelScan();
            return;
          }
          if (response.error === 'rate_limited') {
            showError(
              'rate_limited',
              response.scope,
              response.retryAfterSec ?? 60
            );
            setScanning(false);
            return;
          }
          if (response.error === 'offline') {
            showError('offline');
            setScanning(false);
            return;
          }
          showError(response.error, undefined, response.retryAfterSec);
          setScanning(false);
          return;
        }

        const validated = validateRawScanFields(response.fields);

        const applied = applyScanToForm(validated, buildApplyContext());
        if (applied.filledCount === 0) {
          showError('unreadable');
          setScanning(false);
          return;
        }

        onApplyResult(applied);
        setSuccessBanner({
          filled: applied.filledCount,
          notes: applied.skippedNotes,
        });
        setScanning(false);
        setPanelThumb(null);
        onFocusAmount();
      } catch (e) {
        console.error('Receipt scan failed', e);
        await cleanupUpload();
        showError('photo_open');
        setScanning(false);
      }
    },
    [
      buildApplyContext,
      cancelScan,
      cleanupUpload,
      onApplyResult,
      onFocusAmount,
      showError,
    ]
  );

  const afterAssetPicked = useCallback(
    async (uri: string) => {
      const path = await persistImage(uri, 'receipt');
      onPendingReceipt(path);
      setActiveReceiptPath(path);
      await runScanOnReceipt(path);
    },
    [onPendingReceipt, runScanOnReceipt]
  );

  const openSourceSheet = useCallback(() => {
    setSourceOpen(true);
  }, []);

  const checkOnline = useCallback(async (): Promise<boolean> => {
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false) return false;
      if (state.isInternetReachable === false) return false;
      return true;
    } catch {
      return true;
    }
  }, []);

  const onScanPress = useCallback(async () => {
    if (scanning) return;
    const online = await checkOnline();
    if (!online) {
      showError('offline_precheck');
      return;
    }
    if (!consentEnabled) {
      setConsentOpen(true);
      return;
    }
    openSourceSheet();
  }, [checkOnline, consentEnabled, openSourceSheet, scanning, showError]);

  const onConsentTurnOn = useCallback(async () => {
    await setReceiptScanConsentEnabled(true);
    setConsentEnabled(true);
    setConsentOpen(false);
    openSourceSheet();
  }, [openSourceSheet]);

  const pickFromCamera = useCallback(async () => {
    setSourceOpen(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showError('camera_permission');
      return;
    }
    try {
      const asset = await takePhoto();
      if (!asset) return;
      await afterAssetPicked(asset.uri);
    } catch (e) {
      console.error('takePhoto failed', e);
      showToast(
        'Something went wrong with scanning. Enter the details yourself.',
        'error'
      );
    }
  }, [afterAssetPicked, showError, showToast]);

  const pickFromLibrary = useCallback(async () => {
    setSourceOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError('library_permission');
      return;
    }
    try {
      const assets = await pickImage();
      const asset = assets[0];
      if (!asset) return;
      await afterAssetPicked(asset.uri);
    } catch (e) {
      console.error('pickImage failed', e);
      showToast(
        'Something went wrong with scanning. Enter the details yourself.',
        'error'
      );
    }
  }, [afterAssetPicked, showError, showToast]);

  const retakeActiveReceipt = useCallback(async () => {
    setErrorBanner(null);
    if (activeReceiptPath) {
      await onRemoveReceipt(activeReceiptPath);
      setActiveReceiptPath(null);
    }
    openSourceSheet();
  }, [activeReceiptPath, onRemoveReceipt, openSourceSheet]);

  const tryAgainScan = useCallback(async () => {
    if (retryAfterSec != null && retryAfterSec > 0) return;
    setErrorBanner(null);
    if (errorBanner === 'offline_precheck') {
      const online = await checkOnline();
      if (!online) {
        showError('offline_precheck');
        return;
      }
      if (!consentEnabled) {
        setConsentOpen(true);
        return;
      }
      openSourceSheet();
      return;
    }
    if (!activeReceiptPath) {
      openSourceSheet();
      return;
    }
    await runScanOnReceipt(activeReceiptPath);
  }, [
    activeReceiptPath,
    checkOnline,
    consentEnabled,
    errorBanner,
    openSourceSheet,
    retryAfterSec,
    runScanOnReceipt,
    showError,
  ]);

  const onBannerAction = useCallback(
    async (action: ScanBannerAction) => {
      switch (action) {
        case 'enter_manually':
          setErrorBanner(null);
          onFocusAmount();
          break;
        case 'try_again':
          await tryAgainScan();
          break;
        case 'retake':
          await retakeActiveReceipt();
          break;
        case 'choose_library':
          await pickFromLibrary();
          break;
        case 'take_photo':
          await pickFromCamera();
          break;
        default:
          break;
      }
    },
    [
      onFocusAmount,
      pickFromCamera,
      pickFromLibrary,
      retakeActiveReceipt,
      tryAgainScan,
    ]
  );

  const requestCloseInterrupt = useCallback(async (): Promise<boolean> => {
    if (!scanning) return false;
    await cancelScan();
    return true;
  }, [cancelScan, scanning]);

  const retryLabel =
    retryAfterSec != null && retryAfterSec > 0
      ? `Try again in ${retryAfterSec}s`
      : 'Try again';

  const errorModel =
    errorBanner && errorBanner !== 'success'
      ? bannerForKind(errorBanner, {
          scope: errorScope,
          retryLabel,
        })
      : null;

  if (errorModel && retryAfterSec != null && retryAfterSec > 0) {
    const tryAction = errorModel.actions.find((a) => a.id === 'try_again');
    if (tryAction) {
      tryAction.label = retryLabel;
      tryAction.disabled = true;
    }
  }

  return {
    showScanButton,
    consentEnabled,
    consentOpen,
    setConsentOpen,
    sourceOpen,
    setSourceOpen,
    scanning,
    scanPhase,
    panelThumb,
    onScanPress,
    onConsentTurnOn,
    pickFromCamera,
    pickFromLibrary,
    cancelScan,
    requestCloseInterrupt,
    errorModel,
    successBanner,
    setSuccessBanner,
    onBannerAction,
    refreshConsent,
    setConsentEnabled,
  };
}
