import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import ScalePressable from './ScalePressable';

import { PLAYER_COLORS as COLORS } from '~/constants/Colors';

export type EpisodeItemData = {
  id: string;
  number: string | number;
  title: string;
  description?: string;
  airDate?: string;
  image?: string;
  animeSlug?: string;
  isFiller?: boolean;
};

export type EpisodeCardProps = {
  item: EpisodeItemData;
  isCurrent?: boolean;
  fallbackImage?: string;
  onPress: (item: EpisodeItemData) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
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
// Reusable Episode Card Component
// ---------------------------------------------------------------------------
export const EpisodeCard = ({
  item,
  isCurrent = false,
  fallbackImage,
  onPress,
  style,
  testID,
}: EpisodeCardProps) => {
  const thumb = item.image ?? fallbackImage;

  return (
    <ScalePressable
      testID={testID}
      onPress={() => {
        if (!isCurrent) onPress(item);
      }}
      disabled={isCurrent}
      scaleTo={0.985}
      style={[styles.card, isCurrent && styles.activeCard, style]}>
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

        {item.isFiller && <View style={styles.fillerStripe} />}
      </View>

      {/* Right: Content details (Title + Description / Now playing) */}
      <View style={styles.contentWrap}>
        <View style={styles.textContainer}>
          {/* Episode Title — allowed up to 2 lines */}
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[styles.title, isCurrent && styles.activeTitle]}>
            {item.title}
          </Text>

          {!isCurrent ? (
            /* Regular card: 2 lines of description with ellipsis (...) */
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.description}>
              {item.description || `Episode ${item.number}`}
            </Text>
          ) : (
            /* Active card: Now playing indicator */
            <View style={styles.nowPlayingRow}>
              <PulsingDot />
              <Text style={styles.nowPlayingText}>Now playing</Text>
            </View>
          )}
        </View>
      </View>
    </ScalePressable>
  );
};

export default React.memo(EpisodeCard);

const styles = StyleSheet.create({
  card: {
    height: 88,
    flexDirection: 'row',
    alignItems: 'center',
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
  fillerStripe: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    bottom: 0,
    backgroundColor: '#ef4444',
  },

  // Content
  contentWrap: {
    flex: 1,
    height: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  textContainer: {
    gap: 5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  activeTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  description: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
  },
  nowPlayingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  nowPlayingText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
