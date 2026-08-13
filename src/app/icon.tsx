import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Browser-tab icon.
 *
 * Exists as its own file because a favicon cannot be generated from code under
 * the `favicon.ico` name — Next only allows that for `icon`. The stock
 * favicon.ico that create-next-app ships was deleted along with this, since it
 * takes precedence over every generated icon and was still showing the Vercel
 * triangle in the tab.
 *
 * Rendered at 32px with a heavier stroke and a tighter square than the 192/512
 * icons: at tab size the normal 3.4 weight thins to under a pixel and the mark
 * turns to mush.
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
          borderRadius: 7,
        }}
      >
        <LogoMark size={26} strokeWidth={4.6} />
      </div>
    ),
    { ...size },
  );
}
