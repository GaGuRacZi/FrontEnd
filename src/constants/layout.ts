import type { ViewStyle } from 'react-native';

import { COLORS } from './colors';

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  xxxl: 24,
  jumbo: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  attachButton: 17,
  button: 18,
  segment: 18,
  activeTab: 22,
  toast: 23,
  modal: 24,
  authPanel: 34,
  round: 999,
} as const;

export const SIZE = {
  touchTarget: 44,
  topHeaderHeight: 48,
  inputHeight: 54,
  buttonHeight: 56,
  buttonMediumHeight: 52,
  checkbox: 24,
  checkboxSmall: 20,
  progressDot: 16,
  segmentHeight: 46,
  segmentIndicatorHeight: 36,
  settingRowHeight: 72,
  switchWidth: 48,
  switchHeight: 28,
  switchThumb: 24,
  toastIcon: 38,
  attachButtonHeight: 34,
  attachmentThumbnail: 72,
  attachmentRemoveButton: 24,
  tabBarHeight: 82,
  headerIcon: 28,
  tabIcon: 23,
  activeTabIcon: 29,
} as const;

export const LAYOUT = {
  screenPaddingHorizontal: 18,
  screenPaddingVertical: 16,
  contentGap: 16,
  authContentPaddingHorizontal: 30,
} as const;

export const SHADOWS = {
  segment: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    elevation: 2,
  } satisfies ViewStyle,
  modal: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  } satisfies ViewStyle,
} as const;
