import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimeGrid from '~/components/shared/AnimeGrid';
import ErrorScreen from '~/components/shared/ErrorScreen';
import LoadingScreen from '~/components/shared/LoadingScreen';
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
    isFetching,
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

  if (isLoading || (source && isFetching && items.length === 0)) {
    return <LoadingScreen />;
  }

  if (isError) {
    return <ErrorScreen message="Unable to load this catalogue." />;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-neutral-950">
      <ScreenHeader title={displayTitle} />

      <AnimeGrid
        data={items}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        isFetchingNextPage={isFetchingNextPage}
      />
    </SafeAreaView>
  );
}
