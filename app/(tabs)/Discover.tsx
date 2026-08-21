import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import LottieView from 'lottie-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import RowItem from '~/components/home/RowItem';
import SearchInput from '~/components/search/SearchInput';
import AnimeGrid from '~/components/shared/AnimeGrid';
import ErrorScreen from '~/components/shared/ErrorScreen';
import LoadingScreen from '~/components/shared/LoadingScreen';
import { wp } from '~/helpers/common';
import { useDebounce } from '~/hooks/useDebounce';
import {
  fetchAniListDubbed,
  fetchAniListSearch,
  fetchAniListSubbed,
} from '~/services/AniListService';
import { Anime, SearchResponse } from '~/types';

const Discover = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const normalizedSearchQuery = searchQuery.trim();
  const normalizedDebouncedSearchQuery = debouncedSearchQuery.trim();
  const hasSearchQuery = normalizedSearchQuery.length > 0;

  // Query for search results based on the search query
  const {
    data: SearchResults,
    error: searchError,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<SearchResponse>({
    queryKey: ['anilist', 'search', normalizedDebouncedSearchQuery],
    queryFn: ({ pageParam = 1 }) =>
      fetchAniListSearch({ q: normalizedDebouncedSearchQuery, page: pageParam as number }),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!normalizedDebouncedSearchQuery,
  });

  const { data: subbedAnime = [], isLoading: isSubbedLoading } = useQuery<Anime[]>({
    queryKey: ['anilist', 'subbed'],
    queryFn: fetchAniListSubbed,
    staleTime: 10 * 60 * 1000,
  });

  const { data: dubbedAnime = [], isLoading: isDubbedLoading } = useQuery<Anime[]>({
    queryKey: ['anilist', 'dubbed'],
    queryFn: fetchAniListDubbed,
    staleTime: 10 * 60 * 1000,
  });

  const isCatalogueLoading = isSubbedLoading || isDubbedLoading;

  const searchAnimes = useMemo(
    () => (SearchResults?.pages.flatMap((page: SearchResponse) => page.results) ?? []) as Anime[],
    [SearchResults]
  );
  const isDebouncing = normalizedSearchQuery !== normalizedDebouncedSearchQuery;
  const isSearchLoading = hasSearchQuery && (isLoading || isDebouncing);

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-neutral-950">
      {/* Search Input */}
      <SearchInput text={searchQuery} onChangeText={setSearchQuery} />

      {/* Conditional Rendering: Show only when searchQuery is empty */}
      {!hasSearchQuery && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}>
          {/* Title Section */}
          <Animated.View entering={FadeInDown.delay(400).duration(800)}>
            <Text className="text-center font-salsa text-white" style={{ fontSize: wp(10) }}>
              What are you{'\n'}
              <Text>Looking for ?</Text>
            </Text>
            <Text
              className="mt-2 text-wrap text-center font-sans text-lg font-semibold text-neutral-400"
              numberOfLines={2}>
              Find your Favorite Anime Between more{'\n'}
              <Text>Than 10,000 Anime</Text>
            </Text>
          </Animated.View>

          {isCatalogueLoading && (
            <View className="items-center py-12">
              <LoadingScreen />
            </View>
          )}
          {subbedAnime.length > 0 && (
            <RowItem
              data={subbedAnime}
              name="Subbed Anime"
              staticData={subbedAnime}
              staticQuery="subbed"
              seeAll
            />
          )}
          {dubbedAnime.length > 0 && (
            <RowItem
              data={dubbedAnime}
              name="Dubbed Anime"
              staticData={dubbedAnime}
              staticQuery="dubbed"
              seeAll
            />
          )}
        </ScrollView>
      )}

      {hasSearchQuery && isSearchLoading && <LoadingScreen />}

      {hasSearchQuery && !isSearchLoading && searchError && <ErrorScreen />}

      {/* Search Results */}
      {hasSearchQuery && !isSearchLoading && searchAnimes.length > 0 && (
        <AnimeGrid
          data={searchAnimes}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          isFetchingNextPage={isFetchingNextPage}
          contentPaddingBottom={110}
        />
      )}

      {/* Empty state if no search results */}
      {hasSearchQuery && !isSearchLoading && !searchError && searchAnimes.length === 0 && (
        <View className="flex-1 items-center justify-center pb-24">
          <LottieView
            source={require('~/assets/lottie/no_results_found.json')}
            autoPlay
            loop
            style={{
              height: wp(60),
              width: wp(60),
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

export default Discover;
