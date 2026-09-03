import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type HomeBannerProps = {
  item: Anime;
  onPress: () => void;
};

const HomeBanner = ({ item, onPress }: HomeBannerProps) => {
  const [currentImage, setCurrentImage] = useState(item.image);
  const [prevImage, setPrevImage] = useState<string | null>(null);

  const fadeAnim = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (item.image && item.image !== currentImage) {
      setPrevImage(currentImage);
      setCurrentImage(item.image);

      fadeAnim.value = 0;
      fadeAnim.value = withTiming(1, {
        duration: 450,
        easing: Easing.out(Easing.quad),
      });

      scale.value = 1;
      scale.value = withTiming(1.02, {
        duration: 6000,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [item.image]);

  const newImageStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} testID="home-hero-banner" style={styles.container}>
      {/* Previous image stays visible underneath — screen NEVER flashes black */}
      {prevImage ? (
        <Animated.Image source={{ uri: prevImage }} style={styles.image} resizeMode="cover" />
      ) : null}

      {/* New image crossfades smoothly on top */}
      <Animated.Image
        source={{ uri: currentImage }}
        style={[styles.image, newImageStyle]}
        resizeMode="cover"
      />
    </Pressable>
  );
};

export default HomeBanner;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: wp(100),
    height: hp(56),
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: wp(100),
    height: hp(56),
  },
});
