import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type HomeBannerProps = {
  item: Anime;
  onPress: () => void;
};

const HomeBanner = ({ item, onPress }: HomeBannerProps) => (
  <View style={styles.container} pointerEvents="box-none" testID="home-hero-banner">
    <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
      <Animated.Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
    </Pressable>

    {/* Subtle dark scrim — ensures light/white images have contrast with white text */}
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

    {/* Deep bottom fade — image seamlessly dissolves into the dark background */}
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
  </View>
);

export default HomeBanner;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: wp(100),
    height: hp(58),
  },
  image: {
    width: wp(100),
    height: hp(58),
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
    height: hp(42),
  },
});
