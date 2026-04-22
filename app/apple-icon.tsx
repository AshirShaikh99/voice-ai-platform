import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 16, height: 48, background: "#f2f0ea", borderRadius: 4 }} />
          <div style={{ width: 16, height: 80, background: "#f2f0ea", borderRadius: 4 }} />
          <div style={{ width: 16, height: 116, background: "#f2f0ea", borderRadius: 4 }} />
          <div style={{ width: 16, height: 64, background: "#f2f0ea", borderRadius: 4 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
