import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type HomeBannerProps = {
  item: Anime;
  onPress: () => void;
};

const HomeBanner = ({ item }: HomeBannerProps) => (
  <View style={styles.container} testID="home-hero-banner">
    <Animated.Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />

    {/* Dark scrim over the entire image — tames light/white source images */}
    <LinearGradient
      colors={['rgba(10,10,14,0.22)', 'rgba(10,10,14,0.08)']}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />

    {/* Top status-bar fade */}
    <LinearGradient
      colors={['rgba(10,10,14,0.75)', 'transparent']}
      style={styles.topFade}
      pointerEvents="none"
    />

    {/* Deep bottom fade — starts at 35% from bottom, fully opaque at bottom */}
    <LinearGradient
      colors={[
        'transparent',
        'rgba(10,10,14,0.25)',
        'rgba(10,10,14,0.7)',
        'rgba(10,10,14,0.95)',
        'rgba(10,10,14,1)',
      ]}
      locations={[0, 0.3, 0.6, 0.85, 1]}
      style={styles.bottomFade}
      pointerEvents="none"
    />
  </View>
);

export default HomeBanner;

const styles = StyleSheet.create({
  container: {
    width: wp(100),
    height: hp(56),
  },
  image: {
    width: wp(100),
    height: hp(56),
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
