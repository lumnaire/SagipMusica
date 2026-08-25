import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement ResizeObserver; several presentation components use it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

// Nor IntersectionObserver, which framer-motion's whileInView needs -- every
// marketing section is wrapped in <Reveal>, so without this they throw on
// mount. A no-op is enough: the children are in the DOM either way, and only
// the fade-in depends on the observer firing.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// @ts-expect-error -- test polyfill
globalThis.IntersectionObserver = IntersectionObserverStub;

// jsdom doesn't implement BroadcastChannel either.
class BroadcastChannelStub {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(name: string) {
    this.name = name;
  }
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  close() {}
}
// @ts-expect-error -- test polyfill
globalThis.BroadcastChannel = BroadcastChannelStub;

vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
