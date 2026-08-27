/**
 * Outbound links to the people and places behind SagipMusica.
 *
 * Kept in one file because the same two pages are cited from the marketing
 * site, the auth screens and the footer, and a stale Facebook URL scattered
 * across four components is a link nobody notices has rotted.
 */

/** Lumnaire, who build and run SagipMusica. */
export const LUMNAIRE_FACEBOOK_URL = "https://www.facebook.com/lumnaireph";

/** The congregation SagipMusica was first written for. */
export const FBC_FACEBOOK_URL =
  "https://www.facebook.com/profile.php?id=100064525761388";

/**
 * Where a gift goes. Buy Me a Coffee rather than a bank QR: it settles cards,
 * GCash, Maya and PayPal, in pesos or in dollars, which is what it takes to
 * accept help from a church down the road and from someone abroad with the
 * same link. See SupportCard.
 */
export const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/lumnaire";

/** Who wrote it. Shown in Settings on both builds. */
export const DEVELOPER = {
  name: "Ronald Castromero",
  title: "Founder of Lumnaire",
} as const;
