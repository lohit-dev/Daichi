import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
  Alert,
  Animated,
  useWindowDimensions,
} from 'react-native';
import ReAnimated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';

import { useHistoryStore } from '~/app/_store/useHistoryStore';
import { usePlayerStore, RESIZE_MODES } from '~/app/_store/usePlayerStore';
import ScalePressable from '~/components/shared/ScalePressable';
import type { Episode } from '~/components/watch/EpisodeList';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';
import { getFormattedTitle } from '~/helpers/TextFormat';
import { formatIdToTitle, formatTime } from '~/helpers/common';
import { clamp } from '~/helpers/subtitles';
import { useEpisodeList } from '~/hooks/useEpisodeList';
import { usePlayerControls } from '~/hooks/usePlayerControls';
import { useVideoPlayer } from '~/hooks/useVideoPlayer';
import type { Server, SubtitleCue, SubtitleTrack } from '~/types';

// ===========================================================================
// A note on styling in this file:
// className (NativeWind) is used for layout, spacing, static positioning,
// rounded corners, borders, and any literal arbitrary-value colors that
// don't need to change at runtime. `style` is reserved for the three things
// NativeWind genuinely can't do: values pulled from the COLORS.* object
// (NativeWind needs a static string, it can't resolve a JS variable inside
// a className), hp()/wp() results, and anything computed at runtime —
// Animated interpolations, per-cue subtitle offsets, seek bar geometry,
// drawer width from useWindowDimensions, etc.
// ===========================================================================

// ===========================================================================
// Small shared bits
// ===========================================================================

// Reanimated needs the scroll container itself to be an "Animated" component
// for useAnimatedScrollHandler to run on the UI thread. Using Reanimated's own
// pre-wrapped exports here (not a fresh createAnimatedComponent call) since
// those are the ones NativeWind's react-native-reanimated interop actually
// targets.
const AnimatedFlatList = ReAnimated.FlatList;
const AnimatedScrollView = ReAnimated.ScrollView;

const OverlayIconButton = ({
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
    className="items-center justify-center rounded-full bg-[rgba(24,24,24,0.75)]"
    style={{ width: size, height: size }}
    scaleTo={0.94}
    onPress={onPress}>
    <Ionicons name={icon} size={iconSize} color="#FFFFFF" />
  </ScalePressable>
);

// Simple pulsing dot for the "Now playing" indicator on the active episode card
const NowPlayingDot = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.7, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      className="h-[7px] w-[7px] rounded-full bg-[#A3E635]"
      style={{ transform: [{ scale }], opacity }}
    />
  );
};

// ===========================================================================
// Player overlay — top bar, center transport, bottom seek bar, subtitle cues,
// flashes, buffering spinner. Same prop contract as the old PlayerOverlay.tsx
// so it's a drop-in if you split this back out.
// ===========================================================================

type WatchPlayerOverlayProps = {
  controlsAnim: Animated.Value;
  seekPanResponder: any;
  activeSubtitleCues: SubtitleCue[];
  onCycleResizeMode: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onShowSettings: () => void;
  onEnterPiP: () => void;
  onBack?: () => void;
  controlsDockStyle?: any;
};

