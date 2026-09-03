import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type HomeBannerProps = {
  item: Anime;
  index: number;
  isActive: boolean;
  x: SharedValue<number>;
  screenWidth: number;
  onPress: () => void;
};

const ZOOM_IN = { duration: 5000, easing: Easing.out(Easing.quad) };
const RESET_ZOOM = { duration: 300 };

const HomeBanner = ({ item, index, isActive, x, screenWidth, onPress }: HomeBannerProps) => {
  const infoItems: { key: string; element: React.ReactNode }[] = [];

  // Gentle Ken Burns slow zoom (scale 1.0 -> 1.05) when active
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      scale.value = 1;
      scale.value = withTiming(1.05, ZOOM_IN);
    } else {
      scale.value = withTiming(1, RESET_ZOOM);
    }
  }, [isActive]);

  if (item.type || item.quality) {
    infoItems.push({
      key: 'type',
      element: (
        <Text className="font-salsa text-base font-semibold text-lime-300">
          {item.type || item.quality}
        </Text>
      ),
    });
  }

  if (item.date) {
    infoItems.push({
      key: 'date',
      element: (
        <Text className="font-salsa text-base font-semibold text-gray-300">{item.date}</Text>
      ),
    });
  }

  if (item.episodeNumber || item.episode) {
    infoItems.push({
      key: 'episode',
      element: (
        <Text className="font-salsa text-base font-semibold text-gray-300">
          {item.episodeNumber ? `${item.episodeNumber} Eps` : item.episode}
        </Text>
      ),
    });
  }

  // Backdrop: Counter-translate so the image stays stationary on screen (DOES NOT SLIDE),
  // and smoothly crossfades opacity 0 -> 1 -> 0
  const backdropAnimStyle = useAnimatedStyle(() => {
    const diff = x.value - index * screenWidth;

    // Counter-translate so image remains stationary on screen
    const translateX = diff;

    // Smooth opacity crossfade:
    // When diff < 0 (scrolling from prev slide into this one): fades in 0 -> 1
    // When diff > 0 (next slide fading in over this one): stays visible until next slide covers it
    const opacity = interpolate(
      diff,
      [-screenWidth, 0, screenWidth * 0.85, screenWidth],
      [0, 1, 1, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  const imageZoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Title & Metadata: Pure in-place fade (no sliding horizontally across screen)
  const contentAnimStyle = useAnimatedStyle(() => {
    const diff = x.value - index * screenWidth;
    const absDiff = Math.abs(diff);

    // Counter-translate so text stays stationary on screen while scrolling
    const translateX = diff;

    // Pure crossfade opacity: 1 at center, 0 as slide scrolls away
    const opacity = interpolate(absDiff, [0, screenWidth * 0.5], [1, 0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-end"
      style={{ width: wp(100), height: hp(50) }}
      testID="home-hero-banner">
      {/* Stationary backdrop layer: counter-translated so it fades without sliding */}
      <Animated.View style={[styles.backdropLayer, backdropAnimStyle]}>
        {/* Ken Burns image */}
        <Animated.Image
          source={{ uri: item.image }}
          style={[styles.image, imageZoomStyle]}
          resizeMode="cover"
        />

        {/* Subtle dark scrim */}
        <LinearGradient
          colors={['rgba(10,10,14,0.25)', 'rgba(10,10,14,0.08)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top status-bar fade */}
        <LinearGradient
          colors={['rgba(10,10,14,0.85)', 'rgba(10,10,14,0.4)', 'transparent']}
          style={styles.topFade}
          pointerEvents="none"
        />

        {/* Deep bottom fade */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(10,10,14,0.18)',
            'rgba(10,10,14,0.62)',
            'rgba(10,10,14,0.92)',
            'rgba(10,10,14,1)',
          ]}
          locations={[0, 0.35, 0.6, 0.82, 1]}
          style={styles.bottomFade}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Animated title + metadata */}
      <Animated.View className="w-full items-center pb-1" style={contentAnimStyle}>
        <Text
          className="px-3 pt-1 text-center font-salsa text-3xl font-semibold leading-[35px] text-white"
          numberOfLines={2}
          ellipsizeMode="tail">
          {getFormattedTitle(item.title || '', 'text-3xl font-salsa')}
        </Text>

        <View className="flex-row flex-wrap items-center justify-center px-8 pt-1">
          {infoItems.map((info, i) => (
            <React.Fragment key={info.key}>
              {info.element}
              {i < infoItems.length - 1 && (
                <Text className="font-salsa text-xl text-lime-300"> • </Text>
              )}
            </React.Fragment>
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default HomeBanner;

const styles = StyleSheet.create({
  backdropLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: wp(100),
    height: hp(50),
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: wp(100),
    height: hp(50),
  },
  topFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 90,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: hp(38),
  },
});
