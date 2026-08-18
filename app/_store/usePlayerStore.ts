import { Ionicons } from '@expo/vector-icons';
import { create } from 'zustand';

import { QualityOption, ResizeModeKey, SubtitleCue } from '~/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESIZE_MODES: {
  key: ResizeModeKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'contain', label: 'Fit', icon: 'scan-outline' },
  { key: 'cover', label: 'Fill', icon: 'crop-outline' },
  { key: 'stretch', label: 'Stretch', icon: 'move-outline' },
];

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type FlashState =
  { kind: 'seek-left' | 'seek-right'; label: string } | { kind: 'mode'; label: string } | null;

interface PlayerState {
  // Playback
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;

  // Server / quality / subtitle selection
  selectedServerIndex: number | null;
  selectedQualityHeight: number;
  availableQualities: QualityOption[];
  selectedSubtitleIndex: number | null;
  subtitleCues: SubtitleCue[];
  subtitleStatus: string;
  readySubtitleKey: string | null;

  // Source switch flow
  pendingSeek: number | null;
  resumeAfterSourceChange: boolean;

  // UI controls
  showControls: boolean;
  isFullscreen: boolean;
  isPiP: boolean;
  isLocked: boolean;
  isModalVisible: boolean;
  activeTab: 'servers' | 'subtitles' | 'quality';
  resizeModeIndex: number;
  flash: FlashState;

  // Scrubbing
  isScrubbing: boolean;
  scrubPreviewTime: number;
  seekBarWidth: number;
}

interface PlayerActions {
  // Playback
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setIsBuffering: (buffering: boolean) => void;
  toggleMuted: () => void;

  // Server / quality / subtitle
  setSelectedServerIndex: (index: number | null) => void;
  setSelectedQualityHeight: (height: number) => void;
  setAvailableQualities: (qualities: QualityOption[]) => void;
  setSelectedSubtitleIndex: (index: number | null) => void;
  setSubtitleCues: (cues: SubtitleCue[]) => void;
  setSubtitleStatus: (status: string) => void;
  setReadySubtitleKey: (key: string | null) => void;

  // Source switch flow
  setPendingSeek: (time: number | null) => void;
  setResumeAfterSourceChange: (resume: boolean) => void;

  // UI controls
  setShowControls: (show: boolean) => void;
  toggleControls: () => void;
  setIsFullscreen: (fs: boolean) => void;
  setIsPiP: (pip: boolean) => void;
  setIsLocked: (locked: boolean) => void;
  setIsModalVisible: (visible: boolean) => void;
  setActiveTab: (tab: 'servers' | 'subtitles' | 'quality') => void;
  cycleResizeMode: () => number; // returns new index
  setFlash: (flash: FlashState) => void;

  // Scrubbing
  setIsScrubbing: (scrubbing: boolean) => void;
  setScrubPreviewTime: (time: number) => void;
  setSeekBarWidth: (width: number) => void;

  // Compound actions
  selectServer: (index: number) => void;
  handleSourceLoaded: (duration: number) => void;

  // Reset
  reset: () => void;
}

const initialState: PlayerState = {
  currentTime: 0,
  duration: 0,
  isPlaying: true,
  isBuffering: true,
  isMuted: false,

  selectedServerIndex: null,
  selectedQualityHeight: 0,
  availableQualities: [],
  selectedSubtitleIndex: null,
  subtitleCues: [],
  subtitleStatus: 'Preparing subtitles…',
  readySubtitleKey: null,

  pendingSeek: null,
  resumeAfterSourceChange: true,

  showControls: true,
  isFullscreen: false,
  isPiP: false,
  isLocked: false,
  isModalVisible: false,
  activeTab: 'servers',
  resizeModeIndex: 0,
  flash: null,

  isScrubbing: false,
  scrubPreviewTime: 0,
  seekBarWidth: 0,
};

export const usePlayerStore = create<PlayerState & PlayerActions>()((set, get) => ({
  ...initialState,

  // Playback
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setIsBuffering: (buffering) => set({ isBuffering: buffering }),
  toggleMuted: () => set((s) => ({ isMuted: !s.isMuted })),

  // Server / quality / subtitle
  setSelectedServerIndex: (index) => set({ selectedServerIndex: index }),
  setSelectedQualityHeight: (height) => set({ selectedQualityHeight: height }),
  setAvailableQualities: (qualities) => set({ availableQualities: qualities }),
  setSelectedSubtitleIndex: (index) => set({ selectedSubtitleIndex: index }),
  setSubtitleCues: (cues) => set({ subtitleCues: cues }),
  setSubtitleStatus: (status) => set({ subtitleStatus: status }),
  setReadySubtitleKey: (key) => set({ readySubtitleKey: key }),

  // Source switch flow
  setPendingSeek: (time) => set({ pendingSeek: time }),
  setResumeAfterSourceChange: (resume) => set({ resumeAfterSourceChange: resume }),

  // UI controls
  setShowControls: (show) => set({ showControls: show }),
  toggleControls: () => set((s) => ({ showControls: !s.showControls })),
  setIsFullscreen: (fs) => set({ isFullscreen: fs, showControls: true }),
  setIsPiP: (pip) => set({ isPiP: pip }),
  setIsLocked: (locked) => set({ isLocked: locked }),
  setIsModalVisible: (visible) => set({ isModalVisible: visible }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  cycleResizeMode: () => {
    const next = (get().resizeModeIndex + 1) % RESIZE_MODES.length;
    set({ resizeModeIndex: next, flash: { kind: 'mode', label: RESIZE_MODES[next].label } });
    return next;
  },

  setFlash: (flash) => set({ flash }),

  // Scrubbing
  setIsScrubbing: (scrubbing) => set({ isScrubbing: scrubbing }),
  setScrubPreviewTime: (time) => set({ scrubPreviewTime: time }),
  setSeekBarWidth: (width) => set({ seekBarWidth: width }),

  // Compound: switch server while preserving position
  selectServer: (index) => {
    const { currentTime, isPlaying } = get();
    set({
      pendingSeek: currentTime,
      resumeAfterSourceChange: isPlaying,
      isBuffering: true,
      selectedServerIndex: index,
      isModalVisible: false,
    });
  },

  // Compound: when new source finishes loading
  handleSourceLoaded: (duration) => {
    const { pendingSeek, resumeAfterSourceChange } = get();
    set({ duration });

    if (pendingSeek !== null) {
      // The actual seek on videoRef is handled by the hook caller
      set({
        currentTime: pendingSeek,
        pendingSeek: null,
        isPlaying: resumeAfterSourceChange,
        isBuffering: false,
      });
      return;
    }

    set({ isBuffering: false });
  },

  reset: () => set(initialState),
}));
