import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CloseCircle } from 'iconsax-react-native';
import { useMemo } from 'react';
import { FlatList, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { useHistoryStore, HistoryItem } from '~/app/_store/useHistoryStore';
import ScalePressable from '~/components/shared/ScalePressable';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { formatTime, wp } from '~/helpers/common';
import { getEpisodeNumberKey } from '~/helpers/episodeNumbers';
import { fetchAniListStreamingEpisodeImages } from '~/services/AniListService';

const CARD_WIDTH = wp(50);
const CARD_HEIGHT = CARD_WIDTH * (10 / 16);

type CardProps = {
  item: HistoryItem;
  index: number;
  onRemove: (animeId: string) => void;
};

const ContinueWatchingCard = ({ item, index, onRemove }: CardProps) => {
  const { data: episodeImages } = useQuery({
    queryKey: ['anilist', 'streaming-episode-images-v2', item.animeId],
    queryFn: () => fetchAniListStreamingEpisodeImages(item.animeId),
    staleTime: 30 * 60 * 1000,
    enabled: !item.episodeThumbnail,
  });

  const thumbnail = useMemo(() => {
    if (item.episodeThumbnail) return item.episodeThumbnail;
    if (episodeImages?.length) {
      const map = new Map(
        episodeImages.flatMap((image) => {
          const key = getEpisodeNumberKey(image.number);
          return key ? [[key, image.thumbnail] as const] : [];
        })
      );
      const found = map.get(getEpisodeNumberKey(item.episodeNumber) || '');
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
        animeSlug: item.animeSlug,
        animeTitle: item.animeTitle,
        animeImage: item.animeImage,
        episodeTitle: item.episodeTitle,
        episodeDescription: item.episodeDescription,
        episodeThumbnail: item.episodeThumbnail || thumbnail,
        type: 'sub',
      },
    });
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 70).duration(380)}
      style={styles.cardWrapper}>
      <ScalePressable onPress={handlePress} scaleTo={0.96}>
        <ImageBackground
          source={{ uri: thumbnail }}
          style={styles.thumb}
          imageStyle={styles.thumbImage}>
          <View style={styles.scrim} />

          {/* Remove button */}
          <ScalePressable
            onPress={() => onRemove(item.animeId)}
            scaleTo={0.88}
            style={styles.removeBtn}
            haptic="light">
            <CloseCircle size={20} color="#fff" variant="Bold" />
          </ScalePressable>

          <View style={styles.bottomRow}>
            <View className="rounded-[5px] bg-black/[0.68] px-[6px] py-[2px]">
              <Text className="text-[10px] font-[800] tracking-[0.3px] text-white">
                EP {item.episodeNumber}
              </Text>
            </View>
            <View className="rounded-[5px] bg-black/[0.68] px-[6px] py-[2px]">
              <Text className="text-[9px] font-[700] tracking-[0.1px] text-white">
                {progressText}
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressPercent }]} />
          </View>
        </ImageBackground>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.animeTitle}
        </Text>
      </ScalePressable>
    </Animated.View>
  );
};

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
      <View className="px-4 pb-3 pt-7">
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
  cardWrapper: { width: CARD_WIDTH, marginHorizontal: 5 },
  thumb: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    justifyContent: 'space-between',
  },
  thumbImage: { borderRadius: 10, resizeMode: 'cover' },
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
    bottom: 14,
    left: 7,
    right: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: 3, backgroundColor: '#ef4444' },
  headerTitle: { color: '#ffffff', fontFamily: 'Salsa-Regular', fontSize: 24, fontWeight: '600' },
  cardTitle: {
    marginTop: 7,
    color: '#e8e8e8',
    fontFamily: 'Salsa-Regular',
    fontSize: 13,
    paddingHorizontal: 2,
  },
  list: { paddingHorizontal: 12, paddingBottom: 4 },
});
