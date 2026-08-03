import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCheckbox } from '@/src/components/form/AppCheckbox';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { TermDefinition } from '../types';

type TermAgreementRowProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  onDetailPress?: () => void;
  term: TermDefinition;
};

export function TermAgreementRow({
  checked,
  disabled = false,
  onChange,
  onDetailPress,
  term,
}: TermAgreementRowProps) {
  const requirement = term.required ? '필수' : '선택';
  const detailButton = (
    <Pressable
      accessibilityLabel={`${term.title} 자세히 보기`}
      accessibilityRole={onDetailPress ? 'button' : 'link'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={{ bottom: 6, left: 8, right: 8, top: 6 }}
      onPress={onDetailPress}
      style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
    >
      <Text style={styles.detailText}>자세히 보기</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.checkboxRow}>
        <AppCheckbox
          accessibilityLabel={`${requirement} ${term.title}`}
          checked={checked}
          disabled={disabled}
          label={term.title}
          labelStyle={styles.title}
          onChange={onChange}
          size="small"
        />
      </View>
      <View style={styles.bottomRow}>
        <Text style={[styles.requirement, term.required && styles.required]}>
          {requirement}
        </Text>
        {onDetailPress ? (
          detailButton
        ) : (
          <Link
            asChild
            href={{ pathname: '/signup/terms/[termId]', params: { termId: term.id } }}
          >
            {detailButton}
          </Link>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.xxl,
  },
  checkboxRow: {
    justifyContent: 'center',
    minHeight: SIZE.touchTarget,
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 28,
    marginTop: -8,
    minHeight: 32,
  },
  title: {
    ...TYPOGRAPHY.input,
    color: COLORS.gray800,
  },
  detailButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  detailText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  requirement: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  required: {
    color: COLORS.error,
  },
  pressed: {
    opacity: 0.55,
  },
});
