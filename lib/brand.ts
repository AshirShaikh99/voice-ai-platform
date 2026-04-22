// One source of truth for brand surface copy. Change the name here and the
// whole platform — marketing, auth shell, dashboard, settings — updates.
export const BRAND = {
  name: "Creatigen",
  suffix: "voice platform",
  domain: "creatigen.com",
  tagline: "Voice agents that listen, speak, and resolve.",
  shortDescription:
    "Design conversational agents, give them your knowledge, and put them on your phone lines. Your team reviews every call — your customers never wait on hold.",
} as const;

export type Brand = typeof BRAND;
