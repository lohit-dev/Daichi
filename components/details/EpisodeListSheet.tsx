import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { ArrowDown2, ArrowUp2, SearchNormal1 } from 'iconsax-react-native';
import { useCallback, useMemo, useRef, useState, RefObject } from 'react';
import { View, Text, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import EpisodeCard, { EpisodeItemData } from '../shared/EpisodeCard';
import ScalePressable from '../shared/ScalePressable';

import { useEpisodeList } from '~/hooks/useEpisodeList';

type Episode = EpisodeItemData & { episodeId: string };

export type EpisodePressPayload = {
  episodeId: string;
  animeSlug?: string;
  title?: string;
  description?: string;
  image?: string;
  number?: string | number;
};

type EpisodeListSheetProps = {
  animeId: string;
  malId?: number | null;
  type: 'sub' | 'dub';
  fallbackImage?: string;
  bottomSheetRef: RefObject<BottomSheetModal>;
  onEpisodePress: (episode: EpisodePressPayload) => void;
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
      title: ep.title,
      description: ep.description,
      isFiller: false,
      image: ep.image,
    }));
  }, [episodeData]);

  const filteredAndSortedEpisodes = useMemo(() => {
    let result = [...episodes];
    if (searchQuery) {
      result = result.filter(
        (ep) =>
          ep.number.toString().includes(searchQuery) ||
          ep.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    result.sort((a, b) => {
      const numA = parseFloat(String(a.number)) || 0;
      const numB = parseFloat(String(b.number)) || 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
    return result;
  }, [episodes, searchQuery, sortOrder]);

  const handleEpisodePress = useCallback(
    (episode: Episode) => {
      if (isSelectingEpisodeRef.current) return;
      isSelectingEpisodeRef.current = true;
      onEpisodePress({
        episodeId: episode.episodeId,
        animeSlug: episode.animeSlug,
        title: episode.title,
        description: episode.description,
        image: episode.image,
        number: episode.number,
      });
      bottomSheetRef.current?.dismiss?.();
    },
    [bottomSheetRef, onEpisodePress]
  );

  const renderEpisodeCard = useCallback(
    ({ item, index }: { item: Episode; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(280)}>
        <EpisodeCard
          testID={`episode-card-${index}`}
          item={item}
          fallbackImage={fallbackImage}
          onPress={() => handleEpisodePress(item)}
        />
      </Animated.View>
    ),
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
      <View className="flex-1">
        {/* Header */}
        <View className="border-b px-5 pb-[14px] pt-1" style={styles.headerBorder}>
          <Text style={styles.sheetTitle}>{type === 'sub' ? 'Subbed' : 'Dubbed'} Episodes</Text>
          <Text className="mt-[2px] text-[13px] text-white/45">
            {isLoading ? 'Loading episodes…' : `${episodes.length} Episodes Available`}
          </Text>
        </View>

        {/* Search + Sort */}
        <View className="flex-row items-center gap-[10px] px-4 py-3">
          <View className="flex-1 flex-row items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-[10px]">
            <SearchNormal1 size={18} color="#a3e635" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search episodes..."
              placeholderTextColor="#555"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <ScalePressable
            onPress={() => setSortOrder((c) => (c === 'asc' ? 'desc' : 'asc'))}
            scaleTo={0.94}
            className="flex-row items-center gap-[5px] rounded-[14px] border border-lime-400/25 bg-white/[0.06] px-[14px] py-[10px]">
            {sortOrder === 'asc' ? (
              <ArrowDown2 size={18} color="#a3e635" />
            ) : (
              <ArrowUp2 size={18} color="#a3e635" />
            )}
            <Text className="text-[13px] font-bold text-lime-400">
              {sortOrder === 'asc' ? 'ASC' : 'DESC'}
            </Text>
          </ScalePressable>
        </View>

        {/* List */}
        <View className="flex-1">
          {isLoading ? (
            <View className="flex-1 items-center justify-center p-6">
              <ActivityIndicator size="large" color="#84cc16" />
              <Text className="mt-[10px] text-[13px] text-white/45">Loading episodes...</Text>
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center p-6">
              <Text className="text-center text-[15px] text-red-400">
                Failed to load episodes. Please try again.
              </Text>
            </View>
          ) : !filteredAndSortedEpisodes.length ? (
            <View className="flex-1 items-center justify-center p-6">
              <Text className="text-center text-[15px] text-white/45">
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
  // background colors that can't be expressed as Tailwind classes easily
  sheetBg: { backgroundColor: '#111310' },
  sheetHandle: { backgroundColor: '#3a3a3a' },
  headerBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: { color: '#ffffff', fontFamily: 'Salsa-Regular', fontSize: 22, fontWeight: '700' },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 14 },
  listContent: { paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
});