const WatchPlayerOverlay = ({
  controlsAnim,
  seekPanResponder,
  activeSubtitleCues,
  onCycleResizeMode,
  onSeekBackward,
  onSeekForward,
  onShowSettings,
  onEnterPiP,
  onBack,
  controlsDockStyle,
}: WatchPlayerOverlayProps) => {
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
  const isPiP = usePlayerStore((s) => s.isPiP);

  const togglePlaying = usePlayerStore((s) => s.togglePlaying);
  const toggleMuted = usePlayerStore((s) => s.toggleMuted);
  const setIsLocked = usePlayerStore((s) => s.setIsLocked);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setSeekBarWidth = usePlayerStore((s) => s.setSeekBarWidth);

  const displayTime = isScrubbing ? scrubPreviewTime : currentTime;
  const progressRatio = duration > 0 ? clamp(displayTime / duration, 0, 1) : 0;
  const fillWidth = progressRatio * seekBarWidth;
  const bottomCaptionOffset = showControls && !isLocked ? (isFullscreen ? 100 : 74) : 20;
  const topCaptionOffset = showControls && !isLocked ? (isFullscreen ? 60 : 42) : 14;
  const resizeMode = RESIZE_MODES[resizeModeIndex];

  const topBtnSize = isFullscreen ? 40 : 34;
  const topIconSize = isFullscreen ? 18 : 15;
  const playBtnSize = isFullscreen ? 78 : 58;
  const playIconSize = isFullscreen ? 30 : 24;
  const skipBtnSize = isFullscreen ? 52 : 34;
  const skipIconSize = isFullscreen ? 22 : 15;
  const controlsGap = isFullscreen ? 46 : 30;
  const scrubTrackHeight = isFullscreen ? 4 : 3;
  const scrubThumbSize = isScrubbing ? (isFullscreen ? 18 : 14) : isFullscreen ? 15 : 10;
  const timecodeFontSize = isFullscreen ? 13 : 10.5;

  const topCues = activeSubtitleCues.filter((cue) => cue.placement === 'top');
  const bottomCues = activeSubtitleCues.filter((cue) => cue.placement === 'bottom');

  return (
    <>
      {/* Double-tap seek flash */}
      {flash && flash.kind !== 'mode' && (
        <View
          pointerEvents="none"
          className="absolute bottom-0 top-0 w-[38%] items-center justify-center"
          style={flash.kind === 'seek-left' ? { left: 0 } : { right: 0 }}>
          <View className="items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] px-4 py-3">
            <Ionicons
              name={flash.kind === 'seek-left' ? 'play-back' : 'play-forward'}
              size={20}
              color={COLORS.accent}
            />
            <Text className="mt-[3px] text-[11px] font-semibold" style={{ color: COLORS.accent }}>
              {flash.label}
            </Text>
          </View>
        </View>
      )}

      {/* Resize mode flash */}
      {flash && flash.kind === 'mode' && (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View className="rounded-full bg-[rgba(0,0,0,0.65)] px-4 py-2">
            <Text className="text-[13px] font-bold" style={{ color: COLORS.accent }}>
              {flash.label}
            </Text>
          </View>
        </View>
      )}

      {/* Top subtitle cues */}
      {topCues.map((cue, index) => (
        <ReAnimated.View
          key={`top-${cue.startTime}-${index}`}
          pointerEvents="none"
          className="absolute left-3 right-3 items-center"
          style={[{ top: topCaptionOffset + index * 50 }, controlsDockStyle]}>
          <Text style={styles.subtitleText}>{cue.text}</Text>
        </ReAnimated.View>
      ))}

      {/* Bottom subtitle cues */}
      {bottomCues.map((cue, index) => (
        <ReAnimated.View
          key={`bottom-${cue.startTime}-${index}`}
          pointerEvents="none"
          className="absolute left-3 right-3 items-center"
          style={[{ bottom: bottomCaptionOffset + index * 50 }, controlsDockStyle]}>
          <Text style={styles.subtitleText}>{cue.text}</Text>
        </ReAnimated.View>
      ))}

      {/* Locked state: minimal unlock pill */}
      {isLocked && (
        <Animated.View
          pointerEvents={showControls ? 'auto' : 'none'}
          className="absolute bottom-6 self-center"
          style={{ opacity: controlsAnim }}>
          <ScalePressable
            className="flex-row items-center gap-1.5 rounded-full bg-[rgba(0,0,0,0.6)] px-4 py-2.5"
            onPress={() => setIsLocked(false)}
            scaleTo={0.96}>
            <Ionicons name="lock-closed" size={13} color="#FFFFFF" />
            <Text className="text-[12px] font-semibold text-white">Unlock</Text>
          </ScalePressable>
        </Animated.View>
      )}

      {/* Main controls overlay */}
      {!isLocked && (
        <Animated.View
          pointerEvents={showControls ? 'box-none' : 'none'}
          className="absolute inset-0"
          style={{ opacity: controlsAnim }}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: isFullscreen ? 110 : 70,
            }}
          />

          {/* Top bar */}
          <ReAnimated.View
            className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-3 pb-2.5"
            style={[{ paddingTop: isFullscreen ? 16 : 10 }, controlsDockStyle]}>
            {onBack ? (
              <OverlayIconButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon="chevron-back"
                onPress={onBack}
              />
            ) : (
              <View />
            )}

            <View className="flex-row items-center gap-1.5">
              <OverlayIconButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon={resizeMode.icon}
                onPress={onCycleResizeMode}
              />
              <OverlayIconButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon="lock-open-outline"
                onPress={() => setIsLocked(true)}
              />
              <OverlayIconButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon={isMuted ? 'volume-mute' : 'volume-high'}
                onPress={toggleMuted}
              />
              <OverlayIconButton
                size={topBtnSize}
                iconSize={topIconSize}
                icon="options-outline"
                onPress={onShowSettings}
              />
            </View>
          </ReAnimated.View>

          {/* Center transport */}
          <View
            className="absolute inset-x-0 top-1/2 flex-row items-center justify-center"
            style={{ gap: controlsGap, marginTop: -playBtnSize / 2 }}>
            <ScalePressable
              className="items-center justify-center rounded-full bg-[rgba(0,0,0,0.4)]"
              style={{ width: skipBtnSize, height: skipBtnSize }}
              scaleTo={0.94}
              onPress={onSeekBackward}>
              <Ionicons name="play-back" size={skipIconSize} color="#FFFFFF" />
            </ScalePressable>
            <ScalePressable
              className="items-center justify-center rounded-full"
              style={{ width: playBtnSize, height: playBtnSize, backgroundColor: COLORS.accent }}
              scaleTo={0.94}
              onPress={togglePlaying}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={playIconSize}
                color={COLORS.bg}
                style={isPlaying ? undefined : { marginLeft: 3 }}
              />
            </ScalePressable>
            <ScalePressable
              className="items-center justify-center rounded-full bg-[rgba(0,0,0,0.4)]"
              style={{ width: skipBtnSize, height: skipBtnSize }}
              scaleTo={0.94}
              onPress={onSeekForward}>
              <Ionicons name="play-forward" size={skipIconSize} color="#FFFFFF" />
            </ScalePressable>
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: isFullscreen ? 130 : 90,
            }}
          />

          {/* Bottom seek bar */}
          <ReAnimated.View
            className="absolute bottom-0 left-0 right-0 px-3.5 pt-3.5"
            style={[{ paddingBottom: isFullscreen ? 20 : 12 }, controlsDockStyle]}>
            <View
              {...seekPanResponder.panHandlers}
              onLayout={(event: any) => setSeekBarWidth(event.nativeEvent.layout.width)}
              className="h-[18px] justify-center">
              <View
                className="rounded-[3px] bg-[rgba(255,255,255,0.25)]"
                style={{ height: scrubTrackHeight }}>
                <View
                  className="rounded-[inherit]"
                  style={{
                    height: scrubTrackHeight,
                    borderRadius: scrubTrackHeight,
                    width: fillWidth,
                    backgroundColor: COLORS.accent,
                  }}
                />
                <View
                  className="absolute rounded-full border-2 border-[#0a0a0a]"
                  style={{
                    left: Math.max(0, fillWidth - scrubThumbSize / 2),
                    top: -(scrubThumbSize - scrubTrackHeight) / 2,
                    width: scrubThumbSize,
                    height: scrubThumbSize,
                    backgroundColor: COLORS.accent,
                  }}
                />
              </View>
              {isScrubbing && (
                <View
                  pointerEvents="none"
                  className="absolute -top-6 rounded-md px-1.5 py-1"
                  style={{
                    left: clamp(fillWidth - 22, 0, Math.max(0, seekBarWidth - 44)),
                    backgroundColor: COLORS.surfaceRaised,
                  }}>
                  <Text className="text-[11px] font-semibold" style={{ color: COLORS.accent }}>
                    {formatTime(scrubPreviewTime)}
                  </Text>
                </View>
              )}
            </View>

            <View className="mt-1.5 flex-row items-center justify-between">
              <Text
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: timecodeFontSize,
                  fontWeight: '600',
                }}>
                {formatTime(currentTime)}
                <Text style={{ color: 'rgba(255,255,255,0.45)' }}> / {formatTime(duration)}</Text>
              </Text>

              <View className="flex-row items-center gap-3">
                {!isPiP && (
                  <ScalePressable
                    onPress={onEnterPiP}
                    scaleTo={0.85}
                    accessibilityLabel="Picture in Picture">
                    <MaterialCommunityIcons
                      name="picture-in-picture-bottom-right"
                      size={timecodeFontSize + 6}
                      color="rgba(255,255,255,0.75)"
                    />
                  </ScalePressable>
                )}
                <ScalePressable
                  onPress={() => setIsFullscreen(!isFullscreen)}
                  scaleTo={0.85}
                  accessibilityLabel={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
                  <Ionicons
                    name={isFullscreen ? 'contract' : 'expand'}
                    size={timecodeFontSize + 5}
                    color="rgba(255,255,255,0.75)"
                  />
                </ScalePressable>
              </View>
            </View>
          </ReAnimated.View>
        </Animated.View>
      )}

      {isBuffering && (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center bg-[rgba(0,0,0,0.25)]">
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      )}
    </>
  );
};

// ===========================================================================
// Settings — shared row/tab content, plus two shells (bottom sheet for
// portrait, right-side drawer for fullscreen). Same store-driven state either
// way (isModalVisible / activeTab), just a different container.
// ===========================================================================

type SettingsContentProps = {
  servers: Server[];
  activeServerIndex: number;
  validSubtitleTracks: SubtitleTrack[];
  onSelectServer: (index: number) => void;
};

const SettingsTabBar = () => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  return (
    <View className="mb-3.5 flex-row rounded-full border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.045)] p-1">
      {(['servers', 'subtitles', 'quality'] as const).map((tab) => (
        <ScalePressable
          key={tab}
          className="flex-1 items-center rounded-full py-2.5"
          style={activeTab === tab ? { backgroundColor: COLORS.accent } : undefined}
          scaleTo={0.97}
          onPress={() => setActiveTab(tab)}>
          <Text
            className="text-[12.5px] font-bold"
            style={{ color: activeTab === tab ? COLORS.bg : COLORS.textMuted }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </ScalePressable>
      ))}
    </View>
  );
};

