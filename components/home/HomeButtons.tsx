import { useRouter } from 'expo-router';
import { Add, Play, TickCircle } from 'iconsax-react-native';
import React from 'react';
import { Alert, Text, View } from 'react-native';

import { useSavedAnimesStore } from '~/store/useSavedAnimesStore';
import ScalePressable from '~/components/shared/ScalePressable';
import { Anime } from '~/types';

type HomeButtonsProps = {
  anime?: Anime;
};

const HomeButtons = ({ anime }: HomeButtonsProps) => {
  const router = useRouter();
  const savedAnimes = useSavedAnimesStore((state) => state.animes);
  const addAnime = useSavedAnimesStore((state) => state.addAnime);
  const removeAnime = useSavedAnimesStore((state) => state.removeAnime);
  const isInLibrary = Boolean(
    anime && savedAnimes.some((savedAnime) => savedAnime.slug === anime.slug)
  );

  const handlePlayTrailer = () => {
    if (!anime?.trailer?.id || anime.trailer.site?.toLowerCase() !== 'youtube') {
      Alert.alert('Trailer unavailable', 'A trailer is not available for this title yet.');
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
  };

  return (
    <View className="flex-row justify-center gap-4 px-10 pb-0 pt-2">
      <ScalePressable
        className="flex-1 flex-row items-center justify-center gap-2 space-x-2 rounded-3xl bg-lime-300 py-3"
        disabled={!anime}
        haptic="none"
        onPress={handlePlayTrailer}>
        <Play size={22} color="#000" variant="Bold" />
        <Text className="text-base font-semibold text-black">Play Trailer</Text>
      </ScalePressable>

      <ScalePressable
        className={`flex-1 flex-row items-center justify-center gap-2 space-x-2 rounded-3xl border py-3 ${isInLibrary ? 'border-lime-300 bg-lime-300/15' : 'border-gray-500 bg-transparent'}`}
        disabled={!anime}
        haptic="none"
        onPress={handleLibrary}>
        {isInLibrary ? (
          <TickCircle size={22} variant="Bold" color="#bef264" />
        ) : (
          <Add size={22} variant="Broken" color="#FFF" />
        )}
        <Text className={`text-base font-semibold ${isInLibrary ? 'text-lime-300' : 'text-white'}`}>
          {isInLibrary ? 'In My List' : 'My List'}
        </Text>
      </ScalePressable>
    </View>
  );
};

export default HomeButtons;
