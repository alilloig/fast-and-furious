"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SkillCard } from "@/components/skills/skill-card";
import { SkillGrid } from "@/components/skills/skill-grid";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useListingsRegistry } from "@/hooks/use-listings-registry";
import { useSkillListings } from "@/hooks/use-skill-listings";

export default function HomePage() {
  const { data: entries } = useListingsRegistry();
  const listingIds = entries?.map((e) => e.listingId) ?? [];
  const { data: skills, isLoading } = useSkillListings(listingIds);
  const featured = skills?.slice(0, 6) ?? [];

  return (
    <div>
      {/* Hero */}
      <section className="border-b py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto mb-6 w-32 md:w-40 animate-[bounce_3s_ease-in-out_infinite] drop-shadow-[0_0_25px_rgba(96,165,250,0.4)]">
            <Image
              src="/wooper.png"
              alt="Wooper mascot"
              width={160}
              height={160}
              priority
              className="rounded-2xl"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            AI Skills Marketplace
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Discover, buy, and sell AI skills — prompts, agents, and tool
            configurations — secured by Sui and encrypted with Seal.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/explore">Browse Skills</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/seller/dashboard">Sell Skills</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Skills */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Featured Skills</h2>
            <Button asChild variant="ghost">
              <Link href="/explore">View all</Link>
            </Button>
          </div>
          {isLoading ? (
            <LoadingSkeleton count={6} />
          ) : featured.length > 0 ? (
            <SkillGrid>
              {featured.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </SkillGrid>
          ) : (
            <p className="text-center text-muted-foreground">
              No skills listed yet. Be the first to publish!
            </p>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-2xl font-bold">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Browse",
                description:
                  "Discover AI skills listed by creators. Filter by category, tags, or search by keyword.",
              },
              {
                step: "2",
                title: "Purchase",
                description:
                  "Buy with SUI. Your payment is split between the seller and a small platform fee.",
              },
              {
                step: "3",
                title: "Decrypt & Use",
                description:
                  "Your purchase receipt unlocks the encrypted content via Seal. Download and use instantly.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="text-3xl font-bold">{skills?.length ?? 0}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Skills Listed
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">SUI</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Native Payments
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">E2E</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Encrypted Content
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
