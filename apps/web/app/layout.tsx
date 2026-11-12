import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "AvaGuard | Fuji risk signals",
  description: "Evidence-based ERC-20 risk signals.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link className="brand" href="/">
            AvaGuard<span> / ERC-20</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/">Scan</Link>
            <Link href="/lookup">Lookup</Link>
          </nav>
          <span className="pill">
            {process.env.AVAGUARD_ENV === "local"
              ? "Local Anvil · 43113"
              : "Fuji reader · 43113"}
          </span>
        </header>
        <main>{children}</main>
        <footer>
          Signal scores describe observed signals, never safety certification.
          Coverage and confidence are required for interpretation.
        </footer>
      </body>
    </html>
  );
}
