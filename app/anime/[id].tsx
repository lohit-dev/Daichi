import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft2, Heart, Share } from 'iconsax-react-native';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from 'react-native-toast-notifications';

import { useSavedAnimesStore } from '~/app/_store/useSavedAnimesStore';
import CharacterVoiceActorRow from '~/components/details/CharacterVoiceActorRow';
import EpisodeListSheet from '~/components/details/EpisodeListSheet';
import RowItem from '~/components/home/RowItem';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp } from '~/helpers/common';
import { fetchAniListAnimeById, fetchAniListAnimeExtras } from '~/services/AniListService';
import { AniListAnimeExtras, Anime, AnimeInfoResponse } from '~/types';

type DetailLineProps = {
  label: string;
  value?: string | null;
  accent?: boolean;
};

const DetailLine = ({ label, value, accent = false }: DetailLineProps) => (
  <View style={styles.detailLine}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text numberOfLines={2} style={[styles.detailValue, accent && styles.detailValueAccent]}>
      {value || '—'}
    </Text>
  </View>
);

const AnimeDetails = () => {
  const nav = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [selectedType, setSelectedType] = useState<'sub' | 'dub'>('sub');
  const [isEpisodeSheetOpen, setIsEpisodeSheetOpen] = useState(false);

  const savedAnimes = useSavedAnimesStore((s) => s.animes);
  const addAnime = useSavedAnimesStore((s) => s.addAnime);
  const removeAnime = useSavedAnimesStore((s) => s.removeAnime);

  const {
    data: animeData,
    error,
    isLoading,
  } = useQuery<AnimeInfoResponse>({
    queryKey: ['anilist', 'details', id],
    queryFn: () => fetchAniListAnimeById(id),
  });

  const { data: animeExtras, isLoading: isExtrasLoading } = useQuery<AniListAnimeExtras>({
    queryKey: ['anilist', 'details-extras', animeData?.id],
    queryFn: () => fetchAniListAnimeExtras(animeData!.id),
    enabled: Boolean(animeData?.id),
    staleTime: 15 * 60 * 1000,
  });

  const [isFav, setIsFav] = useState(() => savedAnimes.some((anime) => anime.slug === id));
  const isUpcoming = animeData?.status?.toLowerCase().includes('not yet aired');
  const canWatch = !isUpcoming;
  const bannerImage = animeData?.bannerImage || animeExtras?.bannerImage;
  const heroPan = useSharedValue(0);
  const heroPanDistance = width * 0.23;
  const synopsis = animeData?.synopsis?.trim() || 'No synopsis is available for this title yet.';
  const hasLongSynopsis = synopsis.length > 230;
  const displayedSynopsis =
    showFullDescription || !hasLongSynopsis ? synopsis : `${synopsis.slice(0, 230).trimEnd()}…`;

  useEffect(() => {
    heroPan.value = 0;

    if (!bannerImage) return;

    heroPan.value = withRepeat(
      withTiming(-heroPanDistance, {
        duration: 14_000,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
  }, [bannerImage, heroPan, heroPanDistance]);

  const heroPanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: heroPan.value }],
  }));

  const handleBack = useCallback(() => {
    if (isEpisodeSheetOpen) {
      bottomSheetRef.current?.dismiss();
      return;
    }

    if (nav.canGoBack()) {
      nav.back();
      return;
    }

    nav.replace('/(tabs)/Home');
  }, [isEpisodeSheetOpen, nav]);

  const openEpisodeSheet = useCallback((type: 'sub' | 'dub') => {
    setSelectedType(type);
    setIsEpisodeSheetOpen(true);
    requestAnimationFrame(() => bottomSheetRef.current?.present());
  }, []);

  const handleShare = async () => {
    if (!animeData) return;

    try {
      const deepLink = `animax://anime/${animeData.id}`;
      await RNShare.share({
        title: `Share ${animeData.title}`,
        message: `Watch ${animeData.title} on Animax.\n${deepLink}`,
        url: deepLink,
      });
    } catch (shareError) {
      console.error(shareError);
    }
  };

  const handleAddToLibrary = useCallback(() => {
    if (!animeData) return;

    if (isFav) {
      removeAnime(animeData.id);
    } else {
      const basicAnime: Anime = {
        slug: animeData.id,
        title: animeData.title,
        image: animeData.image,
        synopsis: animeData.synopsis,
        rating: animeData.rating,
        type: animeData.type,
      };
      addAnime(basicAnime);
    }

    setIsFav((current) => !current);
    toast.show(isFav ? 'Removed from library' : 'Added to library', {
      type: 'success',
      placement: 'bottom',
      duration: 2000,
    });
  }, [addAnime, animeData, isFav, removeAnime, toast]);

  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });

      return () => backHandler.remove();
    }, [handleBack])
  );

  if (isLoading) {
    return (
      <View className="flex flex-1 items-center justify-center bg-neutral-950">
        <LottieView
          source={require('~/assets/lottie/loading.json')}
          autoPlay
          loop
          style={{ height: hp(40), width: wp(45) }}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex flex-1 items-center justify-center bg-neutral-950 px-8">
        <LottieView
          source={require('~/assets/lottie/Error.json')}
          autoPlay
          loop
          style={{ height: hp(34), width: wp(70) }}
        />
        <Text className="mt-3 text-center text-xl text-white">
          {error instanceof Error ? error.message : 'An error occurred'}
        </Text>
        <ScalePressable onPress={handleBack} style={styles.errorBackButton} haptic="medium">
          <Text style={styles.errorBackText}>Back to discover</Text>
        </ScalePressable>
      </View>
    );
  }

  if (!animeData) {
    return (
      <View className="flex flex-1 items-center justify-center bg-neutral-950">
        <Text className="text-2xl text-white">No data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {bannerImage ? (
            <Animated.Image
              fadeDuration={0}
              resizeMode="cover"
              source={{ uri: bannerImage }}
              style={[styles.heroImage, { width: width + heroPanDistance }, heroPanStyle]}
            />
          ) : null}
          <LinearGradient
            colors={['rgba(4, 5, 4, 0.12)', 'rgba(4, 5, 4, 0.4)', '#0a0a0a']}
            locations={[0, 0.42, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
            <View style={styles.topBar}>
              <ScalePressable
                accessibilityLabel="Go back"
                onPress={handleBack}
                style={styles.topBarButton}
                scaleTo={0.85}>
                <ArrowLeft2 color="#FFFFFF" size={24} strokeWidth={2.5} />
              </ScalePressable>

              <View style={styles.topBarActions}>
                <ScalePressable
                  accessibilityLabel="Share anime"
                  onPress={handleShare}
                  style={styles.topBarButton}
                  scaleTo={0.85}>
                  <Share color="#FFFFFF" size={22} strokeWidth={2.2} variant="Linear" />
                </ScalePressable>
                <ScalePressable
                  accessibilityLabel={isFav ? 'Remove from library' : 'Add to library'}
                  onPress={handleAddToLibrary}
                  style={[styles.topBarButton, isFav && styles.topBarButtonActive]}
                  scaleTo={0.85}
                  haptic="medium">
                  <Heart
                    color="#FFFFFF"
                    size={22}
                    strokeWidth={2.2}
                    variant={isFav ? 'Bold' : 'Linear'}
                  />
                </ScalePressable>
              </View>
            </View>
          </SafeAreaView>

          <View style={styles.heroFooter}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {isUpcoming ? 'COMING SOON' : animeData.type || 'ANIME'}
              </Text>
            </View>
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.titleBlock}>
          <Image source={{ uri: animeData.image }} style={styles.poster} />
          <View style={styles.titleCopy}>
            <Text style={styles.kicker} numberOfLines={1}>
              {animeData.released || 'Release date unavailable'}
            </Text>
            <Text numberOfLines={3} style={styles.title}>
              {getFormattedTitle(animeData.title)}
            </Text>
            <Text numberOfLines={1} style={styles.alternateTitle}>
              {animeData.alternateTitles?.[0] || animeData.type || 'Anime'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).duration(400).springify()}
          style={styles.content}>
          <View style={styles.quickFacts}>
            <View style={styles.quickFact}>
              <Text style={styles.quickFactValue}>
                {animeData.malRating || animeData.rating || '—'}
              </Text>
              <Text style={styles.quickFactLabel}>SCORE</Text>
            </View>
            <View style={styles.quickFactDivider} />
            <View style={styles.quickFact}>
              <Text numberOfLines={1} style={styles.quickFactValue}>
                {animeData.duration || '—'}
              </Text>
              <Text style={styles.quickFactLabel}>DURATION</Text>
            </View>
            <View style={styles.quickFactDivider} />
            <View style={styles.quickFact}>
              <Text numberOfLines={1} style={styles.quickFactValue}>
                {animeData.type || 'TV'}
              </Text>
              <Text style={styles.quickFactLabel}>FORMAT</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <ScalePressable
              disabled={!canWatch}
              onPress={() => openEpisodeSheet('sub')}
              style={[styles.primaryAction, !canWatch && styles.primaryActionDisabled]}
              testID="detail-sub-button"
              haptic="medium"
              scaleTo={0.96}>
              <Text style={styles.primaryActionText}>
                {canWatch ? 'Watch subbed' : 'Coming soon'}
              </Text>
            </ScalePressable>
            <ScalePressable
              disabled={!canWatch}
              onPress={() => openEpisodeSheet('dub')}
              style={[styles.secondaryAction, !canWatch && styles.secondaryActionDisabled]}
              testID="detail-dub-button"
              haptic="medium"
              scaleTo={0.96}>
              <Text style={styles.secondaryActionText}>Dub</Text>
            </ScalePressable>
          </View>

          {!canWatch ? (
            <Text style={styles.upcomingNotice}>
              Episodes will appear here once this title starts airing.
            </Text>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{getFormattedTitle('The story')}</Text>
              <ScalePressable accessibilityLabel="Share anime" onPress={handleShare} scaleTo={0.85}>
                <Share color="#bef264" size={22} strokeWidth={2} variant="Linear" />
              </ScalePressable>
            </View>
            <Text style={styles.synopsis}>{displayedSynopsis}</Text>
            {hasLongSynopsis ? (
              <ScalePressable
                onPress={() => setShowFullDescription((current) => !current)}
                haptic="none">
                <Text style={styles.readMore}>
                  {showFullDescription ? 'Show less' : 'Read full story'}
                </Text>
              </ScalePressable>
            ) : null}
          </View>

          <View style={styles.infoPanel}>
            <DetailLine label="Premiered" value={animeData.released} />
            <DetailLine
              label="Studio"
              value={
                animeExtras?.studios.length
                  ? animeExtras.studios.join(' • ')
                  : isExtrasLoading
                    ? 'Loading…'
                    : undefined
              }
            />
            <DetailLine label="Genres" value={animeData.genres?.join(' • ')} accent />
            <DetailLine label="Status" value={animeData.status} />
          </View>

          {animeExtras?.cast.length ? (
            <CharacterVoiceActorRow data={animeExtras.cast} className="mt-6" seeAll />
          ) : isExtrasLoading ? (
            <View style={styles.extrasLoading}>
              <LottieView
                source={require('~/assets/lottie/loading.json')}
                autoPlay
                loop
                style={{ height: hp(9), width: wp(18) }}
              />
            </View>
          ) : null}

          {animeExtras?.recommendations.length ? (
            <RowItem
              className="-mx-4 mt-1"
              data={animeExtras.recommendations}
              staticData={animeExtras.recommendations}
              name="You Might Also Like"
              seeAll
            />
          ) : null}
        </Animated.View>
      </ScrollView>

      <EpisodeListSheet
        animeId={animeData.id}
        fallbackImage={animeData.image}
        bottomSheetRef={bottomSheetRef as React.RefObject<BottomSheetModal>}
        enableBackdropPress
        enablePanDownToClose
        onDismiss={() => setIsEpisodeSheetOpen(false)}
        onEpisodePress={(episodeId: string) =>
          nav.push({
            pathname: '/anime/watch/[episodeId]',
            params: {
              episodeId,
              animeId: animeData.id,
              type: selectedType,
              animeTitle: animeData.title,
              animeImage: animeData.image,
            },
          })
        }
        type={selectedType}
      />
    </View>
  );
};

export default AnimeDetails;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingBottom: hp(7),
  },
  hero: {
    height: hp(48),
    minHeight: 390,
    overflow: 'hidden',
    backgroundColor: '#10110f',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  heroSafeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topBarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 45,
    height: 45,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 23,
    backgroundColor: 'rgba(9, 10, 9, 0.55)',
  },
  topBarButtonActive: {
    borderColor: 'rgba(190,242,100,0.65)',
    backgroundColor: '#65a30d',
  },
  heroFooter: {
    position: 'absolute',
    right: 24,
    bottom: 31,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: '#bef264',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  heroPillText: {
    color: '#182008',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroStatus: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  titleBlock: {
    flexDirection: 'row',
    gap: 16,
    marginTop: -71,
    marginHorizontal: 20,
    alignItems: 'flex-end',
  },
  poster: {
    width: wp(27),
    height: hp(20),
    minHeight: 156,
    borderRadius: 17,
    backgroundColor: '#191919',
  },
  titleCopy: {
    flex: 1,
    paddingBottom: 3,
  },
  kicker: {
    marginBottom: 5,
    color: '#bef264',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 33,
    letterSpacing: 0.1,
  },
  alternateTitle: {
    marginTop: 7,
    color: 'rgba(255,255,255,0.56)',
    fontSize: 13,
  },
  content: {
    paddingHorizontal: 20,
  },
  quickFacts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 15,
  },
  quickFact: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFactDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  quickFactValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  quickFactLabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  primaryAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 51,
    borderRadius: 15,
    backgroundColor: '#bef264',
  },
  primaryActionDisabled: {
    backgroundColor: '#3f4a23',
  },
  primaryActionText: {
    color: '#152008',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 91,
    borderWidth: 1,
    borderColor: 'rgba(190,242,100,0.65)',
    borderRadius: 15,
    backgroundColor: 'rgba(163,230,53,0.1)',
  },
  secondaryActionDisabled: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  secondaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  upcomingNotice: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    lineHeight: 17,
  },
  section: {
    marginTop: 34,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  sectionTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  synopsis: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    lineHeight: 23,
  },
  readMore: {
    marginTop: 12,
    color: '#bef264',
    fontSize: 14,
    fontWeight: '700',
  },
  infoPanel: {
    marginTop: 29,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  detailLine: {
    flexDirection: 'row',
    gap: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  detailLabel: {
    width: 72,
    color: 'rgba(255,255,255,0.43)',
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    flex: 1,
    color: '#f5f5f4',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
  },
  detailValueAccent: {
    color: '#d9f99d',
  },
  extrasLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: hp(16),
  },
  errorBackButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#bef264',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  errorBackText: {
    color: '#182008',
    fontSize: 15,
    fontWeight: '700',
  },
});
