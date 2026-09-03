import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

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
    const translateX = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-28, 0, 28],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ translateX }] };
  });

  // Comma-separated genres — no trailing comma
  const genreText = (item.genres ?? []).slice(0, 4).join(', ');

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {item.title}
        </Text>
        {genreText ? (
          <Text style={styles.genres} numberOfLines={1}>
            {genreText}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
};

export default AnimeBannerText;

const styles = StyleSheet.create({
  pressable: {
    width: wp(100),
    height: hp(48),
  },
  content: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: wp(5),
    gap: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: 'Salsa-Regular',
    fontWeight: '700',
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  genres: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
});
