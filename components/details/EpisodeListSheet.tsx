import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { ArrowDown2, ArrowUp2, Play, SearchNormal1 } from 'iconsax-react-native';
import { useCallback, useMemo, useRef, useState, RefObject } from 'react';
import { View, Text, ActivityIndicator, TextInput, Image, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import ScalePressable from '../shared/ScalePressable';

import { useEpisodeList } from '~/hooks/useEpisodeList';

type Episode = {
  episodeId: string;
  number: number;
  title: string;
  isFiller: boolean;
  image?: string;
};

type EpisodeListSheetProps = {
  animeId: string;
  type: 'sub' | 'dub';
  fallbackImage?: string;
  bottomSheetRef: RefObject<BottomSheetModal>;
  onEpisodePress: (episodeId: string) => void;
  onDismiss?: () => void;
  enablePanDownToClose?: boolean;
  enableBackdropPress?: boolean;
};

type SortOrder = 'asc' | 'desc';

const CARD_IMG_WIDTH = 110;
const CARD_IMG_HEIGHT = 70;

const EpisodeListSheet = ({
  animeId,
  type,
  fallbackImage,
  bottomSheetRef,
  onEpisodePress,
  onDismiss,
  enablePanDownToClose = true,
  enableBackdropPress = true,
}: EpisodeListSheetProps) => {
  const snapPoints = useMemo(() => ['75%'], []);
  const isSelectingEpisodeRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const {
    data: episodeData,
    isLoading,
    error,
    loadMoreImages,
    hasMoreImages,
  } = useEpisodeList(animeId, type, fallbackImage);

  const episodes: Episode[] = useMemo(() => {
    if (!episodeData) return [];
    return episodeData.map((ep) => ({
      episodeId: ep.id,
      number: parseFloat(ep.number) || 0,
      title: ep.title || `Episode ${ep.number}`,
      isFiller: false,
      image: ep.image,
    }));
  }, [episodeData]);

  const filteredAndSortedEpisodes = useMemo(() => {
    let result = [...episodes];

    if (searchQuery) {
      result = result.filter(
        (episode) =>
          episode.number.toString().includes(searchQuery) ||
          episode.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    result.sort((a, b) => (sortOrder === 'asc' ? a.number - b.number : b.number - a.number));
    return result;
  }, [episodes, searchQuery, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const handleEpisodePress = useCallback(
    (episode: Episode) => {
      if (isSelectingEpisodeRef.current) return;
      isSelectingEpisodeRef.current = true;
      onEpisodePress(episode.episodeId);
      bottomSheetRef.current?.dismiss?.();
    },
    [bottomSheetRef, onEpisodePress]
  );

  const renderEpisodeCard = useCallback(
    ({ item, index }: { item: Episode; index: number }) => {
      // The hook applies the cover image only after Kitsu and AniList have both
      // had a chance to provide a scene thumbnail. Until then, stay neutral.
      const thumbnail = item.image;

      return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(280)}>
          <ScalePressable
            testID={`episode-card-${index}`}
            style={[styles.card, item.isFiller && styles.cardFiller]}
            scaleTo={0.97}
            onPress={() => handleEpisodePress(item)}>
            {/* Thumbnail */}
            <View style={styles.thumbContainer}>
              {thumbnail ? (
                <Image source={{ uri: thumbnail }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}

              {/* EP number overlay */}
              <View style={styles.epBadge}>
                <Text style={styles.epBadgeText}>EP {item.number}</Text>
              </View>

              {/* Filler stripe */}
              {item.isFiller && <View style={styles.fillerStripe} />}
            </View>

            {/* Text content */}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>

              {item.isFiller && (
                <View style={styles.fillerBadge}>
                  <Text style={styles.fillerBadgeText}>Filler</Text>
                </View>
              )}
            </View>

            {/* Play button */}
            <View style={styles.playBtn}>
              <Play size={16} color="#0a0a0a" variant="Bold" />
            </View>
          </ScalePressable>
        </Animated.View>
      );
    },
    [fallbackImage, handleEpisodePress]
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={0}
      enableDynamicSizing={false}
      enablePanDownToClose={enablePanDownToClose}
      backdropComponent={enableBackdropPress ? undefined : () => null}
      onDismiss={() => {
        isSelectingEpisodeRef.current = false;
        setSearchQuery('');
        setSortOrder('asc');
        onDismiss?.();
      }}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.sheetHandle}>
      <View style={styles.sheetInner}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>{type === 'sub' ? 'Subbed' : 'Dubbed'} Episodes</Text>
            <Text style={styles.sheetSubtitle}>
              {isLoading ? 'Loading episodes…' : `${episodes.length} Episodes Available`}
            </Text>
          </View>
        </View>

        {/* Search + Sort */}
        <View style={styles.filterRow}>
          <View style={styles.searchBox}>
            <SearchNormal1 size={18} color="#a3e635" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search episodes..."
              placeholderTextColor="#555"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScalePressable onPress={toggleSortOrder} scaleTo={0.94} style={styles.sortBtn}>
            {sortOrder === 'asc' ? (
              <ArrowDown2 size={18} color="#a3e635" />
            ) : (
              <ArrowUp2 size={18} color="#a3e635" />
            )}
            <Text style={styles.sortLabel}>{sortOrder === 'asc' ? 'ASC' : 'DESC'}</Text>
          </ScalePressable>
        </View>

        {/* List */}
        <View style={styles.listWrapper}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#84cc16" />
              <Text style={styles.loadingText}>Loading episodes...</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>Failed to load episodes. Please try again.</Text>
            </View>
          ) : !filteredAndSortedEpisodes.length ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No episodes found matching your search'
                  : `No ${type === 'sub' ? 'subbed' : 'dubbed'} episodes available`}
              </Text>
            </View>
          ) : (
            <BottomSheetFlatList
              testID="episode-list"
              data={filteredAndSortedEpisodes}
              renderItem={renderEpisodeCard}
              keyExtractor={(item: Episode) => item.episodeId}
              contentContainerStyle={styles.listContent}
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={5}
              onEndReached={hasMoreImages ? loadMoreImages : undefined}
              onEndReachedThreshold={0.65}
            />
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
};

export default EpisodeListSheet;

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#111310',
  },
  sheetHandle: {
    backgroundColor: '#3a3a3a',
  },
  sheetInner: {
    flex: 1,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    color: '#ffffff',
    fontFamily: 'Salsa',
    fontSize: 22,
    fontWeight: '700',
  },
  sheetSubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Salsa',
    fontSize: 13,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontFamily: 'Salsa',
    fontSize: 14,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(163,230,53,0.25)',
  },
  sortLabel: {
    color: '#a3e635',
    fontFamily: 'Salsa',
    fontSize: 13,
    fontWeight: '700',
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    padding: 10,
  },
  cardFiller: {
    borderColor: 'rgba(239,68,68,0.3)',
  },
  thumbContainer: {
    width: CARD_IMG_WIDTH,
    height: CARD_IMG_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1e1f1c',
    flexShrink: 0,
  },
  thumb: {
    width: CARD_IMG_WIDTH,
    height: CARD_IMG_HEIGHT,
  },
  thumbPlaceholder: {
    backgroundColor: '#252520',
  },
  epBadge: {
    position: 'absolute',
    bottom: 5,
    left: 6,
    backgroundColor: 'rgba(7,8,6,0.82)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  epBadgeText: {
    color: '#bef264',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fillerStripe: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    bottom: 0,
    backgroundColor: '#ef4444',
  },
  cardBody: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#f0f0ee',
    fontFamily: 'Salsa',
    fontSize: 13.5,
    lineHeight: 19,
  },
  fillerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  fillerBadgeText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700',
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#bef264',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Salsa',
    fontSize: 13,
    marginTop: 10,
  },
  errorText: {
    color: '#f87171',
    fontFamily: 'Salsa',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Salsa',
    fontSize: 15,
    textAlign: 'center',
  },
});