const EmptyRow = ({ label }: { label: string }) => (
  <View className="p-4.5 items-center rounded-2xl bg-[rgba(255,255,255,0.045)]">
    <Text className="text-center text-[12.5px] leading-[18px]" style={{ color: COLORS.textMuted }}>
      {label}
    </Text>
  </View>
);

const SettingsTabContent = ({
  servers,
  activeServerIndex,
  validSubtitleTracks,
  onSelectServer,
}: SettingsContentProps) => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const selectedSubtitleIndex = usePlayerStore((s) => s.selectedSubtitleIndex);
  const selectedQualityHeight = usePlayerStore((s) => s.selectedQualityHeight);
  const availableQualities = usePlayerStore((s) => s.availableQualities);
  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);
  const setSelectedSubtitleIndex = usePlayerStore((s) => s.setSelectedSubtitleIndex);
  const setSelectedQualityHeight = usePlayerStore((s) => s.setSelectedQualityHeight);

  const rowBase =
    'mb-2 flex-row items-center justify-between rounded-2xl border-[1.5px] border-transparent bg-[rgba(255,255,255,0.045)] p-3.5';
  const rowActiveStyle = { borderColor: COLORS.accent, backgroundColor: 'rgba(163,230,53,0.08)' };

  if (activeTab === 'servers') {
    if (servers.length === 0) return <EmptyRow label="No servers available" />;
    return (
      <>
        {servers.map((server, index) => {
          const active = activeServerIndex === index;
          return (
            <Pressable
              key={index}
              className={rowBase}
              style={active ? rowActiveStyle : undefined}
              onPress={() => onSelectServer(index)}>
              <Text className="text-[13.5px] font-semibold text-white">{server.serverName}</Text>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: active ? COLORS.accent : 'rgba(255,255,255,0.08)' }}>
                <Text
                  className="text-[10px] font-extrabold tracking-wide"
                  style={{ color: active ? COLORS.bg : COLORS.textMuted }}>
                  {server.type.toUpperCase()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </>
    );
  }

  if (activeTab === 'subtitles') {
    if (validSubtitleTracks.length === 0) return <EmptyRow label="No subtitles available" />;
    return (
      <>
        <Pressable
          className={rowBase}
          style={selectedSubtitleIndex === null ? rowActiveStyle : undefined}
          onPress={() => {
            setSelectedSubtitleIndex(null);
            setIsModalVisible(false);
          }}>
          <Text className="text-[13.5px] font-semibold text-white">None</Text>
          {selectedSubtitleIndex === null && (
            <View
              className="h-5 w-5 items-center justify-center rounded-full"
              style={{ backgroundColor: COLORS.accent }}>
              <Ionicons name="checkmark" size={12} color={COLORS.bg} />
            </View>
          )}
        </Pressable>
        {validSubtitleTracks.map((track, index) => {
          const active = selectedSubtitleIndex === index;
          return (
            <Pressable
              key={index}
              className={rowBase}
              style={active ? rowActiveStyle : undefined}
              onPress={() => {
                setSelectedSubtitleIndex(index);
                setIsModalVisible(false);
              }}>
              <Text className="text-[13.5px] font-semibold text-white">{track.title}</Text>
              {active && (
                <View
                  className="h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: COLORS.accent }}>
                  <Ionicons name="checkmark" size={12} color={COLORS.bg} />
                </View>
              )}
            </Pressable>
          );
        })}
      </>
    );
  }

  // quality
  return (
    <>
      <Pressable
        className={rowBase}
        style={selectedQualityHeight === 0 ? rowActiveStyle : undefined}
        onPress={() => {
          setSelectedQualityHeight(0);
          setIsModalVisible(false);
        }}>
        <Text className="text-[13.5px] font-semibold text-white">Auto</Text>
        {selectedQualityHeight === 0 && (
          <View
            className="h-5 w-5 items-center justify-center rounded-full"
            style={{ backgroundColor: COLORS.accent }}>
            <Ionicons name="checkmark" size={12} color={COLORS.bg} />
          </View>
        )}
      </Pressable>
      {availableQualities.length === 0 ? (
        <EmptyRow
          label={
            'Quality is managed automatically.\nThe player picks the best resolution for your connection.'
          }
        />
      ) : (
        availableQualities.map((quality) => {
          const active = selectedQualityHeight === quality.height;
          return (
            <Pressable
              key={quality.height}
              className={rowBase}
              style={active ? rowActiveStyle : undefined}
              onPress={() => {
                setSelectedQualityHeight(quality.height);
                setIsModalVisible(false);
              }}>
              <Text className="text-[13.5px] font-semibold text-white">{quality.label}</Text>
              {active && (
                <View
                  className="h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: COLORS.accent }}>
                  <Ionicons name="checkmark" size={12} color={COLORS.bg} />
                </View>
              )}
            </Pressable>
          );
        })
      )}
    </>
  );
};

// Portrait: bottom sheet
const SettingsSheetPortrait = ({
  sheetAnim,
  ...contentProps
}: SettingsContentProps & { sheetAnim: Animated.Value }) => {
  const isModalVisible = usePlayerStore((s) => s.isModalVisible);
  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);

  return (
    <Animated.View
      pointerEvents={isModalVisible ? 'auto' : 'none'}
      className="absolute inset-0"
      style={{ zIndex: 2000 }}>
      <Pressable className="absolute inset-0" onPress={() => setIsModalVisible(false)}>
        <Animated.View
          className="absolute inset-0 bg-[rgba(0,0,0,0.6)]"
          style={{ opacity: sheetAnim }}
        />
      </Pressable>

      <Animated.View
        className="absolute bottom-0 left-0 right-0 rounded-t-[28px] border border-[rgba(255,255,255,0.08)] px-4 pb-7 pt-2.5"
        style={{
          maxHeight: '72%',
          backgroundColor: 'rgba(17,20,15,0.98)',
          transform: [
            { translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [1000, 0] }) },
          ],
        }}>
        <View
          className="mb-4 h-1 w-9 self-center rounded"
          style={{ backgroundColor: COLORS.divider }}
        />
        <SettingsTabBar />
        <ScrollView showsVerticalScrollIndicator={false} className="w-full">
          <SettingsTabContent {...contentProps} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

// Fullscreen: right-side drawer
const SettingsDrawerFullscreen = ({
  sheetAnim,
  ...contentProps
}: SettingsContentProps & { sheetAnim: Animated.Value }) => {
  const isModalVisible = usePlayerStore((s) => s.isModalVisible);
  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);
  const { width } = useWindowDimensions();
  const drawerWidth = width * 0.62;

  return (
    <Animated.View
      pointerEvents={isModalVisible ? 'auto' : 'none'}
      className="absolute inset-0"
      style={{ zIndex: 2000 }}>
      <Pressable className="absolute inset-0" onPress={() => setIsModalVisible(false)}>
        <Animated.View
          className="absolute inset-0 bg-[rgba(0,0,0,0.55)]"
          style={{ opacity: sheetAnim }}
        />
      </Pressable>

      <Animated.View
        className="p-4.5 absolute bottom-0 right-0 top-0 border-l border-[rgba(255,255,255,0.09)]"
        style={{
          width: drawerWidth,
          backgroundColor: 'rgba(15,17,14,0.98)',
          transform: [
            {
              translateX: sheetAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [drawerWidth, 0],
              }),
            },
          ],
        }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-[15px] font-bold text-white">Playback settings</Text>
          <ScalePressable
            className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[rgba(255,255,255,0.045)]"
            onPress={() => setIsModalVisible(false)}
            scaleTo={0.9}>
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </ScalePressable>
        </View>
        <SettingsTabBar />
        <ScrollView showsVerticalScrollIndicator={false} className="w-full">
          <SettingsTabContent {...contentProps} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

const WatchSettingsSheet = (props: SettingsContentProps & { sheetAnim: Animated.Value }) => {
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  return isFullscreen ? (
    <SettingsDrawerFullscreen {...props} />
  ) : (
    <SettingsSheetPortrait {...props} />
  );
};

// ===========================================================================
// Episode card + list
// ===========================================================================

// const EP_CARD_HEIGHT = 88;
// const EP_ROW_HEIGHT = EP_CARD_HEIGHT + 10;

const WatchEpisodeCard = React.memo(
  ({
    item,
    isCurrent = false,
    fallbackImage,
    onPress,
  }: {
    item: Episode;
    isCurrent: boolean;
    fallbackImage?: string;
    onPress: (item: Episode) => void;
  }) => {
    const thumb = item.image ?? fallbackImage;

    return (
      <ScalePressable
        onPress={() => {
          if (!isCurrent) onPress(item);
        }}
        disabled={isCurrent}
        scaleTo={0.985}
        style={[epStyles.card, isCurrent && epStyles.activeCard]}>
        {/* Left: Thumbnail with EP badge */}
        <View style={epStyles.thumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={epStyles.thumb} />
          ) : (
            <View style={epStyles.placeholderThumb}>
              <Text style={epStyles.placeholderText}>{item.number}</Text>
            </View>
          )}
          <View style={epStyles.epBadge}>
            <Text style={epStyles.epBadgeText}>EP {item.number}</Text>
          </View>

          {item.isFiller && <View style={epStyles.fillerStripe} />}
        </View>

        {/* Right: Content details (Title + Description / Now playing) */}
        <View style={epStyles.contentWrap}>
          <View style={epStyles.textContainer}>
            {/* Episode Title — allowed up to 2 lines */}
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={[epStyles.title, isCurrent && epStyles.activeTitle]}>
              {item.title}
            </Text>

            {!isCurrent ? (
              /* Regular card: 2 lines of description with ellipsis (...) */
              <Text numberOfLines={2} ellipsizeMode="tail" style={epStyles.description}>
                {item.description || `Episode ${item.number}`}
              </Text>
            ) : (
              /* Active card: Now playing indicator */
              <View style={epStyles.nowPlayingRow}>
                <NowPlayingDot />
                <Text style={epStyles.nowPlayingText}>Now playing</Text>
              </View>
            )}
          </View>
        </View>
      </ScalePressable>
    );
  }
);

