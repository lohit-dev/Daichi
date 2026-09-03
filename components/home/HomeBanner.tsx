import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type HomeBannerProps = {
  item: Anime;
  onPress: () => void;
};

const HomeBanner = ({ item, onPress }: HomeBannerProps) => {
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
    <Pressable onPress={onPress} style={styles.container} testID="home-hero-banner">
      <Animated.Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />

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

      {/* Title and metadata attached to the slide */}
      <View style={styles.content}>
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
      </View>
    </Pressable>
  );
};

export default HomeBanner;

const styles = StyleSheet.create({
  container: {
    width: wp(100),
    height: hp(50),
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
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
  content: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 4,
  },
});
