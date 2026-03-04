"use client";

import { useMemo, useState } from "react";
import { SkillCard } from "@/components/skills/skill-card";
import { PackageCard } from "@/components/skills/package-card";
import { SkillGrid } from "@/components/skills/skill-grid";
import {
  ListingFilters,
  type ListingType,
  type SortOption,
} from "@/components/skills/listing-filters";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useListingsRegistry } from "@/hooks/use-listings-registry";
import { useSkillListings } from "@/hooks/use-skill-listings";
import { usePackageListings } from "@/hooks/use-package-listings";

export default function ExplorePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState<ListingType>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const { data: entries } = useListingsRegistry();
  const listingIds = entries?.map((e) => e.listingId) ?? [];
  const { data: skills, isLoading: skillsLoading } = useSkillListings(listingIds);
  const { data: packages, isLoading: packagesLoading } = usePackageListings(listingIds);

  const isLoading = skillsLoading || packagesLoading;

  const filteredSkills = useMemo(() => {
    if (type === "packages") return [];
    let result = skills ?? [];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (category !== "all") {
      result = result.filter((s) => s.category === category);
    }
    if (sort === "price-asc") result = [...result].sort((a, b) => Number(a.price - b.price));
    if (sort === "price-desc") result = [...result].sort((a, b) => Number(b.price - a.price));
    if (sort === "newest") result = [...result].sort((a, b) => b.createdAtEpoch - a.createdAtEpoch);
    return result;
  }, [skills, search, category, type, sort]);

  const filteredPackages = useMemo(() => {
    if (type === "skills") return [];
    let result = packages ?? [];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }
    if (sort === "price-asc") result = [...result].sort((a, b) => Number(a.price - b.price));
    if (sort === "price-desc") result = [...result].sort((a, b) => Number(b.price - a.price));
    if (sort === "newest") result = [...result].sort((a, b) => b.createdAtEpoch - a.createdAtEpoch);
    return result;
  }, [packages, search, type, sort]);

  const hasResults = filteredSkills.length > 0 || filteredPackages.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Explore</h1>
      <ListingFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        type={type}
        onTypeChange={setType}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="mt-8">
        {isLoading ? (
          <LoadingSkeleton />
        ) : !hasResults ? (
          <EmptyState
            title="No results found"
            description="Try adjusting your filters or search terms."
          />
        ) : (
          <SkillGrid>
            {filteredSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
            {filteredPackages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </SkillGrid>
        )}
      </div>
    </div>
  );
}
