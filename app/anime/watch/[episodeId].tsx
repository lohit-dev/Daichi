import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'iconsax-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';

import { useHistoryStore } from '~/app/_store/useHistoryStore';
import { usePlayerStore } from '~/app/_store/usePlayerStore';
import ScalePressable from '~/components/shared/ScalePressable';
import EpisodeDiscussion from '~/components/watch/EpisodeDiscussion';
import EpisodeList from '~/components/watch/EpisodeList';
import PlayerOverlay from '~/components/watch/PlayerOverlay';
import SettingsSheet from '~/components/watch/SettingsSheet';
import UpNextCard from '~/components/watch/UpNextCard';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';
import { formatIdToTitle } from '~/helpers/common';
import { useEpisodeList } from '~/hooks/useEpisodeList';
import { usePlayerControls } from '~/hooks/usePlayerControls';
import { useVideoPlayer } from '~/hooks/useVideoPlayer';

const WatchScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activePanel, setActivePanel] = useState<'episodes' | 'chat'>('episodes');
  const { episodeId, animeId, animeSlug, type, animeTitle, animeImage } = useLocalSearchParams<{
    episodeId: string;
    animeId: string;
    animeSlug?: string;
    type: 'sub' | 'dub';
    animeTitle: string;
    animeImage: string;
  }>();

  // Reset store on mount, clean up on unmount
  useEffect(() => {
    usePlayerStore.getState().reset();

    // Check if we have saved progress for this exact episode
    const historyItem = useHistoryStore.getState().history[animeId];
    if (historyItem && historyItem.episodeId === episodeId && historyItem.progress > 0) {
      // If we do, queue it up so handleLoad will automatically seek to it
      usePlayerStore.getState().setPendingSeek(historyItem.progress);
    }

    return () => usePlayerStore.getState().reset();
  }, [animeId, episodeId]);

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
  } = useVideoPlayer(animeId, episodeId, type, animeSlug);

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

  const { data: episodeListData } = useEpisodeList(animeId, type, animeImage);
  const episodes = episodeListData ?? [];
  const bottomDockSpace = insets.bottom + 92;

  // The episode thumbnail from the AniList streaming episodes (already merged
  // by useEpisodeList). Used to persist a scene thumbnail in history.
  const currentEpisodeThumbnail = useMemo(
    () => episodes.find((ep) => ep.id === episodeId)?.image,
    [episodes, episodeId]
  );

  // -----------------------------------------------------------------------
  // Zustand selectors (only what the screen itself needs)
  // -----------------------------------------------------------------------

  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const subtitleCues = usePlayerStore((s) => s.subtitleCues);
  const isPiP = usePlayerStore((s) => s.isPiP);
  const setShowControls = usePlayerStore((s) => s.setShowControls);
  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);
  const setIsPiP = usePlayerStore((s) => s.setIsPiP);
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
  const currentEpisode = useMemo(
    () => episodes.find((episode) => episode.id === episodeId),
    [episodes, episodeId]
  );
  const pendingEpisodeNavigationRef = useRef<string | null>(null);

  useEffect(() => {
    pendingEpisodeNavigationRef.current = null;
  }, [episodeId]);

  const goToEpisode = useCallback(
    (target: { id: string; animeSlug?: string } | null) => {
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
        },
      });
    },
    [router, animeId, animeSlug, type, animeTitle, animeImage]
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
      animeSlug,
      animeTitle: animeTitle || formatIdToTitle(animeId),
      animeImage: animeImage || '',
      episodeId,
      episodeNumber: episodeId,
      episodeThumbnail: currentEpisodeThumbnail || undefined,
      progress: currentTime,
      duration: usePlayerStore.getState().duration || 0,
    });
  }, [
    animeId,
    animeSlug,
    animeImage,
    animeTitle,
    currentEpisodeThumbnail,
    currentTime,
    episodeId,
    saveProgress,
  ]);

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

        {/* Tap target for single/double tap */}
        <Pressable className="absolute inset-0" onPress={handleVideoTap} />

        {/* Controls overlay */}
        <PlayerOverlay
          episodeId={episodeId}
          animeTitle={animeTitle || formatIdToTitle(animeId)}
          controlsAnim={controlsAnim}
          seekPanResponder={seekPanResponder}
          activeSubtitleCues={activeSubtitleCues}
          onCycleResizeMode={handleCycleResizeMode}
          onEnterPiP={() => {
            videoRef.current?.enterPictureInPicture();
          }}
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

      {/* Episode panel — hidden while in PiP or fullscreen */}
      <View style={{ flex: 1, display: isFullscreen || isPiP ? 'none' : 'flex' }}>
        {activePanel === 'episodes' ? (
          <View style={{ flex: 1 }}>
            {/* UpNext is PINNED — sits above the scrollable list, never scrolls */}
            <UpNextCard
              episode={nextEpisode}
              onPlay={() => goToEpisode(nextEpisode)}
              autoplaySeconds={0}
            />
            {/* Thin divider */}
            <View style={styles.divider} />
            {/* Scrollable episode list — auto-scrolls to the active episode */}
            <EpisodeList
              episodes={episodes}
              currentEpisodeId={episodeId}
              fallbackImage={animeImage}
              bottomPadding={bottomDockSpace}
              onSelectEpisode={(ep) => goToEpisode(ep)}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.chatContent, { paddingBottom: bottomDockSpace }]}
            showsVerticalScrollIndicator={false}>
            <EpisodeDiscussion
              animeId={animeId}
              episodeId={currentEpisode?.number || episodeId}
              episodeTitle={currentEpisode?.title}
            />
          </ScrollView>
        )}

        {/* Floating bottom dock — Episodes | Chat */}
        <View style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 14) }]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activePanel === 'episodes' }}
            onPress={() => setActivePanel('episodes')}
            style={[styles.dockItem, activePanel === 'episodes' && styles.dockItemActive]}>
            <Ionicons
              name="list-outline"
              size={16}
              color={activePanel === 'episodes' ? COLORS.bg : COLORS.textMuted}
            />
            <Text style={[styles.dockLabel, activePanel === 'episodes' && styles.dockLabelActive]}>
              Episodes
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activePanel === 'chat' }}
            onPress={() => setActivePanel('chat')}
            style={[styles.dockItem, activePanel === 'chat' && styles.dockItemActive]}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={activePanel === 'chat' ? COLORS.bg : COLORS.textMuted}
            />
            <Text style={[styles.dockLabel, activePanel === 'chat' && styles.dockLabelActive]}>
              Chat
            </Text>
          </Pressable>
        </View>
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

const styles = StyleSheet.create({
  chatContent: { flexGrow: 1 },

  // Thin separator between UpNext and episode list
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 16,
  },

  // Bottom dock
  floatingDock: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 3,
    padding: 4,
    borderRadius: 28,
    backgroundColor: 'rgba(14,19,14,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  dockItem: {
    minWidth: 108,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dockItemActive: {
    backgroundColor: COLORS.accent,
  },
  dockLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dockLabelActive: { color: '#0a0f0a' },
});
