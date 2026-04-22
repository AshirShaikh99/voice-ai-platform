// One source of truth for brand surface copy. Change the name here and the
// whole platform — marketing, auth shell, dashboard, settings — updates.
export const BRAND = {
  name: "Creatigen",
  suffix: "voice studio",
  domain: "creatigen.space",
  tagline: "Creativity, in every business call.",
  shortDescription:
    "Creatigen is where you design the voice of your business. Draft an agent in plain language, ground it in your knowledge, and put it on a real phone line. Every call sounds like you — and every call gets reviewed.",
} as const;

export type Brand = typeof BRAND;
