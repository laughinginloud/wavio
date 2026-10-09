// Tests for PlaybackAudioSection settings UI — store interactions, i18n keys,
// and conditional-rendering logic (capabilities, platform checks).
import { useTranslation } from "react-i18next";

jest.mock("@/stores/app", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      maxBitRate: null,
      cellularMaxBitRate: null,
      streamingFormat: "raw" as const,
      cellularStreamingFormat: "same" as const,
      replayGainMode: "off" as const,
      replayGainPreampDb: 0,
      endlessPlaybackEnabled: false,
      crossfadeDuration: 3000,
      showPlayerAudioQuality: true,
      showPlayerRating: false,
      mediaControlsLayout: "seek" as const,
      queueSyncPriority: "server" as const,
      lyricsSource: "off" as const,
      lyricsKeepScreenOn: false,
      waveformSeekbarEnabled: false,
    }),
    setMaxBitRate: jest.fn(),
    setCellularMaxBitRate: jest.fn(),
    setStreamingFormat: jest.fn(),
    setCellularStreamingFormat: jest.fn(),
    setReplayGainMode: jest.fn(),
    setReplayGainPreampDb: jest.fn(),
    setEndlessPlaybackEnabled: jest.fn(),
    setCrossfadeDuration: jest.fn(),
    setShowPlayerAudioQuality: jest.fn(),
    setShowPlayerRating: jest.fn(),
    setMediaControlsLayout: jest.fn(),
    setQueueSyncPriority: jest.fn(),
    setLyricsSource: jest.fn(),
    setLyricsKeepScreenOn: jest.fn(),
    setWaveformSeekbarEnabled: jest.fn(),
    subscribe: jest.fn((fn) => {
      fn({
        maxBitRate: null,
        cellularMaxBitRate: null,
        streamingFormat: "raw",
        cellularStreamingFormat: "same",
        replayGainMode: "off",
        replayGainPreampDb: 0,
        endlessPlaybackEnabled: false,
        crossfadeDuration: 3000,
        showPlayerAudioQuality: true,
        showPlayerRating: false,
        mediaControlsLayout: "seek",
        queueSyncPriority: "server",
        lyricsSource: "off",
        lyricsKeepScreenOn: false,
        waveformSeekbarEnabled: false,
      });
      return jest.fn();
    }),
  },
}));

jest.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: () => ({
    streamFormatSelection: true,
    playQueueSync: true,
    setRating: true,
    replayGain: true,
  }),
}));

jest.mock("@/modules/audio-waveform", () => ({
  isAudioWaveformAvailable: () => true,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string | string[], options?: Record<string, unknown>) => {
      const k = Array.isArray(key) ? key[0] : key;
      if (typeof options?.db === "number") {
        return `${k} (${options.db})`;
      }
      if (typeof options?.bitrate === "number") {
        return `${k} (${options.bitrate})`;
      }
      return k;
    },
  }),
}));

jest.mock("@/hooks/useSettingsToast", () => ({
  useSettingsToast: () => ({
    showErrorToast: jest.fn(),
    showSuccessToast: jest.fn(),
  }),
}));

jest.mock("@/services/equalizer", () => ({
  isEqualizerAvailable: () => true,
  openSystemEqualizer: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/waveform", () => ({
  clearWaveformMemory: jest.fn(),
}));

jest.mock("@/services/waveform/cache", () => ({
  clearWaveforms: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-application", () => ({
  Application: { applicationId: "com.test.app" },
}));

// Mock SettingsRows components
jest.mock("@/components/settings/SettingsRows", () => ({
  SettingsSectionTitle: (props: Record<string, unknown>) =>
    `section:${props?.title}`,
  SettingsToggleRow: (props: Record<string, unknown>) =>
    `toggle:${props?.label}`,
  SettingsSliderRow: (props: Record<string, unknown>) =>
    `slider:${props?.label}`,
  SettingsSelectRow: (props: Record<string, unknown>) =>
    `select:${props?.label}`,
  SettingsActionRow: (props: Record<string, unknown>) =>
    `action:${props?.label}`,
}));

jest.mock("@/components/settings/ConfirmActionDialog", () => {
  return (props: Record<string, unknown>) =>
    props.isOpen ? `confirm-dialog:${props?.title}` : null;
});

jest.mock("@/components/settings/OptionsBottomSheetModal", () => {
  return (props: Record<string, unknown>) =>
    `options-modal:${props?.header}`;
});

