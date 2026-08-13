import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** 180×180 Apple touch icon for "Add to Home Screen" on iOS. */
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
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          // iOS rounds the icon itself, so we don't need explicit radius.
        }}
      >
        <LogoMark size={124} />
      </div>
    ),
    { ...size },
  );
}
