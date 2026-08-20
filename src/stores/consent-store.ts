import { create } from "zustand";

const STORAGE_KEY = "sagipmusica.cookie-consent";
const CONSENT_VERSION = 1;

export interface ConsentCategories {
  /** Session/sign-in storage. Always on: the app cannot work without it. */
  necessary: true;
  /** Remembering interface choices beyond the current visit. */
  preferences: boolean;
  /** Usage measurement. Nothing is loaded unless this is granted. */
  analytics: boolean;
}

interface StoredConsent {
  version: number;
  decidedAt: string;
  categories: Omit<ConsentCategories, "necessary">;
}

interface ConsentState {
  /** null until the visitor has made a choice — that's when the banner shows. */
  consent: ConsentCategories | null;
  /** Open state of the "Customize" dialog. */
  customizeOpen: boolean;
  load: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  save: (categories: Omit<ConsentCategories, "necessary">) => void;
  openCustomize: () => void;
  setCustomizeOpen: (open: boolean) => void;
}

function persist(categories: Omit<ConsentCategories, "necessary">) {
  const payload: StoredConsent = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    categories,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing or storage disabled: the choice simply won't persist,
    // and the banner asks again next visit. Nothing to recover from.
  }
}

export const useConsentStore = create<ConsentState>((set) => ({
  consent: null,
  customizeOpen: false,

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredConsent;
      // A version bump means the categories changed materially, so the old
      // answer no longer covers what we're asking — ask again.
      if (parsed.version !== CONSENT_VERSION) return;
      set({
        consent: {
          necessary: true,
          preferences: !!parsed.categories.preferences,
          analytics: !!parsed.categories.analytics,
        },
      });
    } catch {
      // Unreadable value: treat as no decision.
    }
  },

  acceptAll: () => {
    const categories = { preferences: true, analytics: true };
    persist(categories);
    set({ consent: { necessary: true, ...categories }, customizeOpen: false });
  },

  rejectAll: () => {
    const categories = { preferences: false, analytics: false };
    persist(categories);
    set({ consent: { necessary: true, ...categories }, customizeOpen: false });
  },

  save: (categories) => {
    persist(categories);
    set({ consent: { necessary: true, ...categories }, customizeOpen: false });
  },

  openCustomize: () => set({ customizeOpen: true }),
  setCustomizeOpen: (open) => set({ customizeOpen: open }),
}));

/**
 * Gate for anything non-essential. Call this before loading a script or
 * writing storage that isn't required to sign in and use the app.
 */
export function hasConsent(category: "preferences" | "analytics"): boolean {
  const { consent } = useConsentStore.getState();
  return !!consent?.[category];
}
