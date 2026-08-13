import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

/**
 * 192×192 PWA icon: the Clockity mark on the emerald square.
 *
 * The mark is drawn white on the gradient rather than emerald on transparent —
 * a home-screen icon sits on whatever wallpaper the user has, so it needs to
 * carry its own background.
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
        }}
      >
        <LogoMark size={132} />
      </div>
    ),
    { ...size },
  );
}
