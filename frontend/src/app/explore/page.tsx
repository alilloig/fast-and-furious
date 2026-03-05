"use client";

import { useMemo, useState } from "react";
import { PlaybookCard } from "@/components/skills/playbook-card";
import { PlaybookGrid } from "@/components/skills/playbook-grid";
import {
  ListingFilters,
  type ListingType,
  type SortOption,
} from "@/components/skills/listing-filters";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useListingsRegistry } from "@/hooks/use-listings-registry";
import { usePlaybookListings } from "@/hooks/use-playbook-listings";

export default function ExplorePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState<ListingType>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const { data: entries } = useListingsRegistry();
  const listingIds = entries?.map((e) => e.listingId) ?? [];
  const { data: playbooks, isLoading } = usePlaybookListings(listingIds);

  const filteredPlaybooks = useMemo(() => {
    let result = playbooks ?? [];
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
  }, [playbooks, search, category, sort]);

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
        ) : filteredPlaybooks.length === 0 ? (
          <EmptyState
            title="No results found"
            description="Try adjusting your filters or search terms."
          />
        ) : (
          <PlaybookGrid>
            {filteredPlaybooks.map((playbook) => (
              <PlaybookCard key={playbook.id} playbook={playbook} />
            ))}
          </PlaybookGrid>
        )}
      </div>
    </div>
  );
}
