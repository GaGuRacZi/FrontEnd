import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { COLORS } from '@/src/constants';

export type AppIconName = ComponentProps<typeof Ionicons>['name'];

type AppIconProps = Omit<ComponentProps<typeof Ionicons>, 'color' | 'name' | 'size'> & {
  color?: string;
  name: AppIconName;
  size?: number;
};

export function AppIcon({ color = COLORS.gray600, name, size = 24, ...props }: AppIconProps) {
  return <Ionicons color={color} name={name} size={size} {...props} />;
}
