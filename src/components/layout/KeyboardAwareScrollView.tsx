import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { ScrollViewProps } from 'react-native';
import { Keyboard, ScrollView, TextInput } from 'react-native';

import { SPACING } from '@/src/constants';

type KeyboardAwareScrollViewProps = PropsWithChildren<
  ScrollViewProps & {
    extraScrollHeight?: number;
  }
>;

export function KeyboardAwareScrollView({
  children,
  extraScrollHeight = SPACING.xxxl,
  keyboardDismissMode = 'on-drag',
  keyboardShouldPersistTaps = 'handled',
  onFocus,
  onScroll,
  scrollEventThrottle,
  ...scrollViewProps
}: KeyboardAwareScrollViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  const scrollToFocusedInput = useCallback((keyboardScreenY?: number) => {
    const focusedInput = TextInput.State.currentlyFocusedInput();
    const visibleBottom = keyboardScreenY ?? Keyboard.metrics()?.screenY;

    if (!focusedInput || visibleBottom === undefined) return;

    focusedInput.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + extraScrollHeight - visibleBottom;

      if (overlap <= 0) return;

      scrollViewRef.current?.scrollTo({
        animated: true,
        y: scrollOffset.current + overlap,
      });
    });
  }, [extraScrollHeight]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', (event) => {
      requestAnimationFrame(() => scrollToFocusedInput(event.endCoordinates.screenY));
    });

    return () => subscription.remove();
  }, [scrollToFocusedInput]);

  return (
    <ScrollView
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onFocus={(event) => {
        onFocus?.(event);
        if (Keyboard.isVisible()) {
          requestAnimationFrame(() => scrollToFocusedInput());
        }
      }}
      onScroll={(event) => {
        scrollOffset.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      ref={scrollViewRef}
      scrollEventThrottle={scrollEventThrottle ?? 16}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );
}
