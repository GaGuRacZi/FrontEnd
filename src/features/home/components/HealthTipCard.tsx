import { Image, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { HealthTip } from '../types';

type HealthTipCardProps = {
  tip: HealthTip;
};

export function HealthTipCard({ tip }: HealthTipCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
          <Image
            accessibilityIgnoresInvertColors
            source={require('../../../../assets/images/decorations/paw-tiny.png')}
            style={styles.pillIcon}
          />
      </View>

      <View style={styles.textGroup}>
        <Text style={styles.title}>{tip.title}</Text>
        <Text style={styles.description}>{tip.description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.button,
    flexDirection: 'row',
    gap: SPACING.lg,
    padding: SPACING.xl,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.yellow,
    borderRadius: RADIUS.round,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pillIcon: { height: 26, width: 26 },
  textGroup: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  description: { ...TYPOGRAPHY.small, color: COLORS.gray800 },
});