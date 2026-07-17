import type { StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, TYPOGRAPHY } from '@/src/constants';

const PAW_LOGO = require('../../../../assets/images/paw-logo.png');
const PAW_MAIN_LOGO = require('../../../../assets/images/paw-main-logo.png');

type AuthBrandHeroProps = {
  largeLogo?: boolean;
  style?: StyleProp<ViewStyle>;
  tagline?: string;
};

export function AuthBrandHero({ largeLogo = false, style, tagline }: AuthBrandHeroProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.decorations}>
        <View style={[styles.glow, styles.blueGlow]} />
        <View style={[styles.glow, styles.creamGlow]} />
        <View style={[styles.glow, styles.yellowGlow]} />
      </View>

      <View style={styles.logoCard}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="PAW 로고"
          source={PAW_LOGO}
          style={[styles.logoMark, largeLogo && styles.largeLogoMark]}
        />
      </View>

      <View accessible accessibilityLabel="PAW, Pet AI Wellness" style={styles.wordmark}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          source={PAW_MAIN_LOGO}
          style={styles.wordmarkImage}
        />
      </View>

      {tagline ? (
        <Text numberOfLines={1} style={styles.tagline}>
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    overflow: 'hidden',
    position: 'relative',
  },
  decorations: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  glow: {
    borderRadius: RADIUS.round,
    position: 'absolute',
  },
  blueGlow: {
    backgroundColor: COLORS.primarySoft,
    height: 260,
    left: -82,
    top: 26,
    width: 260,
  },
  creamGlow: {
    backgroundColor: COLORS.cream,
    height: 250,
    opacity: 0.72,
    right: -88,
    top: 160,
    width: 250,
  },
  yellowGlow: {
    backgroundColor: COLORS.yellow,
    height: 128,
    opacity: 0.68,
    right: -20,
    top: 42,
    width: 128,
  },
  logoCard: {
    alignItems: 'center',
    backgroundColor: COLORS.logoBackground,
    borderRadius: 44,
    elevation: 4,
    height: 158,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    top: 95,
    width: 158,
  },
  logoMark: {
    height: 168,
    width: 168,
  },
  largeLogoMark: {
    height: 180,
    width: 180,
  },
  wordmark: {
    height: 88,
    overflow: 'hidden',
    position: 'absolute',
    top: 288,
    width: 194,
  },
  wordmarkImage: {
    height: 334,
    left: -71,
    position: 'absolute',
    top: -196,
    width: 334,
  },
  tagline: {
    ...TYPOGRAPHY.title2,
    bottom: '11.3%',
    color: COLORS.black,
    left: 20,
    position: 'absolute',
    right: 20,
    textAlign: 'center',
  },
});