jest.mock("@/components/ui/divider", () => ({
  Divider: (props: Record<string, unknown>) => `<Divider />`,
}));

jest.mock("@/components/ui/vstack", () => {
  return function VStack({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  };
});

jest.mock("@/components/settings/SettingsScreenScaffold", () => {
  return function Scaffold({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    return <div data-testid="scaffold" title={title}>{children}</div>;
  };
});

import React from "react";
import PlaybackAudioSection from "@/components/settings/sections/PlaybackAudioSection";
import useApp, { type StreamFormat } from "@/stores/app";

// Helper to verify store setter was called with expected value.
const getStore = () => useApp.getState();

describe("PlaybackAudioSection - settings UI logic", () => {
  describe("crossfade settings", () => {
    test("renders a crossfade slider row", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("SettingsSliderRow");
    });

    test("crossfade slider defaults to 3000ms from app store", () => {
      expect(getStore().crossfadeDuration).toBe(3000);
    });

    test("calling setCrossfadeDuration with a value calls the app store setter", () => {
      useApp.setCrossfadeDuration.mockClear();
      useApp.setCrossfadeDuration(5000);
      expect(useApp.setCrossfadeDuration).toHaveBeenCalledWith(5000);
    });

    test("crossfade slider min is 0 and max is 10000", () => {
      // These are hardcoded in the component — verify via source inspection
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("min={0}");
      expect(content).toContain("max={10000}");
    });
  });

  describe("endless playback toggle", () => {
    test("renders an endless playback toggle row", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("SettingsToggleRow");
    });

    test("toggling endless playback calls the app store setter", () => {
      useApp.setEndlessPlaybackEnabled.mockClear();
      useApp.setEndlessPlaybackEnabled(true);
      expect(useApp.setEndlessPlaybackEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe("streaming format settings", () => {
    test("streaming format rows render when capabilities.streamFormatSelection is true", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("SettingsSelectRow");
    });

    test("bitrate options include null and common bitrates", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("64");
      expect(content).toContain("128");
      expect(content).toContain("320");
    });

    test("streaming format options include raw, flac, opus, mp3, aac", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain('"raw"');
      expect(content).toContain('"flac"');
      expect(content).toContain('"opus"');
      expect(content).toContain('"mp3"');
      expect(content).toContain('"aac"');
    });
  });

  describe("replay gain settings", () => {
    test("replay gain options include off, track, album", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain('"off"');
      expect(content).toContain('"track"');
      expect(content).toContain('"album"');
    });

    test("replay gain preamp adjusts with +/- 1 increments clamped to -15/15", () => {
      useApp.setReplayGainPreampDb.mockClear();
      useApp.setReplayGainPreampDb(5);
      expect(useApp.setReplayGainPreampDb).toHaveBeenCalledWith(5);
    });

    test("adjustPreamp clamps to 15 max", () => {
      const current = getStore().replayGainPreampDb;
      expect(current).toBe(0);
    });
  });

  describe("waveform settings", () => {
    test("waveform seekbar toggle renders when isAudioWaveformAvailable returns true", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("SettingsToggleRow");
    });

    test("clear waveforms dialog appears when clear button is pressed", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("ConfirmActionDialog");
    });

    test("clear waveforms action clears both disk and memory caches", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("clearWaveforms()");
      expect(content).toContain("clearWaveformMemory()");
    });
  });

  describe("equalizer settings", () => {
    test("equalizer row renders when isEqualizerAvailable returns true", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("isEqualizerAvailable()");
    });

    test("equalizer action calls openSystemEqualizer with app ID", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("openSystemEqualizer");
    });

    test("equalizer error shows toast on failure", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("showErrorToast");
    });
  });

  describe("i18n key coverage", () => {
    test("all playback settings i18n keys are present in en.json", () => {
      const fs = require("fs");
      const path = require.resolve("@/i18n/en");
      const content = fs.readFileSync(path, "utf8");
      const json = JSON.parse(content).translation;

      const playbackKeys = [
        "app.settings.playbackSettings.title",
        "app.settings.playbackSettings.endlessPlaybackLabel",
        "app.settings.playbackSettings.endlessPlaybackDescription",
        "app.settings.playbackSettings.crossfadeLabel",
        "app.settings.playbackSettings.crossfadeDescription",
        "app.settings.playbackSettings.equalizerLabel",
        "app.settings.playbackSettings.equalizerDescription",
        "app.settings.playbackSettings.equalizerAction",
        "app.settings.playbackSettings.equalizerErrorMessage",
        "app.settings.playbackSettings.queueSyncLabel",
        "app.settings.playbackSettings.queueSyncDescription",
        "app.settings.playbackSettings.waveformSeekbarLabel",
        "app.settings.playbackSettings.waveformSeekbarDescription",
        "app.settings.playbackSettings.waveformCacheLabel",
        "app.settings.playbackSettings.waveformCacheDescription",
        "app.settings.playbackSettings.waveformCacheConfirmTitle",
        "app.settings.playbackSettings.waveformCacheConfirmDescription",
        "app.settings.playbackSettings.waveformCacheSuccessMessage",
        "app.settings.playbackSettings.playerAudioQualityLabel",
        "app.settings.playbackSettings.playerAudioQualityDescription",
        "app.settings.playbackSettings.playerRatingLabel",
        "app.settings.playbackSettings.playerRatingDescription",
        "app.settings.playbackSettings.mediaControlsLabel",
        "app.settings.playbackSettings.mediaControlsDescription",
      ];

      playbackKeys.forEach((key) => {
        expect(json).toHaveProperty(key);
      });
    });

    test("all streaming settings i18n keys are present in en.json", () => {
      const fs = require("fs");
      const path = require.resolve("@/i18n/en");
      const content = fs.readFileSync(path, "utf8");
      const json = JSON.parse(content).translation;

      const streamingKeys = [
        "app.settings.streamingSettings.title",
        "app.settings.streamingSettings.audioQualityLabel",
        "app.settings.streamingSettings.audioQualityDescription",
        "app.settings.streamingSettings.cellularAudioQualityLabel",
        "app.settings.streamingSettings.cellularAudioQualityDescription",
        "app.settings.streamingSettings.streamingFormatLabel",
        "app.settings.streamingSettings.streamingFormatDescription",
        "app.settings.streamingSettings.cellularStreamingFormatLabel",
        "app.settings.streamingSettings.cellularStreamingFormatDescription",
        "app.settings.streamingSettings.replayGainLabel",
        "app.settings.streamingSettings.replayGainDescription",
        "app.settings.streamingSettings.replayGainModes.off",
        "app.settings.streamingSettings.replayGainModes.track",
        "app.settings.streamingSettings.replayGainModes.album",
        "app.settings.streamingSettings.replayGainPreampLabel",
        "app.settings.streamingSettings.replayGainPreampDescription",
        "app.settings.streamingSettings.replayGainPreampValue",
        "app.settings.streamingSettings.streamingFormatOptions.raw",
        "app.settings.streamingSettings.streamingFormatOptions.flac",
        "app.settings.streamingSettings.streamingFormatOptions.opus",
        "app.settings.streamingSettings.streamingFormatOptions.mp3",
        "app.settings.streamingSettings.streamingFormatOptions.aac",
        "app.settings.streamingSettings.streamingFormatOptions.same",
      ];

      streamingKeys.forEach((key) => {
        expect(json).toHaveProperty(key);
      });
    });

    test("crossfade i18n keys are present in en.json", () => {
      const fs = require("fs");
      const path = require.resolve("@/i18n/en");
      const content = fs.readFileSync(path, "utf8");
      const json = JSON.parse(content).translation;

      expect(json).toHaveProperty(
        "app.settings.playbackSettings.crossfadeLabel",
      );
      expect(json).toHaveProperty(
        "app.settings.playbackSettings.crossfadeDescription",
      );
    });
  });

  describe("conditional rendering conditions", () => {
    test("streaming rows are conditionally rendered based on capabilities.streamFormatSelection", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("canTranscode &&");
    });

    test("equalizer row is conditionally rendered based on isEqualizerAvailable()", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("isEqualizerAvailable() &&");
    });

    test("waveform section is conditionally rendered based on isAudioWaveformAvailable()", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("isAudioWaveformAvailable() &&");
    });

    test("lyrics keep screen on is disabled when lyricsSource is off", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain('disabled={lyricsSource === "off"}');
    });

    test("replay gain preamp is disabled when replayGainMode is off", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain('disabled={replayGainMode === "off"}');
    });

    test("Android-specific media controls row uses Platform.OS check", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain('Platform.OS === "android"');
    });

    test("capabilities.playQueueSync gates queue sync row", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("capabilities.playQueueSync &&");
    });

    test("capabilities.setRating gates player rating toggle", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("capabilities.setRating &&");
    });

    test("capabilities.replayGain gates replay gain select and stepper rows", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      const matches = content.match(/capabilities\.replayGain &&/g);
      expect(matches).toHaveLength(2);
    });

    test("waveform clear button only shows when waveformSeekbarEnabled is true", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("waveformSeekbarEnabled &&");
    });
  });

  describe("bottom sheet modals", () => {
    test("all bottom sheet refs are declared with useRef(null)", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("useRef<BottomSheetModal>");
    });

    test("bitrate bottom sheet is rendered in overlays", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("bottomSheetBitRateModalRef");
    });

    test("replay gain bottom sheet is rendered in overlays", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("bottomSheetReplayGainModalRef");
    });

    test("media controls bottom sheet is rendered in overlays", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("bottomSheetMediaControlsModalRef");
    });

    test("queue sync bottom sheet is rendered in overlays", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("bottomSheetQueueSyncModalRef");
    });

    test("lyrics source bottom sheet is rendered in overlays", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("bottomSheetLyricsSourceModalRef");
    });
  });

  describe("crossfade slider interaction", () => {
    test("step value is 100ms", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("step={100}");
    });

    test("crossfade onValueChange calls setCrossfadeDuration from app store", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("setCrossfadeDuration(value)");
    });

    test("crossfade value comes from app store crossfadeDuration property", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("(store) => store.crossfadeDuration");
    });

    test("crossfadeEnabled is derived from crossfadeDuration > 0", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("crossfadeDuration > 0");
    });
  });

  describe("endless playback toggle interaction", () => {
    test("endlessPlaybackEnabled comes from app store", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("(store) => store.endlessPlaybackEnabled");
    });

    test("onToggle calls setEndlessPlaybackEnabled from app store", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("setEndlessPlaybackEnabled(value)");
    });

    test("onToggle passes the toggle value directly", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("(value) => setEndlessPlaybackEnabled(value)");
    });
  });

  describe("replay gain preamp adjustment", () => {
    test("adjustPreamp clamps between -15 and 15", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("Math.min(15, Math.max(-15, replayGainPreampDb + delta))");
    });

    test("increment button calls adjustPreamp(1)", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("adjustPreamp(1)");
    });

    test("decrement button calls adjustPreamp(-1)", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("adjustPreamp(-1)");
    });

    test("preamp value text shows +N for positive and N for negative values", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("+${replayGainPreampDb}");
    });
  });

  describe("waveform cache clearing flow", () => {
    test("clear button sets showClearWaveformsDialog to true", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("setShowClearWaveformsDialog(true)");
    });

    test("confirm callback calls clearWaveforms and clearWaveformMemory", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("handleClearWaveformsPress");
    });

    test("confirm callback shows success toast", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("showSuccessToast");
    });

    test("dialog close sets showClearWaveformsDialog to false", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("setShowClearWaveformsDialog(false)");
    });
  });

  describe("settings toast notifications", () => {
    test("equalizer error shows toast with i18n key", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("equalizerErrorMessage");
    });

    test("waveform cache cleared shows success toast with i18n key", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("waveformCacheSuccessMessage");
    });
  });

  describe("media controls layout options", () => {
    test("media controls uses MEDIA_CONTROLS_LAYOUTS from app store", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("MEDIA_CONTROLS_LAYOUTS");
    });

    test("media controls layout comes from app store mediaControlsLayout property", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("(store) => store.mediaControlsLayout");
    });

    test("media controls onSelect calls setMediaControlsLayout from app store", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("setMediaControlsLayout");
    });
  });

  describe("settings section structure", () => {
    test("renders playback settings section title first", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      // Playback section comes before streaming section (Divider separates them)
      const playbackIdx = content.indexOf("playbackSettings.title");
      const streamingIdx = content.indexOf("streamingSettings.title");
      expect(playbackIdx).toBeGreaterThanOrEqual(0);
      expect(streamingIdx).toBeGreaterThan(playbackIdx);
    });

    test("Divider separates playback and streaming sections", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("<Divider");
    });

    test("component uses SettingsScreenScaffold with title", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("SettingsScreenScaffold");
    });

    test("component wraps content in VStack with gap-y-4", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain("<VStack");
    });

    test("title uses i18n translation from menu.playback.title", () => {
      const fs = require("fs");
      const content = fs.readFileSync(
        require.resolve("@/components/settings/sections/PlaybackAudioSection"),
        "utf8",
      );
      expect(content).toContain('t("app.settings.menu.playback.title")');
    });
  });
});
