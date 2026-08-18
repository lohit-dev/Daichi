import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { ArrowDown2, ArrowUp2, SearchNormal1 } from 'iconsax-react-native';
import { useCallback, useMemo, useRef, useState, RefObject } from 'react';
import { View, Text, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import EpisodeCard, { EpisodeItemData } from '../shared/EpisodeCard';
import ScalePressable from '../shared/ScalePressable';

import { useEpisodeList } from '~/hooks/useEpisodeList';

type Episode = EpisodeItemData & {
  episodeId: string;
};

type EpisodeListSheetProps = {
  animeId: string;
  malId?: number | null;
  type: 'sub' | 'dub';
  fallbackImage?: string;
  bottomSheetRef: RefObject<BottomSheetModal>;
  onEpisodePress: (episode: { episodeId: string; animeSlug?: string }) => void;
  onDismiss?: () => void;
  enablePanDownToClose?: boolean;
  enableBackdropPress?: boolean;
};

type SortOrder = 'asc' | 'desc';

const EpisodeListSheet = ({
  animeId,
  malId,
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
  } = useEpisodeList(animeId, type, fallbackImage, malId);

  const episodes: Episode[] = useMemo(() => {
    if (!episodeData) return [];
    return episodeData.map((ep) => ({
      id: ep.id,
      episodeId: ep.id,
      animeSlug: ep.animeSlug,
      number: ep.number,
      title: ep.title || `Episode ${ep.number}`,
      description: ep.description,
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

    result.sort((a, b) => {
      const numA = parseFloat(String(a.number)) || 0;
      const numB = parseFloat(String(b.number)) || 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
    return result;
  }, [episodes, searchQuery, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const handleEpisodePress = useCallback(
    (episode: Episode) => {
      if (isSelectingEpisodeRef.current) return;
      isSelectingEpisodeRef.current = true;
      onEpisodePress({ episodeId: episode.episodeId, animeSlug: episode.animeSlug });
      bottomSheetRef.current?.dismiss?.();
    },
    [bottomSheetRef, onEpisodePress]
  );

  const renderEpisodeCard = useCallback(
    ({ item, index }: { item: Episode; index: number }) => {
      return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(280)}>
          <EpisodeCard
            testID={`episode-card-${index}`}
            item={item}
            fallbackImage={fallbackImage}
            onPress={() => handleEpisodePress(item)}
          />
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
    fontFamily: 'Salsa-Regular',
    fontSize: 22,
    fontWeight: '700',
  },
  sheetSubtitle: {
    color: 'rgba(255,255,255,0.45)',
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginTop: 10,
  },
  errorText: {
    color: '#f87171',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    textAlign: 'center',
  },
});
