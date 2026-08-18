import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Animated,
  Easing,
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
  variant?: 'danger' | 'primary';
};

type AppModalProps = PropsWithChildren<{
  animateSheetOnly?: boolean;
  closeOnBackdropPress?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  initialHeight?: number;
  onClose: () => void;
  onRequestClose?: () => void;
  primaryAction?: ModalAction;
  resizable?: boolean;
  secondaryAction?: ModalAction;
  surfaceStyle?: StyleProp<ViewStyle>;
  title?: string;
  variant?: 'bottomSheet' | 'center';
  visible: boolean;
}>;

export function AppModal({
  children,
  closeOnBackdropPress = true,
  contentContainerStyle,
  initialHeight,
  onClose,
  onRequestClose,
  primaryAction,
  resizable = false,
  secondaryAction,
  surfaceStyle,
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
  const bottomInsetAdjustment = isBottomSheet
    ? Math.max(0, insets.bottom - SPACING.xxxl)
    : 0;
  const collapsedHeight = Math.min(
    initialHeight === undefined ? maxHeight : initialHeight + bottomInsetAdjustment,
    maxHeight,
  );

  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const sheetOffset = useRef(new Animated.Value(windowHeight)).current;
  const centerScale = useRef(new Animated.Value(0.9)).current;
  const currentHeight = useRef(collapsedHeight);
  const dragStartHeight = useRef(collapsedHeight);
  const canDrag = isBottomSheet && resizable;
  const canResize = canDrag && maxHeight > collapsedHeight;
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      if (isBottomSheet) {
        sheetOffset.setValue(windowHeight);
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            duration: 180,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(sheetOffset, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            duration: 180,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(centerScale, {
            bounciness: 4,
            speed: 16,
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      if (isBottomSheet) {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            duration: 180,
            easing: Easing.in(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.timing(sheetOffset, {
            duration: 200,
            easing: Easing.in(Easing.cubic),
            toValue: windowHeight,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setModalVisible(false);
        });
      } else {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            duration: 150,
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.timing(centerScale, {
            duration: 150,
            toValue: 0.9,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setModalVisible(false);
        });
      }
    }
  }, [backdropOpacity, centerScale, isBottomSheet, sheetOffset, visible, windowHeight]);

  const animateHeight = useCallback(
    (height: number, expanded: boolean) => {
      currentHeight.current = height;
      Animated.spring(sheetHeight, {
        bounciness: 0,
        speed: 18,
        toValue: height,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setIsExpanded(expanded);
        }
      });
    },
    [sheetHeight],
  );

  useEffect(() => {
    sheetHeight.stopAnimation();
    currentHeight.current = collapsedHeight;
    dragStartHeight.current = collapsedHeight;
    sheetHeight.setValue(collapsedHeight);
    setIsExpanded(false);

    return () => sheetHeight.stopAnimation();
  }, [collapsedHeight, sheetHeight, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canDrag,
        onStartShouldSetPanResponderCapture: () => canDrag,
        onMoveShouldSetPanResponder: (_, gesture) =>
          canDrag && Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          canDrag && Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
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
          if (
            dragStartHeight.current <= collapsedHeight + 1 &&
            (gesture.dy > 64 || gesture.vy > 0.75)
          ) {
            onClose();
            return;
          }

          const midpoint = collapsedHeight + (maxHeight - collapsedHeight) / 2;
          const shouldExpand =
            gesture.dy < -36 || gesture.vy < -0.2 || currentHeight.current > midpoint;
          animateHeight(shouldExpand ? maxHeight : collapsedHeight, shouldExpand);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          const shouldExpand =
            currentHeight.current > collapsedHeight + (maxHeight - collapsedHeight) / 2;
          animateHeight(shouldExpand ? maxHeight : collapsedHeight, shouldExpand);
        },
      }),
    [animateHeight, canDrag, collapsedHeight, maxHeight, onClose, sheetHeight],
  );

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={() => {
        if (onRequestClose) onRequestClose();
        else if (closeOnBackdropPress) onClose();
      }}
      statusBarTranslucent
      transparent
      visible={modalVisible}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
        >
          <Pressable
            accessibilityLabel={closeOnBackdropPress ? '모달 닫기' : undefined}
            accessibilityRole={closeOnBackdropPress ? 'button' : undefined}
            accessible={closeOnBackdropPress}
            disabled={!closeOnBackdropPress}
            onPress={closeOnBackdropPress ? onClose : undefined}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
          style={[
            styles.modalLayer,
            isBottomSheet ? styles.bottomAligned : styles.centered,
          ]}
        >
          <Animated.View
            style={[
              styles.surface,
              isBottomSheet ? styles.bottomSheet : styles.centerModal,
              canResize ? { height: sheetHeight } : undefined,
              isBottomSheet
                ? { transform: [{ translateY: sheetOffset }] }
                : { transform: [{ scale: centerScale }] },
              {
                maxHeight,
                paddingBottom: isBottomSheet
                  ? Math.max(SPACING.xxxl, insets.bottom)
                  : SPACING.xxxl,
              },
              surfaceStyle,
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
                accessibilityValue={
                  canResize ? { text: isExpanded ? '펼쳐짐' : '접힘' } : undefined
                }
                onAccessibilityAction={
                  canResize
                    ? (event) => {
                        if (event.nativeEvent.actionName === 'increment') {
                          animateHeight(maxHeight, true);
                        }

                        if (event.nativeEvent.actionName === 'decrement') {
                          animateHeight(collapsedHeight, false);
                        }
                      }
                    : undefined
                }
                style={styles.dragArea}
                {...(canDrag ? panResponder.panHandlers : {})}
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
              contentContainerStyle={[styles.content, contentContainerStyle]}
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
                    variant={primaryAction.variant ?? 'primary'}
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