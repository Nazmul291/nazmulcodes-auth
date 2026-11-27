/**
 * Facts shown on /privacy and /terms. Review these before publishing:
 * changing a value here updates both pages.
 */
export const LEGAL = {
  /** Who runs the service. */
  operator: "NazmulCodes",
  /** Where people send privacy and account requests. Make sure this mailbox exists. */
  contactEmail: "info@nazmulcodes.org",
  /** Bump this whenever the text of either page changes materially. */
  lastUpdated: "November 26, 2026",
  serviceUrl: "https://auth.nazmulcodes.org",
  /** Apps that sign in through this service, listed for readers. */
  connectedProducts: ["Veltrix", "Stockly", "Badgify", "Kilo"],
} as const;

export const LEGAL_LINKS = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
] as const;
