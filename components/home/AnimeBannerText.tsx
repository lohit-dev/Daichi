import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { hp, wp } from '~/helpers/common';
import { Anime } from '~/types';

type AnimeBannerTextProps = {
  item: Anime;
  index: number;
  x: SharedValue<number>;
  onPress: () => void;
};

const GENRE_COLORS: Record<string, string> = {
  Action: '#ef4444',
  Adventure: '#f97316',
  Fantasy: '#a855f7',
  Comedy: '#eab308',
  Drama: '#3b82f6',
  Romance: '#ec4899',
  'Sci-Fi': '#06b6d4',
  Horror: '#dc2626',
  Mystery: '#8b5cf6',
  Thriller: '#64748b',
  Sports: '#22c55e',
  Supernatural: '#8b5cf6',
};

const getGenreColor = (genre: string) => GENRE_COLORS[genre] ?? '#65a30d';

const AnimeBannerText = ({ item, index, x, onPress }: AnimeBannerTextProps) => {
  const { width } = useWindowDimensions();

  const animatedStyle = useAnimatedStyle(() => {
    const translateXAnim = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [-40, 0, 40],
      Extrapolation.CLAMP
    );
    const opacityAnim = interpolate(
      x.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity: opacityAnim, transform: [{ translateX: translateXAnim }] };
  });

  const visibleGenres = (item.genres ?? []).slice(0, 3);
  const hasSubDub = item.sub || item.dub;

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* Genre pills */}
        {visibleGenres.length > 0 && (
          <View style={styles.genreRow}>
            {visibleGenres.map((genre) => (
              <View
                key={genre}
                style={[styles.genrePill, { borderColor: getGenreColor(genre) }]}>
                <Text style={[styles.genreText, { color: getGenreColor(genre) }]}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Title */}
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {item.title}
        </Text>

        {/* Meta row: rating • type • year */}
        <View style={styles.metaRow}>
          {item.rating && (
            <View style={styles.ratingBadge}>
              <Text style={styles.starGlyph}>★</Text>
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
          )}
          {item.type && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{item.type}</Text>
            </View>
          )}
          {item.date && <Text style={styles.metaPlainText}>{item.date}</Text>}
          {hasSubDub && (
            <View style={styles.subDubRow}>
              {item.sub && (
                <View style={styles.subBadge}>
                  <Text style={styles.subBadgeText}>SUB</Text>
                </View>
              )}
              {item.dub && (
                <View style={styles.dubBadge}>
                  <Text style={styles.dubBadgeText}>DUB</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default AnimeBannerText;

const styles = StyleSheet.create({
  pressable: { width: wp(100), height: hp(50) },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: wp(5),
    paddingBottom: 18,
    gap: 8,
  },
  genreRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  genrePill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  genreText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontFamily: 'Salsa-Regular',
    fontWeight: '700',
    lineHeight: 36,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(190,242,100,0.18)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(190,242,100,0.45)',
  },
  starGlyph: {
    color: '#bef264',
    fontSize: 11,
    fontWeight: '700',
  },
  ratingText: {
    color: '#bef264',
    fontSize: 12,
    fontWeight: '700',
  },
  metaBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  metaBadgeText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metaPlainText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  subDubRow: {
    flexDirection: 'row',
    gap: 4,
  },
  subBadge: {
    backgroundColor: 'rgba(101,163,13,0.25)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(101,163,13,0.6)',
  },
  subBadgeText: {
    color: '#a3e635',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dubBadge: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  dubBadgeText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

