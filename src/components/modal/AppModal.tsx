import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
  initialHeight?: number;
  onClose: () => void;
  primaryAction?: ModalAction;
  resizable?: boolean;
  secondaryAction?: ModalAction;
  title?: string;
  variant?: 'bottomSheet' | 'center';
  visible: boolean;
}>;

export function AppModal({
  children,
  closeOnBackdropPress = true,
  initialHeight,
  onClose,
  primaryAction,
  resizable = false,
  secondaryAction,
  title,
  variant = 'bottomSheet',
  visible,
}: AppModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isBottomSheet = variant === 'bottomSheet';
  const showCloseButton = Boolean(title) || !closeOnBackdropPress;
  const maxHeight = Math.max(
    0,
    windowHeight - insets.top - insets.bottom - SPACING.xxxl * 2,
  );
  const collapsedHeight = Math.min(initialHeight ?? maxHeight, maxHeight);
  const sheetHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const currentHeight = useRef(collapsedHeight);
  const dragStartHeight = useRef(collapsedHeight);
  const canResize = isBottomSheet && resizable && maxHeight > collapsedHeight;

  const animateHeight = useCallback(
    (height: number) => {
      currentHeight.current = height;
      Animated.spring(sheetHeight, {
        bounciness: 0,
        speed: 18,
        toValue: height,
        useNativeDriver: false,
      }).start();
    },
    [sheetHeight],
  );

  useEffect(() => {
    currentHeight.current = collapsedHeight;
    dragStartHeight.current = collapsedHeight;
    sheetHeight.setValue(collapsedHeight);
  }, [collapsedHeight, sheetHeight, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canResize,
        onStartShouldSetPanResponderCapture: () => canResize,
        onMoveShouldSetPanResponder: (_, gesture) =>
          canResize && Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          canResize && Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          dragStartHeight.current = currentHeight.current;
          sheetHeight.stopAnimation((height) => {
            currentHeight.current = height;
            dragStartHeight.current = height;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextHeight = Math.min(
            maxHeight,
            Math.max(collapsedHeight, dragStartHeight.current - gesture.dy),
          );
          currentHeight.current = nextHeight;
          sheetHeight.setValue(nextHeight);
        },
        onPanResponderRelease: (_, gesture) => {
          const midpoint = collapsedHeight + (maxHeight - collapsedHeight) / 2;
          const shouldExpand =
            gesture.dy < -36 || gesture.vy < -0.2 || currentHeight.current > midpoint;
          animateHeight(shouldExpand ? maxHeight : collapsedHeight);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          animateHeight(
            currentHeight.current > collapsedHeight + (maxHeight - collapsedHeight) / 2
              ? maxHeight
              : collapsedHeight,
          );
        },
      }),
    [animateHeight, canResize, collapsedHeight, maxHeight, sheetHeight],
  );

  return (
    <Modal
      animationType={isBottomSheet ? 'slide' : 'fade'}
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel={closeOnBackdropPress ? '모달 닫기' : undefined}
          accessibilityRole={closeOnBackdropPress ? 'button' : undefined}
          accessible={closeOnBackdropPress}
          disabled={!closeOnBackdropPress}
          onPress={closeOnBackdropPress ? onClose : undefined}
          style={styles.backdrop}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
          style={[styles.modalLayer, isBottomSheet ? styles.bottomAligned : styles.centered]}
        >
          <Animated.View
            style={[
              styles.surface,
              isBottomSheet ? styles.bottomSheet : styles.centerModal,
              canResize ? { height: sheetHeight } : undefined,
              {
                maxHeight,
                paddingBottom: isBottomSheet
                  ? Math.max(SPACING.xxxl, insets.bottom)
                  : SPACING.xxxl,
              },
            ]}
          >
            {isBottomSheet ? (
              <View
                accessibilityActions={
                  canResize ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
                }
                collapsable={false}
                accessibilityLabel={canResize ? '모달 높이 조절' : undefined}
                accessibilityRole={canResize ? 'adjustable' : undefined}
                onAccessibilityAction={
                  canResize
                    ? (event) =>
                        animateHeight(
                          event.nativeEvent.actionName === 'increment'
                            ? maxHeight
                            : collapsedHeight,
                        )
                    : undefined
                }
                style={styles.dragArea}
                {...(canResize ? panResponder.panHandlers : {})}
              >
                <View style={styles.dragHandle} />
              </View>
            ) : null}

            {showCloseButton ? (
              <View style={styles.header}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                <Pressable
                  accessibilityLabel="모달 닫기"
                  accessibilityRole="button"
                  hitSlop={SPACING.md}
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <AppIcon color={COLORS.gray600} name="close" size={24} />
                </Pressable>
              </View>
            ) : null}

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.contentScroll}
            >
              {children}
            </ScrollView>

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
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modalLayer: {
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
  dragArea: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    marginBottom: SPACING.md,
    marginTop: -SPACING.xl,
    width: '100%',
  },
  dragHandle: {
    alignSelf: 'center',
    backgroundColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    height: 6,
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
    marginLeft: 'auto',
    width: 36,
  },
  contentScroll: {
    flexShrink: 1,
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
