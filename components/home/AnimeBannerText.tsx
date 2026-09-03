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

  const animatedStyle = useAnimatedStyle(() => {
    const translateYAnim = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-50, 0, 50],
      Extrapolation.CLAMP
    );
    const opacityAnim = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-4, 1, -4],
      Extrapolation.CLAMP
    );
    return { opacity: opacityAnim, transform: [{ translateY: translateYAnim }] };
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
      <Animated.View style={[styles.content, animatedStyle]}>
        <Pressable onPress={onPress} className="w-full items-center">
          <Text
            className="px-2 pt-1 text-center font-salsa text-3xl font-semibold text-white"
            numberOfLines={2}
            ellipsizeMode="tail">
            {getFormattedTitle(item.title || '', 'text-4xl font-salsa')}
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
        </Pressable>
      </Animated.View>
    </View>
  );
};

export default AnimeBannerText;

const styles = StyleSheet.create({
  container: { width: wp(100), height: hp(49) },
  content: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
