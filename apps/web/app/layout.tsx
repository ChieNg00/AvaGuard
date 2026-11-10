import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: "AvaGuard | Fuji risk signals", description: "Evidence-based ERC-20 risk signals. M1 foundation preview." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><header><Link className="brand" href="/">AvaGuard<span> / FUJI</span></Link><nav aria-label="Main navigation"><Link href="/">Scan</Link><Link href="/lookup">Lookup</Link></nav><span className="pill">M1 · Local foundation</span></header><main>{children}</main><footer>Signal scores describe observed signals, never safety certification. Coverage and confidence are required beside every future score.</footer></body></html>;
}
