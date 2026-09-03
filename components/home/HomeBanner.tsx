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

    {/* Subtle top fade for status bar */}
    <LinearGradient
      colors={['rgba(10,10,14,0.6)', 'transparent']}
      style={styles.topFade}
      pointerEvents="none"
    />

    {/* Strong bottom fade — image dissolves cleanly into dark bg */}
    <LinearGradient
      colors={['transparent', 'rgba(10,10,14,0.35)', 'rgba(10,10,14,0.82)', 'rgba(10,10,14,1)']}
      locations={[0, 0.42, 0.72, 1]}
      style={styles.bottomFade}
      pointerEvents="none"
    />
  </View>
);

export default HomeBanner;

const styles = StyleSheet.create({
  container: {
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
    height: 80,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: hp(32),
  },
});
