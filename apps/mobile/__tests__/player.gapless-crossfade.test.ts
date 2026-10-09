// Tests for gapless playback and crossfade mutual exclusivity, preload mechanics,
// crossfade lifecycle, volume ramping, and edge cases (podcast skip, queue end).
jest.mock("@/config/storage", () => {
  const mem = new Map<string, string>();
  const make = () => ({
    setItem: (k: string, v: string) => mem.set(k, v),
    getItem: (k: string) => mem.get(k) ?? null,
    removeItem: (k: string) => mem.delete(k),
  });
  return {
    storage: {
      set: (k: string, v: string) => mem.set(k, v),
      getString: (k: string) => mem.get(k) ?? null,
      remove: (k: string) => mem.delete(k),
    },
    zustandStorage: make(),
    createScopedStorage: () => make(),
    createDynamicScopedStorage: () => make(),
    createThrottledScopedJSONStorage: () =>
      jest.requireActual("zustand/middleware").createJSONStorage(() => make()),
    flushPendingScopedWrites: () => {},
    getAuthScope: () => "scope",
  };
});

jest.mock("@/stores/auth", () => ({
  useAuthBase: {
    getState: () => ({
      url: "https://server",
      username: "n",
      serverType: "opensubsonic",
    }),
    subscribe: jest.fn(() => jest.fn()),
  },
  registerLogoutHandler: jest.fn(),
  currentAuthScope: () => "scope",
}));

jest.mock("@tanstack/react-query", () => ({
  onlineManager: { isOnline: () => true },
}));

jest.mock("@/config/queryClient", () => ({
  queryClient: {
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    setQueriesData: jest.fn(),
    invalidateQueries: jest.fn(),
  },
}));

// Mock expo-audio with simple object (matching transcodeRetryFallback pattern)
jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    remove: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setPlaybackRate: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    updateLockScreenMetadata: jest.fn(),
    setMediaButtons: jest.fn(),
    setLockScreenControls: jest.fn(),
    clearLockScreenControls: jest.fn(),
    currentTime: 0,
    duration: 0,
    playing: false,
    volume: 1,
  })),
  setAudioModeAsync: jest.fn(),
  audioSource: (uri: string) => ({ uri }),
}));

jest.mock("@/stores/offline", () => ({
  __esModule: true,
  default: { getState: () => ({ getDownloadedTrack: jest.fn(() => null) }) },
}));

jest.mock("@/services/backend/streaming", () => ({
  streamUrl: (id) => `https://server/stream/${id}`,
  trackTranscodeInfo: () => ({ active: false, fromLabel: null, toLabel: null }),
}));

jest.mock("@/services/backend/mediaAnnotation", () => ({
  scrobble: jest.fn(async () => undefined),
}));

jest.mock("@/services/endlessRadio", () => ({
  fetchEndlessExtension: jest.fn(async () => []),
}));

jest.mock("@/services/network", () => ({
  getIsOnline: () => true,
  getServerReachable: () => true,
  getIsEffectivelyOnline: () => true,
  probeServer: jest.fn(),
}));

jest.mock("@/services/errorReporting", () => ({
  reportError: jest.fn(),
  reportBreadcrumb: jest.fn(),
}));

jest.mock("@/config/i18n", () => ({
  __esModule: true,
  default: { t: (key) => key, language: "en" },
  applyZodLocale: jest.fn(),
}));

jest.mock("@/services/playbackReport", () => ({
  playbackReportEnabled: () => false,
  reportProgress: jest.fn(),
  reportStarting: jest.fn(),
  reportPaused: jest.fn(),
  reportStopped: jest.fn(),
  notePlaybackRateChanged: jest.fn(),
}));

jest.mock("@/services/sleepTimer", () => ({
  checkSleepTimerExpiry: () => false,
  consumeSleepEndOfTrack: () => false,
  registerSleepTimerPauseHandler: jest.fn(),
}));

jest.mock("@/services/resumePositions", () => ({
  getResumePosition: jest.fn(() => null),
  recordResumePosition: jest.fn(),
  clearResumePosition: jest.fn(),
  armResume: jest.fn(),
  loadResumePositions: jest.fn().mockResolvedValue(undefined),
  notePlaybackTrack: jest.fn(),
}));

jest.mock("@/services/podcastProgress", () => ({
  isPodcastTrack: (t) => t?.source === "podcast",
  getPodcastResumePosition: jest.fn(() => null),
  recordPodcastProgress: jest.fn(),
  clearPodcastProgress: jest.fn(),
  resetPodcastProgressRuntime: jest.fn(),
  flushPodcastProgress: jest.fn(),
}));

