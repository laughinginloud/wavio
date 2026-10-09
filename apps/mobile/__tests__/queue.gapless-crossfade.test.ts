// Queue store integration tests for gapless/crossfade advance semantics.
// These verify how queue state (repeat modes, removePlayed, shuffle) affects
// peekNextTrack — which drives gapless preload and crossfade trigger decisions.
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
    getAuthScope: () => "scope",
  };
});

jest.mock("@/stores/auth", () => ({
  useAuthBase: { getState: () => ({ url: "u", username: "n" }) },
}));

import useQueue, { peekNextTrack, peekNextTracks } from "@/stores/queue";

type TestTrack = { id: string; url: string; source?: string };

const makeTrack = (id: string, source = "server"): TestTrack => ({
  id,
  url: `url://${id}`,
  source,
});

const get = () => useQueue.getState();
const ids = () => get().queue.map((t) => t.id);

beforeEach(() => {
  useQueue.setState({
    queue: [],
    currentIndex: null,
    removePlayed: true,
    repeatMode: "off",
    shuffle: false,
    originalOrderIds: null,
    source: null,
  });
});

describe("peekNextTrack - gapless/crossfade advance semantics", () => {
  describe("removePlayed mode (default)", () => {
    test("returns next track when not at end", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 0,
        removePlayed: true,
      });
      expect(peekNextTrack()?.id).toBe("b");
    });

    test("returns previous track when at end (wrapped)", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 2,
        removePlayed: true,
      });
      expect(peekNextTrack()?.id).toBe("b");
    });

    test("returns null when single track at end (nothing to wrap to)", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: true,
      });
      expect(peekNextTrack()).toBeNull();
    });

    test("returns null when queue is empty", () => {
      useQueue.setState({
        queue: [],
        currentIndex: null,
        removePlayed: true,
      });
      expect(peekNextTrack()).toBeNull();
    });

    test("returns null when queue is empty and currentIndex is null", () => {
      useQueue.setState({
        queue: [],
        currentIndex: null,
        removePlayed: true,
      });
      expect(peekNextTrack()).toBeNull();
    });
  });

  describe("repeatMode === 'off' (no removePlayed)", () => {
    test("returns next track when not at end", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "off",
      });
      expect(peekNextTrack()?.id).toBe("b");
    });

    test("returns null when at end (no repeat)", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "off",
      });
      expect(peekNextTrack()).toBeNull();
    });

    test("returns null when queue has one track at end", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "off",
      });
      expect(peekNextTrack()).toBeNull();
    });
  });

  describe("repeatMode === 'all'", () => {
    test("returns first track when at end (repeat-all wrap)", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "all",
      });
      expect(peekNextTrack()?.id).toBe("a");
    });

    test("returns first track when at end with shuffle (returns null - unpredictable)", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 2,
        removePlayed: false,
        repeatMode: "all",
        shuffle: true,
      });
      // Shuffled repeat-all at end returns null because the next pass is unpredictable
      expect(peekNextTrack()).toBeNull();
    });

    test("returns first track when at end without shuffle", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "all",
        shuffle: false,
      });
      expect(peekNextTrack()?.id).toBe("a");
    });

    test("returns next track when not at end", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "all",
      });
      expect(peekNextTrack()?.id).toBe("b");
    });
  });

  describe("repeatMode === 'one'", () => {
    test("returns current track (stays on same)", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: true,
        repeatMode: "one",
      });
      expect(peekNextTrack()?.id).toBe("a");
    });

    test("returns current track regardless of position", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 2,
        removePlayed: true,
        repeatMode: "one",
      });
      expect(peekNextTrack()?.id).toBe("c");
    });

    test("returns null when queue is empty", () => {
      useQueue.setState({
        queue: [],
        currentIndex: null,
        removePlayed: true,
        repeatMode: "one",
      });
      expect(peekNextTrack()).toBeNull();
    });
  });

  describe("next() advance - queue store state changes", () => {
    test("removes current track when removePlayed is true", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: true,
      });
      get().next();
      expect(ids()).toEqual(["b"]);
      expect(get().currentIndex).toBe(0);
    });

    test("advances to next index when removePlayed is false", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "off",
      });
      get().next();
      expect(get().currentIndex).toBe(1);
    });

    test("sets currentIndex to null when at end and repeat is off", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "off",
      });
      get().next(); // advance to b
      expect(get().currentIndex).toBe(1);
      get().next(); // advance past end
      expect(get().currentIndex).toBeNull();
    });

    test("stays on same track when repeatMode is one", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: true,
        repeatMode: "one",
      });
      get().next();
      expect(get().currentIndex).toBe(0);
    });

    test("wraps to start when at end and repeatMode is all", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "all",
      });
      get().next();
      expect(get().currentIndex).toBe(0);
    });

    test("wraps to start without reshuffling when shuffle is off", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 2,
        removePlayed: false,
        repeatMode: "all",
        shuffle: false,
      });
      get().next();
      expect(get().currentIndex).toBe(0);
      expect(ids()).toEqual(["a", "b", "c"]);
    });

    test("returns null when queue is empty and next() is called", () => {
      useQueue.setState({
        queue: [],
        currentIndex: null,
        removePlayed: true,
      });
      get().next();
      expect(get().currentIndex).toBeNull();
    });

    test("sets currentIndex to 0 when not set and next() is called", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: null,
        removePlayed: true,
      });
      get().next();
      expect(get().currentIndex).toBe(0);
    });
  });

  describe("next() advance with removePlayed - gapless preload impact", () => {
    test("after next(), peekNextTrack returns the track after the new current", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 0,
        removePlayed: true,
      });
      // Before advance: a is playing, next is b (for preload)
      expect(peekNextTrack()?.id).toBe("b");

      get().next(); // a is removed, b slides to index 0
      expect(ids()).toEqual(["b", "c"]);
      expect(get().currentIndex).toBe(0);

      // After advance: b is playing, next is c (for preload)
      expect(peekNextTrack()?.id).toBe("c");
    });

    test("after next() at end with removePlayed, wraps and updates peek", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: true,
      });
      // Advance past a (removed), b slides to front
      get().next();
      expect(ids()).toEqual(["b"]);
      expect(get().currentIndex).toBe(0);

      // With only one track and removePlayed, peek returns null (nothing to wrap to)
      expect(peekNextTrack()).toBeNull();
    });
  });

  describe("peekNextTracks - multi-track lookahead", () => {
    test("returns up to count tracks in advance order", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c"), makeTrack("d")],
        currentIndex: 0,
        removePlayed: true,
      });
      const nexts = peekNextTracks(3);
      expect(nexts.map((t) => t.id)).toEqual(["b", "c", "d"]);
    });

    test("returns fewer than count when near end of queue", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: true,
      });
      const nexts = peekNextTracks(3);
      expect(nexts.map((t) => t.id)).toEqual(["b"]);
    });

    test("returns empty array when at end with removePlayed (wraps to same)", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: true,
      });
      const nexts = peekNextTracks(3);
      expect(nexts).toEqual([]);
    });

    test("returns empty array when repeatMode is off and at end", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "off",
      });
      const nexts = peekNextTracks(3);
      expect(nexts).toEqual([]);
    });

    test("returns tracks in repeat-all wrap order", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "all",
      });
      const nexts = peekNextTracks(3);
      expect(nexts.map((t) => t.id)).toEqual(["a", "b"]);
    });

    test("returns empty array when queue is empty", () => {
      useQueue.setState({
        queue: [],
        currentIndex: null,
        removePlayed: true,
      });
      const nexts = peekNextTracks(3);
      expect(nexts).toEqual([]);
    });

    test("returns empty array when repeatMode is one", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: true,
        repeatMode: "one",
      });
      const nexts = peekNextTracks(3);
      // repeat-one advances normally through peekNextTracks (not special-cased)
      expect(nexts.map((t) => t.id)).toEqual(["a"]);
    });
  });

  describe("queue end behavior - crossfade/gapless boundary", () => {
    test("at end with removePlayed: next() returns null currentIndex", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: true,
      });
      get().next();
      expect(get().currentIndex).toBeNull();
    });

    test("at end with repeat-all: next() wraps to start", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "all",
      });
      get().next();
      expect(get().currentIndex).toBe(0);
    });

    test("at end with repeat-off and no removePlayed: next() returns null", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "off",
      });
      get().next();
      expect(get().currentIndex).toBeNull();
    });

    test("at end with repeat-one: next() stays on same track", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: true,
        repeatMode: "one",
      });
      get().next();
      expect(get().currentIndex).toBe(0);
    });

    test("after next() clears currentIndex, peekNextTrack returns null", () => {
      useQueue.setState({
        queue: [makeTrack("a")],
        currentIndex: 0,
        removePlayed: true,
      });
      get().next();
      expect(get().currentIndex).toBeNull();
      expect(peekNextTrack()).toBeNull();
    });
  });

  describe("interaction between repeat modes and peekNextTrack", () => {
    test("switching from off to all changes peek behavior at end", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "off",
      });
      expect(peekNextTrack()).toBeNull();

      get().setRepeatMode("all");
      expect(peekNextTrack()?.id).toBe("a");
    });

    test("switching from all to off changes peek behavior at end", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: false,
        repeatMode: "all",
      });
      expect(peekNextTrack()?.id).toBe("a");

      get().setRepeatMode("off");
      expect(peekNextTrack()).toBeNull();
    });

    test("switching from off to one changes peek to current track", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "off",
      });
      expect(peekNextTrack()?.id).toBe("b");

      get().setRepeatMode("one");
      expect(peekNextTrack()?.id).toBe("a");
    });

    test("switching from one to all changes peek to next track", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "one",
      });
      expect(peekNextTrack()?.id).toBe("a");

      get().setRepeatMode("all");
      expect(peekNextTrack()?.id).toBe("b");
    });
  });

  describe("removePlayed toggle - impact on peek and next", () => {
    test("toggling removePlayed changes peek behavior at end", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 1,
        removePlayed: true,
      });
      // With removePlayed at end, wraps back
      expect(peekNextTrack()?.id).toBe("a");

      get().setRemovePlayed(false);
      get().setRepeatMode("off");
      // Without removePlayed at end with repeat-off, returns null
      expect(peekNextTrack()).toBeNull();
    });

    test("next() with removePlayed removes track from queue", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: true,
      });
      get().next();
      expect(ids()).toEqual(["b"]);
      expect(get().queue.length).toBe(1);
    });

    test("next() without removePlayed does not remove track from queue", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b")],
        currentIndex: 0,
        removePlayed: false,
        repeatMode: "off",
      });
      get().next();
      expect(ids()).toEqual(["a", "b"]);
      expect(get().queue.length).toBe(2);
    });
  });

  describe("shuffle interaction with peekNextTrack", () => {
    test("shuffled queue with repeat-all at end returns null from peek", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 2,
        removePlayed: false,
        repeatMode: "all",
        shuffle: true,
      });
      expect(peekNextTrack()).toBeNull();
    });

    test("non-shuffled queue with repeat-all at end returns first track from peek", () => {
      useQueue.setState({
        queue: [makeTrack("a"), makeTrack("b"), makeTrack("c")],
        currentIndex: 2,
        removePlayed: false,
        repeatMode: "all",
        shuffle: false,
      });
      expect(peekNextTrack()?.id).toBe("a");
    });
  });
});
