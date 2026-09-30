import type { UIStrings } from "./en";
import { en } from "./en";
import { pt } from "./pt";

export const locales = ["en", "pt"] as const; // List of supported locales. Add new locales here when creating new translation files.
export type Locale = (typeof locales)[number]; // Type representing the supported locales
export const defaultLocale: Locale = "en"; // Default locale

export const LocaleCookies = "cyberpunk-red-calculator:locale"; // Cookie name for storing the selected locale

export const translations: Record<Locale, UIStrings> = {
  en,
  pt,
};

// Display names for the supported locales
export const displayNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
};

