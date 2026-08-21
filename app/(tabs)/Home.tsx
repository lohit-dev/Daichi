import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
  View,
  ViewabilityConfig,
  ViewabilityConfigCallbackPair,
  ViewToken,
} from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimeBannerText from '~/components/home/AnimeBannerText';
import ContinueWatchingRow from '~/components/home/ContinueWatchingRow';
import Gradient from '~/components/home/Gradient';
import HomeBanner from '~/components/home/HomeBanner';
import HomeButtons from '~/components/home/HomeButtons';
import RowItem from '~/components/home/RowItem';
import ErrorScreen from '~/components/shared/ErrorScreen';
import LoadingScreen from '~/components/shared/LoadingScreen';
import { fetchAniListHomePage } from '~/services/AniListService';
import { Anime } from '~/types';

const AUTOPLAY_INTERVAL_MS = 4_500;

const Home = () => {
  const { width } = useWindowDimensions();
  const {
    data: homePageData,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['anilist', 'home'],
    queryFn: fetchAniListHomePage,
  });

  const [spotlightAnime, setSpotlightAnime] = useState<Anime[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  const x = useSharedValue(0);
  const bannerRef = useAnimatedRef<Animated.FlatList<Anime>>();
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewabilityConfig = useRef<ViewabilityConfig>({ itemVisiblePercentThreshold: 50 });
  const bannerViewabilityPairs = useRef<ViewabilityConfigCallbackPair[]>([
    {
      viewabilityConfig: viewabilityConfig.current,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const visibleIndex = viewableItems.find((item) => item.isViewable)?.index;
        if (visibleIndex !== null && visibleIndex !== undefined) {
          setActiveIndex(visibleIndex);
        }
      },
    },
  ]);

  // Three copies create a continuous window in both directions. We always
  // re-centre onto the same item after settling at either outer copy, so the
  // reposition itself is invisible to the user.
  const loopedSpotlight = useMemo(
    () =>
      spotlightAnime.length > 1
        ? [...spotlightAnime, ...spotlightAnime, ...spotlightAnime]
        : spotlightAnime,
    [spotlightAnime]
  );

  const activeAnime = loopedSpotlight[activeIndex] ?? spotlightAnime[0];

  const openDetails = useCallback((anime: Anime) => {
    router.push({
      pathname: '/anime/[id]',
      params: { id: anime.slug, poster: anime.image },
    });
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      x.value = event.contentOffset.x;
    },
  });

  useEffect(() => {
    const spotlight = homePageData?.data?.spotlight ?? [];
    const startIndex = spotlight.length > 1 ? spotlight.length : 0;

    setSpotlightAnime(spotlight);
    setActiveIndex(startIndex);

    if (spotlight.length > 1) {
      requestAnimationFrame(() => {
        bannerRef.current?.scrollToOffset({
          offset: startIndex * width,
          animated: false,
        });
      });
    }
  }, [bannerRef, homePageData, width]);

  const handleBannerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!spotlightAnime.length || width <= 0) return;

      const visibleIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      let nextIndex = visibleIndex;

      if (spotlightAnime.length > 1) {
        if (visibleIndex < spotlightAnime.length) {
          nextIndex = visibleIndex + spotlightAnime.length;
        } else if (visibleIndex >= spotlightAnime.length * 2) {
          nextIndex = visibleIndex - spotlightAnime.length;
        }

        if (nextIndex !== visibleIndex) {
          bannerRef.current?.scrollToOffset({
            offset: nextIndex * width,
            animated: false,
          });
        }
      }

      setActiveIndex(nextIndex);
      setIsAutoPlay(true);
    },
    [bannerRef, spotlightAnime.length, width]
  );

  useEffect(() => {
    if (!isAutoPlay || spotlightAnime.length < 2) return;

    autoplayRef.current = setInterval(() => {
      const nextIndex = activeIndex + 1;
      bannerRef.current?.scrollToOffset({ offset: nextIndex * width, animated: true });
    }, AUTOPLAY_INTERVAL_MS);

    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [activeIndex, bannerRef, isAutoPlay, spotlightAnime.length, width]);

  if (isLoading) return <LoadingScreen />;

  if (error) return <ErrorScreen />;

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-neutral-950">
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        scrollEventThrottle={16}>
        {activeAnime ? (
          <HomeBanner item={activeAnime} onPress={() => openDetails(activeAnime)} />
        ) : null}
        <Gradient />

        <View className="flex flex-col">
          <Animated.FlatList
            bounces={false}
            data={loopedSpotlight}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            horizontal
            initialNumToRender={9}
            keyExtractor={(item, index) => `spotlight-${item.slug}-${index}`}
            maxToRenderPerBatch={9}
            onMomentumScrollEnd={handleBannerMomentumEnd}
            onScroll={onScroll}
            onScrollBeginDrag={() => setIsAutoPlay(false)}
            pagingEnabled
            ref={bannerRef}
            removeClippedSubviews
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            viewabilityConfigCallbackPairs={bannerViewabilityPairs.current}
            windowSize={5}
            renderItem={({ item, index }) => (
              <AnimeBannerText item={item} index={index} x={x} onPress={() => openDetails(item)} />
            )}
          />

          <HomeButtons anime={activeAnime} />

          <RowItem
            name="Hot Trends"
            seeAll
            category="popular"
            data={homePageData?.data?.topTables?.newlyAdded}
            rounded
          />
          <ContinueWatchingRow />
          <RowItem
            name="Latest Episodes"
            seeAll
            category="recent"
            data={homePageData?.data?.recentUpdates}
            testIdPrefix="latest-episode"
          />
          <RowItem
            name="Upcoming Releases"
            seeAll
            category="upcoming"
            data={homePageData?.data?.upcoming}
          />
          <RowItem
            name="Top Airing Now"
            seeAll
            category="airing"
            data={homePageData?.data?.topTables?.newReleases}
          />
          <RowItem
            name="Completed Series"
            seeAll
            category="completed"
            data={homePageData?.data?.topTables?.justCompleted}
            className="mb-44"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;