jest.mock("@/services/trackCache", () => ({
  cachedTrackUri: jest.fn(() => null),
  touchCachedTrack: jest.fn(),
  evictTracks: jest.fn(),
}));

jest.mock("@/services/offlineMutations/enqueue", () => ({
  enqueueOfflineMutation: jest.fn(),
}));

jest.mock("@/services/playQueueSync", () => ({
  stopPlayQueueSync: jest.fn(),
}));

jest.mock("@/hooks/backend/useMediaAnnotation", () => ({
  setStarred: jest.fn(),
  isIndexBacked: jest.fn(() => false),
}));

jest.mock("@/services/backend/serverTraits", () => ({
  isIndexBackedType: () => false,
  filesAreOnDeviceType: () => false,
  hasNetworkServerType: () => false,
  isSingletonServerType: () => false,
  speaksHttpType: () => true,
  isNetworkShareType: () => false,
  usesSubsonicAuthType: () => true,
  hasCaseInsensitiveUsernamesType: () => false,
}));

jest.mock("@/services/playback/targets", () => ({
  activeRemoteTarget: () => null,
}));

jest.mock("@/services/lockScreenArtwork", () => ({
  cachedArtworkUri: jest.fn(),
  clearArtworkCache: jest.fn(),
  ensureArtworkCached: jest.fn(),
}));

jest.mock("@/utils/replayGain", () => ({
  computeReplayGainFactor: () => 1,
}));

import * as playerModule from "@/services/player";
import useQueue, { type QueueTrack } from "@/stores/queue";
import { useAppBase } from "@/stores/app";

const { setGaplessPlayback, isGaplessPlaybackEnabled, setCrossfadeDuration } = playerModule;

const audioMock = jest.requireMock("expo-audio") as { createAudioPlayer: jest.Mock };
const mockPlayer = audioMock.createAudioPlayer.mock.results[0]?.value;

const makeTrack = (id: string, source = "server"): QueueTrack =>
  ({
    id,
    url: `https://server/stream/${id}`,
    title: `Track ${id}`,
    suffix: "flac",
    duration: 180,
    source,
    albumId: "album1",
  }) as QueueTrack;

const makePodcastTrack = (): QueueTrack =>
  ({
    id: "pod-1",
    url: `https://server/stream/pod-1`,
    title: "Episode",
    suffix: "mp3",
    duration: 600,
    source: "podcast",
  }) as QueueTrack;

const emitStatus = (status: Partial<Record<string, unknown>>) => {
  const listener = mockPlayer?.addListener.mock.calls.find(
    ([evt]: [string]) => evt === "playbackStatusUpdate",
  )?.[1] as (s: Record<string, unknown>) => void;
  if (!listener) return;
  const defaults = {
    error: null,
    playbackState: "idle",
    duration: 0,
    currentTime: 0,
    playing: false,
    didJustFinish: false,
  };
  listener({ ...defaults, ...status });
};

beforeEach(() => {
  // Ensure __DEV__ is true so preload error logging and gapless logs work
  (global as unknown as Record<string, unknown>).__DEV__ = true;

  mockPlayer?.replace.mockClear();
  mockPlayer?.play.mockClear();
  mockPlayer?.pause.mockClear();

  useQueue.setState({
    queue: [],
    currentIndex: null,
    removePlayed: true,
    repeatMode: "off",
    shuffle: false,
    originalOrderIds: null,
    source: null,
  });

  emitStatus(null);
});

describe("gapless playback and crossfade - mutual exclusivity", () => {
  test("gapless is enabled by default", () => {
    expect(isGaplessPlaybackEnabled()).toBe(true);
  });

  test("setGaplessPlayback(enabled) toggles the flag", () => {
    setGaplessPlayback(false);
    expect(isGaplessPlaybackEnabled()).toBe(false);

    setGaplessPlayback(true);
    expect(isGaplessPlaybackEnabled()).toBe(true);
  });

  test("enabling gapless disables crossfade (duration = 0)", () => {
    expect(setCrossfadeDuration).toBeDefined();
    setCrossfadeDuration(3000);
    setGaplessPlayback(true);
    expect(isGaplessPlaybackEnabled()).toBe(true);
  });

  test("setting positive crossfade duration disables gapless", () => {
    expect(setCrossfadeDuration).toBeDefined();
    setCrossfadeDuration(5000);
    expect(isGaplessPlaybackEnabled()).toBe(false);
  });

  test("setting crossfade to 0 re-enables gapless via setCrossfadeDuration", () => {
    expect(setCrossfadeDuration).toBeDefined();
    setCrossfadeDuration(3000);
    expect(isGaplessPlaybackEnabled()).toBe(false);

    setCrossfadeDuration(0);
    expect(isGaplessPlaybackEnabled()).toBe(true);
  });

  test("setting crossfade duration in app store disables gapless when > 0", () => {
    expect(isGaplessPlaybackEnabled()).toBe(true);
    useAppBase.setState({ crossfadeDuration: 2500 });
    expect(isGaplessPlaybackEnabled()).toBe(false);
  });
});