const epStyles = StyleSheet.create({
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

const EpisodesSectionHeader = ({
  count,
  sortOrder = 'asc',
  onToggleSort,
  onScrollToTop,
}: {
  count: number;
  sortOrder?: 'asc' | 'desc';
  onToggleSort?: () => void;
  onScrollToTop?: () => void;
}) => (
  <View
    className="flex-row items-center justify-between py-2.5"
    style={{
      backgroundColor: COLORS.bg,
      zIndex: 10,
    }}>
    <ScalePressable
      onPress={onScrollToTop}
      scaleTo={0.96}
      className="flex-row items-center gap-1.5 py-0.5">
      <Text className="text-[16px] font-bold text-white">
        <Text style={{ color: COLORS.accent }}>E</Text>pisodes{' '}
        <Text className="text-[13px] font-semibold" style={{ color: COLORS.textFaint }}>
          ({count})
        </Text>
      </Text>
    </ScalePressable>

    <ScalePressable
      onPress={onToggleSort}
      scaleTo={0.93}
      className="flex-row items-center gap-1.5 rounded-[8px] px-2.5 py-1.5"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
      <Ionicons
        name={sortOrder === 'desc' ? 'filter' : 'filter-outline'}
        size={12}
        color={sortOrder === 'desc' ? COLORS.accent : COLORS.textMuted}
      />
      <Text className="text-[12px] font-semibold" style={{ color: COLORS.textMuted }}>
        <Text style={{ color: COLORS.textMuted }}>Ep </Text>
        <Text style={{ color: COLORS.accent }}>
          {sortOrder === 'desc' ? `${count}–1` : `1–${count}`}
        </Text>
      </Text>
    </ScalePressable>
  </View>
);

const WatchEpisodeList = ({
  episodes,
  currentEpisodeId,
  fallbackImage,
  onSelectEpisode,
  bottomPadding = 40,
  onEndReached,
  hasMoreImages,
  onScroll,
  scrollEventThrottle,
  ListHeaderComponent,
}: {
  episodes: Episode[];
  currentEpisodeId: string;
  fallbackImage?: string;
  onSelectEpisode: (episode: Episode) => void;
  bottomPadding?: number;
  onEndReached?: () => void;
  hasMoreImages?: boolean;
  onScroll?: (...args: any[]) => void;
  scrollEventThrottle?: number;
  ListHeaderComponent?: ReactElement;
}) => {
  const listRef = useRef<any>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const displayEpisodes = useMemo(() => {
    if (sortOrder === 'desc') {
      return [...episodes].reverse();
    }
    return episodes;
  }, [episodes, sortOrder]);

  const activeAscIndex = episodes.findIndex((ep) => ep.id === currentEpisodeId);

  // Card geometry — fixed and known at compile time
  const CARD_H = 88;
  const SEPARATOR_H = 10;
  const CARD_STRIDE = CARD_H + SEPARATOR_H; // 98

  // Stores the ACTUAL measured info-block height (variable — depends on title
  // length, description, badges etc). Populated by the onLayout on that item.
  const infoHeightRef = useRef(0);
  const hasScrolledToActive = useRef(false);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => {
      const next = prev === 'asc' ? 'desc' : 'asc';
      if (next === 'desc') {
        // Toggling to Ep 25–1: scroll to top so user sees the newest episodes (25, 24, 23...)
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
      } else {
        // Toggling back to Ep 1–25: anchor to the active episode (e.g. 8, 9, 10...)
        const ascIndex = episodes.findIndex((ep) => ep.id === currentEpisodeId);
        if (ascIndex > 0) {
          requestAnimationFrame(() => {
            const targetH = infoHeightRef.current || 280;
            const offset = targetH + ascIndex * CARD_STRIDE;
            listRef.current?.scrollToOffset({ offset, animated: true });
          });
        } else {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }
      }
      return next;
    });
  }, [episodes, currentEpisodeId, CARD_STRIDE]);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // Computes the exact pixel offset that places the active episode directly
  // below the sticky header.
  const scrollToActiveEpisode = useCallback(
    (infoH: number, indexToScroll = activeAscIndex) => {
      if (indexToScroll <= 0) return;
      const targetH = infoH > 0 ? infoH : infoHeightRef.current || 280;
      const offset = targetH + indexToScroll * CARD_STRIDE;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset, animated: false });
      });
    },
    [activeAscIndex, CARD_STRIDE]
  );

  // On mount / active episode update in ascending mode, anchor to active episode
  useEffect(() => {
    if (sortOrder !== 'asc') return;
    if (activeAscIndex <= 0 || episodes.length === 0) return;
    hasScrolledToActive.current = false;
    const timer = setTimeout(() => {
      scrollToActiveEpisode(infoHeightRef.current, activeAscIndex);
    }, 120);
    return () => clearTimeout(timer);
  }, [activeAscIndex, currentEpisodeId, episodes.length, sortOrder, scrollToActiveEpisode]);

  const listData = useMemo(
    () => [
      { type: 'info' as const, id: '__info__' },
      { type: 'header' as const, id: '__header__' },
      ...displayEpisodes.map((ep) => ({ type: 'episode' as const, ...ep })),
    ],
    [displayEpisodes]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === 'info') {
        return (
          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) {
                infoHeightRef.current = h;
                if (!hasScrolledToActive.current && sortOrder === 'asc') {
                  hasScrolledToActive.current = true;
                  scrollToActiveEpisode(h, activeAscIndex);
                }
              }
            }}>
            {ListHeaderComponent || null}
          </View>
        );
      }
      if (item.type === 'header') {
        return (
          <EpisodesSectionHeader
            count={episodes.length}
            sortOrder={sortOrder}
            onToggleSort={toggleSortOrder}
            onScrollToTop={scrollToTop}
          />
        );
      }
      return (
        <WatchEpisodeCard
          item={item}
          isCurrent={item.id === currentEpisodeId}
          fallbackImage={fallbackImage}
          onPress={onSelectEpisode}
        />
      );
    },
    [
      ListHeaderComponent,
      episodes.length,
      sortOrder,
      toggleSortOrder,
      scrollToTop,
      scrollToActiveEpisode,
      activeAscIndex,
      currentEpisodeId,
      fallbackImage,
      onSelectEpisode,
    ]
  );

  const initialRenderCount = Math.max(activeAscIndex + 12, 25);

  return (
    <AnimatedFlatList
      ref={listRef}
      data={listData}
      keyExtractor={(item: any) => item.id}
      style={{ flex: 1 }}
      stickyHeaderIndices={[1]}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottomPadding, paddingTop: 2 }}
      ItemSeparatorComponent={({ leadingItem }: any) => {
        if (leadingItem?.type === 'episode' || leadingItem?.type === 'header') {
          return <View className="h-2.5" />;
        }
        return null;
      }}
      initialNumToRender={initialRenderCount}
      maxToRenderPerBatch={initialRenderCount}
      windowSize={11}
      removeClippedSubviews={false}
      renderItem={renderItem}
      onEndReached={hasMoreImages ? onEndReached : undefined}
      onEndReachedThreshold={0.6}
    />
  );
};

