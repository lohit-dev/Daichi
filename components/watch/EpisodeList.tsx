import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native';

import ScalePressable from '~/components/shared/ScalePressable';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';

export type Episode = {
  id: string;
  number: string;
  title: string;
  image?: string;
  animeSlug?: string;
};

type EpisodeListProps = {
  episodes: Episode[];
  currentEpisodeId: string;
  fallbackImage?: string;
  onSelectEpisode: (episode: Episode) => void;
  bottomPadding?: number;
};

// row height used for getItemLayout so scrollToIndex works even before the
// list has rendered that far (matters once you're at One Piece / Conan scale)
const ROW_HEIGHT = 80;

// ---------------------------------------------------------------------------
// Pulsing "Now Playing" dot
// ---------------------------------------------------------------------------
const PulsingDot = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.2,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
};

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


  // Scroll to the currently playing episode whenever the episode or list changes
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
      {/* Header — "Episodes (N)" + jump field on same row */}
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>
          Episodes{' '}
          <Text style={styles.sectionCount}>({episodes.length})</Text>
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
          // Retry after a short delay if the list hasn't rendered that far yet
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
        renderItem={({ item }) => {
          const isCurrent = item.id === currentEpisodeId;
          const thumb = item.image ?? fallbackImage;

          return (
            <ScalePressable
              onPress={() => {
                if (!isCurrent) onSelectEpisode(item);
              }}
              disabled={isCurrent}
              scaleTo={0.985}
              style={[styles.row, isCurrent && styles.currentRow]}>
              {/* Left accent bar for currently playing */}
              {isCurrent && <View style={styles.accentBar} />}

              {/* Thumbnail */}
              <View style={[styles.imageWrap, isCurrent && styles.imageWrapActive]}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>{item.number}</Text>
                  </View>
                )}
                <View style={styles.epBadge}>
                  <Text style={styles.epBadgeText}>EP {item.number}</Text>
                </View>
              </View>

              {/* Text info */}
              <View style={styles.copy}>
                <Text numberOfLines={2} style={[styles.title, isCurrent && styles.titleActive]}>
                  {item.title}
                </Text>
                {isCurrent ? (
                  <View style={styles.playingRow}>
                    <PulsingDot />
                    <Text style={styles.playingText}>Now playing</Text>
                  </View>
                ) : (
                  <Text style={styles.epNumberLabel}>Episode {item.number}</Text>
                )}
              </View>

              {/* Right control */}
              <View style={[styles.playControl, isCurrent && styles.playControlActive]}>
                <Ionicons
                  name={isCurrent ? 'volume-high' : 'play'}
                  size={isCurrent ? 16 : 17}
                  color={isCurrent ? COLORS.accent : COLORS.bg}
                />
              </View>
            </ScalePressable>
          );
        }}
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
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionCount: {
    color: COLORS.textMuted,
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

  // ── Episode row ──────────────────────────────────────────────────────────
  row: {
    height: ROW_HEIGHT - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 14,
    backgroundColor: '#111410',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingRight: 10,
    paddingLeft: 8,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  currentRow: {
    backgroundColor: '#141a0f',
    borderColor: COLORS.accent,
    borderWidth: 1,
  },

  // Left accent bar (only on current row)
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },

  // Thumbnail
  imageWrap: {
    width: 80,
    height: 52,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#090b09',
  },
  imageWrapActive: {
    borderWidth: 1,
    borderColor: `${COLORS.accent}55`,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1f17',
  },
  imagePlaceholderText: {
    color: COLORS.textFaint,
    fontSize: 22,
    fontWeight: '800',
  },
  epBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(4,6,4,0.85)',
  },
  epBadgeText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // Text
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: {
    color: COLORS.text,
    fontFamily: 'Salsa-Regular',
    fontSize: 13,
    lineHeight: 17,
  },
  titleActive: {
    color: '#FFFFFF',
  },
  epNumberLabel: {
    color: COLORS.textFaint,
    fontSize: 10,
    fontWeight: '600',
  },
  playingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playingText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Play button
  playControl: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: COLORS.accent,
  },
  playControlActive: {
    backgroundColor: 'rgba(163,230,53,0.12)',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
});
