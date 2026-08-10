import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import TextTicker from 'react-native-text-ticker';

import ScalePressable from '../shared/ScalePressable';

import { usePlayerStore, RESIZE_MODES } from '~/app/_store/usePlayerStore';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';
import { clamp, formatTimecode } from '~/helpers/subtitles';
import { SubtitleCue } from '~/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PlayerOverlayProps = {
  episodeId: string;
  animeTitle: string;
  controlsAnim: Animated.Value;
  seekPanResponder: any;
  activeSubtitleCues: SubtitleCue[];
  onCycleResizeMode: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onShowSettings: () => void;
};

const PlayerOverlay = ({
  episodeId,
  animeTitle,
  controlsAnim,
  seekPanResponder,
  activeSubtitleCues,
  onCycleResizeMode,
  onSeekBackward,
  onSeekForward,
  onShowSettings,
}: PlayerOverlayProps) => {
  // Zustand selectors
  const showControls = usePlayerStore((s) => s.showControls);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const isLocked = usePlayerStore((s) => s.isLocked);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isScrubbing = usePlayerStore((s) => s.isScrubbing);
  const scrubPreviewTime = usePlayerStore((s) => s.scrubPreviewTime);
  const seekBarWidth = usePlayerStore((s) => s.seekBarWidth);
  const resizeModeIndex = usePlayerStore((s) => s.resizeModeIndex);
  const flash = usePlayerStore((s) => s.flash);
  const isBuffering = usePlayerStore((s) => s.isBuffering);

  // Actions
  const togglePlaying = usePlayerStore((s) => s.togglePlaying);
  const toggleMuted = usePlayerStore((s) => s.toggleMuted);
  const setIsLocked = usePlayerStore((s) => s.setIsLocked);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setSeekBarWidth = usePlayerStore((s) => s.setSeekBarWidth);

  // Derived values
  const displayTime = isScrubbing ? scrubPreviewTime : currentTime;
  const progressRatio = duration > 0 ? clamp(displayTime / duration, 0, 1) : 0;
  const fillWidth = progressRatio * seekBarWidth;
  const bottomCaptionOffset = showControls && !isLocked ? (isFullscreen ? 108 : 78) : 22;
  const topCaptionOffset = showControls && !isLocked ? (isFullscreen ? 64 : 44) : 14;
  const resizeMode = RESIZE_MODES[resizeModeIndex];

  // Responsive sizing
  const topBtnSize = isFullscreen ? 42 : 36;
  const topIconSize = isFullscreen ? 19 : 17;
  const playBtnSize = isFullscreen ? 76 : 64;
  const playIconSize = isFullscreen ? 34 : 30;
  const skipBtnSize = isFullscreen ? 56 : 48;
  const skipIconSize = isFullscreen ? 26 : 22;
  const controlsGap = isFullscreen ? 38 : 30;
  const scrubTrackHeight = isFullscreen ? 4 : 3;
  const scrubThumbSize = isScrubbing ? (isFullscreen ? 18 : 14) : isFullscreen ? 15 : 11;
  const timecodeFontSize = isFullscreen ? 14 : 12;
  const episodeTitleFontSize = isFullscreen ? 17 : 15;

  const topCues = activeSubtitleCues.filter((cue) => cue.placement === 'top');
  const bottomCues = activeSubtitleCues.filter((cue) => cue.placement === 'bottom');

  return (
    <>
      {/* Double-tap seek flash */}
      {flash && flash.kind !== 'mode' && (
        <View
          pointerEvents="none"
          className="absolute bottom-0 top-0 items-center justify-center"
          style={[{ width: '38%' }, flash.kind === 'seek-left' ? { left: 0 } : { right: 0 }]}>
          <View
            className="items-center justify-center rounded-full px-4 py-3"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Ionicons
              name={flash.kind === 'seek-left' ? 'play-back' : 'play-forward'}
              size={22}
              color={COLORS.accent}
            />
            <Text style={{ color: COLORS.accent, fontSize: 11, marginTop: 3, fontWeight: '600' }}>
              {flash.label}
            </Text>
          </View>
        </View>
      )}

      {/* Resize mode flash */}
      {flash && flash.kind === 'mode' && (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View className="rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
            <Text style={{ color: COLORS.accent, fontSize: 13, fontWeight: '700' }}>
              {flash.label}
            </Text>
          </View>
        </View>
      )}

      {/* Top subtitle cues */}
      {topCues.map((cue, index) => (
        <View
          key={`top-${cue.startTime}-${index}`}
          pointerEvents="none"
          className="absolute left-3 right-3 items-center"
          style={{ top: topCaptionOffset + index * 58 }}>
          <Text style={styles.subtitleText}>{cue.text}</Text>
        </View>
      ))}

      {/* Bottom subtitle cues */}
      {bottomCues.map((cue, index) => (
        <View
          key={`bottom-${cue.startTime}-${index}`}
          pointerEvents="none"
          className="absolute left-3 right-3 items-center"
          style={{ bottom: bottomCaptionOffset + index * 58 }}>
          <Text style={styles.subtitleText}>{cue.text}</Text>
        </View>
      ))}

      {/* Locked state: minimal unlock pill */}
      {isLocked && (
        <Animated.View
          pointerEvents={showControls ? 'auto' : 'none'}
          className="absolute bottom-6 left-1/2 flex-row items-center rounded-full px-4 py-2.5"
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            marginLeft: -46,
            opacity: controlsAnim,
          }}>
          <ScalePressable
            className="flex-row items-center"
            onPress={() => setIsLocked(false)}
            scaleTo={0.96}>
            <Ionicons name="lock-closed" size={15} color={COLORS.text} />
            <Text style={{ color: COLORS.text, marginLeft: 6, fontSize: 12, fontWeight: '600' }}>
              Unlock
            </Text>
          </ScalePressable>
        </Animated.View>
      )}

      {/* Main controls overlay */}
      {!isLocked && (
        <Animated.View
          pointerEvents={showControls ? 'box-none' : 'none'}
          className="absolute inset-0"
          style={{ opacity: controlsAnim }}>
          {/* Top gradient */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0)']}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: isFullscreen ? 120 : 90,
            }}
          />

          {/* Top bar: title + action buttons */}
          <View className="absolute left-0 right-0 top-0 flex-row items-start justify-between px-4 pb-6 pt-4">
            <View className="flex-1 pr-3">
              <Text
                style={{ color: COLORS.text, fontSize: episodeTitleFontSize, fontWeight: '700' }}>
                Episode {episodeId}
              </Text>
              <View className="mt-1">
                <TextTicker
                  style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: '500' }}
                  duration={10000}
                  loop
                  bounce
                  repeatSpacer={50}
                  marqueeDelay={1000}>
                  {animeTitle}
                </TextTicker>
              </View>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TopButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon={resizeMode.icon}
                onPress={onCycleResizeMode}
              />
              <TopButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon="lock-open-outline"
                onPress={() => setIsLocked(true)}
              />
              <TopButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon={isMuted ? 'volume-mute' : 'volume-high'}
                onPress={toggleMuted}
              />
              <TopButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon="options-outline"
                onPress={onShowSettings}
              />
            </View>
          </View>

          {/* Center playback controls */}
          <View
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex-row items-center justify-center"
            style={{ gap: controlsGap }}>
            <ScalePressable
              className="items-center justify-center rounded-full"
              style={{
                width: skipBtnSize,
                height: skipBtnSize,
                backgroundColor: 'rgba(0,0,0,0.4)',
              }}
              scaleTo={0.96}
              onPress={onSeekBackward}>
              <Ionicons name="play-back" size={skipIconSize} color={COLORS.text} />
            </ScalePressable>
            <ScalePressable
              className="items-center justify-center rounded-full"
              style={{ width: playBtnSize, height: playBtnSize, backgroundColor: COLORS.accent }}
              scaleTo={0.96}
              onPress={togglePlaying}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={playIconSize}
                color={COLORS.bg}
                style={isPlaying ? undefined : { marginLeft: 3 }}
              />
            </ScalePressable>
            <ScalePressable
              className="items-center justify-center rounded-full"
              style={{
                width: skipBtnSize,
                height: skipBtnSize,
                backgroundColor: 'rgba(0,0,0,0.4)',
              }}
              scaleTo={0.96}
              onPress={onSeekForward}>
              <Ionicons name="play-forward" size={skipIconSize} color={COLORS.text} />
            </ScalePressable>
          </View>

          {/* Bottom gradient */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: isFullscreen ? 130 : 100,
            }}
          />

          {/* Bottom bar: seek bar + timecodes */}
          <View className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-6">
            <View
              {...seekPanResponder.panHandlers}
              onLayout={(event: any) => setSeekBarWidth(event.nativeEvent.layout.width)}
              style={{ height: 20, justifyContent: 'center' }}>
              <View
                style={{
                  height: scrubTrackHeight,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                }}>
                <View
                  style={{
                    height: scrubTrackHeight,
                    borderRadius: 2,
                    width: fillWidth,
                    backgroundColor: COLORS.accent,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: Math.max(0, fillWidth - scrubThumbSize / 2),
                    top: -(scrubThumbSize - scrubTrackHeight) / 2,
                    width: scrubThumbSize,
                    height: scrubThumbSize,
                    borderRadius: scrubThumbSize / 2,
                    backgroundColor: COLORS.accent,
                    borderWidth: 2,
                    borderColor: COLORS.bg,
                  }}
                />
              </View>
              {isScrubbing && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: clamp(fillWidth - 22, 0, Math.max(0, seekBarWidth - 44)),
                    top: -26,
                    backgroundColor: COLORS.surfaceRaised,
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                  }}>
                  <Text style={{ color: COLORS.accent, fontSize: 11, fontWeight: '600' }}>
                    {formatTimecode(scrubPreviewTime)}
                  </Text>
                </View>
              )}
            </View>

            <View className="mt-2 flex-row items-center justify-between">
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontSize: timecodeFontSize,
                  fontWeight: '500',
                }}>
                {formatTimecode(currentTime)}
                <Text style={{ color: COLORS.textFaint }}> / {formatTimecode(duration)}</Text>
              </Text>

              <ScalePressable
                onPress={() => setIsFullscreen(!isFullscreen)}
                className="p-1"
                scaleTo={0.85}>
                <Ionicons
                  name={isFullscreen ? 'contract' : 'expand'}
                  size={timecodeFontSize + 6}
                  color={COLORS.textMuted}
                />
              </ScalePressable>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Buffering spinner */}
      {isBuffering && (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Small reusable top-bar button
// ---------------------------------------------------------------------------

const TopButton = ({
  size,
  iconSize,
  icon,
  onPress,
}: {
  size: number;
  iconSize: number;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) => (
  <ScalePressable
    className="items-center justify-center rounded-full"
    style={{
      width: size,
      height: size,
      backgroundColor: 'rgba(38,38,38,0.75)',
    }}
    scaleTo={0.96}
    onPress={onPress}>
    <Ionicons name={icon} size={iconSize} color={COLORS.text} />
  </ScalePressable>
);

export default PlayerOverlay;

const styles = StyleSheet.create({
  subtitleText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: 4,
  },
});
