import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type HomeBannerProps = {
  item: Anime;
  onPress: () => void;
};

const HomeBanner = ({ item, onPress }: HomeBannerProps) => (
  <Pressable onPress={onPress} testID="home-hero-banner">
    <Animated.Image source={{ uri: item.image }} style={styles.image} />
  </Pressable>
);

export default HomeBanner;

const styles = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFill,
    width: wp(100),
    height: hp(56),
  },
});
