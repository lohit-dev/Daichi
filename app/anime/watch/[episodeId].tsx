import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'iconsax-react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Video from 'react-native-video';

import { useHistoryStore } from '~/app/_store/useHistoryStore';
import { usePlayerStore } from '~/app/_store/usePlayerStore';
import ScalePressable from '~/components/shared/ScalePressable';
import EpisodeList from '~/components/watch/EpisodeList';
import PlayerOverlay from '~/components/watch/PlayerOverlay';
import SettingsSheet from '~/components/watch/SettingsSheet';
import UpNextCard from '~/components/watch/UpNextCard';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';
import { useEpisodeList } from '~/hooks/useEpisodeList';
import { usePlayerControls } from '~/hooks/usePlayerControls';
import { useVideoPlayer } from '~/hooks/useVideoPlayer';

const WatchScreen = () => {
  const router = useRouter();
  const { episodeId, animeId, type, animeTitle, animeImage } = useLocalSearchParams<{
    episodeId: string;
    animeId: string;
    type: 'sub' | 'dub';
    animeTitle: string;
    animeImage: string;
  }>();

  // Reset store on mount, clean up on unmount
  useEffect(() => {
    usePlayerStore.getState().reset();
    return () => usePlayerStore.getState().reset();
  }, []);

  // -----------------------------------------------------------------------
  // Hooks
  // -----------------------------------------------------------------------

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
  } = useVideoPlayer(animeId, episodeId, type);

  const handleExit = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({ pathname: '/anime/[id]', params: { id: animeId } });
  }, [animeId, router]);

  const {
    controlsAnim,
    sheetAnim,
    playerWidthRef,
    seekPanResponder,
    triggerFlash,
    handleCycleResizeMode,
    handleVideoTap,
  } = usePlayerControls(seekTo, handleExit);

  const { data: episodeListData } = useEpisodeList(animeId, type);
  const episodes = episodeListData ?? [];

  // -----------------------------------------------------------------------
  // Zustand selectors (only what the screen itself needs)
  // -----------------------------------------------------------------------

  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const subtitleCues = usePlayerStore((s) => s.subtitleCues);
  const setShowControls = usePlayerStore((s) => s.setShowControls);
  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);
  const selectServer = usePlayerStore((s) => s.selectServer);

  // -----------------------------------------------------------------------
  // Active subtitle cues (filtered by current time)
  // -----------------------------------------------------------------------

  const activeSubtitleCues = useMemo(
    () => subtitleCues.filter((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime),
    [currentTime, subtitleCues]
  );

  // -----------------------------------------------------------------------
  // Up Next — the episode right after the one currently loaded
  // -----------------------------------------------------------------------

  const nextEpisode = useMemo(() => {
    const currentIndex = episodes.findIndex((ep: { id: string }) => ep.id === episodeId);
    if (currentIndex === -1) return null;
    return episodes[currentIndex + 1] ?? null;
  }, [episodes, episodeId]);

  const goToEpisode = useCallback(
    (target: { id: string } | null) => {
      if (!target) return;
      router.replace({
        pathname: '/anime/watch/[episodeId]',
        params: {
          episodeId: target.id,
          animeId,
          type,
          animeTitle,
          animeImage,
        },
      });
    },
    [router, animeId, type, animeTitle, animeImage]
  );

  const handleVideoEnd = useCallback(() => {
    if (nextEpisode) {
      goToEpisode(nextEpisode);
      return;
    }

    handleEnd();
  }, [goToEpisode, handleEnd, nextEpisode]);

  // -----------------------------------------------------------------------
  // Progress Tracking (History)
  // -----------------------------------------------------------------------

  const saveProgress = useHistoryStore((s) => s.saveProgress);
  const lastSavedProgressRef = useRef<{ episodeId: string; second: number } | null>(null);

  // Persist the current title at a useful cadence. This is intentionally episode
  // progress, not a watched marker: choosing the next episode must never mark the
  // previous one as completed.
  useEffect(() => {
    const second = Math.floor(currentTime);
    const previous = lastSavedProgressRef.current;

    if (second <= 0 || (previous?.episodeId === episodeId && second - previous.second < 5)) {
      return;
    }

    lastSavedProgressRef.current = { episodeId, second };
    saveProgress({
      animeId,
      animeTitle:
        animeTitle ||
        animeId.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
      animeImage: animeImage || '',
      episodeId,
      episodeNumber: episodeId,
      progress: currentTime,
      duration: usePlayerStore.getState().duration || 0,
    });
  }, [animeId, animeImage, animeTitle, currentTime, episodeId, saveProgress]);

  // -----------------------------------------------------------------------
  // Server selection handler
  // -----------------------------------------------------------------------

  const handleSelectServer = useCallback(
    (index: number) => {
      selectServer(index);
    },
    [selectServer]
  );

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
        <Text style={{ color: COLORS.textMuted, marginTop: 16 }}>
          {isLoading ? 'Loading video source…' : 'No video source available. Returning…'}
        </Text>
        {queryError && (
          <Text style={{ color: COLORS.danger, marginTop: 8 }}>Error: {String(queryError)}</Text>
        )}
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg }}>
      <StatusBar hidden={isFullscreen} style="light" />
      <Stack.Screen
        options={{
          headerShown: !isFullscreen,
          headerLeft: () => (
            <ScalePressable onPress={handleExit} style={{ padding: 8 }} scaleTo={0.96}>
              <ArrowLeft size={24} color={COLORS.text} />
            </ScalePressable>
          ),
          headerStyle: { backgroundColor: COLORS.surface },
          headerTitleStyle: { color: COLORS.text },
          headerTitle: `Episode ${episodeId}`,
        }}
      />

      {/* Player container — resizes between inline and fullscreen without
          remounting the <Video>, so toggling never reloads the stream.
          Kept OUTSIDE the scrollable episode list on purpose: it needs to
          stay a normal-flow sibling so its `position: absolute` fullscreen
          fill still covers the whole screen instead of just scrolling away
          inside a list header. */}
      <View
        style={[
          { backgroundColor: COLORS.bg, overflow: 'hidden' },
          isFullscreen
            ? [StyleSheet.absoluteFill, { zIndex: 1000 }]
            : { height: 256, width: '100%' },
        ]}
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

        {/* Tap target for single/double tap */}
        <Pressable className="absolute inset-0" onPress={handleVideoTap} />

        {/* Controls overlay */}
        <PlayerOverlay
          episodeId={episodeId}
          animeTitle={
            animeTitle ||
            animeId.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
          }
          controlsAnim={controlsAnim}
          seekPanResponder={seekPanResponder}
          activeSubtitleCues={activeSubtitleCues}
          onCycleResizeMode={handleCycleResizeMode}
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
      </View>

      {/* vertical card */}
      <View style={{ flex: 1, display: isFullscreen ? 'none' : 'flex' }}>
        <EpisodeList
          episodes={episodes}
          currentEpisodeId={episodeId}
          fallbackImage={animeImage}
          onSelectEpisode={(ep) => goToEpisode(ep)}
          ListHeaderComponent={
            <UpNextCard
              episode={nextEpisode}
              onPlay={() => goToEpisode(nextEpisode)}
              autoplaySeconds={0}
            />
          }
        />
      </View>

      {/* Settings sheet lives OUTSIDE fullscreen player so it always
          renders in normal portrait flow — sheet itself slides from
          the true bottom of the screen */}
      <SettingsSheet
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
