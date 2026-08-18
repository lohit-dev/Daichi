import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import EpisodeCard, { EpisodeItemData } from '~/components/shared/EpisodeCard';
import ScalePressable from '~/components/shared/ScalePressable';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';

export type Episode = EpisodeItemData;

type EpisodeListProps = {
  episodes: Episode[];
  currentEpisodeId: string;
  fallbackImage?: string;
  onSelectEpisode: (episode: Episode) => void;
  bottomPadding?: number;
};

// Row height for getItemLayout (card 88 + marginBottom 8)
const ROW_HEIGHT = 96;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const EpisodeList = ({
  episodes,
  currentEpisodeId,
  fallbackImage,
  onSelectEpisode,
  bottomPadding = 40,
}: EpisodeListProps) => {
  const listRef = useRef<FlatList<Episode>>(null);
  const [jumpValue, setJumpValue] = useState('');
  const activeIndex = episodes.findIndex((ep) => ep.id === currentEpisodeId);

  // Scroll to the currently playing episode whenever active episode changes
  useEffect(() => {
    if (activeIndex < 0 || episodes.length === 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewPosition: 0.2,
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [activeIndex, currentEpisodeId, episodes.length]);

  const handleJump = useCallback(() => {
    const target = Number(jumpValue);
    if (!target) return;
    const index = episodes.findIndex((ep) => Number(ep.number) === target);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }
  }, [episodes, jumpValue]);

  return (
    <View style={{ flex: 1 }}>
      {/* Header — "Episodes (N)" + jump field */}
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>
          Episodes <Text style={styles.sectionCount}>({episodes.length})</Text>
        </Text>

        {episodes.length > 30 && (
          <View style={styles.jumpBox}>
            <TextInput
              value={jumpValue}
              onChangeText={setJumpValue}
              onSubmitEditing={handleJump}
              placeholder="#"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              returnKeyType="go"
              style={styles.jumpInput}
            />
            <ScalePressable onPress={handleJump} scaleTo={0.92}>
              <Text style={styles.jumpGo}>Go</Text>
            </ScalePressable>
          </View>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={episodes}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(
            () => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 }),
            350
          );
        }}
        contentContainerStyle={{ paddingBottom: bottomPadding, paddingTop: 4 }}
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        windowSize={9}
        removeClippedSubviews
        renderItem={({ item }) => (
          <EpisodeCard
            item={item}
            isCurrent={item.id === currentEpisodeId}
            fallbackImage={fallbackImage}
            onPress={() => onSelectEpisode(item)}
            style={styles.cardItem}
          />
        )}
      />
    </View>
  );
};

export default EpisodeList;

const styles = StyleSheet.create({
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionCount: {
    color: COLORS.textMuted,
    fontSize: 13.5,
    fontWeight: '600',
  },
  jumpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 0,
    height: 30,
  },
  jumpInput: {
    color: COLORS.text,
    width: 36,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 0,
    height: 30,
  },
  jumpGo: {
    color: COLORS.accent,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cardItem: {
    marginHorizontal: 14,
    marginBottom: 8,
  },
});
