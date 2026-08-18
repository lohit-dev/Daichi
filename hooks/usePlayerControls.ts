import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, BackHandler, PanResponder } from 'react-native';

import { usePlayerStore } from '~/app/_store/usePlayerStore';
import { clamp } from '~/helpers/subtitles';

export const usePlayerControls = (seekTo: (time: number) => void, onExit?: () => void) => {
  const router = useRouter();

  // Zustand selectors
  const showControls = usePlayerStore((s) => s.showControls);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLocked = usePlayerStore((s) => s.isLocked);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const isModalVisible = usePlayerStore((s) => s.isModalVisible);
  const isScrubbing = usePlayerStore((s) => s.isScrubbing);
  const currentTime = usePlayerStore((s) => s.currentTime);

  // Zustand actions
  const setShowControls = usePlayerStore((s) => s.setShowControls);
  const toggleControls = usePlayerStore((s) => s.toggleControls);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setIsModalVisible = usePlayerStore((s) => s.setIsModalVisible);
  const setFlash = usePlayerStore((s) => s.setFlash);
  const cycleResizeMode = usePlayerStore((s) => s.cycleResizeMode);

  // Refs
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' | 'center' } | null>(null);
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const playerWidthRef = useRef(0);
  const durationRef = useRef(0);
  const seekBarWidthRef = useRef(0);

  // Keep refs synced
  const duration = usePlayerStore((s) => s.duration);
  const seekBarWidth = usePlayerStore((s) => s.seekBarWidth);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    seekBarWidthRef.current = seekBarWidth;
  }, [seekBarWidth]);

  // -----------------------------------------------------------------------
  // Back button: close sheet > exit fullscreen > navigate back
  // -----------------------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (usePlayerStore.getState().isModalVisible) {
          setIsModalVisible(false);
          return true;
        }
        if (usePlayerStore.getState().isFullscreen) {
          setIsFullscreen(false);
          return true;
        }
        if (onExit) {
          onExit();
        } else if (router.canGoBack()) {
          router.back();
        }
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [onExit, router, setIsModalVisible, setIsFullscreen])
  );

  // -----------------------------------------------------------------------
  // Landscape lock while fullscreen
  // -----------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        if (isFullscreen) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        // Package not installed or platform doesn't support it — ignore.
      }
    })();

    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, [isFullscreen]);

  // Ensure orientation resets to portrait on unmount
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // -----------------------------------------------------------------------
  // Settings sheet slide animation
  // -----------------------------------------------------------------------

  useEffect(() => {
    Animated.timing(sheetAnim, {
      toValue: isModalVisible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [isModalVisible, sheetAnim]);

  // -----------------------------------------------------------------------
  // Controls fade animation
  // -----------------------------------------------------------------------

  useEffect(() => {
    Animated.timing(controlsAnim, {
      toValue: showControls ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [controlsAnim, showControls]);

  // -----------------------------------------------------------------------
  // Auto-hide controls
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!showControls || !isPlaying || isScrubbing) return;

    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3200);
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, isScrubbing, showControls, setShowControls]);

  // -----------------------------------------------------------------------
  // Flash trigger
  // -----------------------------------------------------------------------

  const triggerFlash = useCallback(
    (
      next: { kind: 'seek-left' | 'seek-right'; label: string } | { kind: 'mode'; label: string }
    ) => {
      setFlash(next);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlash(null), 500);
    },
    [setFlash]
  );

  // -----------------------------------------------------------------------
  // Resize mode cycle (with flash)
  // -----------------------------------------------------------------------

  const handleCycleResizeMode = useCallback(() => {
    cycleResizeMode();
    // Flash is set inside store's cycleResizeMode, but we need the timeout
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlash(null), 500);
  }, [cycleResizeMode, setFlash]);

  // -----------------------------------------------------------------------
  // Tap handling (single = toggle controls, double on sides = ±10s seek)
  // -----------------------------------------------------------------------

  const handleVideoTap = useCallback(
    (event: any) => {
      if (isLocked) {
        toggleControls();
        return;
      }

      const x = event.nativeEvent.locationX;
      const now = Date.now();
      const zoneWidth = playerWidthRef.current || 1;
      const side: 'left' | 'right' | 'center' =
        x < zoneWidth * 0.35 ? 'left' : x > zoneWidth * 0.65 ? 'right' : 'center';

      if (
        lastTapRef.current &&
        side !== 'center' &&
        lastTapRef.current.side === side &&
        now - lastTapRef.current.time < 300
      ) {
        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        lastTapRef.current = null;
        if (side === 'left') {
          seekTo(currentTime - 10);
        } else {
          seekTo(currentTime + 10);
        }
        triggerFlash({ kind: side === 'left' ? 'seek-left' : 'seek-right', label: '10s' });
        return;
      }

      lastTapRef.current = { time: now, side };
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => {
        toggleControls();
        lastTapRef.current = null;
      }, 260);
    },
    [currentTime, isLocked, seekTo, triggerFlash, toggleControls]
  );

  // -----------------------------------------------------------------------
  // Seek bar PanResponder
  // -----------------------------------------------------------------------

  // Keep seekTo in a ref so PanResponder (created once) always has the latest.
  const seekToRef = useRef(seekTo);
  useEffect(() => {
    seekToRef.current = seekTo;
  }, [seekTo]);

  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !usePlayerStore.getState().isLocked,
      onMoveShouldSetPanResponder: () => !usePlayerStore.getState().isLocked,
      onPanResponderGrant: (evt) => {
        const w = seekBarWidthRef.current;
        const d = durationRef.current;
        if (!w || !d) return;
        usePlayerStore.getState().setIsScrubbing(true);
        usePlayerStore.getState().setShowControls(true);
        usePlayerStore
          .getState()
          .setScrubPreviewTime(clamp(evt.nativeEvent.locationX / w, 0, 1) * d);
      },
      onPanResponderMove: (evt) => {
        const w = seekBarWidthRef.current;
        const d = durationRef.current;
        if (!w || !d) return;
        usePlayerStore
          .getState()
          .setScrubPreviewTime(clamp(evt.nativeEvent.locationX / w, 0, 1) * d);
      },
      onPanResponderRelease: (evt) => {
        const w = seekBarWidthRef.current;
        const d = durationRef.current;
        usePlayerStore.getState().setIsScrubbing(false);
        if (!w || !d) return;
        const target = clamp(evt.nativeEvent.locationX / w, 0, 1) * d;
        seekToRef.current(target);
      },
      onPanResponderTerminate: () => usePlayerStore.getState().setIsScrubbing(false),
    })
  ).current;

  return {
    controlsAnim,
    sheetAnim,
    playerWidthRef,
    seekPanResponder,
    triggerFlash,
    handleCycleResizeMode,
    handleVideoTap,
  };
};
