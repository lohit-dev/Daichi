import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2 } from 'iconsax-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimeCard from '~/components/shared/AnimeCard';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp } from '~/helpers/common';
import { fetchAniListBrowse, BrowseCategory } from '~/services/AniListService';
import { Anime } from '~/types';

// ─── Category slug → fallback display title ────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  trending: 'Hot Trends',
  airing: 'Top Airing Now',
  upcoming: 'Upcoming Releases',
  popular: 'Hot Trends',
  completed: 'Completed Series',
  recent: 'Latest Episodes',
};

const NUM_COLUMNS = 3;
const PER_PAGE = 24;

export default function BrowseScreen() {
  const router = useRouter();
  const { category, title } = useLocalSearchParams<{
    category: BrowseCategory;
    title?: string;
  }>();

  const displayTitle = title
    ? decodeURIComponent(title as string)
    : (CATEGORY_LABELS[category as string] ?? 'Browse');

  // ─── Infinite query ────────────────────────────────────────────────────────────
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

  // Flatten pages into one array
  const items: Anime[] = data?.pages.flatMap((p) => p.results) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: Anime; index: number }) => <AnimeCard item={item} index={index} />,
    []
  );

  const ListFooter = useCallback(
    () =>
      isFetchingNextPage ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#a3e635" />
        </View>
      ) : null,
    [isFetchingNextPage]
  );

  // ─── States ────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Text>
        <ScalePressable onPress={() => refetch()} style={styles.retryBtn} haptic="medium">
          <Text style={styles.retryText}>Retry</Text>
        </ScalePressable>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <ScalePressable
          onPress={() => router.back()}
          style={styles.backBtn}
          scaleTo={0.85}
          accessibilityLabel="Go back">
          <ArrowLeft2 size={22} color="#fff" />
        </ScalePressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {getFormattedTitle(displayTitle)}
        </Text>

        {/* right spacer keeps title centred — transparent */}
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* ── Infinite grid ── */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.slug}
        numColumns={NUM_COLUMNS}
        renderItem={renderItem}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        windowSize={5}
        removeClippedSubviews
      />

      {/* global loading indicator while first page refetches */}
      {isFetching && !isFetchingNextPage && items.length === 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ActivityIndicator size="large" color="#a3e635" style={{ marginTop: hp(40) }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: 'Salsa-Regular',
    fontSize: 22,
    marginHorizontal: 8,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: hp(10),
    paddingHorizontal: wp(1),
  },
  row: {
    justifyContent: 'flex-start',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    backgroundColor: '#bef264',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#182008',
    fontSize: 15,
    fontWeight: '700',
  },
});
