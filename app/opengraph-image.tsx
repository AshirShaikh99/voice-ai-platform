import { ImageResponse } from "next/og";

import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load font: ${url}`);
  return res.arrayBuffer();
}

export default async function OpenGraphImage() {
  const [newsreaderItalic, geistMedium] = await Promise.all([
    loadFont(
      "https://cdn.jsdelivr.net/fontsource/fonts/newsreader@latest/latin-500-italic.ttf",
    ),
    loadFont(
      "https://cdn.jsdelivr.net/fontsource/fonts/geist@latest/latin-500-normal.ttf",
    ),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0f0f0d",
          backgroundImage:
            "radial-gradient(circle at 18% 12%, rgba(220,200,160,0.10), transparent 42%), radial-gradient(circle at 82% 88%, rgba(200,180,140,0.07), transparent 48%)",
          color: "#f2f0ea",
          fontFamily: "Geist",
        }}
      >
        {/* Top row: wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 22,
            letterSpacing: "-0.01em",
            color: "#f2f0ea",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid #2a2a27",
              background: "#171714",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 3, height: 11, background: "#f2f0ea", borderRadius: 1 }} />
              <div style={{ width: 3, height: 18, background: "#f2f0ea", borderRadius: 1 }} />
              <div style={{ width: 3, height: 24, background: "#f2f0ea", borderRadius: 1 }} />
              <div style={{ width: 3, height: 14, background: "#f2f0ea", borderRadius: 1 }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontWeight: 500 }}>{BRAND.name}</span>
            <span style={{ color: "#6e6b63", fontSize: 20 }}>
              / {BRAND.suffix}
            </span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              fontFamily: "Newsreader",
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 104,
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              color: "#f2f0ea",
              maxWidth: 960,
            }}
          >
            Creativity, in every<br />business call.
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.45,
              letterSpacing: "-0.005em",
              color: "#a5a299",
              maxWidth: 820,
            }}
          >
            Design the voice of your business. Draft an agent in plain language,
            put it on a real phone line — every call sounds like you.
          </div>
        </div>

        {/* Bottom row: rule + domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #2a2a27",
            paddingTop: 24,
          }}
        >
          <span
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              fontSize: 14,
              color: "#6e6b63",
            }}
          >
            Creative voice for business
          </span>
          <span style={{ fontSize: 18, color: "#a5a299" }}>
            {BRAND.domain}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Newsreader",
          data: newsreaderItalic,
          style: "italic",
          weight: 500,
        },
        {
          name: "Geist",
          data: geistMedium,
          style: "normal",
          weight: 500,
        },
      ],
    },
  );
}