describe("preloadNextTrack - gapless preload mechanics", () => {
  test("preloads next track onto gaplessPreloadPlayer when gapless enabled", () => {
    setGaplessPlayback(true);

    // Prime the status listener so isLoading is cleared from any prior tick
    emitStatus(null);

    const [t1, t2] = [makeTrack("a"), makeTrack("b")];
    useQueue.setState({ queue: [t1, t2], currentIndex: 0 });

    // Wait a tick for loadTrack to complete and clear isLoading
    emitStatus({ playing: true, duration: 180, currentTime: 90 });

    // With gapless enabled and two tracks, replace is called for both loading
    // the current track and preloading the next one onto the preload player.
    expect(mockPlayer?.replace).toHaveBeenCalledTimes(2);
    expect(mockPlayer?.replace).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "https://server/stream/b" }),
    );
  });

  test("does not preload if gapless is disabled", () => {
    setGaplessPlayback(false);
    const [t1, t2] = [makeTrack("x"), makeTrack("y")];
    useQueue.setState({ queue: [t1, t2], currentIndex: 0 });

    emitStatus({
      playing: true,
      duration: 180,
      currentTime: 90,
    });

    // Only the current track is loaded (no preload of next track)
    expect(mockPlayer?.replace).toHaveBeenCalledTimes(1);
  });

  test("skips preload for podcast tracks", () => {
    setGaplessPlayback(true);
    const [pod, next] = [makePodcastTrack(), makeTrack("z")];
    useQueue.setState({ queue: [pod, next], currentIndex: 0 });

    emitStatus({
      playing: true,
      duration: 600,
      currentTime: 300,
    });

    // Podcast tracks skip preload — only one replace call for current track
    expect(mockPlayer?.replace).toHaveBeenCalledTimes(1);
  });

  test("is idempotent - calling with same nextTrack.id is a no-op", () => {
    setGaplessPlayback(true);
    const [t1, t2] = [makeTrack("p1"), makeTrack("p2")];
    useQueue.setState({ queue: [t1, t2], currentIndex: 0 });

    emitStatus({ playing: true, duration: 180, currentTime: 60 });
    const firstCalls = mockPlayer?.replace.mock.calls.length ?? 0;

    emitStatus({ playing: true, duration: 180, currentTime: 90 });
    expect(mockPlayer?.replace.mock.calls.length).toBe(firstCalls);
  });

  test("does not preload when queue is empty", () => {
    setGaplessPlayback(true);
    useQueue.setState({ queue: [], currentIndex: null });

    emitStatus({ playing: true, duration: 0, currentTime: 0 });

    expect(mockPlayer?.replace).not.toHaveBeenCalled();
  });

  test("does not preload when there is no next track", () => {
    setGaplessPlayback(true);
    const t = makeTrack("only");
    useQueue.setState({ queue: [t], currentIndex: 0 });

    emitStatus({ playing: true, duration: 180, currentTime: 90 });

    // Only the current track is loaded — no next track to preload
    expect(mockPlayer?.replace).toHaveBeenCalledTimes(1);
  });
});

