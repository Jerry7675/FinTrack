import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
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

function useToastController() {
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

  return { toast, opacity, hide, showToast };
}

function ToastBanner({
  toast,
  opacity,
  hide,
  topInset,
}: {
  toast: ToastState;
  opacity: Animated.Value;
  hide: () => void;
  topInset: number;
}) {
  const { colorScheme } = useApp();
  const c = colors(colorScheme === 'dark' ? 'dark' : 'light');

  if (!toast) return null;

  const config =
    toast.tone === 'error'
      ? { bg: c.expense, fg: c.inkInverse, icon: 'alert-circle' as const }
      : toast.tone === 'success'
        ? { bg: c.income, fg: c.inkInverse, icon: 'checkmark-circle' as const }
        : {
            bg: c.surfaceOverlay,
            fg: c.ink,
            icon: 'information-circle' as const,
          };

  return (
    <Animated.View
      pointerEvents='box-none'
      style={{
        position: 'absolute',
        left: scale(16),
        right: scale(16),
        top: topInset,
        opacity,
        zIndex: 9999,
        elevation: 20,
      }}
    >
      <Pressable
        onPress={hide}
        style={{
          backgroundColor: config.bg,
          borderRadius: scale(16),
          paddingHorizontal: scale(16),
          paddingVertical: vs(14),
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          <Ionicons name={config.icon} size={scale(18)} color={config.fg} />
          <Text
            style={{
              color: config.fg,
              fontSize: fontSize(14),
              fontWeight: '600',
            }}
          >
            {toast.message}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { toast, opacity, hide, showToast } = useToastController();
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastBanner
        toast={toast}
        opacity={opacity}
        hide={hide}
        topInset={insets.top + vs(8)}
      />
    </ToastContext.Provider>
  );
}

/** Toast host scoped inside a native Modal (renders above sheet content). */
export function ModalToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { toast, opacity, hide, showToast } = useToastController();
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <View style={{ flex: 1 }}>
      <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
      <ToastBanner
        toast={toast}
        opacity={opacity}
        hide={hide}
        topInset={vs(8)}
      />
    </View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (message: string) => {
        console.warn(message);
      },
    };
  }
  return ctx;
}
