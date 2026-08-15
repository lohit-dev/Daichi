import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useToast } from 'react-native-toast-notifications';
import { SelectedVideoTrackType } from 'react-native-video';

import { usePlayerStore, RESIZE_MODES } from '~/app/_store/usePlayerStore';
import {
  getPreferredSubtitleIndex,
  loadSubtitleVttOnce,
  MAX_SUBTITLE_RETRIES,
  parseVttCues,
} from '~/helpers/subtitles';
import { fetchAnimeStreamingLink } from '~/services/AnimeService';
import { AnikotoStreamResponse, SubtitleTrack } from '~/types';

export const useVideoPlayer = (
  animeId: string,
  providerEpisodeId: string,
  type: 'sub' | 'dub',
  animeTitle?: string
) => {
  const videoRef = useRef<any>(null);

  const selectedServerIndex = usePlayerStore((s) => s.selectedServerIndex);
  const selectedQualityHeight = usePlayerStore((s) => s.selectedQualityHeight);
  const selectedSubtitleIndex = usePlayerStore((s) => s.selectedSubtitleIndex);
  const readySubtitleKey = usePlayerStore((s) => s.readySubtitleKey);
  const pendingSeek = usePlayerStore((s) => s.pendingSeek);
  const resizeModeIndex = usePlayerStore((s) => s.resizeModeIndex);
  const duration = usePlayerStore((s) => s.duration);

  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setIsBuffering = usePlayerStore((s) => s.setIsBuffering);
  const setAvailableQualities = usePlayerStore((s) => s.setAvailableQualities);
  const setSelectedSubtitleIndex = usePlayerStore((s) => s.setSelectedSubtitleIndex);
  const setSubtitleCues = usePlayerStore((s) => s.setSubtitleCues);
  const setSubtitleStatus = usePlayerStore((s) => s.setSubtitleStatus);
  const setReadySubtitleKey = usePlayerStore((s) => s.setReadySubtitleKey);
  const handleSourceLoaded = usePlayerStore((s) => s.handleSourceLoaded);

  const {
    data: streamingData,
    isLoading,
    error: queryError,
  } = useQuery<AnikotoStreamResponse>({
    queryKey: ['streaming', animeId, providerEpisodeId, type],
    queryFn: () => fetchAnimeStreamingLink(animeId, providerEpisodeId, animeTitle, type),
    enabled: !!animeId && !!providerEpisodeId,
    staleTime: 0,
  });

  const servers = streamingData?.data?.servers || [];
  const primaryServer =
    selectedServerIndex !== null && servers[selectedServerIndex]
      ? servers[selectedServerIndex]
      : servers.find(
          (s: { type: string; m3u8Url: string | null }) => s.type === type && s.m3u8Url
        ) ||
        servers.find((s: { type: string }) => s.type === type) ||
        servers[0];

  const activeServerIndex =
    selectedServerIndex !== null ? selectedServerIndex : servers.indexOf(primaryServer);

  const videoSource = primaryServer?.m3u8Url;
  const referer = primaryServer?.referer;
  const videoSourceKey = `${activeServerIndex}:${videoSource ?? ''}:${referer ?? ''}`;

  useEffect(() => {
    if (!videoSource || !referer) {
      setAvailableQualities([]);
      return;
    }
    let cancelled = false;
    const parseM3u8Qualities = async () => {
      try {
        const res = await fetch(videoSource, {
          headers: { Referer: referer },
        });
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (cancelled) return;
        const qualities: { height: number; label: string }[] = [];
        const lines = text.split('\n');
        for (const line of lines) {
          const match = line.match(/RESOLUTION=\d+x(\d+)/);
          if (match) {
            const height = parseInt(match[1], 10);
            if (height && !qualities.some((q) => q.height === height)) {
              qualities.push({ height, label: `${height}p` });
            }
          }
        }
        qualities.sort((a, b) => b.height - a.height);
        setAvailableQualities(qualities);
      } catch {
        setAvailableQualities([]);
      }
    };
    parseM3u8Qualities();
    return () => {
      cancelled = true;
    };
  }, [videoSource, referer, setAvailableQualities]);

  const validSubtitleTracks: SubtitleTrack[] = useMemo(() => {
    const raw = primaryServer?.subtitles || [];
    return raw
      .filter((track: any) => track.kind !== 'thumbnails' && (track.file || track.url))
      .map((track: any) => ({
        uri: track.file || track.url,
        title: track.label || 'Unknown',
        isDefault: !!track.default,
      }));
  }, [primaryServer]);

  useEffect(() => {
    const index = getPreferredSubtitleIndex(validSubtitleTracks);
    setSelectedSubtitleIndex(index);
    setSubtitleCues([]);
    setReadySubtitleKey(null);
    setSubtitleStatus(index === null ? 'No subtitles available' : 'Loading subtitles…');
  }, [
    validSubtitleTracks,
    setSelectedSubtitleIndex,
    setSubtitleCues,
    setReadySubtitleKey,
    setSubtitleStatus,
  ]);

  const selectedSubtitleUri =
    selectedSubtitleIndex !== null ? validSubtitleTracks[selectedSubtitleIndex]?.uri : undefined;
  const subtitleKey = `${activeServerIndex}:${selectedSubtitleIndex ?? 'none'}:${selectedSubtitleUri ?? ''}`;
  const isSubtitleReady = readySubtitleKey === subtitleKey;

  const toast = useToast();

  useEffect(() => {
    if (!selectedSubtitleUri || !referer) {
      setSubtitleCues([]);
      setSubtitleStatus(selectedSubtitleUri ? 'Subtitle source unavailable' : 'Subtitles off');
      setReadySubtitleKey(subtitleKey);
      return;
    }
    let isMounted = true;
    const downloadWithRetry = async () => {
      for (let attempt = 1; attempt <= MAX_SUBTITLE_RETRIES; attempt += 1) {
        try {
          setSubtitleStatus(
            attempt === 1
              ? 'Loading subtitles…'
              : `Retrying subtitles (${attempt}/${MAX_SUBTITLE_RETRIES})…`
          );
          const content = await loadSubtitleVttOnce(selectedSubtitleUri, referer);
          const cues = parseVttCues(content);
          if (!isMounted) return;
          setSubtitleCues(cues);
          setSubtitleStatus(
            cues.length > 0 ? 'Subtitles ready' : 'Subtitle file has no usable cues'
          );
          setReadySubtitleKey(subtitleKey);
          return;
        } catch (error) {
          console.error(`[subtitles] attempt ${attempt} failed`, error);
          if (attempt === MAX_SUBTITLE_RETRIES) {
            if (isMounted) {
              setSubtitleCues([]);
              setSubtitleStatus('Subtitles unavailable — try another server');
              setReadySubtitleKey(subtitleKey);
              toast.show('Unable to download subtitles. Please choose a different server.', {
                type: 'danger',
                placement: 'bottom',
              });
            }
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, attempt * 800));
        }
      }
    };
    downloadWithRetry();
    return () => {
      isMounted = false;
    };
  }, [
    referer,
    selectedSubtitleUri,
    subtitleKey,
    setSubtitleCues,
    setSubtitleStatus,
    setReadySubtitleKey,
    toast,
  ]);

  const videoSourceObj = useMemo(
    () => ({
      uri: videoSource ?? undefined,
      headers: referer ? { Referer: referer } : undefined,
    }),
    [referer, videoSource]
  );

  const selectedVideoTrack = useMemo(
    () =>
      selectedQualityHeight === 0
        ? { type: SelectedVideoTrackType.AUTO }
        : { type: SelectedVideoTrackType.RESOLUTION, value: selectedQualityHeight },
    [selectedQualityHeight]
  );

  const resizeMode = RESIZE_MODES[resizeModeIndex];

  const handleProgress = useCallback(
    (data: any) => {
      setCurrentTime(data.currentTime);
    },
    [setCurrentTime]
  );

  const handleLoad = useCallback(
    (data: any) => {
      if (pendingSeek !== null) {
        const target = pendingSeek;
        requestAnimationFrame(() => {
          videoRef.current?.seek(target);
          handleSourceLoaded(data.duration);
        });
        return;
      }
      handleSourceLoaded(data.duration);
    },
    [pendingSeek, handleSourceLoaded]
  );

  const handleError = useCallback(
    (error: any) => {
      console.log('Video Player onError:', error);
      setIsBuffering(false);
    },
    [setIsBuffering]
  );

  const handleBuffer = useCallback(
    (data: any) => {
      setIsBuffering(data.isBuffering);
    },
    [setIsBuffering]
  );

  const handleVideoTracks = useCallback(() => {}, []);

  const handleEnd = useCallback(() => {
    setIsPlaying(false);
    usePlayerStore.getState().setShowControls(true);
  }, [setIsPlaying]);

  const seekTo = useCallback(
    (time: number) => {
      const target = Math.max(0, Math.min(duration || 0, time));
      videoRef.current?.seek(target);
      setCurrentTime(target);
      if (!usePlayerStore.getState().isLocked) {
        usePlayerStore.getState().setShowControls(true);
      }
    },
    [duration, setCurrentTime]
  );

  return {
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
    subtitleKey,
    handleProgress,
    handleLoad,
    handleError,
    handleBuffer,
    handleVideoTracks,
    handleEnd,
    seekTo,
  };
};
