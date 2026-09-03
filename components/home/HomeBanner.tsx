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
    {/* Full-bleed hero image */}
    <Animated.Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />

    {/* Left-side vignette for text legibility */}
    <LinearGradient
      colors={['rgba(10,10,14,0.75)', 'transparent']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 0.6, y: 0.5 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />

    {/* Top status-bar fade */}
    <LinearGradient
      colors={['rgba(10,10,14,0.9)', 'transparent']}
      style={styles.topFade}
      pointerEvents="none"
    />

    {/* Strong bottom content fade — text & buttons sit here */}
    <LinearGradient
      colors={['transparent', 'rgba(10,10,14,0.6)', 'rgba(10,10,14,1)']}
      locations={[0, 0.5, 1]}
      style={styles.bottomFade}
      pointerEvents="none"
    />
  </View>
);

export default HomeBanner;

const styles = StyleSheet.create({
  container: {
    width: wp(100),
    height: hp(62),
  },
  image: {
    width: wp(100),
    height: hp(62),
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
    height: hp(30),
  },
});
