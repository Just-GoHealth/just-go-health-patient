import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { REFERRAL_STORAGE_KEY } from "@/lib/constants";
import {
  captureReferralFromUrl,
  clearReferralHandle,
  getReferralHandle,
  normalizeReferralHandle,
} from "@/lib/referral";

function stubBrowser(search: string): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("window", { location: { search } });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  return store;
}

describe("normalizeReferralHandle", () => {
  it("accepts plain handles", () => {
    expect(normalizeReferralHandle("Setornam")).toBe("Setornam");
    expect(normalizeReferralHandle("ama.k_99-x")).toBe("ama.k_99-x");
  });

  it("strips a leading @ and surrounding spaces", () => {
    expect(normalizeReferralHandle("  @Setornam ")).toBe("Setornam");
  });

  it("rejects empty, too long or unsafe values", () => {
    expect(normalizeReferralHandle("")).toBeNull();
    expect(normalizeReferralHandle(null)).toBeNull();
    expect(normalizeReferralHandle(undefined)).toBeNull();
    expect(normalizeReferralHandle("a".repeat(41))).toBeNull();
    expect(normalizeReferralHandle("<script>")).toBeNull();
    expect(normalizeReferralHandle("two words")).toBeNull();
  });
});

describe("referral session storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("in the browser", () => {
    let store: Map<string, string>;

    beforeEach(() => {
      store = stubBrowser("?ref=%40Setornam&utm=x");
    });

    it("captures ?ref= from the URL", () => {
      captureReferralFromUrl();

      expect(store.get(REFERRAL_STORAGE_KEY)).toBe("Setornam");
      expect(getReferralHandle()).toBe("Setornam");
    });

    it("ignores an invalid ?ref=", () => {
      vi.stubGlobal("window", { location: { search: "?ref=<bad>" } });

      captureReferralFromUrl();

      expect(store.has(REFERRAL_STORAGE_KEY)).toBe(false);
      expect(getReferralHandle()).toBeNull();
    });

    it("keeps an earlier handle when a later URL has none", () => {
      captureReferralFromUrl();
      vi.stubGlobal("window", { location: { search: "" } });

      captureReferralFromUrl();

      expect(getReferralHandle()).toBe("Setornam");
    });

    it("clears the handle", () => {
      captureReferralFromUrl();

      clearReferralHandle();

      expect(getReferralHandle()).toBeNull();
    });

    it("does not trust a tampered stored value", () => {
      store.set(REFERRAL_STORAGE_KEY, "<img onerror=x>");

      expect(getReferralHandle()).toBeNull();
    });

    it("survives blocked storage", () => {
      vi.stubGlobal("sessionStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      });

      expect(() => captureReferralFromUrl()).not.toThrow();
      expect(getReferralHandle()).toBeNull();
      expect(() => clearReferralHandle()).not.toThrow();
    });
  });

  it("is a no-op on the server", () => {
    expect(() => captureReferralFromUrl()).not.toThrow();
    expect(getReferralHandle()).toBeNull();
    expect(() => clearReferralHandle()).not.toThrow();
  });
});
