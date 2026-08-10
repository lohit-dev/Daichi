import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

import ScalePressable from '../shared/ScalePressable';

import { darkTheme } from '~/constants/Colors';
import { hp, wp } from '~/helpers/common';

type TabBarProps = {
  state: any;
  descriptors: Record<string, any>;
  navigation: any;
  insets: any;
};

const TabBar = ({ state, descriptors, navigation, insets }: TabBarProps) => {
  const barBottom = Math.max(insets.bottom, hp(2));

  return (
    <View
      className="absolute h-[75px] flex-row"
      style={[
        styles.tabBarStyle,
        { bottom: barBottom, backgroundColor: darkTheme.colors.elevation.level2 },
      ]}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        // Use MD3 colors for states
        const color = isFocused
          ? darkTheme.colors.onSecondaryContainer
          : darkTheme.colors.onSurfaceVariant;

        return (
          <ScalePressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            scaleTo={0.88}
            className="h-full flex-1 items-center justify-center">
            <View style={[styles.iconSlot, isFocused && styles.activeIconPill]}>
              {options.tabBarIcon
                ? options.tabBarIcon({ focused: isFocused, color, size: 24 })
                : null}
            </View>
            <Text className="font-salsa text-xs" style={{ color }}>
              {label as string}
            </Text>
          </ScalePressable>
        );
      })}
    </View>
  );
};

export default TabBar;

const styles = StyleSheet.create({
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    minWidth: 64,
    marginBottom: 4,
  },
  activeIconPill: {
    backgroundColor: darkTheme.colors.secondaryContainer,
    borderRadius: 17,
    overflow: 'hidden',
  },
  tabBarStyle: {
    borderRadius: wp(7),
    elevation: 2,
    left: wp(5),
    right: wp(5),
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
});
