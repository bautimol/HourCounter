import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

/**
 * 192×192 PWA icon: the emerald mark on the app's near-black.
 *
 * It carries a background rather than shipping transparent, because a
 * home-screen icon lands on whatever wallpaper the user has. Dark ground with
 * the accent mark, matching the app itself — the inverse (solid emerald plate,
 * white mark) read as a generic badge and looked nothing like what opens when
 * you tap it.
 *
 * The manifest's background_color tracks this: the splash screen shows between
 * tap and first paint, and a white one behind a dark icon flashes.
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
          background: "linear-gradient(135deg, #0f0f13 0%, #07070a 100%)",
          borderRadius: 36,
        }}
      >
        <LogoMark size={132} color="#10b981" />
      </div>
    ),
    { ...size },
  );
}
