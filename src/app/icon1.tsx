import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** 512×512 PWA icon (also serves the maskable variant). */
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
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          // Maskable safe zone: keep the mark inside the inner ~80% radius.
          borderRadius: 96,
          color: "#ffffff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 340,
          fontWeight: 800,
          letterSpacing: -10,
          lineHeight: 1,
        }}
      >
        H
      </div>
    ),
    { ...size },
  );
}
