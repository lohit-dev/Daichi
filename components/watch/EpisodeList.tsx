import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native';

import ScalePressable from '~/components/shared/ScalePressable';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';

export type Episode = {
  id: string;
  number: string;
  title: string;
  description?: string;
  airDate?: string;
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

// Row height for getItemLayout (card 88 + marginBottom 8)
const ROW_HEIGHT = 96;

const formatAirDate = (dateStr?: string) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

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
// Individual Episode Card (with dynamic description line balancing)
// ---------------------------------------------------------------------------
type EpisodeCardItemProps = {
  item: Episode;
  isCurrent: boolean;
  fallbackImage?: string;
  onSelectEpisode: (episode: Episode) => void;
};

const EpisodeCardItem = ({
  item,
  isCurrent,
  fallbackImage,
  onSelectEpisode,
}: EpisodeCardItemProps) => {
  const thumb = item.image ?? fallbackImage;
  const formattedDate = formatAirDate(item.airDate);
  // Default to 1 line of description if title is longer than 28 chars, else 2 lines
  const [descLines, setDescLines] = useState(item.title && item.title.length > 28 ? 1 : 2);

  return (
    <ScalePressable
      onPress={() => {
        if (!isCurrent) onSelectEpisode(item);
      }}
      disabled={isCurrent}
      scaleTo={0.985}
      style={[styles.card, isCurrent && styles.activeCard]}>
      {/* Left: Thumbnail with EP badge */}
      <View style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={styles.placeholderThumb}>
            <Text style={styles.placeholderText}>{item.number}</Text>
          </View>
        )}
        <View style={styles.epBadge}>
          <Text style={styles.epBadgeText}>EP {item.number}</Text>
        </View>
      </View>

      {/* Right: Content details */}
      <View style={styles.contentWrap}>
        <View style={styles.textContainer}>
          {/* Episode Title — allowed up to 2 lines */}
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            onTextLayout={(e) => {
              const lines = e.nativeEvent.lines.length;
              setDescLines(lines >= 2 ? 1 : 2);
            }}
            style={[styles.title, isCurrent && styles.activeTitle]}>
            {item.title}
          </Text>

          {!isCurrent && (
            /* If title takes 2 lines, description reduces to 1 line to prevent overflow */
            <Text numberOfLines={descLines} ellipsizeMode="tail" style={styles.description}>
              {item.description || `Episode ${item.number}`}
            </Text>
          )}
        </View>

        {/* Bottom metadata row */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <View style={[styles.ccBadge, isCurrent && styles.activeCcBadge]}>
              <Text style={[styles.ccText, isCurrent && styles.activeCcText]}>CC</Text>
            </View>

            {isCurrent && (
              /* Active card: Now playing beside the CC badge */
              <View style={styles.nowPlayingRow}>
                <PulsingDot />
                <Text style={styles.nowPlayingText}>Now playing</Text>
              </View>
            )}
          </View>

          {formattedDate ? <Text style={styles.dateText}>{formattedDate}</Text> : null}
        </View>
      </View>
    </ScalePressable>
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
          <EpisodeCardItem
            item={item}
            isCurrent={item.id === currentEpisodeId}
            fallbackImage={fallbackImage}
            onSelectEpisode={onSelectEpisode}
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

  // ── Episode Card ─────────────────────────────────────────────────────────
  card: {
    height: ROW_HEIGHT - 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#111511',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  activeCard: {
    backgroundColor: '#152012',
    borderColor: COLORS.accent,
    borderWidth: 1,
  },

  // Thumbnail
  thumbWrap: {
    width: 116,
    height: '100%',
    backgroundColor: '#090b09',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1f17',
  },
  placeholderText: {
    color: COLORS.textFaint,
    fontSize: 20,
    fontWeight: '800',
  },
  epBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  epBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // Content
  contentWrap: {
    flex: 1,
    height: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  textContainer: {
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  activeTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  description: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
  },
  nowPlayingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nowPlayingText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Bottom footer row
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ccBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  activeCcBadge: {
    borderColor: `${COLORS.accent}66`,
    backgroundColor: `${COLORS.accent}15`,
  },
  ccText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  activeCcText: {
    color: COLORS.accent,
  },
  dateText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '500',
  },
});
