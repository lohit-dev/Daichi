import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type AnimeBannerTextProps = {
  item: Anime;
  index: number;
  x: SharedValue<number>;
  onPress: () => void;
};

const AnimeBannerText = ({ item, index, x, onPress }: AnimeBannerTextProps) => {
  const { width } = useWindowDimensions();

  // 1 & 2: Staggered Cascade + Depth Pop for Title
  const titleAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-100, 0, 100],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-5, 1, -5],
      Extrapolation.CLAMP
    );

    // Subtle depth pop (expand into focus)
    const scale = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0.95, 1, 0.95],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // 1 & 2: Staggered Cascade + Depth Pop for Metadata (softer travel, follows behind title)
  const metaAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-55, 0, 55],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-4.5, 1, -4.5],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0.96, 1, 0.96],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const infoItems: { key: string; element: React.ReactNode }[] = [];

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

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Pressable onPress={onPress} className="w-full items-center">
          <Animated.Text
            style={titleAnimatedStyle}
            className="px-3 pt-1 text-center font-salsa text-3xl font-semibold leading-[35px] text-white"
            numberOfLines={2}
            ellipsizeMode="tail">
            {getFormattedTitle(item.title || '', 'text-3xl font-salsa')}
          </Animated.Text>

          <Animated.View
            style={metaAnimatedStyle}
            className="flex-row flex-wrap items-center justify-center px-8 pt-1">
            {infoItems.map((info, i) => (
              <React.Fragment key={info.key}>
                {info.element}
                {i < infoItems.length - 1 && (
                  <Text className="font-salsa text-xl text-lime-300"> • </Text>
                )}
              </React.Fragment>
            ))}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

export default AnimeBannerText;

const styles = StyleSheet.create({
  container: { width: wp(100), height: hp(50) },
  content: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
