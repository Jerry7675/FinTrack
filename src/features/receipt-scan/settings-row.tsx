import { useCallback, useEffect, useState } from 'react';

import { AppText, ListRow } from '@/components/ui/primitives';

import { isReceiptScanConfigured } from './config';
import {
  isConsentActive,
  readReceiptScanConsent,
  setReceiptScanConsentEnabled,
} from './consent';
import { ReceiptScanConsentSheet } from './consent-sheet';

export function ReceiptScanSettingsRow() {
  const configured = isReceiptScanConfigured();
  const [enabled, setEnabled] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const refresh = useCallback(async () => {
    const record = await readReceiptScanConsent();
    setEnabled(isConsentActive(record));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!configured) return null;

  const subtitle = enabled
    ? "On. Scanned photos go through FinTrack's server to OpenRouter, a third-party AI service. Free AI models may keep what they receive. Your IP address is used briefly to limit abuse and not kept."
    : "Off. Turn on to fill Quick Add from a receipt photo. Scanned photos go through FinTrack's server to OpenRouter, a third-party AI service.";

  const onPress = async () => {
    if (enabled) {
      await setReceiptScanConsentEnabled(false);
      setEnabled(false);
      return;
    }
    setConsentOpen(true);
  };

  return (
    <>
      <ListRow
        title='Receipt scanning (AI)'
        subtitle={subtitle}
        onPress={() => void onPress()}
        right={<AppText muted>{enabled ? 'On' : 'Off'}</AppText>}
      />
      <ReceiptScanConsentSheet
        visible={consentOpen}
        onTurnOn={async () => {
          await setReceiptScanConsentEnabled(true);
          setEnabled(true);
          setConsentOpen(false);
        }}
        onNotNow={() => setConsentOpen(false)}
      />
    </>
  );
}
