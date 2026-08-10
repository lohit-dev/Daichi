import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CloseCircle } from 'iconsax-react-native';
import { useMemo } from 'react';
import { FlatList, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { useHistoryStore, HistoryItem } from '~/app/_store/useHistoryStore';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { hp, wp, formatTime } from '~/helpers/common';
import { fetchAniListEpisodeImages } from '~/services/AniListService';

// ─── Card dimensions ─────────────────────────────────────────────────────────

const CARD_WIDTH = wp(50);
const CARD_HEIGHT = CARD_WIDTH * (10 / 16); // slightly taller than 16:9

// ─── Card ─────────────────────────────────────────────────────────────────────

type CardProps = {
  item: HistoryItem;
  index: number;
  onRemove: (animeId: string) => void;
};

const ContinueWatchingCard = ({ item, index, onRemove }: CardProps) => {
  // Fetch AniList streaming episode thumbnails for this anime (cached by React Query)
  const { data: episodeImages } = useQuery({
    queryKey: ['anilist', 'episode-images', item.animeId],
    queryFn: () => fetchAniListEpisodeImages(item.animeId),
    staleTime: 30 * 60 * 1000,
    enabled: !item.episodeThumbnail, // skip if already stored at watch time
  });

  // Priority: stored thumbnail → AniList query → anime cover
  const thumbnail = useMemo(() => {
    if (item.episodeThumbnail) return item.episodeThumbnail;

    if (episodeImages?.length) {
      const epNum = Math.round(parseFloat(item.episodeNumber));
      const map = new Map(episodeImages.map((img) => [Math.round(img.number), img.thumbnail]));
      const found = map.get(epNum);
      if (found) return found;
    }

    return item.animeImage;
  }, [item.episodeThumbnail, item.episodeNumber, item.animeImage, episodeImages]);

  const progressRatio =
    item.duration > 0 ? Math.min(Math.max(item.progress / item.duration, 0), 1) : 0;
  const progressPercent = `${(progressRatio * 100).toFixed(1)}%` as `${number}%`;

  const progressText = `${formatTime(item.progress)}/${formatTime(item.duration)}`;

  const handlePress = () => {
    router.push({
      pathname: '/anime/watch/[episodeId]',
      params: {
        episodeId: item.episodeId,
        animeId: item.animeId,
        animeTitle: item.animeTitle,
        animeImage: item.animeImage,
        type: 'sub',
      },
    });
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 70).duration(380)}
      style={styles.cardWrapper}>
      <ScalePressable onPress={handlePress} scaleTo={0.96}>
        {/* Thumbnail */}
        <ImageBackground
          source={{ uri: thumbnail }}
          style={styles.thumb}
          imageStyle={styles.thumbImage}>
          {/* subtle scrim */}
          <View style={styles.scrim} />

          {/* × remove — top right */}
          <ScalePressable
            onPress={() => onRemove(item.animeId)}
            scaleTo={0.88}
            style={styles.removeBtn}
            haptic="light">
            <CloseCircle size={20} color="#fff" variant="Bold" />
          </ScalePressable>

          {/* Bottom row: EP badge + timestamp */}
          <View style={styles.bottomRow}>
            <View style={styles.epBadge}>
              <Text style={styles.epBadgeText}>EP {item.episodeNumber}</Text>
            </View>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{progressText}</Text>
            </View>
          </View>

          {/* YouTube-style red progress bar — no dot */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressPercent }]} />
          </View>
        </ImageBackground>

        {/* Anime title */}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.animeTitle}
        </Text>
      </ScalePressable>
    </Animated.View>
  );
};

// ─── Row ─────────────────────────────────────────────────────────────────────

const ContinueWatchingRow = () => {
  const history = useHistoryStore((s) => s.history);
  const removeHistory = useHistoryStore((s) => s.removeHistory);

  const items = useMemo(
    () => Object.values(history).sort((a, b) => b.timestamp - a.timestamp),
    [history]
  );

  if (items.length === 0) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{getFormattedTitle('Continue Watching')}</Text>
      </View>

      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.animeId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <ContinueWatchingCard item={item} index={index} onRemove={removeHistory} />
        )}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
      />
    </View>
  );
};

export default ContinueWatchingRow;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontFamily: 'Salsa',
    fontSize: 24,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginHorizontal: 5,
  },
  thumb: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    justifyContent: 'space-between',
  },
  thumbImage: {
    borderRadius: 10,
    resizeMode: 'cover',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 10,
  },
  removeBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 99,
  },
  bottomRow: {
    position: 'absolute',
    bottom: 14, // above the progress bar
    left: 7,
    right: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  epBadge: {
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  epBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timeBadge: {
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  timeBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  // YouTube-style red progress bar pinned to very bottom of thumbnail
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#ef4444', // red-500
  },
  cardTitle: {
    marginTop: 7,
    color: '#e8e8e8',
    fontFamily: 'Salsa',
    fontSize: 13,
    paddingHorizontal: 2,
  },
});
