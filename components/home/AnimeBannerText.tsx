import { useRouter } from 'expo-router';
import { Add, Play, TickCircle } from 'iconsax-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useToast } from 'react-native-toast-notifications';

import { useSavedAnimesStore } from '~/app/_store/useSavedAnimesStore';
import ScalePressable from '~/components/shared/ScalePressable';
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
  const router = useRouter();
  const toast = useToast();

  const savedAnimes = useSavedAnimesStore((state) => state.animes);
  const addAnime = useSavedAnimesStore((state) => state.addAnime);
  const removeAnime = useSavedAnimesStore((state) => state.removeAnime);
  const isInLibrary = Boolean(
    item && savedAnimes.some((savedAnime) => savedAnime.slug === item.slug)
  );

  const handlePlayTrailer = () => {
    if (!item?.trailer?.id || item.trailer.site?.toLowerCase() !== 'youtube') {
      toast.show('A trailer is not available for this title yet.', {
        type: 'normal',
        placement: 'bottom',
      });
      return;
    }

    router.push({
      pathname: '/trailer/[videoId]',
      params: {
        videoId: item.trailer.id,
        title: item.title,
      },
    });
  };

  const handleLibrary = () => {
    if (!item) return;

    if (isInLibrary) {
      removeAnime(item.slug);
    } else {
      addAnime(item);
    }

    toast.show(isInLibrary ? 'Removed from My List' : 'Added to My List', {
      type: 'success',
      placement: 'bottom',
      duration: 1800,
    });
  };

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

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View className="absolute bottom-3 left-0 right-0 items-center px-4">
        {/* Title and details - pressable to open anime details */}
        <Pressable onPress={onPress} className="w-full items-center">
          <Text
            className="px-2 pt-1 text-center font-salsa text-3xl font-semibold text-white"
            numberOfLines={2}
            ellipsizeMode="tail">
            {getFormattedTitle(item.title || '', 'text-4xl font-salsa')}
          </Text>

          <View className="flex-row flex-wrap items-center justify-center px-12 pt-1">
            {[item.type || item.quality, item.date].filter(Boolean).map((info, i, arr) => (
              <React.Fragment key={i}>
                <Text
                  className={`font-salsa text-base font-semibold text-gray-300 ${i === 0 ? 'text-lg text-lime-300' : ''}`}>
                  {info}
                </Text>
                {i < arr.length - 1 && (
                  <Text className="font-salsa text-2xl text-lime-300"> • </Text>
                )}
              </React.Fragment>
            ))}
          </View>
        </Pressable>

        {/* Action buttons mixed directly into the banner item */}
        <View className="w-full flex-row justify-center gap-4 px-10 pt-3">
          <ScalePressable
            className="flex-1 flex-row items-center justify-center gap-2 space-x-2 rounded-3xl bg-lime-300 py-3"
            haptic="none"
            onPress={handlePlayTrailer}>
            <Play size={22} color="#000" variant="Bold" />
            <Text className="text-base font-semibold text-black">Play Trailer</Text>
          </ScalePressable>

          <ScalePressable
            className={`flex-1 flex-row items-center justify-center gap-2 space-x-2 rounded-3xl border py-3 ${
              isInLibrary ? 'border-lime-300 bg-lime-300/15' : 'border-gray-500 bg-transparent'
            }`}
            haptic="none"
            onPress={handleLibrary}>
            {isInLibrary ? (
              <TickCircle size={22} variant="Bold" color="#bef264" />
            ) : (
              <Add size={22} variant="Broken" color="#FFF" />
            )}
            <Text
              className={`text-base font-semibold ${isInLibrary ? 'text-lime-300' : 'text-white'}`}>
              {isInLibrary ? 'In My List' : 'My List'}
            </Text>
          </ScalePressable>
        </View>
      </View>
    </Animated.View>
  );
};

export default AnimeBannerText;

const styles = StyleSheet.create({
  container: { width: wp(100), height: hp(58) },
});
