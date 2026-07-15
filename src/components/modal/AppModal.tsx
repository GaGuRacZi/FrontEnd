import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/src/constants';

type ModalAction = {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
};

type AppModalProps = PropsWithChildren<{
  closeOnBackdropPress?: boolean;
  onClose: () => void;
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  title?: string;
  variant?: 'bottomSheet' | 'center';
  visible: boolean;
}>;

export function AppModal({
  children,
  closeOnBackdropPress = true,
  onClose,
  primaryAction,
  secondaryAction,
  title,
  variant = 'bottomSheet',
  visible,
}: AppModalProps) {
  const insets = useSafeAreaInsets();
  const isBottomSheet = variant === 'bottomSheet';

  return (
    <Modal
      animationType={isBottomSheet ? 'slide' : 'fade'}
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={[styles.root, isBottomSheet ? styles.bottomAligned : styles.centered]}>
        <Pressable
          accessibilityLabel="모달 닫기"
          onPress={closeOnBackdropPress ? onClose : undefined}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.surface,
            isBottomSheet ? styles.bottomSheet : styles.centerModal,
            {
              paddingBottom: isBottomSheet
                ? Math.max(SPACING.xxxl, insets.bottom)
                : SPACING.xxxl,
            },
          ]}
        >
          {isBottomSheet ? <View style={styles.dragHandle} /> : null}

          {title ? (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                hitSlop={SPACING.md}
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <AppIcon color={COLORS.gray600} name="close" size={24} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.content}>{children}</View>

          {primaryAction || secondaryAction ? (
            <View style={styles.actions}>
              {secondaryAction ? (
                <AppButton
                  disabled={secondaryAction.disabled}
                  fullWidth={false}
                  loading={secondaryAction.loading}
                  onPress={secondaryAction.onPress}
                  style={styles.actionButton}
                  title={secondaryAction.label}
                  variant="secondary"
                />
              ) : null}
              {primaryAction ? (
                <AppButton
                  disabled={primaryAction.disabled}
                  fullWidth={false}
                  loading={primaryAction.loading}
                  onPress={primaryAction.onPress}
                  style={styles.actionButton}
                  title={primaryAction.label}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bottomAligned: {
    justifyContent: 'flex-end',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  surface: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xxxl,
    paddingTop: SPACING.xxxl,
    ...SHADOWS.modal,
  },
  bottomSheet: {
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    width: '100%',
  },
  centerModal: {
    borderRadius: RADIUS.modal,
    maxWidth: 360,
    width: '100%',
  },
  dragHandle: {
    alignSelf: 'center',
    backgroundColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    height: 6,
    marginBottom: SPACING.xxl,
    width: 66,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xxl,
  },
  title: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
    flex: 1,
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  content: {
    gap: SPACING.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xl,
    marginTop: SPACING.xxxl,
  },
  actionButton: {
    flex: 1,
  },
  pressed: {
    opacity: 0.55,
  },
});
