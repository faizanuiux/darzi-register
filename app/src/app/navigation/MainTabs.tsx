import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Plus, Settings as SettingsIcon, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';
import { AddCustomerRoute } from './AddCustomerRoute';
import { CustomersStack } from './CustomersStack';
import { SettingsStack } from './SettingsStack';
import type { MainTabsParamList } from './types';

const Tabs = createBottomTabNavigator<MainTabsParamList>();

const TAB_META: Record<
  keyof MainTabsParamList,
  { icon: LucideIcon; labelKey: 'customers' | 'add' | 'settings' }
> = {
  Customers: { icon: Users, labelKey: 'customers' },
  Add: { icon: Plus, labelKey: 'add' },
  SettingsTab: { icon: SettingsIcon, labelKey: 'settings' },
};

/**
 * Branded tab bar: ivory card with a brass indicator on the active tab and
 * a raised brass "Add" button in the center.
 */
function DarziTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { strings } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize, fontFamily } = theme;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.line,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingTop: spacing.sm,
        },
      ]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const meta = TAB_META[route.name as keyof MainTabsParamList];
        const label = strings.tabs[meta.labelKey];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        // Center "Add" tab: raised brass circle.
        if (route.name === 'Add') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              activeOpacity={0.85}
              style={styles.addWrap}>
              <View
                style={[
                  styles.addButton,
                  { backgroundColor: focused ? colors.primary : colors.accent },
                ]}>
                <Plus
                  size={30}
                  color={focused ? colors.white : colors.primaryDark}
                  strokeWidth={2.5}
                />
              </View>
              <Text
                style={[
                  styles.addLabel,
                  {
                    color: focused ? colors.primaryText : colors.muted,
                    fontSize: fontSize.xs,
                    fontFamily: fontFamily.semiBold,
                    marginTop: 2,
                  },
                ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        }

        const Icon = meta.icon;
        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            activeOpacity={0.7}
            style={styles.tab}>
            <View
              style={[
                styles.indicator,
                {
                  backgroundColor: focused ? colors.accent : 'transparent',
                  marginBottom: 4,
                },
              ]}
            />
            <Icon
              size={24}
              color={focused ? colors.primaryText : colors.muted}
              strokeWidth={focused ? 2.25 : 2}
            />
            <Text
              style={{
                color: focused ? colors.primaryText : colors.muted,
                fontSize: fontSize.xs,
                fontFamily: focused ? fontFamily.semiBold : fontFamily.regular,
                marginTop: 2,
              }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Bottom tabs of the authenticated app. */
export function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={props => <DarziTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Customers" component={CustomersStack} />
      <Tabs.Screen name="Add" component={AddCustomerRoute} />
      <Tabs.Screen name="SettingsTab" component={SettingsStack} />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 26,
    height: 4,
    borderRadius: 2,
  },
  addWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
  },
  addButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addLabel: {},
});