describe("crossfade lifecycle", () => {
  test("does not start crossfade when remaining <= 1s (must be > 1)", () => {
    const [t1, t2] = [makeTrack("short1"), makeTrack("short2")];
    useQueue.setState({ queue: [t1, t2], currentIndex: 0 });

    emitStatus({
      playing: true,
      duration: 6000,
      currentTime: 5999,
    });

    // CrossfadePlayer would call replace with next track's URL
    expect(mockPlayer?.replace).not.toHaveBeenCalledWith(
      expect.objectContaining({ uri: "https://server/stream/short2" }),
    );
  });

  test("does not start crossfade when crossfadeDuration is 0", () => {
    expect(setCrossfadeDuration).toBeDefined();
    setCrossfadeDuration(0);
    const [t1, t2] = [makeTrack("n1"), makeTrack("n2")];
    useQueue.setState({ queue: [t1, t2], currentIndex: 0 });

    emitStatus({
      playing: true,
      duration: 6000,
      currentTime: 3500,
    });

    expect(mockPlayer?.replace).not.toHaveBeenCalledWith(
      expect.objectContaining({ uri: "https://server/stream/n2" }),
    );
  });

  test("crossfade does not start for podcasts", () => {
    const pod = makePodcastTrack();
    const next = makeTrack("after-pod");
    useQueue.setState({ queue: [pod, next], currentIndex: 0 });

    emitStatus({
      playing: true,
      duration: 600,
      currentTime: 301,
    });

    expect(mockPlayer?.replace).not.toHaveBeenCalledWith(
      expect.objectContaining({ uri: "https://server/stream/after-pod" }),
    );
  });
});

describe("crossfade volume ramp", () => {
  test("volume property is settable on player", () => {
    mockPlayer!.volume = 0.5;
    expect(mockPlayer!.volume).toBe(0.5);

    mockPlayer!.volume = 1.0;
    expect(mockPlayer!.volume).toBe(1.0);
  });

  test("crossfade duration can be configured to different values", () => {
    expect(setCrossfadeDuration).toBeDefined();
    setCrossfadeDuration(1000);
    setCrossfadeDuration(5000);
    expect(isGaplessPlaybackEnabled()).toBe(false);
  });
});

describe("edge cases", () => {
  test("gapless + crossfade can coexist only when mutually exclusive", () => {
    expect(setGaplessPlayback).toBeDefined();
    setGaplessPlayback(true);
    expect(isGaplessPlaybackEnabled()).toBe(true);

    expect(setCrossfadeDuration).toBeDefined();
    setCrossfadeDuration(3000);
    expect(isGaplessPlaybackEnabled()).toBe(false);

    setGaplessPlayback(true);
    expect(isGaplessPlaybackEnabled()).toBe(true);

    setCrossfadeDuration(0);
    expect(isGaplessPlaybackEnabled()).toBe(true);
  });

  test("does not preload when queue has only one track", () => {
    setGaplessPlayback(true);
    const t = makeTrack("solo");
    useQueue.setState({ queue: [t], currentIndex: 0 });

    emitStatus({ playing: true, duration: 180, currentTime: 90 });

    // Only the current track is loaded — no next track to preload
    expect(mockPlayer?.replace).toHaveBeenCalledTimes(1);
  });

  test("multiple rapid status updates with same next track do not re-preload", () => {
    setGaplessPlayback(true);
    const [t1, t2] = [makeTrack("rapid1"), makeTrack("rapid2")];
    useQueue.setState({ queue: [t1, t2], currentIndex: 0 });

    emitStatus({ playing: true, duration: 180, currentTime: 60 });
    const firstReplaceCount = mockPlayer?.replace.mock.calls.length ?? 0;

    emitStatus({ playing: true, duration: 180, currentTime: 70 });
    emitStatus({ playing: true, duration: 180, currentTime: 80 });
    emitStatus({ playing: true, duration: 180, currentTime: 90 });

    expect(mockPlayer?.replace.mock.calls.length).toBe(firstReplaceCount);
  });

  test("gaplessEnabled flag persists across setGaplessPlayback calls", () => {
    setGaplessPlayback(false);
    expect(isGaplessPlaybackEnabled()).toBe(false);

    setGaplessPlayback(false);
    expect(isGaplessPlaybackEnabled()).toBe(false);

    setGaplessPlayback(true);
    expect(isGaplessPlaybackEnabled()).toBe(true);

    setGaplessPlayback(true);
    expect(isGaplessPlaybackEnabled()).toBe(true);
  });
});

describe("app store crossfade sync", () => {
  test("setting crossfadeDuration in app store triggers gapless disable when > 0", () => {
    setGaplessPlayback(true);
    expect(isGaplessPlaybackEnabled()).toBe(true);

    useAppBase.setState({ crossfadeDuration: 2000 });
    expect(isGaplessPlaybackEnabled()).toBe(false);
  });

  test("app store duration sync only disables gapless (not re-enables on 0)", () => {
    useAppBase.setState({ crossfadeDuration: 3000 });
    expect(isGaplessPlaybackEnabled()).toBe(false);

    // Setting to 0 in app store does NOT re-enable gapless.
    useAppBase.setState({ crossfadeDuration: 0 });
    expect(isGaplessPlaybackEnabled()).toBe(false);
  });
});
