import { router } from 'expo-router';
import { Play } from 'iconsax-react-native';
import { useMemo } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  ImageBackground,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import ScalePressable from '~/components/shared/ScalePressable';
import { useHistoryStore, HistoryItem } from '~/app/_store/useHistoryStore';
import { hp, wp } from '~/helpers/common';
import { getFormattedTitle } from '~/helpers/TextFormat';

const CARD_WIDTH = wp(44);
const CARD_HEIGHT = hp(12);

const ContinueWatchingCard = ({ item, index }: { item: HistoryItem; index: number }) => {
  const progressPercent = item.duration > 0 ? Math.min(item.progress / item.duration, 1) : 0;
  const progressWidth = `${Math.round(progressPercent * 100)}%` as `${number}%`;

  const handlePress = () => {
    router.push({
      pathname: '/anime/watch/[episodeId]',
      params: {
        episodeId: item.episodeId,
        animeId: item.animeId,
        animeTitle: item.animeTitle,
        animeImage: item.animeImage,
        // Default to sub; user already had a type when they watched
        type: 'sub',
      },
    });
  };

  return (
    <Animated.View entering={FadeInRight.delay(index * 80).duration(400)}>
      <ScalePressable onPress={handlePress} scaleTo={0.95} style={styles.card}>
        {/* Thumbnail */}
        <ImageBackground
          source={{ uri: item.animeImage }}
          style={styles.thumbnail}
          imageStyle={styles.thumbnailImage}>
          {/* Dark overlay */}
          <View style={styles.thumbnailOverlay} />

          {/* Play button */}
          <View style={styles.playButton}>
            <Play size={18} color="#0a0a0a" variant="Bold" />
          </View>

          {/* Episode pill */}
          <View style={styles.epPill}>
            <Text style={styles.epPillText}>EP {item.episodeNumber}</Text>
          </View>
        </ImageBackground>

        {/* Info strip below thumbnail */}
        <View style={styles.infoStrip}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.animeTitle}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <Text style={styles.progressLabel}>
            {Math.round(progressPercent * 100)}% watched
          </Text>
        </View>
      </ScalePressable>
    </Animated.View>
  );
};

const ContinueWatchingRow = () => {
  const history = useHistoryStore((s) => s.history);

  const items = useMemo(
    () =>
      Object.values(history)
        // most recently watched first
        .sort((a, b) => b.timestamp - a.timestamp),
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
        renderItem={({ item, index }) => <ContinueWatchingCard item={item} index={index} />}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
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
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  card: {
    width: CARD_WIDTH,
    marginHorizontal: 6,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  thumbnail: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    resizeMode: 'cover',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#bef264',
    alignItems: 'center',
    justifyContent: 'center',
  },
  epPill: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(7,8,6,0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  epPillText: {
    color: '#bef264',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  infoStrip: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
    gap: 5,
  },
  cardTitle: {
    color: '#f5f5f5',
    fontFamily: 'Salsa',
    fontSize: 13,
    lineHeight: 17,
  },
  progressTrack: {
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#bef264',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
