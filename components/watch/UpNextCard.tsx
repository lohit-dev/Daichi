import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'iconsax-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import ScalePressable from '~/components/shared/ScalePressable';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';

export type UpNextEpisode = {
  id: string;
  number: string;
  title: string;
  image?: string;
};

type UpNextCardProps = {
  episode: UpNextEpisode | null;
  onPlay: () => void;
  autoplaySeconds?: number | null;
};

const UpNextCard = ({ episode, onPlay, autoplaySeconds = null }: UpNextCardProps) => {
  const [secondsLeft, setSecondsLeft] = useState(autoplaySeconds ?? 0);
  const [cancelled, setCancelled] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!episode || cancelled || !autoplaySeconds || autoplaySeconds <= 0) return;

    setSecondsLeft(autoplaySeconds);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onPlay();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplaySeconds, cancelled, episode?.id]);

  if (!episode || cancelled) return null;

  const autoplayLabel =
    autoplaySeconds && autoplaySeconds > 0 ? `${secondsLeft}s` : null;

  return (
    <View style={styles.container}>
      {/* Section label row */}
      <View style={styles.labelRow}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowText}>UP NEXT</Text>
        </View>
        <Text style={styles.episodeTag}>EPISODE {episode.number}</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        {/* Left lime accent strip */}
        <View style={styles.accentStrip} />

        {/* Thumbnail with gradient overlay */}
        <View style={styles.thumbWrap}>
          {episode.image ? (
            <>
              <Image source={{ uri: episode.image }} style={styles.thumb} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Play size={22} color={COLORS.textMuted} variant="Bold" />
            </View>
          )}
        </View>

        {/* Text */}
        <View style={styles.copy}>
          <Text style={styles.label}>Play next</Text>
          <Text numberOfLines={2} style={styles.title}>
            {episode.title}
          </Text>
          {autoplayLabel && (
            <Text style={styles.autoplayLabel}>Auto-playing in {autoplayLabel}</Text>
          )}
        </View>

        {/* Play button */}
        <ScalePressable
          onPress={onPlay}
          style={styles.playButton}
          scaleTo={0.9}
          haptic="light"
          accessibilityLabel={`Play episode ${episode.number}`}>
          <Play size={16} color={COLORS.bg} variant="Bold" />
        </ScalePressable>
      </View>

      {/* Cancel autoplay */}
      {autoplaySeconds && autoplaySeconds > 0 ? (
        <ScalePressable
          onPress={() => setCancelled(true)}
          style={styles.cancel}
          scaleTo={0.96}>
          <Text style={styles.cancelText}>Cancel autoplay</Text>
        </ScalePressable>
      ) : null}
    </View>
  );
};

export default UpNextCard;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 7,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${COLORS.accent}22`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}55`,
  },
  eyebrowText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  episodeTag: {
    color: COLORS.textFaint,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#0e1310',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    paddingRight: 10,
    minHeight: 64,
  },

  // Lime accent left border strip
  accentStrip: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: COLORS.accent,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },

  // Thumbnail
  thumbWrap: {
    width: 72,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1f17',
    marginLeft: 2,
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    color: COLORS.text,
    fontFamily: 'Salsa-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  autoplayLabel: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },

  // Play button
  playButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: COLORS.accent,
  },

  cancel: { alignSelf: 'flex-end', paddingHorizontal: 4 },
  cancelText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
});
