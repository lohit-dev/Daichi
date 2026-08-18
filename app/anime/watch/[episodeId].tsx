import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'iconsax-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';

import { useHistoryStore } from '~/app/_store/useHistoryStore';
import { usePlayerStore } from '~/app/_store/usePlayerStore';
import ScalePressable from '~/components/shared/ScalePressable';
import EpisodeDiscussion from '~/components/watch/EpisodeDiscussion';
import EpisodeList from '~/components/watch/EpisodeList';
import PlayerOverlay from '~/components/watch/PlayerOverlay';
import SettingsSheet from '~/components/watch/SettingsSheet';
import { PLAYER_COLORS as COLORS } from '~/constants/Colors';
import { formatIdToTitle } from '~/helpers/common';
import { useEpisodeList } from '~/hooks/useEpisodeList';
import { usePlayerControls } from '~/hooks/usePlayerControls';
import { useVideoPlayer } from '~/hooks/useVideoPlayer';

const WatchScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activePanel, setActivePanel] = useState<'episodes' | 'chat'>('episodes');
  const dockAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(dockAnim, {
      toValue: activePanel === 'episodes' ? 0 : 1,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [activePanel, dockAnim]);

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
  const bottomDockSpace = insets.bottom + 80;

  // -----------------------------------------------------------------------
  // Zustand selectors
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
  // Active subtitle cues
  // -----------------------------------------------------------------------

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

  const currentEpisode = useMemo(
    () => episodes.find((episode) => episode.id === episodeId),
    [episodes, episodeId]
  );

  // Episode thumbnail for history
  const currentEpisodeThumbnail = useMemo(
    () => episodes.find((ep) => ep.id === episodeId)?.image,
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
  // Progress Tracking
  // -----------------------------------------------------------------------

  const saveProgress = useHistoryStore((s) => s.saveProgress);
  const lastSavedProgressRef = useRef<{ episodeId: string; second: number } | null>(null);

  useEffect(() => {
    const second = Math.floor(currentTime);
    const previous = lastSavedProgressRef.current;
    if (second <= 0 || (previous?.episodeId === episodeId && second - previous.second < 5)) return;
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
  // Action handlers
  // -----------------------------------------------------------------------

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Watching "${animeTitle || formatIdToTitle(animeId)}" — Episode ${
          currentEpisode?.number ?? episodeId
        } on Daichi`,
        title: animeTitle || formatIdToTitle(animeId),
      });
    } catch {
      // user dismissed
    }
  }, [animeTitle, animeId, currentEpisode, episodeId]);

  const handleDownload = useCallback(() => {
    Alert.alert('Download', 'Download functionality coming soon!', [{ text: 'OK' }]);
  }, []);

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

  const displayTitle = animeTitle || formatIdToTitle(animeId);

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
          headerTitle: `Episode ${currentEpisode?.number ?? episodeId}`,
        }}
      />

      {/* ── Video Player ─────────────────────────────────────────────── */}
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
        <Pressable className="absolute inset-0" onPress={handleVideoTap} />
        <PlayerOverlay
          episodeId={episodeId}
          animeTitle={displayTitle}
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

      {/* ── Content Container ────────────────────────────────────────── */}
      <View style={{ flex: 1, display: isFullscreen || isPiP ? 'none' : 'flex' }}>
        {/* ── Content: Episodes List or Chat Panel ─────── */}
        {activePanel === 'episodes' ? (
          <View style={{ flex: 1 }}>
            {/* ── Compact Info section (only on Episodes tab) ─ */}
            <View style={styles.infoSection}>
              <View style={styles.infoHeader}>
                <View style={styles.infoMeta}>
                  <Text style={styles.episodeLabel}>
                    EP {currentEpisode?.number ?? episodeId}
                    {type === 'dub' ? '  ·  DUB' : '  ·  SUB'}
                  </Text>
                  <Text numberOfLines={1} style={styles.episodeTitle}>
                    {currentEpisode?.title ?? displayTitle}
                  </Text>
                  <Text numberOfLines={1} style={styles.animeSubtitle}>
                    {displayTitle}
                  </Text>
                </View>

                {/* Clean compact action pills */}
                <View style={styles.actionRow}>
                  <ScalePressable
                    style={styles.actionPill}
                    scaleTo={0.92}
                    haptic="light"
                    onPress={handleShare}>
                    <Ionicons name="share-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.actionPillLabel}>Share</Text>
                  </ScalePressable>

                  <ScalePressable
                    style={styles.actionPill}
                    scaleTo={0.92}
                    haptic="light"
                    onPress={handleDownload}>
                    <Ionicons name="download-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.actionPillLabel}>Download</Text>
                  </ScalePressable>
                </View>
              </View>

              {/* Episode description */}
              {currentEpisode?.description ? (
                <Text numberOfLines={2} ellipsizeMode="tail" style={styles.episodeDescription}>
                  {currentEpisode.description}
                </Text>
              ) : null}
            </View>

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

        {/* ── Floating bottom dock: Episodes | Chat ────── */}
        <View style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 14) }]}>
          {/* Animated sliding background pill */}
          <Animated.View
            style={[
              styles.dockIndicator,
              {
                transform: [
                  {
                    translateX: dockAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 108],
                    }),
                  },
                ],
              },
            ]}
          />

          <ScalePressable
            accessibilityRole="tab"
            accessibilityLabel="Episodes"
            onPress={() => setActivePanel('episodes')}
            scaleTo={0.94}
            haptic="light"
            style={styles.dockItem}>
            <Ionicons
              name="list-outline"
              size={16}
              color={activePanel === 'episodes' ? '#0a0f0a' : COLORS.textMuted}
            />
            <Text style={[styles.dockLabel, activePanel === 'episodes' && styles.dockLabelActive]}>
              Episodes
            </Text>
          </ScalePressable>

          <ScalePressable
            accessibilityRole="tab"
            accessibilityLabel="Chat"
            onPress={() => setActivePanel('chat')}
            scaleTo={0.94}
            haptic="light"
            style={styles.dockItem}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={activePanel === 'chat' ? '#0a0f0a' : COLORS.textMuted}
            />
            <Text style={[styles.dockLabel, activePanel === 'chat' && styles.dockLabelActive]}>
              Chat
            </Text>
          </ScalePressable>
        </View>
      </View>

      {/* Settings sheet */}
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
  // Info section
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoMeta: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  episodeLabel: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  episodeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  animeSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  episodeDescription: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
  },

  // Action pills
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionPillLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  // Floating dock
  floatingDock: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    padding: 4,
    borderRadius: 28,
    backgroundColor: 'rgba(14,19,14,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  dockIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    width: 108,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
  },
  dockItem: {
    width: 108,
    height: 38,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  dockLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dockLabelActive: { color: '#0a0f0a' },

  // Chat
  chatContent: { flexGrow: 1 },
});
