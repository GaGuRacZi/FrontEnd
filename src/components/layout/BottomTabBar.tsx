import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING } from '@/src/constants';

const TAB_ICONS: Record<string, { active: AppIconName; inactive: AppIconName }> = {
  'health-summary': { active: 'heart', inactive: 'heart-outline' },
  dashboard: { active: 'grid', inactive: 'grid-outline' },
  home: { active: 'home', inactive: 'home-outline' },
  community: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  mypage: { active: 'person', inactive: 'person-outline' },
};

export function BottomTabBar({ descriptors, insets, navigation, state }: BottomTabBarProps) {
  return (
    <View
      style={[
        styles.container,
        {
          minHeight: SIZE.tabBarHeight + Math.max(0, insets.bottom - SPACING.xl),
          paddingBottom: Math.max(SPACING.xl, insets.bottom),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const options = descriptors[route.key].options;
        const label =
          options.tabBarAccessibilityLabel ??
          (typeof options.title === 'string' ? options.title : route.name);
        const icon = TAB_ICONS[route.name] ?? {
          active: 'ellipse',
          inactive: 'ellipse-outline',
        };

        const onPress = () => {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.name === 'mypage' ? { screen: 'index' } : undefined);
          }
        };

        const onLongPress = () => {
          navigation.emit({ target: route.key, type: 'tabLongPress' });
        };

        return (
          <Pressable
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            key={route.key}
            onLongPress={onLongPress}
            onPress={onPress}
            style={styles.tabItem}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.iconContainer,
                  isFocused && styles.activeIconContainer,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon
                  color={isFocused ? COLORS.primary : COLORS.gray600}
                  name={isFocused ? icon.active : icon.inactive}
                  size={isFocused ? SIZE.activeTabIcon : SIZE.tabIcon}
                />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    paddingHorizontal: SPACING.xxxl,
    paddingTop: SPACING.lg,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  activeIconContainer: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.activeTab,
    height: 58,
    width: 58,
  },
  pressed: {
    opacity: 0.55,
  },
});
