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
      className="flex-row justify-evenly gap-4 px-5 pb-3 pt-1">
      <ScalePressable
        className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-lime-300 py-[13px]"
        disabled={!anime}
        haptic="none"
        onPress={handlePlayTrailer}>
        <Play size={20} color="#000" variant="Bold" />
        <Text className="text-base font-bold text-black">Play Trailer</Text>
      </ScalePressable>

      <ScalePressable
        className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl border py-[13px] ${isInLibrary ? 'border-lime-300 bg-lime-300/10' : 'border-white/20 bg-white/[0.07]'}`}
        disabled={!anime}
        haptic="none"
        onPress={handleLibrary}>
        {isInLibrary ? (
          <TickCircle size={20} variant="Bold" color="#bef264" />
        ) : (
          <Add size={20} variant="Broken" color="#FFF" />
        )}
        <Text className={`text-base font-bold ${isInLibrary ? 'text-lime-300' : 'text-white'}`}>
          {isInLibrary ? 'In My List' : 'My List'}
        </Text>
      </ScalePressable>
    </Animated.View>
  );

};

export default HomeButtons;
