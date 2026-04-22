import { ImageResponse } from "next/og";

export const size = { width: 256, height: 256 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f0d",
          borderRadius: 52,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 24, height: 72, background: "#f2f0ea", borderRadius: 6 }} />
          <div style={{ width: 24, height: 120, background: "#f2f0ea", borderRadius: 6 }} />
          <div style={{ width: 24, height: 168, background: "#f2f0ea", borderRadius: 6 }} />
          <div style={{ width: 24, height: 96, background: "#f2f0ea", borderRadius: 6 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
