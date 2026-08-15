import { useRouter } from 'expo-router';
import { Star1 } from 'iconsax-react-native';
import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import ScalePressable from './ScalePressable';

import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';
const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

// Cap the stagger delay so long lists don't take forever to appear.
// Only the first few visible items get a noticeable cascade; after that
// the delay plateaus and everything fades in almost together.
const MAX_STAGGER_ITEMS = 6;
const STAGGER_DELAY_MS = 80;

interface AnimeCardProps {
  item: Anime;
  index: number;
  detailsEnabled?: boolean;
  width?: number;
  testID?: string;
}

const AnimeCard: React.FC<AnimeCardProps> = React.memo(
  ({ item, index, detailsEnabled = true, width, testID }) => {
    const router = useRouter();

    const handleNavigation = () => {
      router.push({ pathname: '/anime/[id]', params: { id: item.slug, poster: item.image } });
    };

    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, MAX_STAGGER_ITEMS) * STAGGER_DELAY_MS).duration(
          400
        )}
        className="flex-1 items-center justify-center p-2">
        <ScalePressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={item.title || 'anime card'}
          onPress={handleNavigation}
          scaleTo={0.92}>
          <View className="overflow-hidden rounded-2xl">
            <AnimatedImageBackground
              source={{ uri: item.image }}
              style={[styles.Image, width ? { width, height: width * IMAGE_ASPECT_RATIO } : null]}>
              {detailsEnabled && (
                <View className="flex-1 items-end justify-start p-2">
                  <View className="flex-row items-center justify-center space-x-1 rounded-full bg-lime-200 px-2 py-[2]">
                    {item.rating ? (
                      <View className="flex flex-row items-center justify-center gap-1">
                        <Star1 variant="Bold" size={12} color="#000" />
                        <Text className="font-salsa text-black">{item.rating}</Text>
                      </View>
                    ) : (
                      <Text className="font-salsa font-bold text-black">
                        {item.type || 'Anime'}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </AnimatedImageBackground>
          </View>
        </ScalePressable>
      </Animated.View>
    );
  }
);

export default AnimeCard;

const styles = StyleSheet.create({
  Image: {
    width: wp(28),
    height: hp(19),
  },
});

const IMAGE_ASPECT_RATIO = hp(19) / wp(28);
