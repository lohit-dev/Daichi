import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimeGrid from '~/components/shared/AnimeGrid';
import ScalePressable from '~/components/shared/ScalePressable';
import ScreenHeader from '~/components/shared/ScreenHeader';
import { fetchAniListBrowse, BrowseCategory } from '~/services/AniListService';
import { Anime } from '~/types';

const CATEGORY_LABELS: Record<string, string> = {
  trending: 'Hot Trends',
  airing: 'Top Airing Now',
  upcoming: 'Upcoming Releases',
  popular: 'Hot Trends',
  completed: 'Completed Series',
  recent: 'Latest Episodes',
};

const PER_PAGE = 24;

export default function BrowseScreen() {
  const { category, title } = useLocalSearchParams<{
    category: BrowseCategory;
    title?: string;
  }>();

  const displayTitle = title
    ? decodeURIComponent(title as string)
    : (CATEGORY_LABELS[category as string] ?? 'Browse');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['browse', category],
    queryFn: ({ pageParam = 1 }) =>
      fetchAniListBrowse(category as BrowseCategory, pageParam as number, PER_PAGE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const items: Anime[] = data?.pages.flatMap((p) => p.results) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-neutral-950">
        <Text className="px-6 text-center text-[15px] text-white/70">
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Text>
        <ScalePressable
          onPress={() => refetch()}
          className="rounded-xl bg-lime-200 px-6 py-3"
          haptic="medium">
          <Text className="text-[15px] font-bold text-[#182008]">Retry</Text>
        </ScalePressable>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-neutral-950">
      <ScreenHeader title={displayTitle} />

      <AnimeGrid
        data={items}
        onEndReached={handleEndReached}
        isFetchingNextPage={isFetchingNextPage}
      />

      {/* Full-screen spinner while refetching an empty list — needs absoluteFill */}
      {isFetching && !isFetchingNextPage && items.length === 0 && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          className="items-center justify-center">
          <ActivityIndicator size="large" color="#a3e635" />
        </View>
      )}
    </SafeAreaView>
  );
}
