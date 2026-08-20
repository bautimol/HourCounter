import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Footer } from "@/components/footer";

/**
 * Shell for the public content pages (FAQ, soporte, términos, privacidad).
 *
 * Route group, so the URLs stay `/faq` and friends with no `/public` segment.
 * The navbar is the landing's — someone who arrives at these pages from a
 * search result or a footer link should still have a way to sign in, and
 * getting back to the pitch is what the logo is for.
 *
 * `pt-28` clears the fixed navbar; the landing does the same with its hero.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNavbar />
      <main className="flex-1 px-4 pb-16 pt-28 sm:pt-32">{children}</main>
      <Footer />
    </div>
  );
}
