/**
 * ScalePressable – a drop-in replacement for TouchableOpacity that feels
 * native-premium instead of "React-Native-y".
 *
 * On press-in  → springs down to `scaleTo`   (default 0.93)
 * On press-out → springs back  to 1.0
 * Haptics are opt-in. Reserve them for meaningful completed actions rather
 * than routine navigation and every tap.
 *
 * Usage:
 *   <ScalePressable onPress={…} style={…} className={…}>
 *     {children}
 *   </ScalePressable>
 */
import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import { GestureResponderEvent, Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HapticStyle = 'light' | 'medium' | 'heavy' | 'none';

interface ScalePressableProps {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  scaleTo?: number;
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none' | 'menuitem' | 'tab' | 'image';
  disabled?: boolean;
}

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 300,
  mass: 0.6,
};

const ScalePressable: React.FC<ScalePressableProps> = ({
  onPress,
  onLongPress,
  scaleTo = 0.93,
  haptic = 'none',
  style,
  className,
  children,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled = false,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const triggerHaptic = useCallback(() => {
    if (haptic === 'none') return;
    try {
      switch (haptic) {
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics not available in this environment (e.g. Expo Go without native build)
    }
  }, [haptic]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleTo, SPRING_CONFIG);
    triggerHaptic();
  }, [scale, scaleTo, triggerHaptic]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      triggerHaptic();
      onPress?.(event);
    },
    [onPress, triggerHaptic]
  );

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={[animatedStyle, style]}
      className={className}>
      {children}
    </AnimatedPressable>
  );
};

export default ScalePressable;