// ===========================================================================
// Discussion — visual-only placeholder for now (real AniList wiring is a
// follow-up pass; see EpisodeDiscussion.tsx for the data layer to reconnect)
// ===========================================================================

const WatchDiscussionPlaceholder = () => (
  <View className="items-center justify-center px-8">
    <View
      className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-[24px] border"
      style={{
        backgroundColor: 'rgba(163,230,53,0.12)',
        borderColor: 'rgba(163,230,53,0.22)',
      }}>
      <Ionicons name="chatbubbles-outline" size={32} color={COLORS.accent} />
    </View>
    <Text className="text-center text-[18px] font-bold text-white">Discussion Coming Soon</Text>
    <Text
      className="mt-2 text-center text-[14px] leading-[22px]"
      style={{ color: COLORS.textMuted, maxWidth: 300 }}>
      Episode threads and community chat will be available here soon.
    </Text>
  </View>
);

// ===========================================================================
// Screen
// ===========================================================================

const WatchScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [activePanel, setActivePanel] = useState<'episodes' | 'chat'>('episodes');

  // Panel switch (Episodes ↔ Chat) and the player "docking" transition both
  // used to run on core Animated with useNativeDriver:false (unavoidable for
  // marginHorizontal/borderRadius there), which is JS-thread-driven and the
  // likely source of jank. Reanimated shared values + worklets keep this on
  // the UI thread instead. Both scrollable panels (episodes + discussion)
  // feed the same scrollY so the docking effect works whichever tab is open.
  const dockAnim = useSharedValue(0);
  useEffect(() => {
    dockAnim.value = withSpring(activePanel === 'episodes' ? 0 : 1, {
      stiffness: 260,
      damping: 22,
      mass: 0.55,
    });
  }, [activePanel, dockAnim]);

  const scrollY = useSharedValue(0);
  const handleContentScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // ─── Hybrid expansion animation ────────────────────────────────────────────
  // Phase 1 (scroll 0 → SNAP_AT px): smooth scroll-driven interpolation.
  // Phase 2 (scroll > SNAP_AT px):  a single withSpring fires and magnetically
  // locks the player to full width. Spring runs on the UI thread via Reanimated
  // 4's JSI worklet — zero bridge, zero layout recalc on the video view itself.
  //
  // We animate `paddingHorizontal` on a *wrapper* View rather than
  // `marginHorizontal` on the player. The player fills flex:1 inside the
  // wrapper, so from its own perspective its width never changes — the GPU just
  // composites a padded shell. That eliminates per-frame layout passes on the
  // video surface and its Reanimated overlay.
  // ──────────────────────────────────────────────────────────────────────────
  const SNAP_AT = 30; // px of scroll before spring fires
  const SNAP_RANGE = 64; // scroll range for phase-1 interpolation
  const MARGIN_START = 14; // collapsed (portrait, top of list)

  // isFullscreenShared must be declared BEFORE useAnimatedReaction so the
  // worklet closure captures the correct reference.
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const isFullscreenShared = useSharedValue(isFullscreen);
  useEffect(() => {
    isFullscreenShared.value = isFullscreen;
  }, [isFullscreen, isFullscreenShared]);

  // Tracks whether the spring has already fired so we don't re-trigger it
  const hasSnapped = useSharedValue(false);
  // The animated margin value — starts at MARGIN_START, ends at 0
  const dockMargin = useSharedValue(MARGIN_START);

  // Worklet that reacts to scrollY changes and drives dockMargin
  useAnimatedReaction(
    () => scrollY.value,
    (sy) => {
      'worklet';
      if (isFullscreenShared.value) return;
      if (sy >= SNAP_AT && !hasSnapped.value) {
        // Phase 2: spring-snap to fully expanded
        hasSnapped.value = true;
        dockMargin.value = withSpring(0, {
          stiffness: 180,
          damping: 18,
          mass: 0.6,
          overshootClamping: true, // no bounce on a layout value
        });
      } else if (sy < SNAP_AT) {
        // Phase 1: scroll-driven (or reset when scrolled back to top)
        if (hasSnapped.value) {
          hasSnapped.value = false;
        }
        // Smooth interpolation tied to scroll position
        const margin = MARGIN_START - (MARGIN_START * Math.min(sy, SNAP_RANGE)) / SNAP_RANGE;
        dockMargin.value = margin;
      }
    }
  );

  // Reset docking state on mount (each episode is a fresh route mount)
  useEffect(() => {
    dockMargin.value = MARGIN_START;
    hasSnapped.value = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outer wrapper gets paddingHorizontal — the player fills flex:1 inside.
  // No layout pass on the video surface itself.
  const playerDockStyle = useAnimatedStyle(() => {
    if (isFullscreenShared.value) {
      return { paddingHorizontal: 0 };
    }
    return { paddingHorizontal: dockMargin.value };
  });

  // borderRadius on the inner player view, still scroll-driven (no layout cost
  // on border changes in Reanimated 4 — driven by the compositor).
  const playerRadiusStyle = useAnimatedStyle(() => {
    if (isFullscreenShared.value) return { borderRadius: 0 };
    // Mirror the margin: at margin=14 → radius=22, at margin=0 → radius=0
    const radius = (dockMargin.value / MARGIN_START) * 22;
    return { borderRadius: radius };
  });

  // Counter-balance so controls stay at a constant 14px from phone glass edges:
  // outer padding is `dockMargin` (14 -> 0), overlay margin is `14 - dockMargin` (0 -> 14).
  // dockMargin + (14 - dockMargin) = 14px CONSTANT at every frame!
  const controlsDockStyle = useAnimatedStyle(() => {
    if (isFullscreenShared.value) return { marginHorizontal: 0 };
    return { marginHorizontal: MARGIN_START - dockMargin.value };
  });

  const panelTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(dockAnim.value, [0, 1], [0, -screenWidth]) }],
  }));
  const panel1Style = useAnimatedStyle(() => ({
    opacity: interpolate(dockAnim.value, [0, 0.7, 1], [1, 0.6, 0.2]),
  }));
  const panel2Style = useAnimatedStyle(() => ({
    opacity: interpolate(dockAnim.value, [0, 0.3, 1], [0.2, 0.6, 1]),
  }));
  const dockIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(dockAnim.value, [0, 1], [0, 108]) }],
  }));

  const {
    episodeId,
    animeId,
    animeSlug,
    type,
    animeTitle,
    animeImage,
    malId: malIdParam,
    episodeTitle: paramEpisodeTitle,
    episodeDescription: paramEpisodeDescription,
    episodeThumbnail: paramEpisodeThumbnail,
  } = useLocalSearchParams<{
    episodeId: string;
    animeId: string;
    animeSlug?: string;
    type: 'sub' | 'dub';
    animeTitle?: string;
    animeImage?: string;
    malId?: string;
    episodeTitle?: string;
    episodeDescription?: string;
    episodeThumbnail?: string;
  }>();

  useEffect(() => {
    usePlayerStore.getState().reset();
    scrollY.value = 0;

    const historyItem = useHistoryStore.getState().history[animeId];
    if (historyItem && historyItem.episodeId === episodeId && historyItem.progress > 0) {
      usePlayerStore.getState().setPendingSeek(historyItem.progress);
    }

    return () => {
      usePlayerStore.getState().setIsPlaying(false);
      usePlayerStore.getState().reset();
    };
  }, [animeId, episodeId, scrollY]);

  // -----------------------------------------------------------------------
  // Hooks
  // -----------------------------------------------------------------------

  const displayTitle = animeTitle || formatIdToTitle(animeId);
  const malId = malIdParam ? Number(malIdParam) : undefined;
  const {
    data: episodeListData,
    loadMoreImages,
    hasMoreImages,
  } = useEpisodeList(animeId, type, animeImage, malId);
  const episodes = episodeListData ?? [];
  const bottomDockSpace = insets.bottom + 120;

  const historyItem = useHistoryStore((s) => s.history[animeId]);
  const matchingHistory = historyItem?.episodeId === episodeId ? historyItem : undefined;

  const currentEpisode = useMemo(
    () => episodes.find((episode) => episode.id === episodeId),
    [episodes, episodeId]
  );

  const activeEpisodeTitle =
    currentEpisode?.title ||
    paramEpisodeTitle ||
    matchingHistory?.episodeTitle ||
    `Episode ${currentEpisode?.number ?? episodeId}`;

  const activeEpisodeDescription =
    currentEpisode?.description || paramEpisodeDescription || matchingHistory?.episodeDescription;

  const activeEpisodeThumbnail =
    currentEpisode?.image ||
    paramEpisodeThumbnail ||
    matchingHistory?.episodeThumbnail ||
    animeImage;

  const playerMetadata = useMemo(
    () => ({
      title: activeEpisodeTitle,
      subtitle: displayTitle,
      artist: displayTitle,
      description: activeEpisodeDescription,
      imageUri: activeEpisodeThumbnail,
    }),
    [activeEpisodeTitle, displayTitle, activeEpisodeDescription, activeEpisodeThumbnail]
  );

  const {
    videoRef,
    isLoading,
    queryError,
    videoSource,
    videoSourceKey,
    videoSourceObj,
    selectedVideoTrack,
    resizeMode,
    servers,
    activeServerIndex,
    validSubtitleTracks,
    isSubtitleReady,
    handleProgress,
    handleLoad,
    handleError,
    handleBuffer,
    handleVideoTracks,
    handleEnd,
    seekTo,
  } = useVideoPlayer(animeId, episodeId, type, animeSlug, playerMetadata);

  const handleExit = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: '/anime/[id]', params: { id: animeId } });
  }, [animeId, router]);

  const handleBack = useCallback(() => {
    if (usePlayerStore.getState().isModalVisible) {
      usePlayerStore.getState().setIsModalVisible(false);
      return;
    }
    if (usePlayerStore.getState().isFullscreen) {
      usePlayerStore.getState().setIsFullscreen(false);
      return;
    }
    handleExit();
  }, [handleExit]);

  const {
    controlsAnim,
    sheetAnim,
    playerWidthRef,
    seekPanResponder,
    triggerFlash,
    handleCycleResizeMode,
    handleVideoTap,
  } = usePlayerControls(seekTo, handleExit);

  // -----------------------------------------------------------------------
  // Zustand selectors
  // -----------------------------------------------------------------------

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const subtitleCues = usePlayerStore((s) => s.subtitleCues);
  const isPiP = usePlayerStore((s) => s.isPiP);
  const selectedSubtitleIndex = usePlayerStore((s) => s.selectedSubtitleIndex);
  const selectedQualityHeight = usePlayerStore((s) => s.selectedQualityHeight);
  const setShowControls = usePlayerStore((s) => s.setShowControls);
  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);
  const setIsPiP = usePlayerStore((s) => s.setIsPiP);
  const selectServer = usePlayerStore((s) => s.selectServer);

  const activeSubtitleCues = useMemo(
    () => subtitleCues.filter((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime),
    [currentTime, subtitleCues]
  );

  // -----------------------------------------------------------------------
  // Episode helpers
  // -----------------------------------------------------------------------

  const nextEpisode = useMemo(() => {
    const currentIndex = episodes.findIndex((ep: { id: string }) => ep.id === episodeId);
    if (currentIndex === -1) return null;
    return episodes[currentIndex + 1] ?? null;
  }, [episodes, episodeId]);

  const pendingEpisodeNavigationRef = useRef<string | null>(null);
  useEffect(() => {
    pendingEpisodeNavigationRef.current = null;
  }, [episodeId]);

  const goToEpisode = useCallback(
    (
      target: {
        id: string;
        animeSlug?: string;
        title?: string;
        description?: string;
        image?: string;
        number?: string | number;
      } | null
    ) => {
      if (!target || target.id === episodeId || pendingEpisodeNavigationRef.current === target.id) {
        return;
      }
      pendingEpisodeNavigationRef.current = target.id;
      router.replace({
        pathname: '/anime/watch/[episodeId]',
        params: {
          episodeId: target.id,
          animeId,
          animeSlug: target.animeSlug || animeSlug,
          type,
          animeTitle,
          animeImage,
          episodeTitle: target.title,
          episodeDescription: target.description,
          episodeThumbnail: target.image,
        },
      });
    },
    [router, animeId, animeSlug, type, animeTitle, animeImage, episodeId]
  );

  const handleVideoEnd = useCallback(() => {
    if (nextEpisode) {
      goToEpisode(nextEpisode);
      return;
    }
    handleEnd();
  }, [goToEpisode, handleEnd, nextEpisode]);

  // -----------------------------------------------------------------------
  // Progress tracking
  // -----------------------------------------------------------------------

  const saveProgress = useHistoryStore((s) => s.saveProgress);
  const lastSavedProgressRef = useRef<{ episodeId: string; second: number } | null>(null);

  useEffect(() => {
    const second = Math.floor(currentTime);
    const previous = lastSavedProgressRef.current;
    if (
      second <= 0 ||
      !animeImage ||
      (previous?.episodeId === episodeId && second - previous.second < 5)
    )
      return;
    lastSavedProgressRef.current = { episodeId, second };
    saveProgress({
      animeId,
      animeSlug,
      animeTitle: animeTitle || formatIdToTitle(animeId),
      animeImage,
      episodeId,
      episodeNumber: currentEpisode?.number ? String(currentEpisode.number) : episodeId,
      episodeTitle: activeEpisodeTitle,
      episodeDescription: activeEpisodeDescription,
      episodeThumbnail: activeEpisodeThumbnail || undefined,
      progress: currentTime,
      duration: usePlayerStore.getState().duration || 0,
    });
  }, [
    animeId,
    animeSlug,
    animeImage,
    animeTitle,
    activeEpisodeThumbnail,
    activeEpisodeTitle,
    activeEpisodeDescription,
    currentEpisode?.number,
    currentTime,
    episodeId,
    saveProgress,
  ]);

  // -----------------------------------------------------------------------
  // Action handlers
  // -----------------------------------------------------------------------

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Watching "${animeTitle || formatIdToTitle(animeId)}" — Episode ${currentEpisode?.number ?? episodeId} on Daichi`,
        title: animeTitle || formatIdToTitle(animeId),
      });
    } catch {
      // user dismissed
    }
  }, [animeTitle, animeId, currentEpisode, episodeId]);

  const handleDownload = useCallback(() => {
    Alert.alert('Download', 'Download functionality coming soon!', [{ text: 'OK' }]);
  }, []);

  const handleEnterPiP = useCallback(() => {
    try {
      if (videoRef.current?.enterPictureInPicture) {
        videoRef.current.enterPictureInPicture();
      } else {
        Alert.alert(
          'Picture-in-Picture',
          'Picture-in-Picture is not available on this device or configuration.'
        );
      }
    } catch (err) {
      console.warn('[WatchScreen] Failed to enter PiP:', err);
    }
  }, [videoRef]);

  const handleSelectServer = useCallback((index: number) => selectServer(index), [selectServer]);

  // -----------------------------------------------------------------------
  // Loading / error state
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isLoading && !videoSource) {
      const timer = setTimeout(handleExit, 1600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [handleExit, isLoading, videoSource]);

  if (isLoading || !videoSource) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text className="mt-4" style={{ color: COLORS.textMuted }}>
          {isLoading ? 'Loading video source…' : 'No video source available. Returning…'}
        </Text>
        {queryError && (
          <Text className="mt-2" style={{ color: COLORS.danger }}>
            Error: {String(queryError)}
          </Text>
        )}
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Derived display values (real data only — no fabricated fields)
  // -----------------------------------------------------------------------

  const activeSubtitleTrack =
    selectedSubtitleIndex !== null ? validSubtitleTracks[selectedSubtitleIndex] : undefined;
  const activeServerName = servers[activeServerIndex]?.serverName;
  const qualityLabel = selectedQualityHeight === 0 ? 'Auto' : `${selectedQualityHeight}p`;

  // -----------------------------------------------------------------------
  // The info block scrolls WITH the episode list (passed in as its
  // ListHeaderComponent) instead of sitting pinned above it, so the whole
  // panel scrolls as one continuous piece — matching the reference design.
  // -----------------------------------------------------------------------

  const infoHeader = (
    <View className="gap-1 pb-1.5 pt-3.5">
      <View className="flex-row items-start justify-between gap-2.5">
        <View className="min-w-0 flex-1">
          <Text className="text-[19px] font-bold text-white">
            {getFormattedTitle(activeEpisodeTitle)}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-[3px] text-[12px] font-semibold"
            style={{ color: COLORS.textMuted }}>
            {getFormattedTitle(displayTitle)}
          </Text>
        </View>
        <View className="flex-shrink-0 flex-row gap-2">
          <ScalePressable
            className="h-9 w-9 items-center justify-center rounded-full border"
            style={{
              backgroundColor: 'rgba(255,255,255,0.045)',
              borderColor: 'rgba(255,255,255,0.09)',
            }}
            scaleTo={0.92}
            haptic="light"
            onPress={handleShare}>
            <Ionicons name="share-social-outline" size={15} color="#FFFFFF" />
          </ScalePressable>
          <ScalePressable
            className="h-9 w-9 items-center justify-center rounded-full border"
            style={{
              backgroundColor: 'rgba(255,255,255,0.045)',
              borderColor: 'rgba(255,255,255,0.09)',
            }}
            scaleTo={0.92}
            haptic="light"
            onPress={handleDownload}>
            <Ionicons name="download-outline" size={15} color="#FFFFFF" />
          </ScalePressable>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <View
          className="rounded-full border px-2.5 py-1.5"
          style={{
            backgroundColor: 'rgba(255,255,255,0.045)',
            borderColor: 'rgba(255,255,255,0.09)',
          }}>
          <Text className="text-[11.5px] font-semibold" style={{ color: COLORS.textMuted }}>
            {qualityLabel}
          </Text>
        </View>
        <View
          className="rounded-full border px-2.5 py-1.5"
          style={{
            backgroundColor: 'rgba(255,255,255,0.045)',
            borderColor: 'rgba(255,255,255,0.09)',
          }}>
          <Text className="text-[11.5px] font-semibold" style={{ color: COLORS.textMuted }}>
            {activeSubtitleTrack?.title || 'Subtitles off'}
          </Text>
        </View>
        {activeServerName && (
          <View
            className="rounded-full border px-2.5 py-1.5"
            style={{
              backgroundColor: 'rgba(255,255,255,0.045)',
              borderColor: 'rgba(255,255,255,0.09)',
            }}>
            <Text className="text-[11.5px] font-semibold" style={{ color: COLORS.textMuted }}>
              Server: {activeServerName}
            </Text>
          </View>
        )}
        {currentEpisode?.airDate && (
          <View
            className="rounded-full border px-2.5 py-1.5"
            style={{
              backgroundColor: 'rgba(255,255,255,0.045)',
              borderColor: 'rgba(255,255,255,0.09)',
            }}>
            <Text className="text-[11.5px] font-semibold" style={{ color: COLORS.textMuted }}>
              {currentEpisode.airDate}
            </Text>
          </View>
        )}
      </View>

      {activeEpisodeDescription ? (
        <Text
          className="mt-3 text-[13px] leading-[19px]"
          style={{ color: 'rgba(255,255,255,0.68)' }}>
          {getFormattedTitle(activeEpisodeDescription, undefined, true)}
        </Text>
      ) : null}
    </View>
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg }}>
      <StatusBar hidden={isFullscreen} style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Video player wrapper — animates paddingHorizontal so the inner ─
          player view never changes its own width (no layout recalc on the
          video surface). borderRadius is animated separately on the inner
          view via compositor, not layout.                                  */}
      <ReAnimated.View
        style={[
          { backgroundColor: COLORS.bg },
          isFullscreen
            ? [StyleSheet.absoluteFill, { zIndex: 1000, padding: 0 }]
            : {
                height: 219,
                marginTop: insets.top + 8,
              },
          playerDockStyle,
        ]}>
        {/* Inner player: fills 100% of the padded shell, only borderRadius changes */}
        <ReAnimated.View
          className="flex-1 overflow-hidden"
          style={[isFullscreen ? { borderRadius: 0 } : playerRadiusStyle]}
          onLayout={(e) => {
            playerWidthRef.current = e.nativeEvent.layout.width;
          }}>
          <Video
            key={videoSourceKey}
            ref={videoRef}
            controls={false}
            source={videoSourceObj}
            style={{ width: '100%', height: '100%' }}
            paused={!isPlaying || !isSubtitleReady}
            muted={isMuted}
            rate={1.0}
            playInBackground
            showNotificationControls
            preventsDisplaySleepDuringVideoPlayback
            enterPictureInPictureOnLeave
            onPictureInPictureStatusChanged={(e) => setIsPiP(e.isActive)}
            onProgress={handleProgress}
            onEnd={handleVideoEnd}
            onError={handleError}
            onBuffer={handleBuffer}
            onLoad={handleLoad}
            onVideoTracks={handleVideoTracks}
            selectedVideoTrack={selectedVideoTrack}
            resizeMode={resizeMode.key}
            ignoreSilentSwitch="ignore"
          />
          <Pressable className="absolute inset-0" onPress={handleVideoTap} />
          <WatchPlayerOverlay
            controlsAnim={controlsAnim}
            seekPanResponder={seekPanResponder}
            activeSubtitleCues={activeSubtitleCues}
            onCycleResizeMode={handleCycleResizeMode}
            onEnterPiP={handleEnterPiP}
            onBack={handleBack}
            controlsDockStyle={controlsDockStyle}
            onSeekBackward={() => {
              seekTo(currentTime - 10);
              triggerFlash({ kind: 'seek-left', label: '10s' });
            }}
            onSeekForward={() => {
              seekTo(currentTime + 10);
              triggerFlash({ kind: 'seek-right', label: '10s' });
            }}
            onShowSettings={() => {
              setIsModalVisible(true);
              setShowControls(true);
            }}
          />
        </ReAnimated.View>
      </ReAnimated.View>

      {/* ── Everything below the player — one continuous scroll per panel ─ */}
      <View
        className="flex-1 overflow-hidden"
        style={{ display: isFullscreen || isPiP ? 'none' : 'flex' }}>
        <ReAnimated.View
          className="flex-1 flex-row"
          style={[{ width: screenWidth * 2 }, panelTrackStyle]}>
          {/* Panel 1: Info + Episodes — a single FlatList, info block as its header */}
          <ReAnimated.View className="flex-1" style={[{ width: screenWidth }, panel1Style]}>
            <WatchEpisodeList
              episodes={episodes}
              currentEpisodeId={episodeId}
              fallbackImage={animeImage}
              bottomPadding={bottomDockSpace}
              onSelectEpisode={(ep) => goToEpisode(ep)}
              onEndReached={loadMoreImages}
              hasMoreImages={hasMoreImages}
              onScroll={handleContentScroll}
              scrollEventThrottle={16}
              ListHeaderComponent={infoHeader}
            />
          </ReAnimated.View>

          {/* Panel 2: Discussion — vertically centered placeholder */}
          <ReAnimated.View className="flex-1" style={[{ width: screenWidth }, panel2Style]}>
            <AnimatedScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingBottom: bottomDockSpace,
              }}
              showsVerticalScrollIndicator={false}
              onScroll={handleContentScroll}
              scrollEventThrottle={16}>
              <WatchDiscussionPlaceholder />
            </AnimatedScrollView>
          </ReAnimated.View>
        </ReAnimated.View>

        {/* ── Floating bottom dock: Episodes | Chat ────── */}
        <View
          className="absolute flex-row self-center rounded-[28px] border p-1"
          style={{
            bottom: Math.max(insets.bottom, 14),
            backgroundColor: 'rgba(14,17,14,0.94)',
            borderColor: 'rgba(255,255,255,0.1)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45,
            shadowRadius: 12,
            elevation: 12,
          }}>
          <ReAnimated.View
            className="absolute bottom-1 left-1 top-1 w-[108px] rounded-[20px]"
            style={[{ backgroundColor: COLORS.accent }, dockIndicatorStyle]}
          />

          <ScalePressable
            accessibilityRole="tab"
            accessibilityLabel="Episodes"
            onPress={() => setActivePanel('episodes')}
            scaleTo={0.94}
            haptic="light"
            className="z-10 h-[38px] w-[108px] flex-row items-center justify-center gap-1.5 rounded-[20px]">
            <Ionicons
              name="list-outline"
              size={16}
              color={activePanel === 'episodes' ? COLORS.bg : COLORS.textMuted}
            />
            <Text
              className="text-[11px] font-extrabold tracking-wide"
              style={{ color: activePanel === 'episodes' ? COLORS.bg : COLORS.textMuted }}>
              Episodes
            </Text>
          </ScalePressable>

          <ScalePressable
            accessibilityRole="tab"
            accessibilityLabel="Chat"
            onPress={() => setActivePanel('chat')}
            scaleTo={0.94}
            haptic="light"
            className="z-10 h-[38px] w-[108px] flex-row items-center justify-center gap-1.5 rounded-[20px]">
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={activePanel === 'chat' ? COLORS.bg : COLORS.textMuted}
            />
            <Text
              className="text-[11px] font-extrabold tracking-wide"
              style={{ color: activePanel === 'chat' ? COLORS.bg : COLORS.textMuted }}>
              Chat
            </Text>
          </ScalePressable>
        </View>
      </View>

      {/* Settings — bottom sheet in portrait, right drawer in fullscreen */}
      <WatchSettingsSheet
        sheetAnim={sheetAnim}
        servers={servers}
        activeServerIndex={activeServerIndex}
        validSubtitleTracks={validSubtitleTracks}
        onSelectServer={handleSelectServer}
      />
    </View>
  );
};

export default WatchScreen;

// ===========================================================================
// The only style that couldn't move to className: subtitle text-shadow (no
// NativeWind / RN core equivalent for textShadow* props).
// ===========================================================================

const styles = StyleSheet.create({
  subtitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: 4,
  },
});
