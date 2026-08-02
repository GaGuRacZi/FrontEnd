import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/src/constants';

import { AppModal } from './AppModal';

type AppAlertButton = {
  onPress?: () => void;
  style?: 'cancel' | 'default' | 'destructive';
  text: string;
};

type AppAlertRequest = {
  buttons: AppAlertButton[];
  message?: string;
  title: string;
};

type ShowAppAlert = (
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
) => void;

const AppAlertContext = createContext<ShowAppAlert | null>(null);

export function AppAlertProvider({ children }: PropsWithChildren) {
  const [activeAlert, setActiveAlert] = useState<AppAlertRequest | null>(null);
  const activeAlertRef = useRef<AppAlertRequest | null>(null);
  const queueRef = useRef<AppAlertRequest[]>([]);

  const showAlert = useCallback<ShowAppAlert>((title, message, buttons = []) => {
    const request = {
      buttons: buttons.length ? buttons.slice(0, 2) : [{ text: '확인' }],
      message,
      title,
    };

    if (activeAlertRef.current) {
      if (
        activeAlertRef.current.title === title &&
        activeAlertRef.current.message === message
      ) {
        return;
      }

      if (
        queueRef.current.some(
          (queuedAlert) =>
            queuedAlert.title === title && queuedAlert.message === message,
        )
      ) {
        return;
      }

      queueRef.current.push(request);
      return;
    }

    activeAlertRef.current = request;
    setActiveAlert(request);
  }, []);

  const closeAlert = useCallback((onPress?: () => void) => {
    const nextAlert = queueRef.current.shift() ?? null;
    activeAlertRef.current = nextAlert;
    setActiveAlert(nextAlert);

    if (onPress) {
      requestAnimationFrame(onPress);
    }
  }, []);

  const actions = useMemo(() => {
    if (!activeAlert) {
      return {
        primaryAction: undefined,
        secondaryAction: undefined,
      };
    }

    const cancelButton = activeAlert.buttons.find((button) => button.style === 'cancel');
    const primaryButton =
      activeAlert.buttons.find((button) => button !== cancelButton) ??
      activeAlert.buttons[activeAlert.buttons.length - 1];
    const secondaryButton =
      cancelButton ??
      (activeAlert.buttons.length > 1 && primaryButton === activeAlert.buttons[1]
        ? activeAlert.buttons[0]
        : undefined);

    return {
      primaryAction: primaryButton
        ? {
            label: primaryButton.text,
            onPress: () => closeAlert(primaryButton.onPress),
            variant: primaryButton.style === 'destructive' ? 'danger' as const : 'primary' as const,
          }
        : undefined,
      secondaryAction: secondaryButton
        ? {
            label: secondaryButton.text,
            onPress: () => closeAlert(secondaryButton.onPress),
          }
        : undefined,
    };
  }, [activeAlert, closeAlert]);

  return (
    <AppAlertContext.Provider value={showAlert}>
      {children}
      <AppModal
        closeOnBackdropPress
        onClose={() => closeAlert()}
        primaryAction={actions.primaryAction}
        secondaryAction={actions.secondaryAction}
        title={activeAlert?.title}
        variant="center"
        visible={Boolean(activeAlert)}
      >
        {activeAlert?.message ? (
          <Text style={styles.message}>{activeAlert.message}</Text>
        ) : null}
      </AppModal>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert() {
  const context = useContext(AppAlertContext);

  if (!context) {
    throw new Error('useAppAlert must be used within AppAlertProvider');
  }

  return context;
}

const styles = StyleSheet.create({
  message: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
