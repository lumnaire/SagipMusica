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

// jsdom has no layout, so it implements no scrolling either. The Bible picker
// scrolls a verse reached by typing a reference into view, which is a no-op
// worth keeping rather than guarding at the call site.
Element.prototype.scrollIntoView = function scrollIntoView() {};

vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
