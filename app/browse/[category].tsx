import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimeGrid from '~/components/shared/AnimeGrid';
import ErrorScreen from '~/components/shared/ErrorScreen';
import LoadingScreen from '~/components/shared/LoadingScreen';
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

  if (isLoading || (isFetching && items.length === 0)) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <ErrorScreen
        message={error instanceof Error ? error.message : 'Something went wrong.'}
        onRetry={() => refetch()}
      />
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
    </SafeAreaView>
  );
}
