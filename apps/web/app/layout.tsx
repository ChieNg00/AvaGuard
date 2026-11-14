import type { Metadata } from "next";
import Link from "next/link";
import { getServerConfig } from "../lib/server-config";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "AvaGuard | Fuji risk signals",
  description: "Evidence-based ERC-20 risk signals.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  const { headerPill } = getServerConfig();
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
          <span className="pill">{headerPill}</span>
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
