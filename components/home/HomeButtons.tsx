import { useRouter } from 'expo-router';
import { Add, Play, TickCircle } from 'iconsax-react-native';
import React from 'react';
import { Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useToast } from 'react-native-toast-notifications';

import { useSavedAnimesStore } from '~/app/_store/useSavedAnimesStore';
import ScalePressable from '~/components/shared/ScalePressable';
import { Anime } from '~/types';

type HomeButtonsProps = {
  anime?: Anime;
};

const HomeButtons = ({ anime }: HomeButtonsProps) => {
  const router = useRouter();
  const toast = useToast();
  const savedAnimes = useSavedAnimesStore((state) => state.animes);
  const addAnime = useSavedAnimesStore((state) => state.addAnime);
  const removeAnime = useSavedAnimesStore((state) => state.removeAnime);
  const isInLibrary = Boolean(
    anime && savedAnimes.some((savedAnime) => savedAnime.slug === anime.slug)
  );

  const handlePlayTrailer = () => {
    if (!anime?.trailer?.id || anime.trailer.site?.toLowerCase() !== 'youtube') {
      toast.show('A trailer is not available for this title yet.', {
        type: 'normal',
        placement: 'bottom',
      });
      return;
    }

    router.push({
      pathname: '/trailer/[videoId]',
      params: {
        videoId: anime.trailer.id,
        title: anime.title,
      },
    });
  };

  const handleLibrary = () => {
    if (!anime) return;

    if (isInLibrary) {
      removeAnime(anime.slug);
    } else {
      addAnime(anime);
    }

    toast.show(isInLibrary ? 'Removed from My List' : 'Added to My List', {
      type: 'success',
      placement: 'bottom',
      duration: 1800,
    });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(400).duration(500)}
      className="flex-row justify-evenly gap-5 px-16">
      <ScalePressable
        className="flex-1 flex-row items-center justify-center gap-2 space-x-2 rounded-3xl bg-lime-300 p-3"
        disabled={!anime}
        haptic="none"
        onPress={handlePlayTrailer}>
        <Play size={24} color="#000" variant="Bold" />
        <Text className="text-lg font-semibold text-black">Play Trailer</Text>
      </ScalePressable>

      <ScalePressable
        className={`flex-1 flex-row items-center justify-center gap-2 space-x-2 rounded-3xl border p-3 ${isInLibrary ? 'border-lime-300 bg-lime-300/15' : 'border-gray-500 bg-transparent'}`}
        disabled={!anime}
        haptic="none"
        onPress={handleLibrary}>
        {isInLibrary ? (
          <TickCircle size={24} variant="Bold" color="#bef264" />
        ) : (
          <Add size={24} variant="Broken" color="#FFF" />
        )}
        <Text className={`text-lg font-semibold ${isInLibrary ? 'text-lime-300' : 'text-white'}`}>
          {isInLibrary ? 'In My List' : 'My List'}
        </Text>
      </ScalePressable>
    </Animated.View>
  );
};

export default HomeButtons;
