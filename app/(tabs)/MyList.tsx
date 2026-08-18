import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo } from 'react';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavedAnimesStore } from '~/app/_store/useSavedAnimesStore';
import AnimeCard from '~/components/shared/AnimeCard';
import { getFormattedTitle } from '~/helpers/TextFormat';

const MyList = () => {
  const savedAnimes = useSavedAnimesStore((s) => s.animes);
  const libraryAnimes = useMemo(() => {
    const seen = new Set<string>();
    return savedAnimes.filter((anime) => {
      if (!anime.slug || seen.has(anime.slug)) return false;
      seen.add(anime.slug);
      return true;
    });
  }, [savedAnimes]);

  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(0, (screenWidth - 32) / 3);
  const renderLibraryCard = useCallback(
    ({ item, index }: { item: (typeof libraryAnimes)[number]; index: number }) => (
      <View style={{ width: cardWidth, marginBottom: 14 }}>
        <AnimeCard item={item} index={index} width={Math.max(0, cardWidth - 16)} />
      </View>
    ),
    [cardWidth]
  );

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-neutral-950">
      <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-72">
        <LinearGradient
          colors={['rgba(163, 230, 53, 0.2)', 'transparent']}
          className="h-72 w-full rounded-full"
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={libraryAnimes}
        numColumns={3}
        keyExtractor={(item) => item.slug}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 16 }}
        columnWrapperStyle={{ justifyContent: 'flex-start' }}
        removeClippedSubviews
        initialNumToRender={9}
        maxToRenderPerBatch={9}
        windowSize={7}
        updateCellsBatchingPeriod={40}
        ListHeaderComponent={
          <View className="mt-16 items-center px-6 pt-8">
            <Text className="pt-6 font-salsa text-5xl text-white">
              {getFormattedTitle('My Library', 'text-5xl font-salsa font-semibold')}
            </Text>
            <Text className="mt-2 font-salsa text-lg text-neutral-400">
              {getFormattedTitle(
                `${libraryAnimes.length} Saved Anime`,
                'text-lg font-salsa font-semibold'
              )}
            </Text>
          </View>
        }
        renderItem={renderLibraryCard}
        ListEmptyComponent={
          <View className="items-center justify-center p-8 pt-20">
            <Text className="text-center font-salsa text-2xl text-neutral-400">
              Your library is empty{'\n'}Add some anime to get started!
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default MyList;
