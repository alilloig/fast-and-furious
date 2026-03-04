"use client";

import Link from "next/link";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { NotDeployedBanner } from "./not-deployed-banner";
import { MobileNav } from "./mobile-nav";

const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/purchases", label: "My Purchases" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <NotDeployedBanner />
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Fast & Furious
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ConnectButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
