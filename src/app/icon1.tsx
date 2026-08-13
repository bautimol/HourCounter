import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo";

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
        }}
      >
        <LogoMark size={300} />
      </div>
    ),
    { ...size },
  );
}
