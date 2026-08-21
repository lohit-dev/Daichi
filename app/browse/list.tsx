import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimeGrid from '~/components/shared/AnimeGrid';
import ScreenHeader from '~/components/shared/ScreenHeader';
import { fetchAniListDubbedPage, fetchAniListSubbedPage } from '~/services/AniListService';
import { Anime } from '~/types';

export default function StaticListScreen() {
  const { title, data, source } = useLocalSearchParams<{
    title?: string;
    data?: string;
    source?: 'subbed' | 'dubbed';
  }>();

  const {
    data: pages,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['anilist', 'paged', source],
    queryFn: ({ pageParam = 1 }) =>
      source === 'subbed'
        ? fetchAniListSubbedPage(pageParam as number)
        : fetchAniListDubbedPage(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
    enabled: Boolean(source),
    staleTime: 10 * 60 * 1000,
  });

  const items: Anime[] = useMemo(() => {
    if (source) return pages?.pages.flatMap((p) => p.results) ?? [];
    if (!data) return [];
    try {
      return JSON.parse(decodeURIComponent(data as string)) as Anime[];
    } catch {
      return [];
    }
  }, [pages, data, source]);

  const displayTitle = title ? decodeURIComponent(title as string) : 'Anime';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-neutral-950">
      <ScreenHeader title={displayTitle} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#a3e635" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-white/50">Unable to load this catalogue.</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-white/50">No titles found.</Text>
        </View>
      ) : (
        <AnimeGrid
          data={items}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          isFetchingNextPage={isFetchingNextPage}
        />
      )}
    </SafeAreaView>
  );
}
