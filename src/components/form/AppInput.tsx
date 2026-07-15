import type { ReactNode } from 'react';
import { forwardRef, useState } from 'react';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type AppInputProps = Omit<TextInputProps, 'style'> & {
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
};

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  {
    containerStyle,
    error,
    helperText,
    inputStyle,
    label,
    leftElement,
    multiline = false,
    onBlur,
    onFocus,
    rightElement,
    ...textInputProps
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const supportText = error ?? helperText;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputContainer,
          multiline && styles.multilineContainer,
          isFocused && styles.focused,
          error && styles.error,
          textInputProps.editable === false && styles.disabled,
        ]}
      >
        {leftElement ? <View style={styles.leftElement}>{leftElement}</View> : null}
        <TextInput
          accessibilityState={{ disabled: textInputProps.editable === false }}
          multiline={multiline}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={COLORS.gray500}
          ref={ref}
          style={[styles.input, multiline && styles.multilineInput, inputStyle]}
          {...textInputProps}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>

      {supportText ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.supportText, error && styles.errorText]}
        >
          {supportText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
    width: '100%',
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  inputContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: SIZE.inputHeight,
  },
  input: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
    flex: 1,
    minHeight: SIZE.inputHeight,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 0,
  },
  multilineContainer: {
    alignItems: 'flex-start',
    minHeight: 112,
  },
  multilineInput: {
    minHeight: 112,
    paddingVertical: SPACING.xl,
    textAlignVertical: 'top',
  },
  focused: {
    borderColor: COLORS.primary,
  },
  error: {
    borderColor: COLORS.error,
  },
  disabled: {
    backgroundColor: COLORS.gray100,
  },
  rightElement: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: SPACING.xxl,
  },
  leftElement: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: SPACING.xl,
  },
  supportText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  errorText: {
    color: COLORS.error,
  },
});
