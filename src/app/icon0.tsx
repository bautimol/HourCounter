import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

/**
 * 192×192 PWA icon. Solid emerald square with a stylized "H" mark — same
 * brand as the Clock3 + bg-accent square in the navbar / auth hero.
 */
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
          borderRadius: 36,
          color: "#ffffff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 130,
          fontWeight: 800,
          letterSpacing: -4,
          lineHeight: 1,
        }}
      >
        H
      </div>
    ),
    { ...size },
  );
}
