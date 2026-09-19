import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/palette';
import { fontSize, scale, vs } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

type ToastTone = 'default' | 'success' | 'error';

type ToastState = {
  message: string;
  tone: ToastTone;
} | null;

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useApp();
  const c = colors(colorScheme === 'dark' ? 'dark' : 'light');
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [opacity]);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(hide, 2600);
    },
    [hide, opacity]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const bg =
    toast?.tone === 'error'
      ? c.expense
      : toast?.tone === 'success'
        ? c.accent
        : colorScheme === 'dark'
          ? '#FAFAFA'
          : '#0A0A0A';
  const fg =
    toast?.tone === 'success' && colorScheme === 'dark'
      ? '#0A0A0A'
      : toast?.tone === 'error'
        ? '#FFFFFF'
        : colorScheme === 'dark'
          ? '#0A0A0A'
          : '#FFFFFF';

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents='box-none'
          style={{
            position: 'absolute',
            left: scale(16),
            right: scale(16),
            top: insets.top + vs(8),
            opacity,
            zIndex: 9999,
            elevation: 20,
          }}
        >
          <Pressable
            onPress={hide}
            style={{
              backgroundColor: bg,
              borderRadius: scale(16),
              paddingHorizontal: scale(16),
              paddingVertical: vs(14),
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Text
              style={{
                color: fg,
                fontSize: fontSize(14),
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (message: string) => {
        // Fallback when provider missing
        console.warn(message);
      },
    };
  }
  return ctx;
}
