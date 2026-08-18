import type { TextStyle } from 'react-native';

export const FONT_FAMILY = {
  regular: 'NotoSansKR_400Regular',
  medium: 'NotoSansKR_500Medium',
  bold: 'NotoSansKR_700Bold',
} as const;

export const TYPOGRAPHY = {
  display: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 28,
    lineHeight: 38,
  },
  title1: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 24,
    lineHeight: 34,
  },
  title2: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 20,
    lineHeight: 30,
  },
  authTitle: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 22,
    lineHeight: 30,
  },
  title3: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 17,
    lineHeight: 26,
  },
  body1: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 15,
    lineHeight: 24,
  },
  bodyLarge: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 16,
    lineHeight: 27,
  },
  body2: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 22,
  },
  segment: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  segmentActive: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  selection: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 13,
    lineHeight: 22,
  },
  selectionActive: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 13,
    lineHeight: 22,
  },
  label: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 15,
    lineHeight: 21,
  },
  kakaoButton: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  small: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 10,
    lineHeight: 15,
  },
  checkboxLabel: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 12,
    lineHeight: 20,
  },
  smallButton: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 11,
    lineHeight: 16,
  },
  badge: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 11,
    lineHeight: 16,
  },
} satisfies Record<string, TextStyle>;
